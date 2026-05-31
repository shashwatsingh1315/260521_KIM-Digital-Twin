// ProcessForm.jsx — Kind-driven station process editor with pause-and-apply.
//
// State machine: Idle → Editing (Edit click) → Applied → Idle
// The twin is paused only when the user explicitly clicks "Edit",
// NOT on every onChange keystroke.

import { useState, useCallback, useEffect } from 'react';
import { useTwinContext } from './TwinProvider.jsx';
import { effectiveSlots, capacityPerHour } from '../engine/derive.js';
import { makeStation } from '../network/station.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';
import SchemaMatrixPanel from './SchemaMatrixPanel.jsx';

// State machine states
const IDLE = 'idle';
const EDITING = 'editing';

function deriveReadout(stationProc, processKind) {
  if (!stationProc) return null;
  const takt = parseFloat(stationProc.takt_seconds);
  if (!Number.isFinite(takt) || takt <= 0) return null;

  const effSlots = effectiveSlots(
    stationProc.parallel_slots ?? 1,
    stationProc.operators_per_slot ?? 0,
  );
  const cph = capacityPerHour(takt, effSlots);

  if (processKind === 'hold') {
    const dwell = parseFloat(stationProc.dwell_seconds);
    if (Number.isFinite(dwell) && dwell > 0) {
      return { label: 'Throughput', value: `${((stationProc.slots ?? 1) / dwell * 3600).toFixed(1)}/hr` };
    }
    return null;
  }

  return {
    effectiveSlots: effSlots,
    capacityPerHour: cph.toFixed(1),
  };
}

