import React, { useState, useRef, useCallback, useEffect } from 'react';
import { location_node } from '../data/m800_model.js';
import { computeLayout, saveOverrides, resetOverrides, loadOverrides } from '../layout/autoLayout.js';

const SITE_COLORS = { KMP: '#3b82f6', WH: '#10b981', EXT: '#6b7280' };
const FLOOR_LABELS = { GF: 'GF', FF: 'FF', SF: 'SF', '3F': '3F' };

// Only show leaf locations (not site/floor containers)
const LEAF_TYPES = new Set([
  'dock', 'buffer', 'lift', 'store', 'station_zone', 'ramp',
  'inspection_area', 'ASRS', 'ASRS_point', 'ASRS_zone', 'dispatch', 'external',
]);

// World → canvas pixel conversion
function worldToCanvas(wx, wz, pan, scale, canvasW, canvasH) {
  return {
    cx: canvasW / 2 + (wx + pan.x) * scale,
    cy: canvasH / 2 + (wz + pan.y) * scale,
  };
}
function canvasToWorld(cx, cy, pan, scale, canvasW, canvasH) {
  return {
    wx: (cx - canvasW / 2) / scale - pan.x,
    wz: (cy - canvasH / 2) / scale - pan.y,
  };
}

export default function LayoutEditor({ onClose }) {
  const containerRef = useRef(null);
  const [overrides, setOverrides] = useState(() => loadOverrides());
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(14); // pixels per world unit
  const [dragging, setDragging] = useState(null); // { id, startMouse, startWorld }
  const [panDragging, setPanDragging] = useState(null);
  const [size, setSize] = useState({ w: 800, h: 500 });

  // Compute layout with current overrides
  const layout = computeLayout(location_node, overrides);
  const leaves = location_node.filter(l => LEAF_TYPES.has(l.location_type));

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Drag node ──────────────────────────────────────────────────────────────
  const onNodeMouseDown = useCallback((e, locId) => {
    e.stopPropagation();
    const pos = layout[locId];
    setDragging({ id: locId, startMouse: { x: e.clientX, y: e.clientY }, startWorld: { x: pos.x, z: pos.z } });
  }, [layout]);

  // ── Pan canvas ─────────────────────────────────────────────────────────────
  const onCanvasMouseDown = useCallback((e) => {
    setPanDragging({ startMouse: { x: e.clientX, y: e.clientY }, startPan: { ...pan } });
  }, [pan]);

  const onMouseMove = useCallback((e) => {
    if (dragging) {
      const dx = (e.clientX - dragging.startMouse.x) / scale;
      const dz = (e.clientY - dragging.startMouse.y) / scale;
      const newX = dragging.startWorld.x + dx;
      const newZ = dragging.startWorld.z + dz;
      setOverrides(prev => ({ ...prev, [dragging.id]: { x: +newX.toFixed(2), z: +newZ.toFixed(2) } }));
    } else if (panDragging) {
      const dx = (e.clientX - panDragging.startMouse.x) / scale;
      const dy = (e.clientY - panDragging.startMouse.y) / scale;
      setPan({ x: panDragging.startPan.x + dx, y: panDragging.startPan.y + dy });
    }
  }, [dragging, panDragging, scale]);

  const onMouseUp = useCallback(() => {
    setDragging(null);
    setPanDragging(null);
  }, []);

  // Zoom via scroll
  const onWheel = useCallback((e) => {
    e.preventDefault();
    setScale(s => Math.min(30, Math.max(5, s - e.deltaY * 0.02)));
  }, []);

  const handleSave = () => {
    saveOverrides(overrides);
    onClose(overrides);
  };

  const handleReset = () => {
    resetOverrides();
    setOverrides({});
  };

  const { w, h } = size;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--panel-bg)', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Edit Layout — Top-Down View (drag nodes to reposition)</span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button onClick={handleReset} style={btnStyle('var(--warning)')}>Reset to Auto</button>
          <button onClick={handleSave} style={btnStyle('var(--success)')}>Save Layout</button>
          <button onClick={() => onClose(null)} style={btnStyle('var(--danger)')}>Cancel</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, padding: '6px 16px', background: '#0f1117', fontSize: 11, color: '#aaa' }}>
        {Object.entries(SITE_COLORS).map(([site, color]) => (
          <span key={site} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {site === 'EXT' ? 'External' : site}
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>Scroll to zoom · Drag empty area to pan · Drag node to move</span>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab', position: 'relative', userSelect: 'none' }}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        {/* Grid lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {gridLines(w, h, pan, scale)}
        </svg>

        {/* Nodes */}
        {leaves.map(loc => {
          const pos = layout[loc.location_id];
          if (!pos) return null;
          const { cx, cy } = worldToCanvas(pos.x, pos.z, pan, scale, w, h);
          const color = SITE_COLORS[loc.site] || '#888';
          const isOverridden = !!overrides[loc.location_id];
          const isDragged = dragging?.id === loc.location_id;

          return (
            <div
              key={loc.location_id}
              onMouseDown={e => onNodeMouseDown(e, loc.location_id)}
              style={{
                position: 'absolute',
                left: cx,
                top: cy,
                transform: 'translate(-50%, -50%)',
                cursor: 'grab',
                zIndex: isDragged ? 20 : 10,
              }}
            >
              <div style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: color,
                border: isOverridden ? '2px solid white' : '1px solid rgba(255,255,255,0.3)',
                boxShadow: isDragged ? `0 0 0 3px ${color}55` : 'none',
              }} />
              <div style={{
                position: 'absolute',
                top: 14,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 9,
                color: '#ccc',
                whiteSpace: 'nowrap',
                background: 'rgba(0,0,0,0.7)',
                padding: '1px 3px',
                borderRadius: 2,
                pointerEvents: 'none',
              }}>
                {loc.zone || loc.location_type}
                {loc.floor ? ` (${FLOOR_LABELS[loc.floor]})` : ''}
              </div>
            </div>
          );
        })}

        {/* Floor labels at Y=0 level (show site groupings) */}
        <div style={{ position: 'absolute', bottom: 12, left: 16, fontSize: 11, color: '#555', pointerEvents: 'none' }}>
          Floor elevation is fixed by floor type (GF→0, FF→5, SF→10, 3F→15). Dragging moves X/Z only.
        </div>
      </div>
    </div>
  );
}

