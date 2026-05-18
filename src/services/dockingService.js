import * as ROSLIB from 'roslib';
import ros from './rosConnection.js';

// This service handles triggering the autonomous docking mission.
// It uses the ROS 2 Action API via roslibjs.

const dockAction = new ROSLIB.Action({
  ros: ros,
  name: '/dock',
  actionType: 'yahboomcar_msgs/action/Dock'
});

/**
 * Sends a goal to the docking action server.
 * @param {string} dockId - The ID of the dock (e.g., 'default').
 * @param {boolean} cancelNav - Whether to cancel Nav2 navigation.
 * @param {function} onFeedback - Callback for feedback (state, distance).
 * @param {function} onResult - Callback for final result.
 */
export const startDocking = (dockId = 'default', cancelNav = true, onFeedback, onResult) => {
  const goalMessage = {
    dock_id: dockId,
    cancel_nav: cancelNav
  };

  dockAction.sendGoal(
    goalMessage,
    (result) => {
      if (onResult) onResult(result);
    },
    (feedback) => {
      if (onFeedback) onFeedback(feedback);
    }
  );
};
