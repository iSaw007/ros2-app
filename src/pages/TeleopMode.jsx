import React from 'react';
import { Joystick } from 'react-joystick-component';
import { drive, stop } from '../services/teleopService';

export default function TeleopMode() {
  const handleMove = (event) => {
    console.log('Joystick Event:', event);

    const maxLinear = 0.5; // m/s
    const maxAngular = 1.0; // rad/s

    // BUG FIX: The joystick returns values between -1 and 1, not -100 and 100!
    // So we should NOT divide by 100.
    const linear = event.y * maxLinear;
    const angular = -event.x * maxAngular; // Invert X for ROS right-hand rule

    console.log(`Sending Cmd: Linear=${linear.toFixed(3)}, Angular=${angular.toFixed(3)}`);

    drive(linear, angular);
  };

  const handleStop = () => {
    console.log('Joystick Stop');
    stop();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
        Teleop Mode
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mt-2">
        Live camera stream and joystick controls.
      </p>

      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* Camera Stream */}
        <div className="col-span-12 lg:col-span-8">
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-black shadow-sm">
            <img
              src={`http://${import.meta.env.VITE_ROS_BRIDGE_IP}:8080/stream?topic=/camera/image_raw`}
              alt="Robot Camera Stream"
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Joystick Control Card */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-6">
              Virtual Joystick
            </h2>

            <Joystick
              size={120}
              sticky={false}
              baseColor="#e2e8f0"
              stickColor="#3b82f6"
              move={handleMove}
              stop={handleStop}
            />

            <p className="text-sm text-gray-500 mt-4 text-center">
              Check browser console (F12) to see the event data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
