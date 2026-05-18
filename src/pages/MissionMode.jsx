import React, { useState } from 'react';
import { startDocking } from '../services/dockingService';

export default function MissionMode() {
  const [logs, setLogs] = useState([]);
  const [isDocking, setIsDocking] = useState(false);

  const appendLog = (message) => {
    setLogs((prevLogs) => [...prevLogs, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleStartDocking = () => {
    setIsDocking(true);
    setLogs([]); // Clear logs
    appendLog('Sending goal to Docking Action Server...');
    
    startDocking(
      'default',
      true,
      (feedback) => {
        // Feedback callback
        console.log('Docking Feedback:', feedback);
        appendLog(`Feedback: State = ${feedback.state}, Distance = ${feedback.distance.toFixed(2)}m`);
      },
      (result) => {
        // Result callback
        console.log('Docking Result:', result);
        appendLog(`Mission Complete: Success = ${result.success}`);
        setIsDocking(false);
      }
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
        Mission Control
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mt-2">
        Trigger autonomous actions and monitor real-time feedback.
      </p>
      
      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* Action Button Card */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center min-h-[200px]">
            <button
              onClick={handleStartDocking}
              disabled={isDocking}
              className={`${
                isDocking ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              } text-white font-medium px-6 py-3 rounded-lg transition-colors w-full`}
            >
              {isDocking ? 'Docking in Progress...' : 'Initiate Docking'}
            </button>
          </div>
        </div>

        {/* Live Feedback Logs */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col h-[400px]">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
              Action Feedback Logs
            </h2>
            
            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 rounded-lg font-mono text-sm text-gray-700 dark:text-gray-300">
              {logs.length === 0 ? (
                <p className="text-gray-400">No active mission. Click "Initiate Docking" to start.</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
