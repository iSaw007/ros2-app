import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type DockSize = "sm" | "md" | "lg";

/** Display sizes, kept at the camera's own 4:3 so frames are never letterboxed. */
// eslint-disable-next-line react-refresh/only-export-components
export const DOCK_SIZES: Record<DockSize, { width: number; height: number; quality: number }> = {
  sm: { width: 224, height: 168, quality: 30 },
  md: { width: 304, height: 228, quality: 40 },
  lg: { width: 400, height: 300, quality: 55 },
};

const STORAGE_KEY = "camera-dock";

type CameraDockContextValue = {
  isOpen: boolean;
  size: DockSize;
  toggle: () => void;
  close: () => void;
  cycleSize: () => void;
};

const CameraDockContext = createContext<CameraDockContextValue | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useCameraDock = () => {
  const context = useContext(CameraDockContext);
  if (!context) throw new Error("useCameraDock must be used within a CameraDockProvider");
  return context;
};

const readStored = (): { isOpen: boolean; size: DockSize } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { isOpen: false, size: "md" };
    const parsed = JSON.parse(raw);
    return {
      isOpen: !!parsed.isOpen,
      size: parsed.size in DOCK_SIZES ? parsed.size : "md",
    };
  } catch {
    // Private windows and blocked site data both throw here.
    return { isOpen: false, size: "md" };
  }
};

export const CameraDockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [{ isOpen, size }, setState] = useState(readStored);

  // Remember whether the operator wanted the camera up, and how big. This is a
  // per-viewer convenience, so browser storage is the right home for it.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ isOpen, size }));
    } catch {
      // Not being able to remember the preference is not worth failing over.
    }
  }, [isOpen, size]);

  const toggle = useCallback(() => setState((s) => ({ ...s, isOpen: !s.isOpen })), []);
  const close = useCallback(() => setState((s) => ({ ...s, isOpen: false })), []);
  const cycleSize = useCallback(
    () =>
      setState((s) => {
        const order: DockSize[] = ["sm", "md", "lg"];
        return { ...s, size: order[(order.indexOf(s.size) + 1) % order.length] };
      }),
    [],
  );

  const value = useMemo(
    () => ({ isOpen, size, toggle, close, cycleSize }),
    [isOpen, size, toggle, close, cycleSize],
  );

  return <CameraDockContext.Provider value={value}>{children}</CameraDockContext.Provider>;
};
