import * as ROSLIB from 'roslib';

// Central ROS bridge connection shared across the entire app.
// Implements exponential-backoff auto-reconnect so the UI recovers
// automatically when the robot reboots or the WebSocket drops.

const ROS_URL = `ws://${import.meta.env.VITE_ROS_BRIDGE_IP}:9090`;

const ros = new ROSLIB.Ros({ url: ROS_URL });

let _retryDelay = 1000; // ms, doubles on each failure up to 16s

ros.on('connection', () => {
  _retryDelay = 1000; // reset backoff on successful connect
  console.log('[rosbridge] Connected');
});

ros.on('error', (error) => {
  console.error('[rosbridge] Error:', error);
});

ros.on('close', () => {
  console.warn(`[rosbridge] Closed. Reconnecting in ${_retryDelay}ms…`);
  setTimeout(() => {
    ros.connect(ROS_URL);
    _retryDelay = Math.min(_retryDelay * 2, 16000);
  }, _retryDelay);
});

export default ros;
