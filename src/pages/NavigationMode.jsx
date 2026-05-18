import React, { useState } from 'react';
import { getMapData } from '../services/mapService';

export default function NavigationMode() {
  const [mapInfo, setMapInfo] = useState('No map data yet. Click "Start Map" to fetch.');

  const handleStartMap = () => {
    setMapInfo('Connecting to map topic...');
    
    // Call the service. We set unsubscribeImmediately=true to save bandwidth
    getMapData((message) => {
      console.log('Map Data Received:', message);
      
      // Extract some basic info to show it worked
      const { width, height, resolution } = message.info;
      setMapInfo(`Map Loaded! Dimensions: ${width}x${height} at ${resolution.toFixed(2)}m/px.`);
    }, true);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
        Navigation Mode
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mt-2">
        Fetch the static map from the robot.
      </p>
      
      <div className="mt-6 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm max-w-lg">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Map Data Stream
        </h2>
        
        <button
          onClick={handleStartMap}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Start Map
        </button>
        
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
          <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
            {mapInfo}
          </p>
        </div>
      </div>
    </div>
  );
}