function btnStyle(color) {
  return {
    background: 'transparent',
    border: `1px solid ${color}`,
    color,
    padding: '5px 12px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  };
}

function gridLines(w, h, pan, scale) {
  const lines = [];
  const step = 5; // grid every 5 world units
  // Horizontal lines (constant z)
  const zStart = Math.floor((-h / 2 / scale) - pan.y - 5);
  const zEnd   = Math.ceil((h / 2 / scale) - pan.y + 5);
  for (let z = zStart; z <= zEnd; z += step) {
    const { cy } = { cx: 0, cy: h / 2 + (z + pan.y) * scale };
    lines.push(<line key={`h${z}`} x1={0} y1={cy} x2={w} y2={cy} stroke="#1a1f2e" strokeWidth={1} />);
  }
  // Vertical lines (constant x)
  const xStart = Math.floor((-w / 2 / scale) - pan.x - 5);
  const xEnd   = Math.ceil((w / 2 / scale) - pan.x + 5);
  for (let x = xStart; x <= xEnd; x += step) {
    const cx = w / 2 + (x + pan.x) * scale;
    lines.push(<line key={`v${x}`} x1={cx} y1={0} x2={cx} y2={h} stroke="#1a1f2e" strokeWidth={1} />);
  }
  // Site boundaries
  lines.push(<line key="kmp-wh" x1={w/2 + pan.x * scale} y1={0} x2={w/2 + pan.x * scale} y2={h} stroke="#2a3048" strokeWidth={1} strokeDasharray="4 4" />);
  return lines;
}
