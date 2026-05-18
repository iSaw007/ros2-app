import React from 'react';

// This is a barebones Overview component to verify routing works.
export default function Overview() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
        Overview Working
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mt-2">
        If you see this, the routing for the homepage is successful!
      </p>
    </div>
  );
}
