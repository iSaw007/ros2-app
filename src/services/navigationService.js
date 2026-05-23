import * as ROSLIB from 'roslib';
import ros from './rosConnection.js';

// This service handles triggering navigation missions using Nav2.
// It uses the ROS 2 Action API via roslibjs.

const navigateAction = new ROSLIB.Action({
  ros: ros,
  name: '/navigate_to_pose',
  actionType: 'nav2_msgs/action/NavigateToPose'
});

const backupAction = new ROSLIB.Action({
  ros: ros,
  name: '/backup',
  actionType: 'nav2_msgs/action/BackUp'
});

/**
 * Sends a goal to the NavigateToPose action server.
 * @param {number} x - The x coordinate in the map frame.
 * @param {number} y - The y coordinate in the map frame.
 * @param {number} theta - The yaw angle in radians (default 0).
 * @param {function} onFeedback - Callback for feedback (current_pose, distance_remaining, etc.).
 * @param {function} onResult - Callback for final result.
 */
export const sendWaypoint = (x, y, theta = 0, onFeedback, onResult) => {
  const goalMessage = {
    pose: {
      header: {
        frame_id: 'map'
      },
      pose: {
        position: {
          x: x,
          y: y,
          z: 0.0
        },
        orientation: {
          x: 0.0,
          y: 0.0,
          z: Math.sin(theta / 2),
          w: Math.cos(theta / 2)
        }
      }
    },
    behavior_tree: ''
  };

  navigateAction.sendGoal(
    goalMessage,
    (result) => {
      if (onResult) onResult(result);
    },
    (feedback) => {
      if (onFeedback) onFeedback(feedback);
    }
  );
};

/**
 * Cancels the current navigation goal.
 */
export const cancelNavigation = () => {
  navigateAction.cancel();
  backupAction.cancel();
};

/**
 * Sends a goal to the BackUp action server to back away from an obstacle or dock.
 * @param {number} distance - The distance to back up in meters (positive value).
 * @param {number} speed - The speed in m/s (positive value).
 * @param {function} onFeedback - Callback for feedback (distance_traveled).
 * @param {function} onResult - Callback for final result.
 */
export const sendBackup = (distance = 0.4, speed = 0.1, onFeedback, onResult) => {
  const goalMessage = {
    target: {
      x: -distance, // Negative X is backwards in base frame
      y: 0.0,
      z: 0.0
    },
    speed: speed,
    time_allowance: {
      sec: 20,
      nanosec: 0
    }
  };

  backupAction.sendGoal(
    goalMessage,
    (result) => {
      if (onResult) onResult(result);
    },
    (feedback) => {
      if (onFeedback) onFeedback(feedback);
    }
  );
};
