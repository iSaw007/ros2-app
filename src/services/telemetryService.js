import { sharedTopic } from './rosConnection.js';

// Robot pose, as estimated by AMCL against the static map.
//
// Both the Overview page and the map canvas want this at the same time, so it
// is reference-counted and cached: the ROS subscription exists while at least
// one of them is mounted, and a component mounting later gets the last known
// pose immediately rather than rendering an empty placeholder until the next
// AMCL update (which, by design, only fires once the robot has moved past
// AMCL's own update thresholds — that can be a long wait on a stationary robot).

const poseTopic = sharedTopic({
  name: '/amcl_pose',
  messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped',
  cache: true,
});

/** Yaw from a quaternion, for a robot confined to the ground plane. */
const yawFromQuaternion = (q) =>
  Math.atan2(2.0 * (q.w * q.z + q.x * q.y), 1.0 - 2.0 * (q.y * q.y + q.z * q.z));

/**
 * Subscribes to pose updates.
 * @param {function} callback Called with ({x, y, yaw}).
 * @returns {function} Unsubscribe.
 */
export const subscribeToPose = (callback) =>
  poseTopic.subscribe((message) => {
    const { position, orientation } = message.pose.pose;
    callback({
      x: position.x,
      y: position.y,
      yaw: yawFromQuaternion(orientation),
    });
  });

/** Last known pose, or null if none has arrived yet. */
export const getLastPose = () => {
  const message = poseTopic.getCached();
  if (!message) return null;
  const { position, orientation } = message.pose.pose;
  return { x: position.x, y: position.y, yaw: yawFromQuaternion(orientation) };
};
