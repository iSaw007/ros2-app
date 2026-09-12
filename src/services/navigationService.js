import * as ROSLIB from 'roslib';
import ros, { sharedTopic } from './rosConnection.js';

// Nav2 point-to-point navigation and the back-up recovery behaviour.
//
// Both use roslibjs's ROS 2 Action API, which requires holding the goal id
// returned by sendGoal in order to cancel, and a fourth failure callback to
// learn about any terminal outcome other than success. See dockingService.js
// for the full explanation.
//
// `/backup` is served by Nav2's behavior_server, which is launched by
// nav2_unified.launch.py with "backup" in its behavior_plugins list. Earlier
// revisions of this app fired the goal and ignored the response on the
// assumption that no server existed; it does exist, and its result is used.

const navigateAction = new ROSLIB.Action({
  ros,
  name: '/navigate_to_pose',
  actionType: 'nav2_msgs/action/NavigateToPose',
});

const backupAction = new ROSLIB.Action({
  ros,
  name: '/backup',
  actionType: 'nav2_msgs/action/BackUp',
});

// The path the planner intends to follow, republished on every replan.
//
// Subscribed only while a goal is actually running: it is a few hundred poses
// of pure diagnostics, worth nothing to an idle operator, and the same
// spend-it-where-it-earns-its-keep reasoning applies here as everywhere else.
const planTopic = sharedTopic({
  name: '/plan',
  messageType: 'nav_msgs/msg/Path',
});

/**
 * Subscribes to the current planned path.
 * @param {function} callback Called with an array of {x, y} in map coordinates.
 * @returns {function} Unsubscribe.
 */
export const subscribeToPlan = (callback) =>
  planTopic.subscribe((message) =>
    callback(
      (message.poses ?? []).map((entry) => ({
        x: entry.pose.position.x,
        y: entry.pose.position.y,
      })),
    ),
  );

let navGoalId = null;
let backupGoalId = null;

/**
 * Sends a NavigateToPose goal in the map frame.
 *
 * @param {object}   options
 * @param {number}   options.x          Target x, metres.
 * @param {number}   options.y          Target y, metres.
 * @param {number}   options.theta      Target yaw, radians.
 * @param {function} options.onFeedback Called with ({distanceRemaining}).
 * @param {function} options.onResult   Called with ({success, message}).
 */
export const sendWaypoint = ({ x, y, theta = 0, onFeedback, onResult }) => {
  const settle = (outcome) => {
    navGoalId = null;
    onResult?.(outcome);
  };

  navGoalId = navigateAction.sendGoal(
    {
      pose: {
        header: { frame_id: 'map' },
        pose: {
          position: { x, y, z: 0.0 },
          orientation: { x: 0.0, y: 0.0, z: Math.sin(theta / 2), w: Math.cos(theta / 2) },
        },
      },
      behavior_tree: '',
    },
    () => settle({ success: true, message: '' }),
    (feedback) => {
      onFeedback?.({
        distanceRemaining:
          typeof feedback.distance_remaining === 'number' ? feedback.distance_remaining : null,
      });
    },
    (error) => settle({ success: false, message: String(error) }),
  );

  if (!navGoalId) {
    settle({ success: false, message: 'Could not send goal — no connection to the robot.' });
    return false;
  }
  return true;
};

/** Cancels the running navigation goal, if any. */
export const cancelNavigation = () => {
  if (navGoalId) navigateAction.cancelGoal(navGoalId);
};

/**
 * Backs the robot straight out — used to leave the dock before navigating.
 *
 * @param {object}   options
 * @param {number}   options.distance   Metres to travel backwards, positive.
 * @param {number}   options.speed      Metres per second, positive.
 * @param {function} options.onFeedback Called with ({distanceTravelled}).
 * @param {function} options.onResult   Called with ({success, message}).
 */
export const sendBackup = ({ distance = 0.4, speed = 0.1, onFeedback, onResult }) => {
  const settle = (outcome) => {
    backupGoalId = null;
    onResult?.(outcome);
  };

  backupGoalId = backupAction.sendGoal(
    {
      // Nav2's BackUp behaviour takes the target as a displacement in the robot
      // frame; negative x is backwards.
      target: { x: -Math.abs(distance), y: 0.0, z: 0.0 },
      speed,
      time_allowance: { sec: 20, nanosec: 0 },
    },
    () => settle({ success: true, message: '' }),
    (feedback) => {
      onFeedback?.({
        distanceTravelled:
          typeof feedback.distance_traveled === 'number' ? feedback.distance_traveled : null,
      });
    },
    (error) => settle({ success: false, message: String(error) }),
  );

  if (!backupGoalId) {
    settle({ success: false, message: 'Could not send goal — no connection to the robot.' });
    return false;
  }
  return true;
};

/** Cancels the running back-up behaviour, if any. */
export const cancelBackup = () => {
  if (backupGoalId) backupAction.cancelGoal(backupGoalId);
};

/** Cancels every motion goal this service owns. */
export const cancelAllMotion = () => {
  cancelNavigation();
  cancelBackup();
};
