import { useCallback, useEffect, useRef, useState } from "react";

type Offset = { x: number; y: number };

/**
 * Makes a floating panel draggable by a handle.
 *
 * Returns an offset from wherever the element would otherwise sit, rather than
 * an absolute position, so the caller keeps control of the initial placement —
 * the waypoint card still opens next to the click, the camera dock still starts
 * in its corner, and dragging adjusts from there.
 *
 * Pointer events rather than mouse events, so this works under a finger as well
 * as a cursor, and pointer capture keeps the gesture attached to the handle even
 * when the pointer outruns it.
 */
export const useDraggable = (resetKey?: unknown) => {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const origin = useRef<{ x: number; y: number; base: Offset } | null>(null);

  // A new subject (a different waypoint, say) should appear where it belongs
  // rather than inheriting the last drag.
  useEffect(() => {
    setOffset({ x: 0, y: 0 });
  }, [resetKey]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      try {
        (event.currentTarget as Element).setPointerCapture(event.pointerId);
      } catch {
        /* capture is a convenience; dragging works without it */
      }
      origin.current = { x: event.clientX, y: event.clientY, base: offset };
    },
    [offset],
  );

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const start = origin.current;
    if (!start) return;
    setOffset({
      x: start.base.x + (event.clientX - start.x),
      y: start.base.y + (event.clientY - start.y),
    });
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    try {
      (event.currentTarget as Element).releasePointerCapture(event.pointerId);
    } catch {
      /* nothing was captured */
    }
    origin.current = null;
  }, []);

  return {
    offset,
    /** Spread onto the element that should act as the drag handle. */
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      style: { cursor: "grab", touchAction: "none" as const },
    },
  };
};
