// TrackEditor.jsx — author the transport network (node placement + segments).
//
// Junction routing is material-type based and implicit (derived from
// next_process + station capabilities + graph reachability), so there is no
// "routing rule" field to edit — the editor edits node coordinates + segment
// topology/properties, and correctness is enforced by validateFactoryConfig
// before a change is applied. Structural edits replace the whole config (clean
// re-init).
//
// Node coordinates are real-world metres (x = width, y = floor height,
// z = depth) so a layout can be placed exactly against an engineering drawing;
// they are carried as config.layout_overrides and survive the round-trip.

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTwinContext } from './TwinProvider.jsx';
import { makeTrackSegment, TRANSPORT_MODE } from '../network/trackSegment.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';
import { validateFactoryConfig } from '../engine/validator.js';
import { computeTwinLayout } from './twinLayout.js';
import { T, useKeyboardShortcuts } from './kit.jsx';

const IDLE = 'idle';
const EDITING = 'editing';
const MODES = Object.values(TRANSPORT_MODE);

function toDraft(seg) {
  return {
    id: seg.id,
    from_node_id: seg.from_node_id,
    to_node_id: seg.to_node_id,
    length_m: seg.length_m,
    capacity: seg.capacity,
    class: seg.transport.class,
    mode: seg.transport.mode ?? TRANSPORT_MODE.CONVEYOR,
    speed_m_per_min: seg.transport.speed_m_per_min ?? 60,
    pool_id: seg.transport.pool_id ?? '',
  };
}

function rebuildSegment(d) {
  const transport = d.class === 'carrier'
    ? { class: 'carrier', pool_id: d.pool_id }
    : { class: 'passive', mode: d.mode, speed_m_per_min: Number(d.speed_m_per_min) };
  return makeTrackSegment({
    id: d.id,
    from_node_id: d.from_node_id,
    to_node_id: d.to_node_id,
    length_m: Number(d.length_m),
    capacity: parseInt(d.capacity, 10),
    transport,
  });
}

