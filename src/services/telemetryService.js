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
 * @param {function} callback - Function called with (x, y, yaw) values.
 * @returns {object} The listener topic object (useful for unsubscribing).
 */
export const subscribeToPose = (callback) => {
  poseListener.subscribe((message) => {
    const x = message.pose.pose.position.x;
    const y = message.pose.pose.position.y;
    
    // Extract yaw heading from quaternion (planar robot)
    const q = message.pose.pose.orientation;
    const yaw = Math.atan2(2.0 * (q.w * q.z + q.x * q.y), 1.0 - 2.0 * (q.y * q.y + q.z * q.z));
    
    callback(x, y, yaw);
  });
  
  return poseListener;
};

/**
 * Unsubscribes from pose updates.
 */
export const unsubscribeFromPose = () => {
  poseListener.unsubscribe();
};
