import * as ROSLIB from 'roslib';
import ros from './rosConnection.js';

// This service handles receiving the map data.
// It subscribes to the '/map' topic.

const mapListener = new ROSLIB.Topic({
  ros: ros,
  name: '/map',
  messageType: 'nav_msgs/msg/OccupancyGrid'
});

/**
 * Subscribes to map updates.
 * @param {function} callback - Function called with the map message object.
 * @param {boolean} unsubscribeImmediately - If true, unsubscribes after first message to save bandwidth.
 */
export const getMapData = (callback, unsubscribeImmediately = true) => {
  mapListener.subscribe((message) => {
    callback(message);
    
    if (unsubscribeImmediately) {
      console.log('Unsubscribing from map to save bandwidth.');
      mapListener.unsubscribe();
    }
  });
};
