import { sharedTopic } from './rosConnection.js';

// The occupancy grid.
//
// This topic is the app's single largest bandwidth cost — a full grid is
// hundreds of kilobytes and it is published rarely (map_server latches one
// message; SLAM republishes only as the map grows). The earlier approach of
// unsubscribing after the first message to save that bandwidth had a real
// failure mode: navigating away and back left the page with no map at all,
// because there was no new message to receive and nothing had kept the old one.
//
// Caching resolves both concerns at once. The grid is fetched once, held in
// memory, and replayed instantly to whoever mounts next; the ROS subscription
// closes as soon as the first grid arrives. Switching views is now free in both
// bandwidth and latency, and `refreshMap()` exists for the case where the map
// genuinely has changed.

const mapTopic = sharedTopic({
  name: '/map',
  messageType: 'nav_msgs/msg/OccupancyGrid',
  cache: true,
  oneShot: true,
});

/**
 * Subscribes to the occupancy grid. Delivers the cached grid immediately if one
 * has already been received.
 * @param {function} callback Called with the OccupancyGrid message.
 * @returns {function} Unsubscribe.
 */
export const subscribeToMap = (callback) => mapTopic.subscribe(callback);

/** Discards the cached grid and pulls a fresh one from the robot. */
export const refreshMap = () => mapTopic.refresh();

/** The cached grid, or null if none has been received yet. */
export const getCachedMap = () => mapTopic.getCached();
