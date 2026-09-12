import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeToMap, refreshMap, getCachedMap, mapFingerprint } from '../services/mapService';
import {
  sendWaypoint,
  cancelNavigation,
  sendBackup,
  cancelBackup,
  subscribeToPlan,
} from '../services/navigationService';
import { getLastPose, subscribeToPose } from '../services/telemetryService';
import {
  subscribeToLocations,
  saveLocation,
  deleteLocation,
  exportLocations,
  importLocations,
} from '../services/locationStore';
import { WaypointPopover } from '../components/WaypointPopover';
import { SavedLocations } from '../components/SavedLocations';
import { useRosStatus } from '../context/RosStatusContext';
import { useDockState } from '../context/DockStateContext';
import MapRenderer from '../components/MapRenderer';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Badge, EmptyState, Meter, Readout, StatusLine } from '../components/ui/Indicators';
import { MapIcon, RefreshIcon, StopIcon } from '../components/ui/Icons';

const IDLE = { kind: 'idle', label: 'Idle', tone: 'neutral' };

/**
 * Arrival heading for a tapped point: the bearing from where the robot is now
 * to where it is going.
 *
 * The goal's orientation is not optional — Nav2's goal checker is stateful, so
 * once the robot is within `xy_goal_tolerance` it stops checking position and
 * waits until its heading matches the one that was commanded. Sending a fixed
 * zero, as this page used to, therefore meant every tap read as "go there and
 * face east": the robot would arrive and then rotate on the spot to an
 * orientation nobody asked for, hunting around the goal to reach it.
 *
 * Aiming along the direction of travel asks for the heading the robot will
 * naturally already have on arrival, so no final rotation is demanded. A path
 * that curves around an obstacle still ends slightly off this bearing, but by a
 * small and bounded amount rather than by an arbitrary one.
 */
const headingFromTravel = (target) => {
  const pose = getLastPose();
  if (!pose) return 0;
  const dx = target.x - pose.x;
  const dy = target.y - pose.y;
  // Too close to infer a direction from; keep the robot's current heading.
  if (Math.hypot(dx, dy) < 0.05) return pose.yaw;
  return Math.atan2(dy, dx);
};

