// ProcessForm.jsx — Kind-driven station inspector with pause-and-apply.
//
// State machine: Idle → Editing (Edit click) → Applied → Idle
// The twin is paused only when the user explicitly clicks "Edit",
// NOT on every onChange keystroke. In IDLE mode the header shows live
// stats (buffer fill, capacity, operators) so a click is informative even
// before editing.

import { useState, useCallback, useEffect } from 'react';
import { useTwinContext } from './TwinProvider.jsx';
import { effectiveSlots, capacityPerHour } from '../engine/derive.js';
import { fillStateColor } from '../../materials/factoryMaterials.js';
import { makeStation } from '../network/station.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';
import SchemaMatrixPanel from './SchemaMatrixPanel.jsx';
import { T, Button, Badge, Field, Stepper, SliderInput, IconButton, useKeyboardShortcuts } from './kit.jsx';

// State machine states
const IDLE = 'idle';
const EDITING = 'editing';

// Process kind → family color (matches the 3D station tints).
const KIND_FAMILY = {
  inspect: T.family.inspect,
  store: T.family.storage,
  hold: T.family.storage,
  offload: T.family.logistics,
  intake: T.family.logistics,
};
const kindColor = (kind) => KIND_FAMILY[kind] ?? T.family.production;

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

function KindFields({ draft, onChange, processKind, validationErrors }) {
  const readout = deriveReadout(draft, processKind);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* takt_seconds — shown for all kinds except store/hold */}
      {processKind !== 'store' && processKind !== 'hold' && (
        <Field label="Takt" error={validationErrors?.takt}>
          <Stepper
            testid="takt-input"
            value={draft.takt_seconds ?? ''}
            min={1}
            step={1}
            unit="s"
            error={validationErrors?.takt}
            onChange={(v) => onChange({ ...draft, takt_seconds: parseFloat(v) || draft.takt_seconds })}
          />
        </Field>
      )}

      {/* hold: dwell_seconds */}
      {processKind === 'hold' && (
        <Field label="Dwell">
          <Stepper
            value={draft.dwell_seconds ?? ''}
            min={1}
            step={1}
            unit="s"
            onChange={(v) => onChange({ ...draft, dwell_seconds: parseFloat(v) || draft.dwell_seconds })}
          />
        </Field>
      )}

      {/* inspect: pass_rate */}
      {processKind === 'inspect' && (
        <Field label="Pass rate" error={validationErrors?.pass_rate}>
          <SliderInput
            value={draft.pass_rate ?? 0}
            min={0}
            max={1}
            step={0.01}
            format={(n) => `${Math.round(n * 100)}%`}
            onChange={(v) => onChange({ ...draft, pass_rate: parseFloat(v) })}
          />
        </Field>
      )}

      {/* Derived readout */}
      {readout && (
        <div style={{ fontSize: 11, color: T.textFaint, background: T.surfaceSolid, borderRadius: 4, padding: '4px 8px', fontFamily: T.mono }}>
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

export default function ProcessForm({ selectedStationId, onClose, onOpenConfig }) {
  const { config, twinHook } = useTwinContext();
  const { pause, resume, applyConfig, metrics } = twinHook;

  const [mode, setMode] = useState(IDLE);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [drafts, setDrafts] = useState(null); // array of station process drafts when Editing
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
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
    setValidationErrors({});
  }, [pause, processes]);

  const handleCancel = useCallback(() => {
    setMode(IDLE);
    setDrafts(null);
    setError(null);
    setValidationErrors({});
    resume();
  }, [resume]);

  const handleApply = useCallback(() => {
    // Validate before applying
    const errs = {};
    const activeDraftForValidation = drafts?.[activeTabIdx] ?? drafts?.[0];
    const activeProcDef = processMap.get(activeDraftForValidation?.process_id);
    const kind = activeProcDef?.kind;

    if (kind !== 'store' && kind !== 'hold') {
      const takt = parseFloat(activeDraftForValidation?.takt_seconds);
      if (!Number.isFinite(takt) || takt <= 0) {
        errs.takt = 'Takt must be greater than 0';
      }
    }
    if (kind === 'inspect') {
      const pr = parseFloat(activeDraftForValidation?.pass_rate);
      if (!Number.isFinite(pr) || pr < 0 || pr > 1) {
        errs.pass_rate = 'Pass rate must be between 0 and 1';
      }
    }

    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors({});

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
  }, [station, drafts, config, applyConfig, resume, activeTabIdx, processMap]);

  const activeDraft = drafts?.[activeTabIdx] ?? drafts?.[0];

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

  // All hooks above this line — safe to bail out now.
  if (!station) return null;

  const fillRatio = metrics?.bufferFullness?.[station.id] ?? 0;
  const fillColor = fillStateColor(fillRatio);
  const totalOps = processes.reduce(
    (sum, p) => sum + (p.operators_per_slot ?? 0) * effectiveSlots(p.parallel_slots ?? 1, p.operators_per_slot ?? 0), 0);
  const readout = deriveReadout(activeProc, activeProcessDef?.kind);

  return (
    <div
      data-testid="process-form"
      style={{
        position: 'absolute',
        bottom: 80,
        right: 16,
        background: T.surface,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${mode === EDITING ? T.violet : T.border}`,
        borderRadius: T.radius,
        color: T.textDim,
        zIndex: T.z.rail,
        minWidth: 250,
        maxWidth: 320,
        boxShadow: T.shadow.panel,
        animation: 'twinFadeIn 0.18s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: `1px solid ${T.borderSoft}` }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.display }}>
          {station.name}
        </span>
        {activeProcessDef?.kind && (
          <Badge color={kindColor(activeProcessDef.kind)} bg={`${kindColor(activeProcessDef.kind)}1f`}>
            {activeProcessDef.kind}
          </Badge>
        )}
        {onClose && (
          <IconButton onClick={onClose} title="Close inspector">×</IconButton>
        )}
      </div>

      {/* Live stats strip */}
      <div style={{ display: 'flex', gap: 10, padding: '7px 12px', borderBottom: `1px solid ${T.borderSoft}`, fontSize: 10, fontFamily: T.sans, color: T.textFaint, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: fillColor, boxShadow: `0 0 5px ${fillColor}` }} />
          Buffer <span style={{ fontFamily: T.mono, color: fillColor }}>{Math.round(fillRatio * 100)}%</span>
        </span>
        {readout?.capacityPerHour && (
          <span>Cap <span style={{ fontFamily: T.mono, color: T.textDim }}>{readout.capacityPerHour}/hr</span></span>
        )}
        <span>Ops <span style={{ fontFamily: T.mono, color: T.textDim }}>{totalOps}</span></span>
      </div>

      {/* Paused banner */}
      {mode === EDITING && (
        <div
          data-testid="paused-banner"
          style={{ background: T.violetDeep, color: '#ddd6fe', padding: '4px 12px', fontSize: 11, textAlign: 'center', fontFamily: T.sans }}
        >
          ⏸ Paused for edit
        </div>
      )}

      {/* Process tabs */}
      {processes.length > 1 && (
        <div style={{ display: 'flex', gap: 2, padding: '6px 8px 0', borderBottom: `1px solid ${T.borderSoft}` }}>
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
                fontFamily: T.sans,
                fontWeight: 600,
                background: activeTabIdx === i ? T.borderSoft : 'transparent',
                color: activeTabIdx === i ? T.textDim : T.textFaint,
                cursor: 'pointer',
                transition: `background ${T.transition}, color ${T.transition}`,
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
            {activeProc && (
              <div style={{ fontSize: 12, fontFamily: T.mono, color: T.textDim, lineHeight: 1.6 }}>
                {activeProc.takt_seconds != null && <div>Takt: {activeProc.takt_seconds}s</div>}
                {activeProc.dwell_seconds != null && <div>Dwell: {activeProc.dwell_seconds}s</div>}
                <div>Slots: {activeProc.parallel_slots}</div>
                <div>Ops/slot: {activeProc.operators_per_slot}</div>
              </div>
            )}
            <Button testid="edit-btn" onClick={handleEdit} style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>
              Edit
            </Button>
            <Button
              testid="schema-toggle-btn"
              variant="ghost"
              onClick={() => setShowSchema((s) => !s)}
              style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}
            >
              {showSchema ? 'Hide schema impact ▴' : 'Schema impact ▾'}
            </Button>
            {onOpenConfig && (
              <Button
                variant="ghost"
                onClick={onOpenConfig}
                title="Open the full station editor in the Configuration panel"
                style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}
              >
                Open in Configuration →
              </Button>
            )}
            {showSchema && <SchemaMatrixPanel stationId={selectedStationId} />}
          </div>
        ) : (
          /* Editing view */
          <div>
            {activeDraft && (
              <KindFields
                draft={activeDraft}
                onChange={(updated) => {
                  setDrafts((prev) => prev.map((d, i) => i === activeTabIdx ? updated : d));
                  setValidationErrors({});
                }}
                processKind={activeProcessDef?.kind}
                validationErrors={validationErrors}
              />
            )}
            {error && (
              <div style={{ color: '#fca5a5', fontSize: 11, marginTop: 6, fontFamily: T.sans }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <Button testid="apply-btn" variant="primary" onClick={handleApply} style={{ flex: 1, justifyContent: 'center' }}>
                Apply
              </Button>
              <Button testid="cancel-btn" onClick={handleCancel} style={{ flex: 1, justifyContent: 'center' }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
