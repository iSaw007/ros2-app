// Named waypoints the operator has saved.
//
// These live in browser storage rather than on the robot. That is the right
// trade for now — no robot-side schema to agree on, nothing to migrate, and
// they survive reloads — but it does mean the list belongs to this browser on
// this machine. Moving it to a ROS parameter or a small file on the robot is
// the obvious next step if two operators ever need the same list.

const STORAGE_KEY = 'saved-locations';

let cache = null;
const listeners = new Set();

const read = () => {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? JSON.parse(raw) : [];
  } catch {
    // Private windows and blocked site data both throw here.
    cache = [];
  }
  if (!Array.isArray(cache)) cache = [];
  return cache;
};

const write = (next) => {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Failing to persist is not worth losing the in-memory list over.
  }
  listeners.forEach((fn) => fn(next));
};

/** All saved locations, most recently added last. */
export const listLocations = () => read();

/**
 * Subscribes to changes in the saved list.
 * @returns {function} Unsubscribe.
 */
export const subscribeToLocations = (callback) => {
  listeners.add(callback);
  callback(read());
  return () => listeners.delete(callback);
};

/**
 * Saves a named location. A name already in use is overwritten rather than
 * duplicated, so re-saving a spot after nudging its coordinates does the
 * obvious thing.
 */
export const saveLocation = ({ name, x, y, theta = 0, mapId = null }) => {
  const trimmed = name.trim();
  if (!trimmed) return read();
  const existing = read().filter((entry) => entry.name !== trimmed);
  // mapId records which map these coordinates were measured against, so a
  // location saved on one map can be recognised as suspect on another.
  write([
    ...existing,
    { id: `${Date.now()}-${trimmed}`, name: trimmed, x, y, theta, mapId },
  ]);
  return read();
};

/** The saved list as pretty-printed JSON, for handing to another machine. */
export const exportLocations = () =>
  JSON.stringify({ version: 1, locations: read() }, null, 2);

/**
 * Merges an exported list into this one. Names already present are replaced, so
 * importing the same file twice is harmless rather than duplicating everything.
 *
 * @returns {{added: number, error: string|null}}
 */
export const importLocations = (json) => {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { added: 0, error: 'That file is not valid JSON.' };
  }

  const incoming = Array.isArray(parsed) ? parsed : parsed?.locations;
  if (!Array.isArray(incoming)) {
    return { added: 0, error: 'No locations found in that file.' };
  }

  const valid = incoming.filter(
    (entry) =>
      entry &&
      typeof entry.name === 'string' &&
      entry.name.trim() &&
      Number.isFinite(entry.x) &&
      Number.isFinite(entry.y),
  );
  if (valid.length === 0) {
    return { added: 0, error: 'No usable locations in that file.' };
  }

  const byName = new Map(read().map((entry) => [entry.name, entry]));
  valid.forEach((entry) => {
    byName.set(entry.name.trim(), {
      id: entry.id ?? `${Date.now()}-${entry.name.trim()}`,
      name: entry.name.trim(),
      x: entry.x,
      y: entry.y,
      theta: Number.isFinite(entry.theta) ? entry.theta : 0,
      mapId: entry.mapId ?? null,
    });
  });

  write([...byName.values()]);
  return { added: valid.length, error: null };
};

export const deleteLocation = (id) => {
  write(read().filter((entry) => entry.id !== id));
  return read();
};
