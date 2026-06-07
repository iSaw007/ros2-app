import React, { useState, useEffect } from 'react';
import { getMapData, unsubscribeFromMap } from '../services/mapService';
import { sendWaypoint, cancelNavigation, sendBackup } from '../services/navigationService';
import MapRenderer from '../components/MapRenderer';

export default function NavigationMode() {
  const [mapData, setMapData]     = useState(null);
  const [mapInfo, setMapInfo]     = useState('Connecting to map…');
  const [loading, setLoading]     = useState(false);
  const [targetPose, setTargetPose] = useState(null);
  const [navStatus, setNavStatus] = useState('Idle');
  const [isDocked, setIsDocked]   = useState(false);

  // Auto-load map on first mount
  useEffect(() => { 
    loadMap(); 
    return () => unsubscribeFromMap();
  }, []);

  const loadMap = () => {
    setLoading(true);
    setMapInfo('Connecting to map topic…');
    unsubscribeFromMap(); // Clear any existing subscription first
    setMapData(null);
    
    getMapData((message) => {
      setMapData(message);
      const { width, height, resolution } = message.info;
      setMapInfo(`Map Loaded: ${width}×${height} at ${(resolution * 100).toFixed(0)}cm/px.`);
      setLoading(false);
    }, false);
  };

  const executeWaypoint = (x, y, theta = 0) => {
    sendWaypoint(
      x, y, theta,
      (feedback) => {
        const dist = feedback.distance_remaining?.toFixed(2) ?? '?';
        setNavStatus(`Navigating… ${dist}m remaining`);
      },
      (_result) => {
        setNavStatus('Reached Goal ✓');
        setTargetPose(null);
        setTimeout(() => setNavStatus('Idle'), 4000);
      }
    );
  };

  const handleMapDoubleClick = (x, y) => {
    setTargetPose({ x, y, yaw: 0 });

    if (isDocked) {
      setNavStatus('Undocking…');
      sendBackup(0.4, 0.1, null, () => {});
      
      // Immediately proceed since action doesn't exist yet
      setIsDocked(false);
      setNavStatus('Navigating…');
      executeWaypoint(x, y);
    } else {
      setNavStatus('Navigating…');
      executeWaypoint(x, y);
    }
  };

  const handleCancelNav = () => {
    cancelNavigation();
    setNavStatus('Cancelled');
    setTargetPose(null);
    setTimeout(() => setNavStatus('Idle'), 3000);
  };

  const isActive = navStatus.startsWith('Navigating') || navStatus === 'Undocking…';
  const dotColor =
    isActive          ? 'bg-blue-500 animate-pulse' :
    navStatus.includes('Goal') ? 'bg-green-500' :
    navStatus === 'Cancelled'  ? 'bg-red-500'   : 'bg-gray-400';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Navigation & Map</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Stream the occupancy grid and track the robot's real-time position.
          </p>
        </div>
        <button
          onClick={loadMap}
          disabled={loading}
          className="mt-4 md:mt-0 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md transition-colors cursor-pointer"
        >
          {loading ? 'Loading…' : mapData ? 'Refresh Map' : 'Load Map'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Status sidebar */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-5">

          {/* Map status */}
          <div>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Map</h3>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${mapData ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className="font-semibold text-sm text-gray-800 dark:text-white">
                {mapData ? 'Loaded' : 'Not loaded'}
              </span>
            </div>
            <p className="mt-1.5 text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800 break-words">
              {mapInfo}
            </p>
          </div>

          {/* Nav status */}
          <div>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Navigation</h3>
            <div className="mt-1 flex items-center justify-between">
              <p className="font-semibold text-sm text-gray-800 dark:text-white flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
                {navStatus}
              </p>
              {isActive && (
                <button
                  onClick={handleCancelNav}
                  className="text-xs bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Double-click the map to set a waypoint.
            </p>
          </div>

          {/* Dock status */}
          <div>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Dock Status
              <span className="ml-1 text-gray-300 dark:text-gray-600 normal-case">(manual override)</span>
            </h3>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {isDocked ? 'Docked — will undock on nav' : 'Free to move'}
              </span>
              <button
                onClick={() => setIsDocked(!isDocked)}
                title="Toggle manually if docked status was not set automatically"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                  isDocked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDocked ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Map canvas */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          {mapData ? (
            <MapRenderer
              mapData={mapData}
              onMapDoubleClick={handleMapDoubleClick}
              targetPose={targetPose}
            />
          ) : (
            <div className="w-full h-[550px] bg-gray-50 dark:bg-gray-950 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center p-6 text-center">
              <div className="text-4xl mb-3">🗺️</div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200">
                {loading ? 'Connecting to map…' : 'No Map Stream Active'}
              </h3>
              {!loading && (
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mt-1 mb-4">
                  Map will load automatically. Click Refresh if it doesn't appear.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
