import * as ROSLIB from 'roslib';

// Central rosbridge connection shared by the whole app, plus the shared-topic
// registry every service is built on.
//
// Two problems this module exists to solve:
//
//  1. Reconnection. The robot reboots, the Wi-Fi drops, rosbridge restarts.
//     The UI has to recover on its own without a page reload.
//
//  2. Subscription ownership. roslibjs `Topic.unsubscribe()` called with no
//     argument tears down the ROS-level subscription but leaves every
//     registered 'message' listener attached (see RosLib.js, Topic#unsubscribe).
//     With module-level singleton topics that means two components sharing one
//     topic will fight: whichever unmounts first kills the ROS subscription for
//     the other, while its own dead callback stays attached and leaks.
//     `sharedTopic()` below fixes this with reference counting — the ROS
//     subscription lives exactly as long as at least one consumer wants it.

const ROS_URL = `ws://${import.meta.env.VITE_ROS_BRIDGE_IP}:9090`;

const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 16000;

const ros = new ROSLIB.Ros({ url: ROS_URL });

let retryDelay = RETRY_MIN_MS;
let retryTimer = null;

ros.on('connection', () => {
  retryDelay = RETRY_MIN_MS; // reset backoff on a successful connect
  console.info('[rosbridge] connected:', ROS_URL);
});

ros.on('error', () => {
  // roslib emits 'close' right after 'error', so reconnection is handled there.
  // Logged at debug level because a disconnected robot would otherwise spam
  // the console with an error every retry.
  console.debug('[rosbridge] socket error');
});

ros.on('close', () => {
  if (retryTimer) return; // a retry is already pending
  const delay = retryDelay;
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  console.warn(`[rosbridge] closed — retrying in ${delay}ms`);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    ros.connect(ROS_URL);
  }, delay);
});

/** Force an immediate reconnect attempt, bypassing the backoff timer. */
export const reconnectNow = () => {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryDelay = RETRY_MIN_MS;
  ros.connect(ROS_URL);
};

export const bridgeUrl = ROS_URL;

// A handle on the live connection while developing, for poking at topics and
// services from the browser console. Stripped from production builds.
if (import.meta.env.DEV) {
  window.__ros = ros;
}

/**
 * Calls a ROS service, with a timeout and an explicit type.
 *
 * The timeout is the point of this helper. A rosbridge request that never comes
 * back leaves the caller waiting forever — no success, no error, nothing to
 * show the operator. That is intolerable for the cancel button, where silence
 * is indistinguishable from "the robot ignored you" while it keeps moving.
 *
 * On ROS 2 Humble this is not merely belt and braces. rosbridge ships with
 * `default_call_service_timeout` at 0.0 and `call_services_in_new_thread` at
 * false — it says so itself in two warnings at startup — which together mean a
 * service call that does not get a prompt answer blocks rosbridge's main thread
 * and never times out. No response is ever sent, to this client or any other.
 * That is observable here: cancelling a docking mission mid-flight can hang
 * indefinitely, because the coordinator is busy driving.
 *
 * The robot's launch configuration is the real place to fix that (pass
 * `call_services_in_new_thread:=true` and a non-zero
 * `default_call_service_timeout` to rosbridge). Until it is, this timer is what
 * stands between the operator and a cancel button that silently does nothing.
 * A `timeout` is sent with the request as well, for a rosbridge configured
 * sensibly enough to honour it.
 *
 * Sending `type` is a smaller matter: roslibjs omits it, leaving rosbridge to
 * resolve the type from the ROS graph. That lookup does work — hidden services
 * such as an action's `_action/cancel_goal` included — so this is belt and
 * braces against a service that has not yet been discovered, not a workaround.
 *
 * Note for anyone extending this: roslibjs v2 removed the `ServiceRequest`
 * constructor that v1 exported. Request payloads are plain objects now, and
 * `new ROSLIB.ServiceRequest(...)` throws a TypeError that, thrown inside an
 * event handler, disappears without trace.
 *
 * @param {object}   options
 * @param {string}   options.name       Service name.
 * @param {string}   options.type       Service type.
 * @param {object}   options.args       Request payload.
 * @param {number}   [options.timeoutMs] How long to wait for a response.
 * @param {function} onResult           Called with the response values.
 * @param {function} onError            Called with an error message.
 */
