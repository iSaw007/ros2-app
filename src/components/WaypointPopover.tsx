import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { CloseIcon } from "./ui/Icons";
import { useDraggable } from "../hooks/useDraggable";

type Pending = { x: number; y: number; screenX: number; screenY: number };

type Props = {
  pending: Pending;
  /** Container size, so the card can be kept inside the map. */
  bounds: { width: number; height: number };
  onChange: (next: { x: number; y: number }) => void;
  onSend: () => void;
  onSave: (name: string) => void;
  onCancel: () => void;
  canSend: boolean;
};

const CARD_WIDTH = 208;
const CARD_HEIGHT = 208;

/**
 * Confirmation for a point picked on the map.
 *
 * A click proposes a destination; this is where it becomes a command. It also
 * accepts typed coordinates, because clicking is only accurate to whatever a
 * pixel happens to be worth at the current zoom — at a fifth of a metre per
 * pixel, "near the shelf" is the best a pointer can do.
 */
export const WaypointPopover: React.FC<Props> = ({
  pending, bounds, onChange, onSend, onSave, onCancel, canSend,
}) => {
  const [name, setName] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  // Reset the drag whenever a different point is picked, so each new waypoint
  // card opens beside its own click rather than wherever the last was left.
  const { offset, handleProps } = useDraggable(`${pending.screenX},${pending.screenY}`);

  // Escape cancels, as it would in any dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Keep the card on screen when the click lands near an edge.
  const left = Math.min(Math.max(8, pending.screenX + 12), Math.max(8, bounds.width - CARD_WIDTH - 8));
  const top = Math.min(Math.max(8, pending.screenY + 12), Math.max(8, bounds.height - CARD_HEIGHT - 8));

  const field = (label: string, value: number, set: (n: number) => void) => (
    <label className="flex flex-col gap-1">
      <span className="field-label">{label}</span>
      <input
        type="number"
        step="0.05"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => set(parseFloat(e.target.value))}
        className="tnum h-7 w-full rounded-[4px] border border-edge-strong bg-surface px-1.5 text-[12px] text-ink"
      />
    </label>
  );

  return (
    <div
      ref={cardRef}
      style={{ left: left + offset.x, top: top + offset.y, width: CARD_WIDTH }}
      className="absolute z-20 rounded-[6px] border border-edge bg-surface shadow-lg"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <header
        {...handleProps}
        className="flex h-7 items-center justify-between border-b border-edge px-2 select-none"
      >
        <span className="field-label">Waypoint</span>
        <button
          onClick={onCancel}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Discard waypoint"
          className="flex h-5 w-5 items-center justify-center rounded-[3px] text-faint transition-colors hover:bg-sunken hover:text-ink"
        >
          <CloseIcon size={12} />
        </button>
      </header>

      <div className="flex flex-col gap-2.5 p-2.5">
        <div className="grid grid-cols-2 gap-2">
          {field("X (m)", pending.x, (n) => onChange({ x: n, y: pending.y }))}
          {field("Y (m)", pending.y, (n) => onChange({ x: pending.x, y: n }))}
        </div>

        <Button variant="primary" size="sm" block onClick={onSend} disabled={!canSend}>
          Send robot here
        </Button>

        <div className="flex flex-col gap-1.5 border-t border-edge pt-2.5">
          <span className="field-label">Save as</span>
          <div className="flex gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave(name); }}
              placeholder="Charging bay"
              className="h-7 min-w-0 flex-1 rounded-[4px] border border-edge-strong bg-surface px-1.5 text-[12px] text-ink placeholder:text-faint"
            />
            <Button size="sm" onClick={() => onSave(name)} disabled={!name.trim()}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
