import * as ROSLIB from 'roslib';
import ros, { sharedTopic, callServiceTyped } from './rosConnection.js';

// Autonomous docking, driven by the dock_coordinator action server.
//
// Two details of roslibjs's ROS 2 Action API shape this module:
//
//   * There is no `cancel()`. Cancelling requires the goal id returned by
//     `sendGoal`, passed to `cancelGoal(id)`. The id therefore has to be held
//     for the lifetime of the mission — a cancel button that cannot cancel is
//     worse than no cancel button, because the robot is moving when it is used.
//
//   * `sendGoal`'s result callback fires only on STATUS_SUCCEEDED. Every other
//     terminal outcome (aborted, rejected, cancelled) goes to the fourth
//     argument, which defaults to `console.error`. Without it the UI never
//     learns a mission ended and sits "in progress" indefinitely.
//
// Those callbacks only exist for a goal this browser tab sent, which is the
// wrong basis for a display: reload the page mid-mission and the robot is still
// driving while the tab has forgotten everything. So the mission's *state* is
// not read from them at all. Every ROS 2 action also publishes its progress on
// two hidden topics, and rosbridge serves them like any other:
//
//     /dock/_action/feedback   the live feedback, plus the goal's id
//     /dock/_action/status     goal state transitions (action_msgs/GoalStatusArray)
//
// Reading those makes the robot the source of truth. A tab that just loaded
// picks up a mission already running, and so does a second device opening the
// dashboard alongside the first. The action client is then only used to *start*
// a mission, never to know what it is doing.

const dockAction = new ROSLIB.Action({
  ros,
  name: '/dock',
  actionType: 'yahboomcar_msgs/action/Dock',
});

/**
 * States reported by dock_coordinator's feedback.
 *
 * STAGING is published as a literal string while the coordinator drives to the
 * staging pose under Nav2; the rest are the names of its DockState enum. LOST
 * is a transient recovery state, not a step of the mission — the coordinator
 * enters it when the marker has been out of view too long, and either reacquires
 * or falls back to SEARCHING.
 */
export const DOCK_STATES = {
  STAGING: 'STAGING',
  STAGING_CORRECTION: 'STAGING_CORRECTION',
  SEARCHING: 'SEARCHING',
  TRACKING: 'TRACKING',
  APPROACH: 'APPROACH',
  LOST: 'LOST',
  DOCKED: 'DOCKED',
};

/** The mission's nominal progression. LOST is deliberately absent. */
export const DOCK_PIPELINE = [
  DOCK_STATES.STAGING,
  DOCK_STATES.STAGING_CORRECTION,
  DOCK_STATES.SEARCHING,
  DOCK_STATES.TRACKING,
  DOCK_STATES.APPROACH,
  DOCK_STATES.DOCKED,
];

/** action_msgs/msg/GoalStatus constants. */
export const GOAL_STATUS = {
  UNKNOWN: 0,
  ACCEPTED: 1,
  EXECUTING: 2,
  CANCELING: 3,
  SUCCEEDED: 4,
  CANCELED: 5,
  ABORTED: 6,
};

const TERMINAL_STATUSES = [GOAL_STATUS.SUCCEEDED, GOAL_STATUS.CANCELED, GOAL_STATUS.ABORTED];
export const isTerminalStatus = (status) => TERMINAL_STATUSES.includes(status);

const feedbackTopic = sharedTopic({
  name: '/dock/_action/feedback',
  messageType: 'yahboomcar_msgs/action/Dock_FeedbackMessage',
});

const statusTopic = sharedTopic({
  name: '/dock/_action/status',
  messageType: 'action_msgs/msg/GoalStatusArray',
});

/**
 * Follows whatever docking mission the robot is running, whether or not this
 * tab started it.
 *
 * Feedback is the liveness signal: the coordinator publishes it continuously
 * while a mission executes, so its arrival means a mission is in progress.
 * Status is transition-only — it is how a mission's end is learned, but it
 * cannot be relied on to announce a mission that was already running before
 * this subscription existed.
 *
 * @param {object}   options
 * @param {function} options.onFeedback Called with ({goalId, state, distanceM, markerAreaPx2, errorXPx}).
 * @param {function} options.onStatus   Called with ({goalId, status}) on each transition.
 * @returns {function} Unsubscribe.
 */
export const watchDockMission = ({ onFeedback, onStatus }) => {
  const stopFeedback = feedbackTopic.subscribe((message) => {
    const feedback = message.feedback ?? {};
    onFeedback?.({
      goalId: message.goal_id?.uuid ?? null,
      state: feedback.state,
      distanceM: typeof feedback.distance_m === 'number' ? feedback.distance_m : null,
      markerAreaPx2: typeof feedback.marker_area_px2 === 'number' ? feedback.marker_area_px2 : null,
      errorXPx: typeof feedback.error_x_px === 'number' ? feedback.error_x_px : null,
    });
  });

  const stopStatus = statusTopic.subscribe((message) => {
    for (const entry of message.status_list ?? []) {
      onStatus?.({
        goalId: entry.goal_info?.goal_id?.uuid ?? null,
        status: entry.status,
      });
    }
  });

  return () => {
    stopFeedback();
    stopStatus();
  };
};

/**
 * Starts a docking mission.
 *
 * Progress is not reported here — follow `watchDockMission` for that. The
 * result callback is kept only because it carries the coordinator's own
 * explanatory message, which the status topic does not.
 *
 * @param {object}   options
 * @param {string}   options.dockId    Key into dock.yaml's dock database.
 * @param {boolean}  options.cancelNav Cancel any running Nav2 task first.
 * @param {function} options.onResult  Called with ({success, message}).
 * @returns {boolean} False if the goal could not be sent.
 */
export const startDocking = ({ dockId = 'default', cancelNav = true, onResult }) => {
  const goalId = dockAction.sendGoal(
    { dock_id: dockId, cancel_nav: cancelNav },
    (result) => onResult?.({ success: !!result.success, message: result.message ?? '' }),
    undefined,
    (error) => onResult?.({ success: false, message: String(error) }),
  );

  // sendGoal returns undefined if the action is advertised rather than called.
  if (!goalId) {
    onResult?.({ success: false, message: 'Could not send goal — no connection to the robot.' });
    return false;
  }
  return true;
};

/**
 * Cancels the docking mission.
 *
 * Goes through the action's own cancel service rather than roslibjs's
 * `cancelGoal`, which can only cancel a goal this tab sent and so would leave a
 * reloaded page unable to stop a moving robot. Per action_msgs/srv/CancelGoal,
 * a zeroed goal id and timestamp mean "cancel all goals" — correct here, since
 * the coordinator runs one mission at a time, and it works identically whether
 * or not this tab started it.
 *
 * The call is made through `callServiceTyped` for its timeout: a cancel that
 * gets no answer must say so rather than leave the operator watching a moving
 * robot and an unchanged screen.
 *
 * @param {function} onDone Called with ({accepted, count}).
 */
export const cancelDocking = (onDone) => {
  callServiceTyped(
    {
      name: '/dock/_action/cancel_goal',
      type: 'action_msgs/srv/CancelGoal',
      args: {
        goal_info: {
          goal_id: { uuid: new Array(16).fill(0) },
          stamp: { sec: 0, nanosec: 0 },
        },
      },
    },
    (response) => {
      onDone?.({
        // return_code 0 is ERROR_NONE: at least one goal is now cancelling.
        accepted: response.return_code === 0,
        count: (response.goals_canceling ?? []).length,
      });
    },
    (error) => onDone?.({ accepted: false, count: 0, error: String(error) }),
  );
};
