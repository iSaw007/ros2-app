import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { subscribeToPose, getLastPose } from '../services/telemetryService';
import { IconButton } from './ui/Button';
import { CrosshairIcon, FitIcon, MinusIcon, PlusIcon } from './ui/Icons';

// Occupancy-grid canvas.
//
// The grid keeps a fixed dark palette in both themes. An operator reads a map
// by shape and contrast, and a map that inverts when the UI theme changes is
// harder to trust than one that always looks the same.

const readMapPalette = () => {
  const style = getComputedStyle(document.documentElement);
  return {
    void: style.getPropertyValue('--map-void').trim() || '#0b0e12',
    free: style.getPropertyValue('--map-free').trim() || '#f2f4f7',
    occupied: style.getPropertyValue('--map-occupied').trim() || '#1b2430',
    unknown: style.getPropertyValue('--map-unknown').trim() || '#949eab',
  };
};

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 60;

export default function MapRenderer({ mapData, onWaypoint, targetPose }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const gridCanvasRef = useRef(null);
  const fittedFor = useRef(null);

  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0 });
  const [robotPose, setRobotPose] = useState(getLastPose);
  const [cursorWorld, setCursorWorld] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => subscribeToPose(setRobotPose), []);

  // Track the container's real size so the canvas stays sharp when the window,
  // the sidebar, or the panel around it changes.
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /** Fits the whole grid into the viewport with a small margin. */
  const fitToView = useCallback(() => {
    if (!mapData?.info || !size.width || !size.height) return;
    const { width, height } = mapData.info;
    const zoom = Math.min(size.width / width, size.height / height) * 0.92;
    setView({
      zoom,
      x: (size.width - width * zoom) / 2,
      y: (size.height - height * zoom) / 2,
    });
  }, [mapData, size]);

  // Rasterise the grid once per message into an offscreen canvas, so panning and
  // zooming only ever redraw a bitmap rather than re-walking hundreds of
  // thousands of cells.
  useEffect(() => {
    if (!mapData?.info) return;
    const { width, height } = mapData.info;
    const cells = mapData.data;
    const palette = readMapPalette();

    const parse = (hex) => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    const free = parse(palette.free);
    const occupied = parse(palette.occupied);
    const unknown = parse(palette.unknown);

    let offscreen = gridCanvasRef.current;
    if (!offscreen) {
      offscreen = document.createElement('canvas');
      gridCanvasRef.current = offscreen;
    }
    offscreen.width = width;
    offscreen.height = height;

    const context = offscreen.getContext('2d');
    const image = context.createImageData(width, height);

    for (let i = 0; i < cells.length; i += 1) {
      const value = cells[i];
      const colour = value === 0 ? free : value === 100 ? occupied : unknown;

      // An OccupancyGrid is row-major from the bottom-left; ImageData is
      // row-major from the top-left, so the row index is mirrored.
      const x = i % width;
      const y = height - 1 - Math.floor(i / width);
      const offset = (y * width + x) * 4;

      image.data[offset] = colour[0];
      image.data[offset + 1] = colour[1];
      image.data[offset + 2] = colour[2];
      image.data[offset + 3] = value === -1 ? 90 : 255;
    }

    context.putImageData(image, 0, 0);
    fittedFor.current = null; // a new grid needs a fresh fit
  }, [mapData]);

  // Fit once per grid, and only once the container has been measured. Keeping
  // this out of the rasterise effect matters: fitToView changes identity on
  // every resize, and folding it in there would re-fit — throwing away the
  // operator's pan and zoom — each time the window or sidebar moved.
  useEffect(() => {
    if (!mapData?.info || !size.width || !size.height) return;
    if (fittedFor.current === mapData) return;
    fittedFor.current = mapData;
    fitToView();
  }, [mapData, size, fitToView]);

  // Draw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.width || !size.height) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = size.width * ratio;
    canvas.height = size.height * ratio;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const context = canvas.getContext('2d');
    const palette = readMapPalette();

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = palette.void;
    context.fillRect(0, 0, size.width, size.height);

    context.save();
    context.translate(view.x, view.y);
    context.scale(view.zoom, view.zoom);

    if (gridCanvasRef.current) {
      // Nearest-neighbour: at high zoom an operator should see honest cells,
      // not a blurred interpolation of them.
      context.imageSmoothingEnabled = view.zoom < 1;
      context.drawImage(gridCanvasRef.current, 0, 0);
    }

    // Overlays are drawn at a constant screen size, so they stay legible at
    // every zoom level instead of growing with the map.
    const toPixels = (worldX, worldY) => {
      const { resolution, origin, height } = mapData.info;
      return [
        (worldX - origin.position.x) / resolution,
        height - 1 - (worldY - origin.position.y) / resolution,
      ];
    };

    if (mapData?.info && targetPose) {
      const [px, py] = toPixels(targetPose.x, targetPose.y);
      const r = 7 / view.zoom;
      context.strokeStyle = '#f26060';
      context.lineWidth = 1.5 / view.zoom;
      context.beginPath();
      context.arc(px, py, r, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(px - r * 1.7, py);
      context.lineTo(px + r * 1.7, py);
      context.moveTo(px, py - r * 1.7);
      context.lineTo(px, py + r * 1.7);
      context.stroke();
    }

    if (mapData?.info && robotPose) {
      const [px, py] = toPixels(robotPose.x, robotPose.y);
      const scale = 1 / view.zoom;

      context.save();
      context.translate(px, py);
      // Yaw is counter-clockwise in the world; canvas y points down.
      context.rotate(-robotPose.yaw);

      context.fillStyle = 'rgba(59,130,246,0.22)';
      context.beginPath();
      context.arc(0, 0, 11 * scale, 0, Math.PI * 2);
      context.fill();

      // A wedge pointing along the robot's heading reads as an orientation at a
      // glance, where a dot plus a line does not.
      context.fillStyle = '#3b82f6';
      context.beginPath();
      context.moveTo(10 * scale, 0);
      context.lineTo(-6 * scale, -6 * scale);
      context.lineTo(-3 * scale, 0);
      context.lineTo(-6 * scale, 6 * scale);
      context.closePath();
      context.fill();

      context.restore();
    }

    context.restore();
  }, [view, size, robotPose, mapData, targetPose]);

  const toWorld = useCallback((clientX, clientY) => {
    if (!mapData?.info || !canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = (clientX - rect.left - view.x) / view.zoom;
    const canvasY = (clientY - rect.top - view.y) / view.zoom;
    const { resolution, origin, height } = mapData.info;
    return {
      x: canvasX * resolution + origin.position.x,
      y: origin.position.y + (height - 1 - canvasY) * resolution,
    };
  }, [mapData, view]);

  const handleMouseDown = (event) => {
    setIsDragging(true);
    dragOrigin.current = { x: event.clientX - view.x, y: event.clientY - view.y };
  };

  const handleMouseMove = (event) => {
    setCursorWorld(toWorld(event.clientX, event.clientY));
    if (!isDragging) return;
    setView((current) => ({
      ...current,
      x: event.clientX - dragOrigin.current.x,
      y: event.clientY - dragOrigin.current.y,
    }));
  };

  const endDrag = () => setIsDragging(false);

  const handleDoubleClick = (event) => {
    const world = toWorld(event.clientX, event.clientY);
    if (world && onWaypoint) onWaypoint(world);
  };

  const zoomAbout = (factor, clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const anchorX = clientX === undefined ? size.width / 2 : clientX - rect.left;
    const anchorY = clientY === undefined ? size.height / 2 : clientY - rect.top;

    setView((current) => {
      const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current.zoom * factor));
      const ratio = zoom / current.zoom;
      return {
        zoom,
        x: anchorX - (anchorX - current.x) * ratio,
        y: anchorY - (anchorY - current.y) * ratio,
      };
    });
  };

  // Registered natively rather than through React's onWheel, which attaches a
  // passive listener that cannot call preventDefault — without it the page
  // scrolls behind the map while zooming.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      zoomAbout(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [size]);

  const centreOnRobot = () => {
    if (!robotPose || !mapData?.info) return;
    const { resolution, origin, height } = mapData.info;
    const zoom = Math.max(view.zoom, 4);
    const px = (robotPose.x - origin.position.x) / resolution;
    const py = height - 1 - (robotPose.y - origin.position.y) / resolution;
    setView({ zoom, x: size.width / 2 - px * zoom, y: size.height / 2 - py * zoom });
  };

  // Metres per 100 screen pixels, rounded to something a person would say.
  const scaleMetres = mapData?.info
    ? (100 / view.zoom) * mapData.info.resolution
    : null;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[var(--map-void)]"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={() => { endDrag(); setCursorWorld(null); }}
        onDoubleClick={handleDoubleClick}
        className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}
      />

      {/* View controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <IconButton label="Zoom in" onClick={() => zoomAbout(1.25)}>
          <PlusIcon size={15} />
        </IconButton>
        <IconButton label="Zoom out" onClick={() => zoomAbout(1 / 1.25)}>
          <MinusIcon size={15} />
        </IconButton>
        <IconButton label="Fit map to view" onClick={fitToView}>
          <FitIcon size={15} />
        </IconButton>
        <IconButton
          label="Centre on robot"
          variant={robotPose ? 'primary' : 'default'}
          onClick={centreOnRobot}
          disabled={!robotPose}
        >
          <CrosshairIcon size={15} />
        </IconButton>
      </div>

      {/* Pose readout */}
      {robotPose && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-[5px] border border-white/10 bg-black/55 px-2.5 py-2 backdrop-blur-sm">
          <p className="field-label mb-1 !text-white/45">Robot</p>
          <p className="tnum text-[11.5px] leading-relaxed text-white/85">
            {robotPose.x.toFixed(2)}, {robotPose.y.toFixed(2)} m<br />
            {robotPose.yaw.toFixed(2)} rad
          </p>
        </div>
      )}

      {/* Scale bar and cursor position */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1.5">
        {scaleMetres !== null && (
          <div className="flex items-center gap-2">
            <div className="h-[5px] w-[100px] border-x border-b border-white/50" />
            <span className="tnum text-[10.5px] text-white/60">
              {scaleMetres < 1 ? `${(scaleMetres * 100).toFixed(0)} cm` : `${scaleMetres.toFixed(1)} m`}
            </span>
          </div>
        )}
        {cursorWorld && (
          <span className="tnum text-[10.5px] text-white/45">
            {cursorWorld.x.toFixed(2)}, {cursorWorld.y.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
