// CarrierPoolPanel.jsx — author dedicated carrier pools (kind, count, timing).
//
// Pause-and-apply: structural edits validate via validateFactoryConfig and then
// replace the whole config (clean engine re-init). Pools are dedicated — one
// pool serves at most one carrier segment (enforced by the validator).

import { useState, useCallback } from 'react';
import { useTwinContext } from './TwinProvider.jsx';
import { makeCarrierPool, CARRIER_KIND } from '../network/carrierPool.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';
import { validateFactoryConfig } from '../engine/validator.js';

const IDLE = 'idle';
const EDITING = 'editing';
const KINDS = Object.values(CARRIER_KIND);

function toDraft(pool) {
  return {
    id: pool.id,
    carrier_kind: pool.carrier_kind,
    count: pool.count,
    units_per_trip: pool.units_per_trip,
    speed_loaded_m_per_min: pool.speed_loaded_m_per_min,
    speed_empty_m_per_min: pool.speed_empty_m_per_min,
    load_unload_seconds: pool.load_unload_seconds,
  };
}

function rebuildPool(d) {
  return makeCarrierPool({
    id: d.id,
    carrier_kind: d.carrier_kind,
    count: parseInt(d.count, 10),
    units_per_trip: parseInt(d.units_per_trip, 10),
    speed_loaded_m_per_min: Number(d.speed_loaded_m_per_min),
    speed_empty_m_per_min: Number(d.speed_empty_m_per_min),
    load_unload_seconds: Number(d.load_unload_seconds),
  });
}

export default function CarrierPoolPanel({ onClose }) {
  const { config, twinHook, setConfig } = useTwinContext();
  const { pause, resume } = twinHook;

  const [mode, setMode] = useState(IDLE);
  const [drafts, setDrafts] = useState(null);
  const [errors, setErrors] = useState([]);

  const pools = config.carrierPools ?? [];

  const handleEdit = useCallback(() => {
    pause();
    setDrafts(pools.map(toDraft));
    setErrors([]);
    setMode(EDITING);
  }, [pause, pools]);

  const handleCancel = useCallback(() => {
    setMode(IDLE);
    setDrafts(null);
    setErrors([]);
    resume();
  }, [resume]);

  const buildCandidate = useCallback((nextDrafts) => {
    try {
      const candidate = makeFactoryConfig({
        materials: config.materials,
        processes: config.processes,
        stations: config.stations,
        segments: config.segments,
        nodes: config.nodes,
        exits: config.exits,
        carrierPools: nextDrafts.map(rebuildPool),
        shifts: config.shifts,
        orders: config.orders,
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
      setErrors(buildCandidate(next).errors);
      return next;
    });
  }, [buildCandidate]);

  const handleApply = useCallback(() => {
    const { candidate, errors: errs } = buildCandidate(drafts);
    if (errs.length || !candidate) {
      setErrors(errs.length ? errs : ['Invalid carrier configuration']);
      return;
    }
    setConfig(candidate);
    setMode(IDLE);
    setDrafts(null);
    setErrors([]);
    resume();
  }, [drafts, buildCandidate, setConfig, resume]);

  const editing = mode === EDITING;
  const rows = editing ? drafts : pools.map(toDraft);

  return (
    <div
      data-testid="carrier-pool-panel"
      style={{
        position: 'absolute',
        top: 64,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 340,
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
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Carrier pools</span>
        <button onClick={onClose} style={closeBtn}>×</button>
      </div>

      {editing && (
        <div data-testid="carrier-paused-banner" style={bannerStyle}>⏸ Paused for edit</div>
      )}

      <div style={{ padding: '10px 12px' }}>
        {rows.length === 0 ? (
          <div data-testid="carrier-empty" style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
            No carrier pools in this scenario. (Switch to the “Carrier (AMR)” scenario to edit one.)
          </div>
        ) : (
          rows.map((d, idx) => (
            <div
              key={d.id}
              data-testid={`pool-row-${d.id}`}
              style={{ border: '1px solid #1e293b', borderRadius: 6, padding: '6px 8px', marginBottom: 6 }}
            >
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#94a3b8', marginBottom: 4 }}>
                {d.id} <span style={{ color: '#475569' }}>· {d.carrier_kind}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Field label="count" testid={`pool-count-${d.id}`} value={d.count}
                  disabled={!editing} onChange={(v) => updateDraft(idx, { count: v })} />
                <Field label="per trip" testid={`pool-pertrip-${d.id}`} value={d.units_per_trip}
                  disabled={!editing} onChange={(v) => updateDraft(idx, { units_per_trip: v })} />
                <Field label="load(s)" testid={`pool-loadunload-${d.id}`} value={d.load_unload_seconds}
                  disabled={!editing} onChange={(v) => updateDraft(idx, { load_unload_seconds: v })} />
                <Field label="ld m/min" testid={`pool-loaded-${d.id}`} value={d.speed_loaded_m_per_min}
                  disabled={!editing} onChange={(v) => updateDraft(idx, { speed_loaded_m_per_min: v })} />
                <Field label="mt m/min" testid={`pool-empty-${d.id}`} value={d.speed_empty_m_per_min}
                  disabled={!editing} onChange={(v) => updateDraft(idx, { speed_empty_m_per_min: v })} />
              </div>
            </div>
          ))
        )}

        {editing && errors.length > 0 && (
          <div data-testid="carrier-errors" style={{ color: '#fca5a5', fontSize: 11, marginTop: 6 }}>
            {errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {!editing ? (
              <button data-testid="carrier-edit-btn" onClick={handleEdit}
                style={{ ...btnStyle, background: '#1e293b', color: '#94a3b8', width: '100%' }}>Edit</button>
            ) : (
              <>
                <button data-testid="carrier-apply-btn" onClick={handleApply} disabled={errors.length > 0}
                  style={{ ...btnStyle, background: errors.length ? '#334155' : '#2563eb', color: '#fff', flex: 1, cursor: errors.length ? 'not-allowed' : 'pointer' }}>
                  Apply
                </button>
                <button data-testid="carrier-cancel-btn" onClick={handleCancel}
                  style={{ ...btnStyle, background: '#374151', color: '#94a3b8', flex: 1 }}>Cancel</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, testid, value, disabled, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: '#64748b' }}>{label}</span>
      <input
        data-testid={testid}
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, width: 56, opacity: disabled ? 0.6 : 1 }}
      />
    </label>
  );
}

const bannerStyle = { background: '#4c1d95', color: '#ddd6fe', padding: '4px 12px', fontSize: 11, textAlign: 'center' };
const closeBtn = { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16 };
const inputStyle = {
  background: '#0f172a', border: '1px solid #334155', borderRadius: 4,
  color: '#e2e8f0', padding: '3px 6px', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box',
};
const btnStyle = { padding: '5px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'monospace' };
