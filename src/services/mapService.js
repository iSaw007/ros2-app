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
  // map_server latches the grid and publishes it once. Matching its
  // TRANSIENT_LOCAL durability is what makes the retained message reach a
  // subscriber that connects afterwards — which is almost always, since the
  // robot is usually already running when a browser opens.
  qos: {
    history: 'keep_last',
    depth: 1,
    reliability: 'reliable',
    durability: 'transient_local',
  },
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

/**
 * A short identifier for the loaded map.
 *
 * Saved waypoints are coordinates in the map frame, which makes them
 * meaningless against a different map: re-run SLAM, get an origin a few
 * centimetres off, and every stored location quietly points somewhere else. An
 * OccupancyGrid carries no name or id, so one is derived from its geometry plus
 * a cheap checksum over a strided sample of the cells.
 *
 * This identifies a map well enough to catch the case that matters — a
 * different map loaded than the one a location was saved against. Two genuinely
 * distinct maps that share dimensions, resolution, origin AND sample checksum
 * would collide, which is unlikely enough to accept and not worth hashing
 * hundreds of kilobytes on every comparison to rule out.
 */
export const mapFingerprint = (message) => {
  if (!message?.info) return null;
  const { width, height, resolution, origin } = message.info;

  let checksum = 0;
  const cells = message.data ?? [];
  // Every 97th cell: a prime stride, so the sample does not align with the
  // grid's row width and miss whole structural features.
  for (let i = 0; i < cells.length; i += 97) {
    checksum = (checksum + (cells[i] + 1) * (i + 1)) % 1000000007;
  }

  const ox = Number(origin?.position?.x ?? 0).toFixed(3);
  const oy = Number(origin?.position?.y ?? 0).toFixed(3);
  return `${width}x${height}@${Number(resolution).toFixed(3)}+${ox},${oy}#${checksum}`;
};
