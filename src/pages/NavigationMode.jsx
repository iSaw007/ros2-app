import React, { useState } from 'react';
import { getMapData } from '../services/mapService';
import { sendWaypoint, cancelNavigation, sendBackup } from '../services/navigationService';
import MapRenderer from '../components/MapRenderer';

export default function NavigationMode() {
  const [mapData, setMapData] = useState(null);
  const [mapInfo, setMapInfo] = useState('No map data loaded yet. Click "Load Map" to stream.');
  const [loading, setLoading] = useState(false);
  
  const [targetPose, setTargetPose] = useState(null);
  const [navStatus, setNavStatus] = useState('Idle');
  const [isDocked, setIsDocked] = useState(false);

  const handleStartMap = () => {
    setLoading(true);
    setMapInfo('Connecting to map topic...');
    
    getMapData((message) => {
      console.log('Map Data Received:', message);
      setMapData(message);
      const { width, height, resolution } = message.info;
      setMapInfo(`Map Loaded: ${width}x${height} at ${(resolution * 100).toFixed(0)}cm/px.`);
      setLoading(false);
    }, false); // Set unsubscribeImmediately=false to listen to updates (like SLAM)
  };

  const handleMapDoubleClick = (x, y) => {
    console.log(`Sending waypoint to x: ${x.toFixed(2)}, y: ${y.toFixed(2)}`);
    setTargetPose({ x, y, yaw: 0 }); // Visual target
    
    if (isDocked) {
      setNavStatus('Undocking...');
      sendBackup(
        0.4, 0.1, // back up 40cm at 0.1m/s
        null, // ignore feedback
        (backupResult) => {
          setIsDocked(false);
          setNavStatus('Navigating...');
          executeWaypoint(x, y);
        }
      );
    } else {
      setNavStatus('Navigating...');
      executeWaypoint(x, y);
    }
  };

  const executeWaypoint = (x, y) => {
    sendWaypoint(
      x, y, 0, // default orientation
      (feedback) => {
        // Feedback callback
      },
      (result) => {
        // Result callback
        setNavStatus('Reached Goal');
        setTargetPose(null);
        setTimeout(() => setNavStatus('Idle'), 5000);
      }
    );
  };
  
  const handleCancelNav = () => {
    cancelNavigation();
    setNavStatus('Cancelled');
    setTargetPose(null);
    setTimeout(() => setNavStatus('Idle'), 5000);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Navigation & Map Visualization
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Stream the occupancy grid map and track the robot's real-time position.
          </p>
        </div>
        
        <button
          onClick={handleStartMap}
          disabled={loading}
          className="mt-4 md:mt-0 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md transition-colors cursor-pointer"
        >
          {loading ? 'Loading Map...' : mapData ? 'Refresh Map' : 'Load Map'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Status indicator */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Connection Status</h3>
            <p className="mt-1 font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${mapData ? 'bg-green-500' : 'bg-amber-500'}`}></span>
              {mapData ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Dock Status</h3>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {isDocked ? 'Docked (Auto-Undock)' : 'Free to Move'}
              </span>
              <button
                onClick={() => setIsDocked(!isDocked)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${isDocked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDocked ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Navigation Status</h3>
            <div className="mt-1 flex items-center justify-between">
              <p className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${navStatus === 'Navigating...' || navStatus === 'Undocking...' ? 'bg-blue-500 animate-pulse' : navStatus === 'Reached Goal' ? 'bg-green-500' : navStatus === 'Cancelled' ? 'bg-red-500' : 'bg-gray-400'}`}></span>
                {navStatus}
              </p>
              {(navStatus === 'Navigating...' || navStatus === 'Undocking...') && (
                <button 
                  onClick={handleCancelNav}
                  className="text-xs bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Double-click on the map to set a destination waypoint.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Map Status</h3>
            <p className="mt-1 text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 break-words">
              {mapInfo}
            </p>
          </div>
        </div>

        {/* Map Visualization Canvas */}
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
              <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200">No Map Stream Active</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mt-1 mb-4">
                Please click the "Load Map" button above to subscribe to the occupancy grid from the robot.
              </p>
              <button
                onClick={handleStartMap}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                {loading ? 'Connecting...' : 'Load Map Now'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