export const callServiceTyped = ({ name, type, args, timeoutMs = 15000 }, onResult, onError) => {
  const id = `call_service:${name}:${Math.random().toString(36).slice(2)}`;
  let settled = false;

  // Give rosbridge a deadline comfortably inside our own, so that when a
  // service is slow it is rosbridge that reports it, with a reason.
  const serverTimeoutSec = Math.max(1, Math.round((timeoutMs - 5000) / 1000));

  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    onError?.(`No response from ${name} within ${timeoutMs} ms.`);
  }, timeoutMs);

  ros.once(id, (message) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (message.result) onResult?.(message.values);
    else onError?.(message.values ?? 'Service call failed.');
  });

  try {
    ros.callOnConnection({
      op: 'call_service',
      id,
      type,
      service: name,
      args,
      timeout: serverTimeoutSec,
    });
  } catch (error) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    onError?.(String(error));
  }
};

/**
 * Creates a reference-counted, optionally caching subscription to a ROS topic.
 *
 * @param {object}  options
 * @param {string}  options.name          Topic name.
 * @param {string}  options.messageType   ROS message type.
 * @param {boolean} options.cache         Retain the last message and replay it
 *                                        to consumers that subscribe later.
 * @param {boolean} options.oneShot       Drop the ROS subscription after the
 *                                        first message. Only meaningful with
 *                                        `cache`, which then serves everyone
 *                                        else. Used for the occupancy grid,
 *                                        which is large and rarely changes.
 * @returns {{subscribe: function, getCached: function, refresh: function, clearCache: function}}
 */
export const sharedTopic = ({ name, messageType, cache = false, oneShot = false }) => {
  const topic = new ROSLIB.Topic({ ros, name, messageType });

  const consumers = new Set();
  let cached = null;
  let rosSubscribed = false;

  const onMessage = (message) => {
    if (cache) cached = message;
    // Copy before iterating: a consumer may unsubscribe from inside its callback.
    for (const fn of [...consumers]) fn(message);

    if (oneShot && rosSubscribed) {
      topic.unsubscribe(onMessage);
      rosSubscribed = false;
    }
  };

  const openRosSubscription = () => {
    if (rosSubscribed) return;
    rosSubscribed = true;
    topic.subscribe(onMessage);
  };

  const closeRosSubscription = () => {
    if (!rosSubscribed) return;
    // Pass the callback explicitly. roslib only tears the subscription down
    // once no 'message' listeners remain, and it actually detaches ours —
    // the no-argument form does neither correctly.
    topic.unsubscribe(onMessage);
    rosSubscribed = false;
  };

  return {
    /**
     * @param {function} callback Called with each message. If a cached message
     *   exists it is delivered synchronously on subscribe, so a remounting
     *   component renders immediately instead of waiting for a publisher that
     *   may never publish again.
     * @returns {function} Unsubscribe. Idempotent.
     */
    subscribe(callback) {
      consumers.add(callback);
      if (cache && cached !== null) callback(cached);
      // A one-shot topic that already has its message needs no live subscription.
      if (!(oneShot && cached !== null)) openRosSubscription();

      let done = false;
      return () => {
        if (done) return;
        done = true;
        consumers.delete(callback);
        if (consumers.size === 0) closeRosSubscription();
      };
    },

    getCached: () => cached,

    /** Drop the cache and re-open the subscription to pull a fresh message. */
    refresh() {
      cached = null;
      closeRosSubscription();
      openRosSubscription();
    },

    clearCache() {
      cached = null;
    },
  };
};

export default ros;