function KindFields({ stationProc, draft, onChange, processKind }) {
  const readout = deriveReadout(draft, processKind);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* takt_seconds — shown for all kinds except store/hold */}
      {processKind !== 'store' && processKind !== 'hold' && (
        <label style={labelStyle}>
          <span style={labelTextStyle}>Takt (s)</span>
          <input
            data-testid="takt-input"
            type="number"
            min={1}
            step={1}
            value={draft.takt_seconds ?? ''}
            onChange={(e) => onChange({ ...draft, takt_seconds: parseFloat(e.target.value) || draft.takt_seconds })}
            style={inputStyle}
          />
        </label>
      )}

      {/* hold: dwell_seconds */}
      {processKind === 'hold' && (
        <label style={labelStyle}>
          <span style={labelTextStyle}>Dwell (s)</span>
          <input
            type="number" min={1} step={1}
            value={draft.dwell_seconds ?? ''}
            onChange={(e) => onChange({ ...draft, dwell_seconds: parseFloat(e.target.value) || draft.dwell_seconds })}
            style={inputStyle}
          />
        </label>
      )}

      {/* inspect: pass_rate */}
      {processKind === 'inspect' && (
        <label style={labelStyle}>
          <span style={labelTextStyle}>Pass rate</span>
          <input
            type="number" min={0} max={1} step={0.01}
            value={draft.pass_rate ?? ''}
            onChange={(e) => onChange({ ...draft, pass_rate: parseFloat(e.target.value) })}
            style={inputStyle}
          />
        </label>
      )}

      {/* Derived readout */}
      {readout && (
        <div style={{ fontSize: 11, color: '#64748b', background: '#0f172a', borderRadius: 4, padding: '4px 8px', fontFamily: 'monospace' }}>
          {readout.label ? (
            <span>{readout.label}: {readout.value}</span>
          ) : (
            <>
              <span>eff. slots: {readout.effectiveSlots} · </span>
              <span>cap: {readout.capacityPerHour}/hr</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProcessForm({ selectedStationId, onClose }) {
  const { config, twinHook } = useTwinContext();
  const { pause, resume, applyConfig } = twinHook;

  const [mode, setMode] = useState(IDLE);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [drafts, setDrafts] = useState(null); // array of station process drafts when Editing
  const [error, setError] = useState(null);
  const [showSchema, setShowSchema] = useState(false);

  // Non-hook derivations (null-safe: station may be absent after a config swap).
  const station = config.stations.find((s) => s.id === selectedStationId);
  const processes = station?.processes ?? [];
  const activeProc = processes[activeTabIdx] ?? processes[0];

  // Map process_id → process def for kind lookup
  const processMap = new Map(config.processes.map((p) => [p.id, p]));
  const activeProcessDef = processMap.get(activeProc?.process_id);

  const handleEdit = useCallback(() => {
    pause();
    setDrafts(processes.map((p) => ({ ...p })));
    setMode(EDITING);
    setError(null);
  }, [pause, processes]);

  const handleCancel = useCallback(() => {
    setMode(IDLE);
    setDrafts(null);
    setError(null);
    resume();
  }, [resume]);

  const handleApply = useCallback(() => {
    try {
      // Rebuild config with updated station
      const updatedStation = makeStation({
        id: station.id,
        name: station.name,
        node_id: station.node_id,
        entry_buffer_capacity: station.entry_buffer_capacity,
        processes: drafts,
      });

      const newConfig = makeFactoryConfig({
        materials: config.materials,
        processes: config.processes,
        stations: config.stations.map((s) => s.id === station.id ? updatedStation : s),
        segments: config.segments,
        nodes: config.nodes,
        exits: config.exits,
        carrierPools: config.carrierPools,
        shifts: config.shifts,
        orders: config.orders,
      });

      applyConfig(newConfig);
      setMode(IDLE);
      setDrafts(null);
      setError(null);
      resume();
    } catch (err) {
      setError(err.message);
    }
  }, [station, drafts, config, applyConfig, resume]);

  const activeDraft = drafts?.[activeTabIdx] ?? drafts?.[0];

  // Cleanup: if the form unmounts while in EDITING mode, resume the twin.
  useEffect(() => {
    return () => {
      if (mode === EDITING) {
        resume();
      }
    };
  }, [mode, resume]);

  // All hooks above this line — safe to bail out now.
  if (!station) return null;

  return (
    <div
      data-testid="process-form"
      style={{
        position: 'absolute',
        bottom: 80,
        right: 16,
        background: 'rgba(12,19,34,0.92)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${mode === EDITING ? '#7c3aed' : '#1e3a5f'}`,
        borderRadius: 8,
        color: '#cbd5e1',
        zIndex: 100,
        minWidth: 240,
        maxWidth: 320,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #1e293b' }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>
          {station.name}
        </span>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14 }}>×</button>
        )}
      </div>

      {/* Paused banner */}
      {mode === EDITING && (
        <div
          data-testid="paused-banner"
          style={{ background: '#4c1d95', color: '#ddd6fe', padding: '4px 12px', fontSize: 11, textAlign: 'center' }}
        >
          ⏸ Paused for edit
        </div>
      )}

      {/* Process tabs */}
      {processes.length > 1 && (
        <div style={{ display: 'flex', gap: 2, padding: '6px 8px 0', borderBottom: '1px solid #1e293b' }}>
          {processes.map((p, i) => (
            <button
              key={p.process_id}
              data-testid={`process-tab-${p.process_id}`}
              onClick={() => setActiveTabIdx(i)}
              style={{
                padding: '3px 8px',
                borderRadius: '4px 4px 0 0',
                border: 'none',
                fontSize: 11,
                background: activeTabIdx === i ? '#1e293b' : 'transparent',
                color: activeTabIdx === i ? '#94a3b8' : '#475569',
                cursor: 'pointer',
              }}
            >
              {processMap.get(p.process_id)?.name ?? p.process_id}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '10px 12px' }}>
        {mode === IDLE ? (
          /* Read-only view */
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
              Kind: <span style={{ color: '#94a3b8' }}>{activeProcessDef?.kind ?? '—'}</span>
            </div>
            {activeProc && (
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#94a3b8', lineHeight: 1.6 }}>
                {activeProc.takt_seconds != null && <div>Takt: {activeProc.takt_seconds}s</div>}
                {activeProc.dwell_seconds != null && <div>Dwell: {activeProc.dwell_seconds}s</div>}
                <div>Slots: {activeProc.parallel_slots}</div>
                <div>Ops/slot: {activeProc.operators_per_slot}</div>
              </div>
            )}
            <button
              data-testid="edit-btn"
              onClick={handleEdit}
              style={{ ...btnStyle, marginTop: 10, background: '#1e293b', color: '#94a3b8', width: '100%' }}
            >
              Edit
            </button>
            <button
              data-testid="schema-toggle-btn"
              onClick={() => setShowSchema((s) => !s)}
              style={{ ...btnStyle, marginTop: 6, background: 'transparent', color: '#64748b', width: '100%', border: '1px solid #1e293b' }}
            >
              {showSchema ? 'Hide schema impact ▴' : 'Schema impact ▾'}
            </button>
            {showSchema && <SchemaMatrixPanel stationId={selectedStationId} />}
          </div>
        ) : (
          /* Editing view */
          <div>
            {activeDraft && (
              <KindFields
                stationProc={activeProc}
                draft={activeDraft}
                onChange={(updated) => {
                  setDrafts((prev) => prev.map((d, i) => i === activeTabIdx ? updated : d));
                }}
                processKind={activeProcessDef?.kind}
              />
            )}
            {error && (
              <div style={{ color: '#fca5a5', fontSize: 11, marginTop: 6 }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button
                data-testid="apply-btn"
                onClick={handleApply}
                style={{ ...btnStyle, background: '#2563eb', color: '#fff', flex: 1 }}
              >
                Apply
              </button>
              <button
                data-testid="cancel-btn"
                onClick={handleCancel}
                style={{ ...btnStyle, background: '#374151', color: '#94a3b8', flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = { display: 'flex', flexDirection: 'column', gap: 3 };
const labelTextStyle = { fontSize: 11, color: '#64748b' };
const inputStyle = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 4,
  color: '#e2e8f0',
  padding: '4px 8px',
  fontSize: 13,
  fontFamily: 'monospace',
  width: '100%',
  boxSizing: 'border-box',
};
const btnStyle = {
  padding: '5px 12px',
  borderRadius: 4,
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'monospace',
};
