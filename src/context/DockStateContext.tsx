import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type DockSource = "mission" | "manual" | null;

type DockStateValue = {
  isDocked: boolean;
  /** How the current state came to be, so the UI can be honest about it. */
  source: DockSource;
  /** Record that a docking mission actually completed. */
  reportDocked: () => void;
  /** Record that the robot physically left the dock. */
  reportUndocked: () => void;
  /** Correct the flag by hand, moving nothing. */
  setManually: (docked: boolean) => void;
};

const STORAGE_KEY = "dock-state";

const DockStateContext = createContext<DockStateValue | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useDockState = () => {
  const context = useContext(DockStateContext);
  if (!context) throw new Error("useDockState must be used within a DockStateProvider");
  return context;
};

const readStored = (): { isDocked: boolean; source: DockSource } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { isDocked: false, source: null };
    const parsed = JSON.parse(raw);
    return { isDocked: !!parsed.isDocked, source: parsed.source ?? null };
  } catch {
    return { isDocked: false, source: null };
  }
};

/**
 * Whether the robot is sitting on its dock.
 *
 * This is one fact about the robot that several parts of the interface need —
 * the header, the navigation view, the docking mission — so it is held once
 * rather than re-derived in each of them. The previous arrangement had the
 * navigation page keep a private toggle that nothing else could see and nothing
 * ever set automatically, which made it a claim the operator had to maintain by
 * hand and could silently get wrong.
 *
 * It is still only the *app's* belief. The robot does not publish a docked
 * state, so this cannot survive being opened on another device, and after a
 * reload it is only as good as what this browser last recorded. Making it true
 * for everyone means publishing it from dock_coordinator on a latched topic and
 * reading it here instead of localStorage — at which point this provider is the
 * only file that changes.
 */
export const DockStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [{ isDocked, source }, setState] = useState(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ isDocked, source }));
    } catch {
      // Not being able to remember it is not worth failing over.
    }
  }, [isDocked, source]);

  const reportDocked = useCallback(() => setState({ isDocked: true, source: "mission" }), []);
  const reportUndocked = useCallback(() => setState({ isDocked: false, source: "mission" }), []);
  const setManually = useCallback(
    (docked: boolean) => setState({ isDocked: docked, source: "manual" }),
    [],
  );

  const value = useMemo(
    () => ({ isDocked, source, reportDocked, reportUndocked, setManually }),
    [isDocked, source, reportDocked, reportUndocked, setManually],
  );

  return <DockStateContext.Provider value={value}>{children}</DockStateContext.Provider>;
};
