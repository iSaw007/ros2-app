import * as ROSLIB from 'roslib';
import ros from './rosConnection.js';

// Manual velocity commands.
//
// Published straight to the diff_drive_controller rather than to /cmd_vel: on
// ROS 2 Humble the controller subscribes to an unstamped Twist on this topic,
// and the simulation bringup bridges /cmd_vel onto it. Publishing here works
// against both the simulated and the real robot without relying on that bridge.

const cmdVel = new ROSLIB.Topic({
  ros,
  name: '/diff_drive_controller/cmd_vel_unstamped',
  messageType: 'geometry_msgs/msg/Twist',
});

/**
 * Sends a velocity command.
 * @param {number} linearX  Forward velocity, m/s.
 * @param {number} angularZ Yaw rate, rad/s.
 */
export const drive = (linearX, angularZ) => {
  cmdVel.publish({
    linear: { x: linearX, y: 0.0, z: 0.0 },
    angular: { x: 0.0, y: 0.0, z: angularZ },
  });
};

/**
 * Commands zero velocity.
 *
 * Always published, never skipped as redundant. The controller stops on its own
 * when commands stop arriving, but an explicit zero is what makes the stop
 * immediate and deliberate rather than a timeout.
 */
export const stop = () => drive(0.0, 0.0);