export default function NavigationMode() {
  const { isConnected } = useRosStatus();
  const { isDocked, source: dockSource, reportUndocked, setManually } = useDockState();

  const [mapData, setMapData] = useState(getCachedMap);
  const [status, setStatus] = useState(IDLE);
  const [target, setTarget] = useState(null);
  const [distanceRemaining, setDistanceRemaining] = useState(null);
  const [plannedPath, setPlannedPath] = useState(null);
  const [isUndocking, setIsUndocking] = useState(false);
  // A point clicked on the map, awaiting confirmation. Nothing is commanded
  // until the operator says so.
  const [pending, setPending] = useState(null);
  const [locations, setLocations] = useState([]);
  const [hoveredLocation, setHoveredLocation] = useState(null);
  const [mapBounds, setMapBounds] = useState({ width: 0, height: 0 });
  const mapWrapRef = useRef(null);
  const importInputRef = useRef(null);
  const [importNote, setImportNote] = useState(null);
  const [robotPose, setRobotPose] = useState(getLastPose);

  // Identifies the map currently loaded, so saved coordinates can be checked
  // against the map they were measured on.
  const currentMapId = useMemo(() => mapFingerprint(mapData), [mapData]);

  // The distance the goal started at, so progress can be shown as a fraction.
  const initialDistance = useRef(null);
  const resetTimer = useRef(null);
  const stopPlanFeed = useRef(null);

  // The planner publishes a path when a goal is accepted and on each successful
  // replan, and replans can be sparse. Subscribing from an effect keyed on
  // status would attach a render later than the goal was sent, which is long
  // enough to miss the first — and sometimes only — path of the whole journey.
  // So the feed is opened by hand immediately before the goal goes out.
  const openPlanFeed = useCallback(() => {
    stopPlanFeed.current?.();
    stopPlanFeed.current = subscribeToPlan(setPlannedPath);
  }, []);

  const closePlanFeed = useCallback(() => {
    stopPlanFeed.current?.();
    stopPlanFeed.current = null;
  }, []);

  // The grid is served from the service's cache, so switching to this view and
  // back is instant and costs no bandwidth. Nothing is unsubscribed here that
  // would prevent the map coming back — the cause of the map never reloading
  // in the previous version.
  useEffect(() => subscribeToMap(setMapData), []);

  useEffect(() => subscribeToLocations(setLocations), []);

  // Needed only to prefill the "add location" form with where the robot is.
  useEffect(() => subscribeToPose(setRobotPose), []);

  // The popover is positioned inside the map, so it needs the map's size to
  // keep itself from hanging off an edge.
  useEffect(() => {
    const element = mapWrapRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) =>
      setMapBounds({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [mapData]);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    stopPlanFeed.current?.();
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
    openPlanFeed();

    sendWaypoint({
      x: point.x,
      y: point.y,
      // Explicit heading wins when one is given; otherwise face the way we came.
      theta: point.theta ?? headingFromTravel(point),
      onFeedback: ({ distanceRemaining: remaining }) => {
        if (remaining === null) return;
        if (initialDistance.current === null) initialDistance.current = Math.max(remaining, 0.01);
        setDistanceRemaining(remaining);
      },
      onResult: ({ success, message }) => {
        closePlanFeed();
        setTarget(null);
        setPlannedPath(null);
        settleTo(
          success
            ? { kind: 'arrived', label: 'Goal reached', tone: 'ok' }
            : { kind: 'failed', label: message || 'Goal failed', tone: 'danger' },
        );
      },
    });
  }, [settleTo, openPlanFeed, closePlanFeed]);

  const handlePick = useCallback((point) => {
    setPending({
      ...point,
      x: Math.round(point.x * 100) / 100,
      y: Math.round(point.y * 100) / 100,
    });
  }, []);

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
        reportUndocked();
        driveTo(point);
      },
    });
  }, [isConnected, isDocked, driveTo, settleTo, reportUndocked]);

  const handleCancel = () => {
    cancelNavigation();
    cancelBackup();
    closePlanFeed();
    setTarget(null);
    setPlannedPath(null);
    settleTo({ kind: 'cancelled', label: 'Cancelled', tone: 'warn' }, 3000);
  };

  const sendPending = () => {
    if (!pending) return;
    const { x, y } = pending;
    setPending(null);
    handleWaypoint({ x, y });
  };

  const savePending = (name) => {
    if (!pending || !name.trim()) return;
    saveLocation({ name, x: pending.x, y: pending.y, mapId: currentMapId });
    setPending(null);
  };

  const handleUndockNow = () => {
    setIsUndocking(true);
    sendBackup({
      distance: 0.4,
      speed: 0.1,
      onResult: ({ success, message }) => {
        setIsUndocking(false);
        if (success) {
          reportUndocked();
          settleTo({ kind: 'arrived', label: 'Clear of the dock', tone: 'ok' }, 3000);
        } else {
          settleTo({ kind: 'failed', label: message || 'Could not leave the dock', tone: 'danger' });
        }
      },
    });
  };

  const handleExport = () => {
    const blob = new Blob([exportLocations()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'saved-locations.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    const { added, error } = importLocations(await file.text());
    setImportNote(error ?? `Imported ${added} location${added === 1 ? '' : 's'}.`);
    setTimeout(() => setImportNote(null), 5000);
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
              Click the map to place a waypoint, then confirm or edit it.
            </p>
          </div>
        </Panel>

        {/* Dock state. Undock drives the robot off the dock; the override
            corrects the record when the two have drifted apart — a mission that
            failed halfway, or a robot pushed by hand. The two are deliberately
            separate: one moves a machine, the other edits a belief, and an
            operator should never have to guess which they are about to do. */}
        <Panel title="Dock">
          <div className="flex flex-col gap-3">
            <StatusLine
              tone={isDocked ? 'ok' : 'neutral'}
              label={isDocked ? 'On the dock' : 'Clear of the dock'}
            />
            <p className="text-[11px] leading-relaxed text-faint">
              {isDocked
                ? dockSource === 'manual'
                  ? 'Set by hand. The robot will back out before navigating.'
                  : 'Reported by the docking mission. The robot will back out before navigating.'
                : 'Goals are sent straight to Nav2.'}
            </p>

            {isDocked && (
              <>
                <Button
                  size="sm"
                  block
                  onClick={handleUndockNow}
                  disabled={!isConnected || isUndocking}
                >
                  {isUndocking ? 'Backing out…' : 'Undock'}
                </Button>
                <button
                  onClick={() => setManually(false)}
                  className="text-[11px] text-faint underline-offset-2 transition-colors hover:text-ink hover:underline"
                >
                  Mark as undocked without moving
                </button>
              </>
            )}
            {!isDocked && (
              <button
                onClick={() => setManually(true)}
                className="text-[11px] text-faint underline-offset-2 transition-colors hover:text-ink hover:underline"
              >
                Mark as docked without moving
              </button>
            )}
          </div>
        </Panel>

        <SavedLocations
          locations={locations}
          currentMapId={currentMapId}
          canSend={isConnected}
          robotPose={robotPose}
          onGo={(place) => handleWaypoint({ x: place.x, y: place.y })}
          onDelete={deleteLocation}
          onAdd={({ name, x, y }) => saveLocation({ name, x, y, mapId: currentMapId })}
          onHover={setHoveredLocation}
          onExport={handleExport}
          onImport={handleImportFile}
          note={importNote}
        />

        {!isConnected && (
          <Badge tone="warn" className="justify-center py-1.5">No link to the robot</Badge>
        )}
      </div>

      {/* Map */}
      <Panel flush className="min-h-[420px] overflow-hidden lg:h-full" >
        <div ref={mapWrapRef} className="h-full w-full">
        {mapData ? (
          <MapRenderer
            mapData={mapData}
            onPick={handlePick}
            targetPose={target}
            plannedPath={plannedPath}
            pendingGoal={pending}
            savedLocations={locations}
            hoveredLocation={hoveredLocation}
          >
            {pending && (
              <WaypointPopover
                pending={pending}
                bounds={mapBounds}
                canSend={isConnected}
                onChange={({ x, y }) => setPending((p) => ({ ...p, x, y }))}
                onSend={sendPending}
                onSave={savePending}
                onCancel={() => setPending(null)}
              />
            )}
          </MapRenderer>
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
        </div>
      </Panel>
    </div>
  );
}