export default function TrackEditor({ onClose }) {
  const { config, twinHook, setConfig } = useTwinContext();
  const { pause, resume } = twinHook;

  const [mode, setMode] = useState(IDLE);
  const [drafts, setDrafts] = useState(null);
  const [coords, setCoords] = useState(null);   // { nodeId: {x,y,z} } pinned overrides
  const [errors, setErrors] = useState([]);

  // Computed fallback positions so the inputs show meaningful numbers even for
  // nodes that have no explicit override yet.
  const computed = useMemo(
    () => computeTwinLayout(config, config.layout_overrides || {}),
    [config],
  );
  const posOf = useCallback(
    (id, src) => src?.[id] ?? config.layout_overrides?.[id] ?? computed.get(id) ?? { x: 0, y: 0, z: 0 },
    [config.layout_overrides, computed],
  );

  const handleEdit = useCallback(() => {
    pause();
    setDrafts(config.segments.map(toDraft));
    setCoords({ ...(config.layout_overrides || {}) });
    setErrors([]);
    setMode(EDITING);
  }, [pause, config.segments, config.layout_overrides]);

  const handleCancel = useCallback(() => {
    setMode(IDLE);
    setDrafts(null);
    setCoords(null);
    setErrors([]);
    resume();
  }, [resume]);

  // Build a candidate config from the current drafts + coordinates, validating.
  const buildCandidate = useCallback((nextDrafts, nextCoords) => {
    try {
      const segments = nextDrafts.map(rebuildSegment);
      const candidate = makeFactoryConfig({
        materials: config.materials,
        processes: config.processes,
        stations: config.stations,
        segments,
        nodes: config.nodes,
        exits: config.exits,
        carrierPools: config.carrierPools,
        shifts: config.shifts,
        orders: config.orders,
        layout_overrides: { ...(config.layout_overrides || {}), ...(nextCoords || {}) },
      });
      const v = validateFactoryConfig(candidate);
      return { candidate, errors: v.errors };
    } catch (err) {
      return { candidate: null, errors: [err.message] };
    }
  }, [config]);

  const updateDraft = useCallback((idx, patch) => {
    setDrafts((prev) => {
      const next = prev.map((d, i) => (i === idx ? { ...d, ...patch } : d));
      setErrors(buildCandidate(next, coords).errors);
      return next;
    });
  }, [buildCandidate, coords]);

  const updateCoord = useCallback((nodeId, axis, value) => {
    setCoords((prev) => {
      const base = posOf(nodeId, prev);
      const n = Number(value);
      const next = { ...prev, [nodeId]: { x: base.x, y: base.y, z: base.z, [axis]: Number.isFinite(n) ? n : 0 } };
      setErrors(buildCandidate(drafts, next).errors);
      return next;
    });
  }, [buildCandidate, drafts, posOf]);

  const handleApply = useCallback(() => {
    const { candidate, errors: errs } = buildCandidate(drafts, coords);
    if (errs.length || !candidate) {
      setErrors(errs.length ? errs : ['Invalid network configuration']);
      return;
    }
    setConfig(candidate);   // full engine re-init with the new network
    setMode(IDLE);
    setDrafts(null);
    setCoords(null);
    setErrors([]);
    resume();
  }, [drafts, coords, buildCandidate, setConfig, resume]);

  // Escape key handler
  useKeyboardShortcuts([
    {
      key: 'Escape',
      action: () => {
        if (mode === EDITING) handleCancel();
        else if (onClose) onClose();
      },
    },
  ], [mode, handleCancel, onClose]);

  // Cleanup: if the form unmounts while in EDITING mode, resume the twin.
  useEffect(() => {
    return () => {
      if (mode === EDITING) {
        resume();
      }
    };
  }, [mode, resume]);

  const editing = mode === EDITING;

  return (
    <div
      data-testid="track-editor"
      style={{
        position: 'absolute',
        top: 64,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 360,
        maxHeight: '70vh',
        overflowY: 'auto',
        background: 'rgba(12,19,34,0.94)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${editing ? '#7c3aed' : '#1e3a5f'}`,
        borderRadius: 8,
        color: '#cbd5e1',
        zIndex: 200,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #1e293b' }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Network &amp; layout editor</span>
        <button onClick={onClose} title="Close network editor" aria-label="Close network editor" style={closeBtn}>×</button>
      </div>

      {editing && (
        <div data-testid="track-paused-banner" style={bannerStyle}>⏸ Paused for edit</div>
      )}

      <div style={{ padding: '10px 12px' }}>
        {/* Nodes — coordinates in metres (x / y / z) */}
        <div style={sectionLabel}>Node positions — metres ({config.nodes.length})</div>
        {config.nodes.map((n) => {
          const p = posOf(n.id, coords);
          return (
            <div
              key={n.id}
              data-testid={`node-row-${n.id}`}
              style={{ border: '1px solid #1e293b', borderRadius: 6, padding: '6px 8px', marginBottom: 6 }}
            >
              <div style={{ fontSize: 11, fontFamily: T.mono, color: '#94a3b8', marginBottom: 4 }}>
                {n.id}<span style={{ color: '#475569' }}> · {n.type}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Field label="x" testid={`node-x-${n.id}`} value={p.x} disabled={!editing} onChange={(v) => updateCoord(n.id, 'x', v)} />
                <Field label="y" testid={`node-y-${n.id}`} value={p.y} disabled={!editing} onChange={(v) => updateCoord(n.id, 'y', v)} />
                <Field label="z" testid={`node-z-${n.id}`} value={p.z} disabled={!editing} onChange={(v) => updateCoord(n.id, 'z', v)} />
              </div>
            </div>
          );
        })}

        {/* Segments */}
        <div style={{ ...sectionLabel, marginTop: 10 }}>Segments ({config.segments.length})</div>
        {(editing ? drafts : config.segments.map(toDraft)).map((d, idx) => (
          <div
            key={d.id}
            data-testid={`segment-row-${d.id}`}
            style={{ border: '1px solid #1e293b', borderRadius: 6, padding: '6px 8px', marginBottom: 6 }}
          >
            <div style={{ fontSize: 11, fontFamily: T.mono, color: '#94a3b8', marginBottom: 4 }}>
              {d.id}: {d.from_node_id} → {d.to_node_id}
              <span style={{ color: '#475569' }}> · {d.class}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Field label="len(m)" testid={`seg-length-${d.id}`} value={d.length_m}
                disabled={!editing} onChange={(v) => updateDraft(idx, { length_m: v })} />
              <Field label="cap" testid={`seg-capacity-${d.id}`} value={d.capacity}
                disabled={!editing} onChange={(v) => updateDraft(idx, { capacity: v })} />
              {d.class === 'passive' ? (
                <Field label="m/min" testid={`seg-speed-${d.id}`} value={d.speed_m_per_min}
                  disabled={!editing} onChange={(v) => updateDraft(idx, { speed_m_per_min: v })} />
              ) : (
                <div style={{ fontSize: 11, color: '#64748b', alignSelf: 'flex-end' }}>pool: {d.pool_id}</div>
              )}
            </div>
            {editing && d.class === 'passive' && (
              <select
                data-testid={`seg-mode-${d.id}`}
                value={d.mode}
                onChange={(e) => updateDraft(idx, { mode: e.target.value })}
                style={{ ...inputStyle, marginTop: 4, width: '100%' }}
              >
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>
        ))}

        {/* Validation errors */}
        {editing && errors.length > 0 && (
          <div data-testid="track-errors" style={{ color: '#fca5a5', fontSize: 11, marginTop: 6 }}>
            {errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {!editing ? (
            <button data-testid="track-edit-btn" onClick={handleEdit}
              style={{ ...btnStyle, background: '#1e293b', color: '#94a3b8', width: '100%' }}>Edit</button>
          ) : (
            <>
              <button data-testid="track-apply-btn" onClick={handleApply} disabled={errors.length > 0}
                style={{ ...btnStyle, background: errors.length ? '#334155' : '#2563eb', color: '#fff', flex: 1, cursor: errors.length ? 'not-allowed' : 'pointer' }}>
                Apply
              </button>
              <button data-testid="track-cancel-btn" onClick={handleCancel}
                style={{ ...btnStyle, background: '#374151', color: '#94a3b8', flex: 1 }}>Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, testid, value, disabled, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
      <span style={{ fontSize: 10, color: '#64748b' }}>{label}</span>
      <input
        data-testid={testid}
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, width: '100%', opacity: disabled ? 0.6 : 1 }}
      />
    </label>
  );
}

const sectionLabel = { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 };
const bannerStyle = { background: '#4c1d95', color: '#ddd6fe', padding: '4px 12px', fontSize: 11, textAlign: 'center' };
const closeBtn = { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16 };
const inputStyle = {
  background: '#0f172a', border: '1px solid #334155', borderRadius: 4,
  color: '#e2e8f0', padding: '3px 6px', fontSize: 12, fontFamily: T.mono, boxSizing: 'border-box',
};
const btnStyle = { padding: '5px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: T.mono };
