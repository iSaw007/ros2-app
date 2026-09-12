import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import ros, { bridgeUrl, reconnectNow } from "../services/rosConnection";

type RosStatus = "connected" | "connecting" | "disconnected";

interface RosStatusContextValue {
  status: RosStatus;
  isConnected: boolean;
  isConnecting: boolean;
  /** When the current link was established, or null while it is down. */
  connectedSince: number | null;
  /** rosbridge WebSocket URL, for display. */
  url: string;
  /** Retry immediately instead of waiting out the backoff. */
  reconnect: () => void;
}

const RosStatusContext = createContext<RosStatusContextValue>({
  status: "connecting",
  isConnected: false,
  isConnecting: true,
  connectedSince: null,
  url: "",
  reconnect: () => {},
});

export const RosStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<RosStatus>("connecting");
  const [connectedSince, setConnectedSince] = useState<number | null>(null);

  useEffect(() => {
    const onConnect = () => {
      setStatus("connected");
      setConnectedSince(Date.now());
    };
    const onError = () => {
      setStatus("disconnected");
      setConnectedSince(null);
    };
    const onClose = () => {
      // The socket closed and rosConnection has already scheduled a retry.
      setStatus("connecting");
      setConnectedSince(null);
    };

    ros.on("connection", onConnect);
    ros.on("error", onError);
    ros.on("close", onClose);

    // Reflect a link that was already up before this provider mounted.
    if (ros.isConnected) onConnect();

    return () => {
      ros.off("connection", onConnect);
      ros.off("error", onError);
      ros.off("close", onClose);
    };
  }, []);

  const value = useMemo(
    () => ({
      status,
      isConnected: status === "connected",
      isConnecting: status === "connecting",
      connectedSince,
      url: bridgeUrl as string,
      reconnect: reconnectNow as () => void,
    }),
    [status, connectedSince],
  );

  return <RosStatusContext.Provider value={value}>{children}</RosStatusContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useRosStatus = () => useContext(RosStatusContext);
