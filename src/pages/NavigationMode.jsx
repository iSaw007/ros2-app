import React, { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeToMap, refreshMap, getCachedMap } from '../services/mapService';
import {
  sendWaypoint,
  cancelNavigation,
  sendBackup,
  cancelBackup,
} from '../services/navigationService';
import { useRosStatus } from '../context/RosStatusContext';
import MapRenderer from '../components/MapRenderer';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Badge, EmptyState, Meter, Readout, StatusLine } from '../components/ui/Indicators';
import { MapIcon, RefreshIcon, StopIcon } from '../components/ui/Icons';

const IDLE = { kind: 'idle', label: 'Idle', tone: 'neutral' };

export default function NavigationMode() {
  const { isConnected } = useRosStatus();

  const [mapData, setMapData] = useState(getCachedMap);
  const [status, setStatus] = useState(IDLE);
  const [target, setTarget] = useState(null);
  const [distanceRemaining, setDistanceRemaining] = useState(null);
  const [isDocked, setIsDocked] = useState(false);

  // The distance the goal started at, so progress can be shown as a fraction.
  const initialDistance = useRef(null);
  const resetTimer = useRef(null);

  // The grid is served from the service's cache, so switching to this view and
  // back is instant and costs no bandwidth. Nothing is unsubscribed here that
  // would prevent the map coming back — the cause of the map never reloading
  // in the previous version.
  useEffect(() => subscribeToMap(setMapData), []);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    cancelNavigation();
    cancelBackup();
  }, []);

  const settleTo = useCallback((next, holdMs = 4000) => {
    setStatus(next);
    setDistanceRemaining(null);
    initialDistance.current = null;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus(IDLE), holdMs);
  }, []);

  const driveTo = useCallback((point) => {
    setTarget(point);
    setStatus({ kind: 'navigating', label: 'Navigating', tone: 'accent' });

    sendWaypoint({
      x: point.x,
      y: point.y,
      theta: 0,
      onFeedback: ({ distanceRemaining: remaining }) => {
        if (remaining === null) return;
        if (initialDistance.current === null) initialDistance.current = Math.max(remaining, 0.01);
        setDistanceRemaining(remaining);
      },
      onResult: ({ success, message }) => {
        setTarget(null);
        settleTo(
          success
            ? { kind: 'arrived', label: 'Goal reached', tone: 'ok' }
            : { kind: 'failed', label: message || 'Goal failed', tone: 'danger' },
        );
      },
    });
  }, [settleTo]);

  const handleWaypoint = useCallback((point) => {
    if (!isConnected) return;

    if (!isDocked) {
      driveTo(point);
      return;
    }

    // Leaving the dock has to finish before Nav2 is given a goal, or the
    // planner starts from a pose the robot is about to abandon.
    setStatus({ kind: 'undocking', label: 'Backing out of dock', tone: 'accent' });
    sendBackup({
      distance: 0.4,
      speed: 0.1,
      onResult: ({ success, message }) => {
        if (!success) {
          settleTo({ kind: 'failed', label: message || 'Could not leave the dock', tone: 'danger' });
          return;
        }
        setIsDocked(false);
        driveTo(point);
      },
    });
  }, [isConnected, isDocked, driveTo, settleTo]);

  const handleCancel = () => {
    cancelNavigation();
    cancelBackup();
    setTarget(null);
    settleTo({ kind: 'cancelled', label: 'Cancelled', tone: 'warn' }, 3000);
  };

  const handleRefreshMap = () => {
    setMapData(null);
    refreshMap();
  };

  const isBusy = status.kind === 'navigating' || status.kind === 'undocking';
  const progress =
    distanceRemaining !== null && initialDistance.current
      ? 1 - Math.min(distanceRemaining / initialDistance.current, 1)
      : 0;

  return (
    <div className="mx-auto grid h-full max-w-[1400px] grid-cols-1 gap-3 lg:grid-cols-[260px_1fr]">
      {/* Status column */}
      <div className="flex flex-col gap-3">
        <Panel
          title="Map"
          action={
            <button
              onClick={handleRefreshMap}
              className="flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-ink"
            >
              <RefreshIcon size={13} /> Refresh
            </button>
          }
        >
          {mapData ? (
            <div className="grid grid-cols-2 gap-3">
              <Readout
                label="Size"
                value={`${mapData.info.width}×${mapData.info.height}`}
                unit="px"
              />
              <Readout
                label="Resolution"
                value={(mapData.info.resolution * 100).toFixed(1)}
                unit="cm/px"
              />
            </div>
          ) : (
            <p className="text-xs text-faint">
              {isConnected ? 'Waiting for the occupancy grid…' : 'No link to the robot.'}
            </p>
          )}
        </Panel>

        <Panel title="Navigation">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <StatusLine tone={status.tone} label={status.label} pulse={isBusy} />
              {isBusy && (
                <Button size="sm" variant="danger" onClick={handleCancel}>
                  <StopIcon size={13} /> Stop
                </Button>
              )}
            </div>

            {status.kind === 'navigating' && distanceRemaining !== null && (
              <div className="flex flex-col gap-1.5 border-t border-edge pt-3">
                <Readout label="Remaining" value={distanceRemaining.toFixed(2)} unit="m" />
                <Meter fraction={progress} />
              </div>
            )}

            {target && (
              <div className="border-t border-edge pt-3">
                <Readout
                  label="Target"
                  value={`${target.x.toFixed(2)}, ${target.y.toFixed(2)}`}
                  unit="m"
                />
              </div>
            )}

            <p className="border-t border-edge pt-3 text-[11px] leading-relaxed text-faint">
              Double-click anywhere on the map to send the robot there.
            </p>
          </div>
        </Panel>

        {/* Dock state is operator-declared: nothing publishes it yet, and
            navigating out of a dock without backing off first fails. */}
        <Panel title="Dock state">
          <label className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-[13px] font-medium">
                {isDocked ? 'On the dock' : 'Free to move'}
              </span>
              <span className="text-[11px] text-faint">
                {isDocked
                  ? 'The robot will back out before navigating.'
                  : 'Goals are sent directly.'}
              </span>
            </span>
            <button
              role="switch"
              aria-checked={isDocked}
              aria-label="Robot is on the dock"
              onClick={() => setIsDocked((value) => !value)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                isDocked ? 'bg-accent' : 'bg-edge-strong'
              }`}
            >
              {/* left-0.5 is load-bearing: without an explicit inset the knob
                  takes its static position from the button's centred text
                  alignment and sits mid-track in both states. */}
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  isDocked ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </Panel>

        {!isConnected && (
          <Badge tone="warn" className="justify-center py-1.5">No link to the robot</Badge>
        )}
      </div>

      {/* Map */}
      <Panel flush className="min-h-[420px] overflow-hidden lg:h-full">
        {mapData ? (
          <MapRenderer
            mapData={mapData}
            onWaypoint={handleWaypoint}
            targetPose={target}
          />
        ) : (
          <EmptyState
            icon={<MapIcon size={24} />}
            title={isConnected ? 'No map received' : 'Waiting for the ROS bridge'}
            hint={
              isConnected
                ? 'The grid arrives once map_server or SLAM is publishing on /map. Refresh to request it again.'
                : 'The map appears as soon as the link comes up.'
            }
          />
        )}
      </Panel>
    </div>
  );
}
