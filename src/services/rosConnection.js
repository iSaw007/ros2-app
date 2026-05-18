import * as ROSLIB from 'roslib';

// This service handles the central connection to the ROS bridge.
// It shares a single 'ros' instance across the application.

const ros = new ROSLIB.Ros({
  url: 'ws://localhost:9090'
});

ros.on('connection', () => {
  console.log('Connected to rosbridge-server!');
});

ros.on('error', (error) => {
  console.error('Error connecting to rosbridge-server:', error);
});

ros.on('close', () => {
  console.log('Connection to rosbridge-server closed.');
});

export default ros;
