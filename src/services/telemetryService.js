import * as ROSLIB from 'roslib';
import ros from './rosConnection.js';

// This service handles receiving data from the robot.
// It subscribes to the '/amcl_pose' topic.

const poseListener = new ROSLIB.Topic({
  ros: ros,
  name: '/amcl_pose',
  messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped'
});

/**
 * Subscribes to pose updates.
 * @param {function} callback - Function called with (x, y) coordinates.
 * @returns {object} The listener topic object (useful for unsubscribing).
 */
export const subscribeToPose = (callback) => {
  poseListener.subscribe((message) => {
    const x = message.pose.pose.position.x;
    const y = message.pose.pose.position.y;
    callback(x, y);
  });
  
  return poseListener;
};

/**
 * Unsubscribes from pose updates.
 */
export const unsubscribeFromPose = () => {
  poseListener.unsubscribe();
};
