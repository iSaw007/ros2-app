import { sharedTopic } from './rosConnection.js';

// Robot pose, as estimated by AMCL against the static map.
//
// Both the Overview page and the map canvas want this at the same time, so it
// is reference-counted and cached: the ROS subscription exists while at least
// one of them is mounted, and a component mounting later gets the last known
// pose immediately rather than rendering an empty placeholder until the next
// AMCL update (which, by design, only fires once the robot has moved past
// AMCL's own update thresholds — that can be a long wait on a stationary robot).

const poseTopic = sharedTopic({
  name: '/amcl_pose',
  messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped',
  cache: true,
});

/** Yaw from a quaternion, for a robot confined to the ground plane. */
const yawFromQuaternion = (q) =>
  Math.atan2(2.0 * (q.w * q.z + q.x * q.y), 1.0 - 2.0 * (q.y * q.y + q.z * q.z));

/**
 * Subscribes to pose updates.
 * @param {function} callback Called with ({x, y, yaw}).
 * @returns {function} Unsubscribe.
 */
export const subscribeToPose = (callback) =>
  poseTopic.subscribe((message) => {
    const { position, orientation } = message.pose.pose;
    callback({
      x: position.x,
      y: position.y,
      yaw: yawFromQuaternion(orientation),
    });
  });

/** Last known pose, or null if none has arrived yet. */
export const getLastPose = () => {
  const message = poseTopic.getCached();
  if (!message) return null;
  const { position, orientation } = message.pose.pose;
  return { x: position.x, y: position.y, yaw: yawFromQuaternion(orientation) };
};

// The robot's collision outline, as Nav2 actually models it.
//
// Drawing the robot at its true size is what makes clearances readable: a
// fixed-size marker says nothing about whether the robot fits through a gap,
// and shrinks into meaninglessness as you zoom in. This is the same polygon the
// local costmap checks against, so when a path refuses an obvious shortcut the
// picture explains why.
//
// Only the polygon's *shape* is used, measured from its own centroid. The
// message is published in the costmap's frame, and taking the shape alone means
// it can be drawn at the robot's known map pose without needing any transform.
const footprintTopic = sharedTopic({
  name: '/local_costmap/published_footprint',
  messageType: 'geometry_msgs/msg/PolygonStamped',
  cache: true,
  oneShot: true,
  qos: {
    history: 'keep_last',
    depth: 1,
    reliability: 'best_effort',
    durability: 'volatile',
  },
});

/** Radius of this robot's footprint in metres, from nav2_params robot_radius. */
export const DEFAULT_FOOTPRINT_RADIUS_M = 0.22;

/**
 * Subscribes to the robot's footprint radius.
 *
 * Reports a radius rather than the polygon itself: this robot is configured
 * with `robot_radius`, so its footprint is a circle that Nav2 approximates as a
 * many-sided polygon. A radius is the honest summary and is far cheaper to draw
 * at every frame.
 *
 * @param {function} callback Called with the radius in metres.
 * @returns {function} Unsubscribe.
 */
export const subscribeToFootprintRadius = (callback) =>
  footprintTopic.subscribe((message) => {
    const points = message?.polygon?.points ?? [];
    if (points.length < 3) return;

    const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    const radius =
      points.reduce((sum, p) => sum + Math.hypot(p.x - cx, p.y - cy), 0) / points.length;

    if (Number.isFinite(radius) && radius > 0.01) callback(radius);
  });
