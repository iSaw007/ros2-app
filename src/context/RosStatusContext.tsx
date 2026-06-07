import React, { createContext, useContext, useEffect, useState } from 'react';
// @ts-ignore - rosConnection is plain JS without type declarations
import ros from '../services/rosConnection';

type RosStatus = 'connected' | 'connecting' | 'disconnected';

interface RosStatusContextValue {
  status: RosStatus;
  isConnected: boolean;
  isConnecting: boolean;
}

const RosStatusContext = createContext<RosStatusContextValue>({
  status: 'connecting',
  isConnected: false,
  isConnecting: true,
});

export const RosStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<RosStatus>('connecting');

  useEffect(() => {
    const onConnect = () => setStatus('connected');
    const onError   = () => setStatus('disconnected');
    const onClose   = () => setStatus('connecting'); // reconnect cycle started

    ros.on('connection', onConnect);
    ros.on('error', onError);
    ros.on('close', onClose);

    // Reflect initial state if already connected when component mounts
    // @ts-ignore — roslib typings don't expose isConnected directly
    if (ros.isConnected) setStatus('connected');

    return () => {
      ros.off('connection', onConnect);
      ros.off('error', onError);
      ros.off('close', onClose);
    };
  }, []);

  return (
    <RosStatusContext.Provider
      value={{
        status,
        isConnected: status === 'connected',
        isConnecting: status === 'connecting',
      }}
    >
      {children}
    </RosStatusContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useRosStatus = () => useContext(RosStatusContext);
