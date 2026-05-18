import * as ROSLIB from 'roslib';
import ros from './rosConnection.js';

// This service handles sending velocity commands to the robot.
// It publishes to the '/cmd_vel' topic.

const cmdVel = new ROSLIB.Topic({
  ros: ros,
  name: '/cmd_vel',
  messageType: 'geometry_msgs/msg/Twist'
});

/**
 * Sends a velocity command to the robot.
 * @param {number} linearX - Linear velocity in m/s.
 * @param {number} angularZ - Angular velocity in rad/s.
 */
export const drive = (linearX, angularZ) => {
  const message = {
    linear: { x: linearX, y: 0.0, z: 0.0 },
    angular: { x: 0.0, y: 0.0, z: angularZ }
  };
  cmdVel.publish(message);
};

/**
 * Stops the robot by sending zero velocity.
 */
export const stop = () => {
  drive(0.0, 0.0);
};
