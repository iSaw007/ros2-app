import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  startDocking,
  cancelDocking,
  watchDockMission,
  isTerminalStatus,
  GOAL_STATUS,
  DOCK_STATES,
  DOCK_PIPELINE,
} from '../services/dockingService';
import { sendBackup, cancelBackup } from '../services/navigationService';
import { useRosStatus } from '../context/RosStatusContext';
import { useDockState } from '../context/DockStateContext';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Badge, Meter, Readout, StatusLine, EmptyState } from '../components/ui/Indicators';
import { DockIcon, PlayIcon, StopIcon, WarningIcon } from '../components/ui/Icons';

const STATE_LABELS = {
  [DOCK_STATES.STAGING]: 'Staging',
  [DOCK_STATES.STAGING_CORRECTION]: 'Correcting',
  [DOCK_STATES.SEARCHING]: 'Searching',
  [DOCK_STATES.TRACKING]: 'Tracking',
  [DOCK_STATES.APPROACH]: 'Approach',
  [DOCK_STATES.DOCKED]: 'Docked',
  [DOCK_STATES.LOST]: 'Marker lost',
};

const STATE_HINTS = {
  [DOCK_STATES.STAGING]: 'Driving to the staging pose under Nav2.',
  [DOCK_STATES.STAGING_CORRECTION]: 'Adjusting the approach angle before the visual phase.',
  [DOCK_STATES.SEARCHING]: 'Turning in place, looking for the dock markers.',
  [DOCK_STATES.TRACKING]: 'Markers acquired — closing on the dock.',
  [DOCK_STATES.APPROACH]: 'Final alignment and contact.',
  [DOCK_STATES.DOCKED]: 'Mission complete.',
  [DOCK_STATES.LOST]: 'Markers out of view — reacquiring before falling back to search.',
};

const TRACKING_RANGE_M = 2.0;

// How long to listen before concluding no mission is running. Feedback arrives
// at roughly 10 Hz, so anything beyond a few hundred milliseconds is generous;
// this leaves room for a slow first delivery over a congested link.
const PROBE_WINDOW_MS = 2500;

// If feedback stops without a terminal status, the mission is no longer being
// reported on. That is not the same as it having finished, and the interface
// says so rather than inventing an outcome.
const FEEDBACK_TIMEOUT_MS = 4000;

