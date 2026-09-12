import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { CloseIcon, MapIcon, WarningIcon } from "./ui/Icons";

type Place = {
  id: string;
  name: string;
  x: number;
  y: number;
  mapId?: string | null;
};

type Props = {
  locations: Place[];
  currentMapId: string | null;
  canSend: boolean;
  /** Robot's current pose, used to prefill "add here". */
  robotPose: { x: number; y: number } | null;
  onGo: (place: Place) => void;
  onDelete: (id: string) => void;
  onAdd: (entry: { name: string; x: number; y: number }) => void;
  onHover: (id: string | null) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  note: string | null;
};

/**
 * Saved waypoints, as a menu rather than a permanently open list.
 *
 * The list is reference material, consulted occasionally: it does not earn
 * standing space next to the live status panels, and on a narrow screen it
 * would push the map off the bottom entirely.
 */
export const SavedLocations: React.FC<Props> = ({
  locations, currentMapId, canSend, robotPose,
  onGo, onDelete, onAdd, onHover, onExport, onImport, note,
}) => {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", x: 0, y: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Close when the pointer goes elsewhere or Escape is pressed.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        onHover(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); onHover(null); }
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onHover]);

  const startAdding = () => {
    // Prefilled with where the robot is, which makes "remember this spot" a
    // matter of naming it. Still editable for somewhere it has not been.
    setDraft({
      name: "",
      x: robotPose ? Math.round(robotPose.x * 100) / 100 : 0,
      y: robotPose ? Math.round(robotPose.y * 100) / 100 : 0,
    });
    setAdding(true);
  };

  const commitAdd = () => {
    if (!draft.name.trim()) return;
    onAdd({ name: draft.name, x: draft.x, y: draft.y });
    setAdding(false);
    setDraft({ name: "", x: 0, y: 0 });
  };

  const staleCount = locations.filter(
    (p) => currentMapId && p.mapId && p.mapId !== currentMapId,
  ).length;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-[6px] border border-edge bg-surface px-3 py-2.5 text-left transition-colors hover:bg-sunken"
      >
        <span className="flex items-center gap-2">
          <MapIcon size={15} />
          <span className="text-[13px] font-medium">Saved locations</span>
          <span className="tnum text-[11px] text-faint">{locations.length}</span>
          {staleCount > 0 && <WarningIcon size={12} />}
        </span>
        <span className={`text-faint transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-[6px] border border-edge bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-edge px-3 py-1.5">
            <button
              onClick={adding ? () => setAdding(false) : startAdding}
              className="text-[11px] font-medium text-accent transition-colors hover:brightness-110"
            >
              {adding ? "Cancel" : "+ Add location"}
            </button>
            <span className="flex items-center gap-2">
              <button
                onClick={() => importRef.current?.click()}
                className="text-[11px] text-faint transition-colors hover:text-ink"
              >
                Import
              </button>
              <button
                onClick={onExport}
                disabled={locations.length === 0}
                className="text-[11px] text-faint transition-colors hover:text-ink disabled:opacity-40"
              >
                Export
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) onImport(file);
                }}
                className="hidden"
              />
            </span>
          </div>

          {adding && (
            <div className="flex flex-col gap-2 border-b border-edge bg-sunken px-3 py-2.5">
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); }}
                placeholder="Name"
                className="h-7 rounded-[4px] border border-edge-strong bg-surface px-1.5 text-[12px] text-ink placeholder:text-faint"
              />
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y"] as const).map((axis) => (
                  <label key={axis} className="flex flex-col gap-1">
                    <span className="field-label">{axis.toUpperCase()} (m)</span>
                    <input
                      type="number"
                      step="0.05"
                      value={draft[axis]}
                      onChange={(e) => setDraft({ ...draft, [axis]: parseFloat(e.target.value) })}
                      className="tnum h-7 rounded-[4px] border border-edge-strong bg-surface px-1.5 text-[12px] text-ink"
                    />
                  </label>
                ))}
              </div>
              <p className="text-[10.5px] text-faint">
                {robotPose ? "Prefilled with the robot's position." : "No pose yet — type coordinates."}
              </p>
              <Button size="sm" variant="primary" block onClick={commitAdd} disabled={!draft.name.trim()}>
                Save location
              </Button>
            </div>
          )}

          <div className="max-h-[240px] overflow-y-auto">
            {locations.length === 0 ? (
              <p className="px-3 py-3 text-[11px] leading-relaxed text-faint">
                Nothing saved yet. Click the map, or use Add location above.
              </p>
            ) : (
              <ul className="divide-y divide-edge">
                {locations.map((place) => {
                  const wrongMap =
                    currentMapId && place.mapId && place.mapId !== currentMapId;
                  return (
                    <li
                      key={place.id}
                      onMouseEnter={() => onHover(place.id)}
                      onMouseLeave={() => onHover(null)}
                      className={`flex items-center gap-2 px-3 py-2 transition-colors hover:bg-sunken ${
                        wrongMap ? "bg-warn-soft/40" : ""
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-1.5">
                          {wrongMap && (
                            <span
                              className="shrink-0 text-warn"
                              title="Saved against a different map — these coordinates may no longer point where you expect."
                            >
                              <WarningIcon size={12} />
                            </span>
                          )}
                          <span className="truncate text-[12px] font-medium">{place.name}</span>
                        </span>
                        <span className="tnum text-[10.5px] text-faint">
                          {place.x.toFixed(2)}, {place.y.toFixed(2)}
                        </span>
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => onGo(place)} disabled={!canSend}>
                        Go
                      </Button>
                      <button
                        onClick={() => onDelete(place.id)}
                        aria-label={`Delete ${place.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-[4px] text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                      >
                        <CloseIcon size={12} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {note && <p className="border-t border-edge px-3 py-2 text-[11px] text-muted">{note}</p>}
          {staleCount > 0 && (
            <p className="border-t border-edge px-3 py-2 text-[11px] leading-relaxed text-warn">
              Marked locations were saved on a different map. Their coordinates
              may no longer point where you expect.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
