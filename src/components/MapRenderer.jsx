import React, { useEffect, useRef, useState } from 'react';
import { subscribeToPose, unsubscribeFromPose } from '../services/telemetryService';

export default function MapRenderer({ mapData, onMapDoubleClick, targetPose }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  
  // Transform state (zoom and pan)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Robot pose state
  const [robotPose, setRobotPose] = useState(null);

  // Subscribe to live robot pose
  useEffect(() => {
    subscribeToPose((x, y, yaw) => {
      setRobotPose({ x, y, yaw });
    });
    return () => {
      unsubscribeFromPose();
    };
  }, []);

  // Update offscreen canvas when map data changes
  useEffect(() => {
    if (!mapData || !mapData.info) return;

    const { width, height } = mapData.info;
    const data = mapData.data;

    // Create or resize offscreen canvas
    let offscreenCanvas = offscreenCanvasRef.current;
    if (!offscreenCanvas) {
      offscreenCanvas = document.createElement('canvas');
      offscreenCanvasRef.current = offscreenCanvas;
    }
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;

    const ctx = offscreenCanvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);

    // Render OccupancyGrid cells
    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      let r, g, b, a;

      if (val === 0) {
        // Free space: light grey-white
        r = 245; g = 247; b = 250; a = 255;
      } else if (val === 100) {
        // Occupied: dark slate grey
        r = 30; g = 41; b = 59; a = 255;
      } else {
        // Unknown or intermediate: soft blue-grey
        r = 148; g = 163; b = 184; a = 255;
      }

      // ROS 2 OccupancyGrid: row-major, starting at bottom-left corner
      // HTML Canvas ImageData: row-major, starting at top-left corner
      // Vertically flip the index
      const x = i % width;
      const y = height - 1 - Math.floor(i / width);
      const canvasIndex = (y * width + x) * 4;

      imageData.data[canvasIndex] = r;
      imageData.data[canvasIndex + 1] = g;
      imageData.data[canvasIndex + 2] = b;
      imageData.data[canvasIndex + 3] = a;
    }

    ctx.putImageData(imageData, 0, 0);

    // Initial fit-to-view
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const scaleX = containerWidth / width;
      const scaleY = containerHeight / height;
      const initialZoom = Math.min(scaleX, scaleY) * 0.9;
      setZoom(initialZoom);
      setPan({
        x: (containerWidth - width * initialZoom) / 2,
        y: (containerHeight - height * initialZoom) / 2
      });
    }
  }, [mapData]);

  // Main draw loop (requestAnimationFrame style drawing)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const offscreenCanvas = offscreenCanvasRef.current;

    // Set canvas resolution matching display size
    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    // Clear display canvas
    ctx.fillStyle = '#0f172a'; // Deep dark background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    
    // Apply pan & zoom
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 1. Draw cached map image
    if (offscreenCanvas) {
      ctx.drawImage(offscreenCanvas, 0, 0);
    }

    // 2. Overlay live robot pose
    if (robotPose && mapData && mapData.info) {
      const { resolution, origin } = mapData.info;
      const height = mapData.info.height;

      // Translate world coordinates to pixel coordinates on the map
      const robotPx = (robotPose.x - origin.position.x) / resolution;
      const robotPy = height - 1 - ((robotPose.y - origin.position.y) / resolution);

      // Draw robot position indicator (glowing outer circle + arrow direction)
      ctx.save();
      ctx.translate(robotPx, robotPy);
      ctx.rotate(-robotPose.yaw); // Rotate based on robot yaw (negative because canvas Y is flipped)

      // Outer glow pulse
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.4)'; // Glow blue
      ctx.fill();

      // Inner dot
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#3b82f6'; // Bright blue
      ctx.fill();

      // Heading arrow/nose pointing forward (+X in robot frame is forward)
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.lineTo(8, -4);
      ctx.lineTo(8, 4);
      ctx.closePath();
      ctx.fillStyle = '#60a5fa'; // Light blue arrow
      ctx.fill();

      ctx.restore();
    }

    // 3. Overlay target waypoint
    if (targetPose && mapData && mapData.info) {
      const { resolution, origin } = mapData.info;
      const height = mapData.info.height;

      const targetPx = (targetPose.x - origin.position.x) / resolution;
      const targetPy = height - 1 - ((targetPose.y - origin.position.y) / resolution);

      ctx.save();
      ctx.translate(targetPx, targetPy);

      // Draw red crosshair target marker
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, 2 * Math.PI);
      ctx.strokeStyle = '#ef4444'; // Red
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 10);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }, [pan, zoom, robotPose, mapData, targetPose]);

  // Handle drag-to-pan
  const handleMouseDown = (e) => {
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const handleDoubleClick = (e) => {
    if (!mapData || !mapData.info || !onMapDoubleClick) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Reverse pan and zoom to get canvas pixel coordinates
    const canvasX = (mouseX - pan.x) / zoom;
    const canvasY = (mouseY - pan.y) / zoom;
    
    const { resolution, origin, height } = mapData.info;
    
    // Convert back to ROS world coordinates
    const worldX = (canvasX * resolution) + origin.position.x;
    const worldY = origin.position.y + ((height - 1 - canvasY) * resolution);
    
    onMapDoubleClick(worldX, worldY);
  };

  // Handle scroll-wheel-to-zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    
    // Cap zoom scale
    const boundedZoom = Math.max(0.1, Math.min(100, newZoom));
    
    // Zoom toward cursor position
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const dx = mouseX - pan.x;
    const dy = mouseY - pan.y;
    
    setZoom(boundedZoom);
    setPan({
      x: mouseX - dx * (boundedZoom / zoom),
      y: mouseY - dy * (boundedZoom / zoom)
    });
  };

  const resetView = () => {
    if (!mapData || !mapData.info || !containerRef.current) return;
    const { width, height } = mapData.info;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    const scaleX = containerWidth / width;
    const scaleY = containerHeight / height;
    const initialZoom = Math.min(scaleX, scaleY) * 0.9;
    setZoom(initialZoom);
    setPan({
      x: (containerWidth - width * initialZoom) / 2,
      y: (containerHeight - height * initialZoom) / 2
    });
  };

  return (
    <div className="relative w-full h-[550px] bg-slate-950 rounded-xl overflow-hidden shadow-lg border border-slate-800" ref={containerRef}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
      
      {/* Floating control widget */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => {
            const newZoom = zoom * 1.2;
            setZoom(Math.min(100, newZoom));
          }}
          className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 shadow-md font-bold transition-all cursor-pointer"
          title="Zoom In"
        >
          ＋
        </button>
        <button
          onClick={() => {
            const newZoom = zoom / 1.2;
            setZoom(Math.max(0.1, newZoom));
          }}
          className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 shadow-md font-bold transition-all cursor-pointer"
          title="Zoom Out"
        >
          －
        </button>
        <button
          onClick={resetView}
          className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 shadow-md font-bold transition-all cursor-pointer"
          title="Reset View"
        >
          🔄
        </button>
      </div>

      {/* Telemetry info card */}
      {robotPose && (
        <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-sm p-3 rounded-lg border border-slate-800 shadow-md text-xs font-mono text-slate-300 flex flex-col gap-1 pointer-events-none">
          <div className="text-blue-400 font-bold mb-1 border-b border-slate-800 pb-1">Robot Pose</div>
          <div>X: {robotPose.x.toFixed(3)} m</div>
          <div>Y: {robotPose.y.toFixed(3)} m</div>
          <div>Yaw: {robotPose.yaw.toFixed(3)} rad</div>
        </div>
      )}
    </div>
  );
}