function Pipeline({ activeState, completed, failed, lost }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {DOCK_PIPELINE.map((state, index) => {
        const isActive = state === activeState;
        const isComplete = completed.includes(state);

        let tone = 'border-edge bg-sunken text-faint';
        if (isActive && failed) tone = 'border-danger/40 bg-danger-soft text-danger';
        else if (isActive && lost) tone = 'border-warn/40 bg-warn-soft text-warn';
        else if (isActive) tone = 'border-accent/40 bg-accent-soft text-accent';
        else if (isComplete) tone = 'border-ok/30 bg-ok-soft text-ok';

        return (
          <React.Fragment key={state}>
            <li
              className={`rounded-[4px] border px-2 py-1 text-[11px] font-semibold transition-colors ${tone}`}
              aria-current={isActive ? 'step' : undefined}
            >
              {STATE_LABELS[state]}
            </li>
            {index < DOCK_PIPELINE.length - 1 && (
              <li aria-hidden="true" className="text-[10px] text-faint">·</li>
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

const LOG_TONES = {
  state: 'text-accent',
  success: 'text-ok',
  error: 'text-danger',
  warn: 'text-warn',
  info: 'text-muted',
};

const DOCK_IDS = ['default'];

export default function MissionMode() {
  const { isConnected } = useRosStatus();
  const { reportDocked, reportUndocked } = useDockState();

  const [dockId, setDockId] = useState(DOCK_IDS[0]);
  const [logs, setLogs] = useState([]);

  // 'probing'  — listening to find out whether a mission is already running
  // 'idle'     — nothing running
  // 'running'  — a mission is in progress
  // 'docked' | 'failed' | 'cancelled' | 'stalled' — terminal
  const [phase, setPhase] = useState('probing');
  // True when the mission was already under way when this page loaded, rather
  // than started from here. Worth showing: it explains a populated interface
  // the operator did not personally set in motion.
  const [adopted, setAdopted] = useState(false);
  const [isUndocking, setIsUndocking] = useState(false);

  const [rawState, setRawState] = useState(null);
  const [pipelineState, setPipelineState] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [distanceM, setDistanceM] = useState(null);

  const logRef = useRef(null);
  const logCounter = useRef(0);
  const phaseRef = useRef(phase);
  const rawStateRef = useRef(null);
  const pipelineStateRef = useRef(null);
  const goalIdRef = useRef(null);
  const lastFeedbackAt = useRef(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const appendLog = useCallback((text, level = 'info') => {
    logCounter.current += 1;
    // Read the counter here, not inside the updater. React runs updaters later,
    // so two calls batched into one render would both see the already-twice-
    // incremented ref and produce two entries sharing an id.
    const id = logCounter.current;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setLogs((previous) => [...previous.slice(-199), { id, text, level, time }]);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const resetMissionView = useCallback(() => {
    rawStateRef.current = null;
    pipelineStateRef.current = null;
    goalIdRef.current = null;
    setRawState(null);
    setPipelineState(null);
    setCompleted([]);
    setDistanceM(null);
  }, []);

  // Follow the robot, not this tab's own goal. This is what survives a reload:
  // the mission's state is republished continuously by the coordinator, so a
  // page that has just loaded can pick up one already in progress.
  useEffect(() => {
    const stop = watchDockMission({
      onFeedback: ({ goalId, state, distanceM: distance }) => {
        lastFeedbackAt.current = Date.now();
        goalIdRef.current = goalId;

        if (phaseRef.current === 'probing' || phaseRef.current === 'idle') {
          setAdopted(true);
          setPhase('running');
          appendLog('Reattached to a docking mission already in progress.', 'warn');
        } else if (phaseRef.current !== 'running') {
          setPhase('running');
        }

        if (state !== rawStateRef.current) {
          rawStateRef.current = state;
          setRawState(state);
          appendLog(
            STATE_HINTS[state] ?? state,
            state === DOCK_STATES.LOST ? 'warn' : 'state',
          );
        }

        // LOST is a recovery state, not a step: leave the pipeline showing the
        // phase the mission is still trying to complete.
        if (state !== DOCK_STATES.LOST && DOCK_PIPELINE.includes(state)) {
          const previous = pipelineStateRef.current;
          if (previous !== state) {
            // Everything before the reported step counts as done. For a mission
            // adopted mid-flight that is the only way to populate the earlier
            // steps at all, and for one started here it agrees with what was
            // actually observed.
            const reachedIndex = DOCK_PIPELINE.indexOf(state);
            setCompleted(DOCK_PIPELINE.slice(0, reachedIndex));
            pipelineStateRef.current = state;
            setPipelineState(state);
          }
        }

        if (distance !== null) setDistanceM(distance);
      },

      onStatus: ({ goalId, status }) => {
        // Only act on a transition belonging to the goal currently being
        // followed. The goal id is learned from feedback, so until that has
        // arrived no transition can be attributed to this mission — including
        // the terminal status of the *previous* goal, which the coordinator
        // republishes as a new mission starts and which would otherwise be
        // reported as this one having instantly ended.
        if (!goalIdRef.current || goalId !== goalIdRef.current) return;
        if (!isTerminalStatus(status)) return;

        if (status === GOAL_STATUS.SUCCEEDED) {
          rawStateRef.current = DOCK_STATES.DOCKED;
          pipelineStateRef.current = DOCK_STATES.DOCKED;
          setRawState(DOCK_STATES.DOCKED);
          setPipelineState(DOCK_STATES.DOCKED);
          setCompleted(DOCK_PIPELINE.slice(0, -1));
          setPhase('docked');
          reportDocked();
          appendLog('Docked.', 'success');
        } else if (status === GOAL_STATUS.CANCELED) {
          setPhase('cancelled');
          appendLog('Mission cancelled.', 'warn');
        } else {
          setPhase('failed');
          appendLog('Mission aborted by the coordinator.', 'error');
        }
        goalIdRef.current = null;
      },
    });

    // Nothing heard in the probe window means nothing is running.
    const probe = setTimeout(() => {
      if (phaseRef.current === 'probing') setPhase('idle');
    }, PROBE_WINDOW_MS);

    // Feedback drying up mid-mission is reported as exactly that.
    const watchdog = setInterval(() => {
      if (phaseRef.current !== 'running') return;
      if (Date.now() - lastFeedbackAt.current < FEEDBACK_TIMEOUT_MS) return;
      setPhase('stalled');
      appendLog('Feedback from the coordinator stopped.', 'error');
    }, 1000);

    return () => {
      stop();
      clearTimeout(probe);
      clearInterval(watchdog);
    };
  }, [appendLog, reportDocked]);

  // A back-up behaviour started here should not outlive the page.
  useEffect(() => () => { cancelBackup(); }, []);

  const handleStart = () => {
    setAdopted(false);
    setPhase('running');
    lastFeedbackAt.current = Date.now();
    resetMissionView();
    setLogs([]);
    appendLog(`Goal sent for dock "${dockId}".`, 'info');

    startDocking({
      dockId,
      cancelNav: true,
      onResult: ({ success, message }) => {
        // The status topic reports the outcome; this only adds the
        // coordinator's own explanation, which the status code lacks.
        if (!success && message) appendLog(message, 'error');
      },
    });
  };

  const handleCancel = () => {
    appendLog('Cancel requested.', 'warn');
    cancelDocking(({ accepted, count, error }) => {
      if (!accepted) appendLog(`Cancel failed: ${error ?? 'unknown reason'}`, 'error');
      else if (count === 0) appendLog('No active mission to cancel.', 'warn');
      else appendLog(`Cancelling ${count} goal${count === 1 ? '' : 's'}.`, 'warn');
    });
  };

  const handleUndock = () => {
    setIsUndocking(true);
    appendLog('Backing out of the dock.', 'info');

    sendBackup({
      distance: 0.4,
      speed: 0.1,
      onResult: ({ success, message }) => {
        setIsUndocking(false);
        if (success) {
          resetMissionView();
          setPhase('idle');
          appendLog('Clear of the dock.', 'success');
        } else {
          appendLog(message || 'Back-up behaviour did not complete.', 'error');
        }
      },
    });
  };

  const isRunning = phase === 'running';
  const isDocked = phase === 'docked';
  const failed = phase === 'failed' || phase === 'stalled';
  const isLost = rawState === DOCK_STATES.LOST;
  const showRange =
    distanceM !== null &&
    [DOCK_STATES.TRACKING, DOCK_STATES.APPROACH, DOCK_STATES.LOST].includes(rawState);

  const statusTone = isDocked
    ? 'ok'
    : failed
      ? 'danger'
      : phase === 'cancelled'
        ? 'warn'
        : isLost
          ? 'warn'
          : isRunning
            ? 'accent'
            : 'neutral';

  const statusLabel = {
    probing: 'Checking for an active mission…',
    idle: 'Idle',
    docked: 'Docked',
    failed: 'Failed',
    stalled: 'Feedback lost',
    cancelled: 'Cancelled',
  }[phase] ?? (rawState ? STATE_LABELS[rawState] ?? rawState : 'Running');

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 lg:grid-cols-[300px_1fr]">
      <div className="flex flex-col gap-3">
        <Panel title="Mission">
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Target dock</span>
              <select
                value={dockId}
                onChange={(event) => setDockId(event.target.value)}
                disabled={isRunning || isUndocking || DOCK_IDS.length === 1}
                className="h-9 rounded-[5px] border border-edge-strong bg-surface px-2 text-[13px] text-ink disabled:opacity-60"
              >
                {DOCK_IDS.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
              {DOCK_IDS.length === 1 && (
                <span className="text-[11px] text-faint">One dock is defined in dock.yaml.</span>
              )}
            </label>

            {isRunning ? (
              <Button variant="danger" size="lg" block onClick={handleCancel}>
                <StopIcon size={17} /> Cancel mission
              </Button>
            ) : isDocked ? (
              <Button size="lg" block onClick={handleUndock} disabled={isUndocking}>
                {isUndocking ? 'Backing out…' : 'Undock'}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                block
                onClick={handleStart}
                disabled={!isConnected || phase === 'probing'}
              >
                <PlayIcon size={17} /> Start docking
              </Button>
            )}

            {!isConnected && (
              <Badge tone="warn" className="justify-center py-1.5">No link to the robot</Badge>
            )}
            {adopted && isRunning && (
              <Badge tone="warn" className="justify-center py-1.5">
                Mission started elsewhere
              </Badge>
            )}
          </div>
        </Panel>

        <Panel title="Status">
          <div className="flex flex-col gap-3">
            <StatusLine
              tone={statusTone}
              label={statusLabel}
              pulse={(isRunning && !isLost) || phase === 'probing'}
            />
            {isRunning && rawState && (
              <p className="text-xs leading-relaxed text-faint">{STATE_HINTS[rawState]}</p>
            )}
            {phase === 'stalled' && (
              <p className="text-xs leading-relaxed text-faint">
                The coordinator stopped publishing feedback without reporting an
                outcome. The robot may still be moving — cancel if unsure.
              </p>
            )}
            {isLost && (
              <Badge tone="warn"><WarningIcon size={12} /> Recovering</Badge>
            )}
            {showRange && (
              <div className="flex flex-col gap-1.5 border-t border-edge pt-3">
                <Readout label="Range to dock" value={distanceM.toFixed(2)} unit="m" />
                <Meter
                  fraction={1 - Math.min(distanceM, TRACKING_RANGE_M) / TRACKING_RANGE_M}
                  tone={isLost ? 'warn' : 'accent'}
                />
              </div>
            )}
            {phase === 'stalled' && (
              <Button variant="danger" size="sm" block onClick={handleCancel}>
                <StopIcon size={14} /> Cancel anyway
              </Button>
            )}
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-3">
        <Panel title="Pipeline">
          {pipelineState ? (
            <Pipeline
              activeState={pipelineState}
              completed={completed}
              failed={failed}
              lost={isLost}
            />
          ) : (
            <p className="text-xs text-faint">
              The mission runs staging, search, tracking, and approach in order.
              Start a mission to follow it.
            </p>
          )}
        </Panel>

        <Panel title="Mission log" flush className="min-h-[340px]">
          {logs.length === 0 ? (
            <EmptyState
              icon={<DockIcon size={22} />}
              title={phase === 'probing' ? 'Checking for an active mission…' : 'No mission running'}
              hint="Feedback from the docking coordinator appears here, one line per state change."
            />
          ) : (
            <div ref={logRef} className="h-[340px] overflow-y-auto px-3 py-2">
              {logs.map((entry) => (
                <div key={entry.id} className="flex gap-2.5 py-[3px] text-[11.5px] leading-relaxed">
                  <span className="tnum shrink-0 text-faint">{entry.time}</span>
                  <span className={LOG_TONES[entry.level]}>{entry.text}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
