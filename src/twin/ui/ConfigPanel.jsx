// ConfigPanel.jsx — the comprehensive, docked Configuration editor.
//
// One tabbed sidebar that exposes *every* input in the FactoryConfig: Orders,
// Materials, Processes, Stations, Network, Carriers, Shifts, and Simulation.
// Edits mutate a local draft; live validation (build through the make* factories
// + validateFactoryConfig) gates the Apply button. Apply replaces the whole
// config via setConfig (clean engine re-init). The sim is paused while dirty.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTwinContext } from './TwinProvider.jsx';
import {
  T, Panel, Field, TextInput, NumberInput, Select, Button, IconButton,
  Badge, SectionTitle, EntityCard, Grid2,
  SearchInput, ConfirmDialog, EmptyState,
  Stepper, SliderInput, SegmentedControl, WeekdayPicker, ChipList,
} from './kit.jsx';
import {
  toDraft, buildAndValidate, PROCESS_KINDS, NODE_TYPES, EXIT_KINDS,
  CARRIER_KINDS, TRANSPORT_MODES,
} from './configDraft.js';

// Tabs grouped by concern. Every tab button stays mounted (e2e clicks them
// directly) — the grouping is visual, not navigational.
const GROUPS = [
  { label: 'Demand', tabs: [{ key: 'orders', label: 'Orders' }, { key: 'materials', label: 'Materials' }] },
  { label: 'Production', tabs: [{ key: 'processes', label: 'Processes' }, { key: 'stations', label: 'Stations' }] },
  { label: 'Logistics', tabs: [{ key: 'network', label: 'Network' }, { key: 'carriers', label: 'Carriers' }] },
  { label: 'Operations', tabs: [{ key: 'shifts', label: 'Shifts' }, { key: 'sim', label: 'Simulation' }] },
];

// ── grouped tab nav ──────────────────────────────────────────────────────

function GroupedTabs({ active, onChange }) {
  return (
    <div role="tablist" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: '8px 10px', borderBottom: `1px solid ${T.borderSoft}` }}>
      {GROUPS.map((g) => (
        <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: T.textFaint, fontFamily: T.display, paddingLeft: 2 }}>
            {g.label}
          </span>
          {g.tabs.map((t) => {
            const on = active === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                data-testid={`config-tab-${t.key}`}
                onClick={() => onChange(t.key)}
                style={{
                  padding: '4px 6px',
                  borderRadius: 5,
                  border: `1px solid ${on ? T.accent : 'transparent'}`,
                  background: on ? T.accentDeep : 'transparent',
                  color: on ? '#dbeafe' : T.textFaint,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontFamily: T.sans,
                  fontWeight: 600,
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  outline: 'none',
                  transition: `background ${T.transition}, color ${T.transition}`,
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = T.textDim; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = T.textFaint; }}
                onFocus={(e) => { e.target.style.boxShadow = `0 0 0 2px ${T.accent}`; }}
                onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── small composite inputs ───────────────────────────────────────────────

function FreeChips({ values, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {values.map((v, i) => (
        <div key={i} style={{ display: 'flex', gap: 4 }}>
          <TextInput value={v} onChange={(nv) => onChange(values.map((x, j) => (j === i ? nv : x)))} />
          <IconButton onClick={() => onChange(values.filter((_, j) => j !== i))} title="remove">✕</IconButton>
        </div>
      ))}
      <button onClick={() => onChange([...values, ''])} style={{ background: 'none', border: `1px dashed ${T.borderSoft}`, color: T.textFaint, borderRadius: 4, fontSize: 11, cursor: 'pointer', padding: '3px' }}>+ add</button>
    </div>
  );
}

function KVEditor({ obj, onChange, keyOptions, keyLabel = 'key', valLabel = 'qty' }) {
  const entries = Object.entries(obj ?? {});
  const setKey = (oldK, newK) => {
    const next = {}; for (const [k, v] of entries) next[k === oldK ? newK : k] = v; onChange(next);
  };
  const setVal = (k, v) => onChange({ ...obj, [k]: v });
  const remove = (k) => { const next = { ...obj }; delete next[k]; onChange(next); };
  const add = () => onChange({ ...obj, '': '' });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {entries.map(([k, v], i) => (
        <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {keyOptions
            ? <Select value={k} onChange={(nk) => setKey(k, nk)} options={[{ value: '', label: keyLabel }, ...keyOptions]} />
            : <TextInput value={k} placeholder={keyLabel} onChange={(nk) => setKey(k, nk)} />}
          <NumberInput value={v} onChange={(nv) => setVal(k, nv)} style={{ width: 70 }} />
          <IconButton onClick={() => remove(k)} title="remove">✕</IconButton>
        </div>
      ))}
      <button onClick={add} style={{ background: 'none', border: `1px dashed ${T.borderSoft}`, color: T.textFaint, borderRadius: 4, fontSize: 11, cursor: 'pointer', padding: '3px' }}>+ {keyLabel}/{valLabel}</button>
    </div>
  );
}

function AddBtn({ onClick, children, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      style={{ width: '100%', background: 'rgba(59,130,246,0.08)', border: `1px dashed ${T.border}`, color: T.cyan, borderRadius: 6, fontSize: 12, fontFamily: T.sans, fontWeight: 600, cursor: 'pointer', padding: '7px', marginTop: 4, transition: `background ${T.transition}` }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.16)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
    >
      {children}
    </button>
  );
}

// Staffing as a per-station table with steppers — every station is listed so
// coverage gaps are visible; zero rows are dropped on write to keep the draft
// shape `{ station_id: count }` unchanged.
function StaffingEditor({ staffing, stations, onChange }) {
  const set = (id, v) => {
    const n = Math.max(0, parseInt(v, 10) || 0);
    const next = { ...staffing };
    if (n === 0) delete next[id];
    else next[id] = n;
    onChange(next);
  };
  const total = stations.reduce((sum, st) => sum + (parseInt(staffing?.[st.id], 10) || 0), 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {stations.length === 0 && (
        <span style={{ fontSize: 11, color: T.textFaint, fontStyle: 'italic' }}>No stations defined yet.</span>
      )}
      {stations.map((st) => (
        <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ flex: 1, fontSize: 11, fontFamily: T.mono, color: T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {st.id}
          </span>
          <Stepper
            value={staffing?.[st.id] ?? 0}
            min={0}
            onChange={(v) => set(st.id, v)}
            style={{ width: 96, flexShrink: 0 }}
          />
        </div>
      ))}
      {stations.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${T.borderSoft}`, paddingTop: 4, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: T.textFaint, fontFamily: T.sans }}>Total people</span>
          <span style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: T.text }}>{total}</span>
        </div>
      )}
    </div>
  );
}

// ── the panel ─────────────────────────────────────────────────────────────

export default function ConfigPanel({ open, onClose, initialTab }) {
  const { config, twinHook, setConfig, seed = 0, setSeed } = useTwinContext();
  const { pause, resume } = twinHook;

  const [tab, setTab] = useState(initialTab ?? 'orders');
  // Follow an external deep-link request (e.g. the wizard routing to Network).
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
  const [draft, setDraft] = useState(() => ({ ...toDraft(config), seed }));
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  // Keep the draft in sync with the live config whenever it changes from the
  // outside (fixture swap, other editors) — but never clobber an active edit.
  useEffect(() => {
    if (!dirtyRef.current) setDraft({ ...toDraft(config), seed });
  }, [config, seed]);

  // Resume the sim if the panel unmounts mid-edit.
  useEffect(() => () => { if (dirtyRef.current) resume(); }, [resume]);

  const { config: candidate, errors, warnings } = useMemo(() => buildAndValidate(draft), [draft]);

  // Any mutation marks dirty and pauses the sim on the first edit.
  const mutate = useCallback((updater) => {
    setDraft((prev) => updater({ ...prev }));
    if (!dirtyRef.current) { pause(); setDirty(true); }
  }, [pause]);

  const setList = useCallback((key, list) => mutate((d) => ({ ...d, [key]: list })), [mutate]);
  const patchItem = useCallback((key, idx, patch) =>
    mutate((d) => ({ ...d, [key]: d[key].map((it, i) => (i === idx ? { ...it, ...patch } : it)) })), [mutate]);
  const addItem = useCallback((key, item) => mutate((d) => ({ ...d, [key]: [...d[key], item] })), [mutate]);
  const removeItem = useCallback((key, idx) => mutate((d) => ({ ...d, [key]: d[key].filter((_, i) => i !== idx) })), [mutate]);

  // Set one axis (metres) of a node's measured coordinate. Absent nodes fall
  // back to auto-layout; setting any axis pins all three so the position is
  // explicit and survives every round-trip.
  const setCoord = useCallback((nodeId, axis, value) => mutate((d) => {
    const cur = d.layout_overrides?.[nodeId] ?? { x: 0, y: 0, z: 0 };
    const n = Number(value);
    return {
      ...d,
      layout_overrides: {
        ...(d.layout_overrides ?? {}),
        [nodeId]: { x: cur.x ?? 0, y: cur.y ?? 0, z: cur.z ?? 0, [axis]: Number.isFinite(n) ? n : 0 },
      },
    };
  }), [mutate]);

  const apply = useCallback(() => {
    if (errors.length || !candidate) return;
    if (setSeed && draft.seed !== seed) setSeed(draft.seed);
    setConfig(candidate);
    setDirty(false);
    resume();
  }, [errors, candidate, setConfig, resume, setSeed, draft.seed, seed]);

  const reset = useCallback(() => {
    setDraft({ ...toDraft(config), seed });
    setDirty(false);
    resume();
  }, [config, seed]);

  const [showResetConfirm, setShowResetConfirm] = useState(false);


  if (!open) return null;

  const procOptions = draft.processes.map((p) => p.id).filter(Boolean);
  const matOptions = draft.materials.map((m) => m.id).filter(Boolean);
  const nodeOptions = [...draft.nodes.map((n) => n.id), ...draft.exits.map((e) => e.id)].filter(Boolean);
  const poolOptions = draft.carrierPools.map((p) => p.id).filter(Boolean);

  return (
    <Panel
      testid="config-panel"
      title="Configuration"
      style={{ position: 'absolute', top: 12, left: 12, bottom: 12, width: 380, zIndex: 250, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      right={<IconButton onClick={onClose} testid="config-close" title="Close">✕</IconButton>}
    >
      <GroupedTabs active={tab} onChange={setTab} />

      {dirty && (
        <div data-testid="config-dirty-banner" style={{ background: T.violetDeep, color: '#ddd6fe', padding: '4px 12px', fontSize: 11, textAlign: 'center' }}>
          ⏸ Sim paused — unapplied changes
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 12px' }}>
        {tab === 'orders' && <OrdersTab draft={draft} matOptions={matOptions} procOptions={procOptions} patch={patchItem} add={addItem} remove={removeItem} setList={setList} />}
        {tab === 'materials' && <MaterialsTab draft={draft} procOptions={procOptions} patch={patchItem} add={addItem} remove={removeItem} setList={setList} />}
        {tab === 'processes' && <ProcessesTab draft={draft} matOptions={matOptions} patch={patchItem} add={addItem} remove={removeItem} setList={setList} />}
        {tab === 'stations' && <StationsTab draft={draft} procOptions={procOptions} nodeOptions={draft.nodes.map((n) => n.id)} patch={patchItem} add={addItem} remove={removeItem} mutate={mutate} />}
        {tab === 'network' && <NetworkTab draft={draft} nodeOptions={nodeOptions} poolOptions={poolOptions} patch={patchItem} add={addItem} remove={removeItem} setCoord={setCoord} />}
        {tab === 'carriers' && <CarriersTab draft={draft} patch={patchItem} add={addItem} remove={removeItem} />}
        {tab === 'shifts' && <ShiftsTab draft={draft} patch={patchItem} add={addItem} remove={removeItem} setList={setList} />}
        {tab === 'sim' && <SimTab draft={draft} mutate={mutate} />}
      </div>

      {/* validation + actions */}
      <div style={{ borderTop: `1px solid ${T.borderSoft}`, padding: '8px 12px' }}>
        {errors.length > 0 && (
          <div data-testid="config-errors" style={{ color: '#fca5a5', fontSize: 11, marginBottom: 6, maxHeight: 80, overflowY: 'auto' }}>
            {errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
          </div>
        )}
        {errors.length === 0 && warnings.length > 0 && (
          <div data-testid="config-warnings" style={{ color: '#fcd34d', fontSize: 11, marginBottom: 6 }}>
            {warnings.map((w, i) => <div key={i}>! {w}</div>)}
          </div>
        )}
        {errors.length === 0 && (
          <div style={{ fontSize: 11, color: T.green, marginBottom: 6 }}>✓ Configuration valid</div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <Button testid="config-apply" variant="primary" disabled={errors.length > 0 || !dirty} onClick={() => apply()} style={{ flex: 1 }}>Apply</Button>
          <Button testid="config-reset" variant="ghost" disabled={!dirty} onClick={() => setShowResetConfirm(true)} style={{ flex: 1 }}>Reset</Button>
        </div>
      </div>

      <ConfirmDialog
        open={showResetConfirm}
        title="Reset changes?"
        message="All unsaved edits will be discarded and the simulation will resume."
        onConfirm={() => { reset(); setShowResetConfirm(false); }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </Panel>
  );
}

// ── tabs ────────────────────────────────────────────────────────────────

function OrdersTab({ draft, matOptions, procOptions, patch, add, remove, setList }) {
  const [filter, setFilter] = useState('');
  const lf = filter.toLowerCase();
  const filtered = draft.orders.map((o, i) => ({ o, i })).filter(({ o }) =>
    !lf || (o.id ?? '').toLowerCase().includes(lf) || (o.material_type ?? '').toLowerCase().includes(lf)
  );
  return (
    <div>
      <SectionTitle>Production orders</SectionTitle>
      <SearchInput value={filter} onChange={setFilter} placeholder="Filter orders…" />
      {filtered.length === 0 && <EmptyState icon="📦" message="No orders yet" hint="Add your first production order to get started." />}
      {filtered.map(({ o, i }) => (
        <EntityCard key={i} testid={`order-card-${o.id || i}`} title={o.id || '(new order)'} onRemove={() => remove('orders', i)} onDuplicate={() => add('orders', { ...o, id: `${o.id}_copy` })}>
          <Grid2>
            <Field label="id" required><TextInput testid={`order-id-${i}`} value={o.id} onChange={(v) => patch('orders', i, { id: v })} /></Field>
            <Field label="material" required><Select value={o.material_type} onChange={(v) => patch('orders', i, { material_type: v })} options={['', ...matOptions]} /></Field>
            <Field label="quantity" required><Stepper testid={`order-qty-${i}`} value={o.quantity} min={1} unit="pcs" onChange={(v) => patch('orders', i, { quantity: v })} /></Field>
            <Field label="arrival"><Stepper value={o.arrival_time} min={0} step={10} unit="s" onChange={(v) => patch('orders', i, { arrival_time: v })} /></Field>
          </Grid2>
          <Field label="process sequence" style={{ marginTop: 8 }}>
            <ChipList values={o.process_sequence} options={procOptions} onChange={(v) => patch('orders', i, { process_sequence: v })} addLabel="+ step" />
          </Field>
        </EntityCard>
      ))}
      <AddBtn testid="add-order" onClick={() => add('orders', { id: `order_${draft.orders.length + 1}`, material_type: matOptions[0] ?? '', quantity: 1, process_sequence: [], arrival_time: 0 })}>+ Add order</AddBtn>
    </div>
  );
}

function MaterialsTab({ draft, procOptions, patch, add, remove }) {
  const [filter, setFilter] = useState('');
  const lf = filter.toLowerCase();
  const filtered = draft.materials.map((m, i) => ({ m, i })).filter(({ m }) =>
    !lf || (m.id ?? '').toLowerCase().includes(lf)
  );
  return (
    <div>
      <SectionTitle>Materials</SectionTitle>
      <SearchInput value={filter} onChange={setFilter} placeholder="Filter materials…" />
      {filtered.length === 0 && <EmptyState icon="🧱" message="No materials defined" hint="Define the materials your factory will process." />}
      {filtered.map(({ m, i }) => (
        <EntityCard key={i} testid={`material-card-${m.id || i}`} title={m.id || '(new material)'} onRemove={() => remove('materials', i)} onDuplicate={() => add('materials', { ...m, id: `${m.id}_copy`, allowed_processes: [...m.allowed_processes], properties: { ...m.properties } })}>
          <Field label="id" required><TextInput testid={`material-id-${i}`} value={m.id} onChange={(v) => patch('materials', i, { id: v })} /></Field>
          <Field label="allowed processes" style={{ marginTop: 8 }}>
            <ChipList values={m.allowed_processes} options={procOptions} onChange={(v) => patch('materials', i, { allowed_processes: v })} addLabel="+ proc" />
          </Field>
          <Field label="properties" style={{ marginTop: 8 }}>
            <KVEditor obj={m.properties} onChange={(v) => patch('materials', i, { properties: v })} keyLabel="prop" valLabel="val" />
          </Field>
        </EntityCard>
      ))}
      <AddBtn testid="add-material" onClick={() => add('materials', { id: `MAT_${draft.materials.length + 1}`, allowed_processes: [], properties: {} })}>+ Add material</AddBtn>
    </div>
  );
}

function ProcessesTab({ draft, matOptions, patch, add, remove }) {
  const [filter, setFilter] = useState('');
  const lf = filter.toLowerCase();
  const filtered = draft.processes.map((p, i) => ({ p, i })).filter(({ p }) =>
    !lf || (p.id ?? '').toLowerCase().includes(lf) || (p.name ?? '').toLowerCase().includes(lf) || (p.kind ?? '').toLowerCase().includes(lf)
  );
  return (
    <div>
      <SectionTitle>Processes</SectionTitle>
      <SearchInput value={filter} onChange={setFilter} placeholder="Filter processes…" />
      {filtered.length === 0 && <EmptyState icon="⚙" message="No processes defined" hint="Add the manufacturing processes for your production line." />}
      {filtered.map(({ p, i }) => (
        <EntityCard key={i} testid={`process-card-${p.id || i}`} title={p.id || '(new process)'} badge={<Badge>{p.kind}</Badge>} onRemove={() => remove('processes', i)} onDuplicate={() => add('processes', { ...p, id: `${p.id}_copy`, bom: { ...p.bom }, adds_enrichments: [...p.adds_enrichments] })}>
          <Grid2>
            <Field label="id" required><TextInput testid={`process-id-${i}`} value={p.id} onChange={(v) => patch('processes', i, { id: v })} /></Field>
            <Field label="name"><TextInput value={p.name} onChange={(v) => patch('processes', i, { name: v })} /></Field>
          </Grid2>
          <Field label="kind" required style={{ marginTop: 8 }}>
            <Select testid={`process-kind-${i}`} value={p.kind} onChange={(v) => patch('processes', i, { kind: v })} options={PROCESS_KINDS} />
          </Field>
          {/* kind-specific fields */}
          {(p.kind === 'transform' || p.kind === 'assembly' || p.kind === 'intake') && (
            <Field label="output material" style={{ marginTop: 8 }}>
              <Select value={p.output_material} onChange={(v) => patch('processes', i, { output_material: v })} options={['', ...matOptions]} />
            </Field>
          )}
          {p.kind === 'assembly' && (
            <Field label="bill of materials" style={{ marginTop: 8 }}>
              <KVEditor obj={p.bom} onChange={(v) => patch('processes', i, { bom: v })} keyOptions={matOptions} keyLabel="material" valLabel="qty" />
            </Field>
          )}
          {p.kind === 'inspect' && (
            <Field label="pass rate" style={{ marginTop: 8 }}>
              <SliderInput testid={`process-passrate-${i}`} value={p.pass_rate} min={0} max={1} step={0.01} format={(n) => `${Math.round(n * 100)}%`} onChange={(v) => patch('processes', i, { pass_rate: v })} />
            </Field>
          )}
          {p.kind === 'hold' && (
            <Grid2 style={{ marginTop: 8 }}>
              <Field label="dwell"><Stepper value={p.dwell_seconds} min={1} step={5} unit="s" onChange={(v) => patch('processes', i, { dwell_seconds: v })} /></Field>
              <Field label="slots"><Stepper value={p.slots} min={1} onChange={(v) => patch('processes', i, { slots: v })} /></Field>
            </Grid2>
          )}
          {p.kind === 'store' && (
            <Field label="slots" style={{ marginTop: 8 }}><Stepper value={p.slots} min={1} onChange={(v) => patch('processes', i, { slots: v })} /></Field>
          )}
          {(p.kind === 'label' || p.kind === 'seal') && (
            <Field label="adds enrichments" style={{ marginTop: 8 }}><FreeChips values={p.adds_enrichments} onChange={(v) => patch('processes', i, { adds_enrichments: v })} /></Field>
          )}
        </EntityCard>
      ))}
      <AddBtn testid="add-process" onClick={() => add('processes', { id: `proc_${draft.processes.length + 1}`, name: 'New process', kind: 'transform', output_material: matOptions[0] ?? '', pass_rate: 0.9, dwell_seconds: 60, slots: 1, bom: {}, adds_enrichments: [] })}>+ Add process</AddBtn>
    </div>
  );
}

function StationsTab({ draft, procOptions, nodeOptions, patch, add, remove, mutate }) {
  const [filter, setFilter] = useState('');
  const lf = filter.toLowerCase();
  const filtered = draft.stations.map((s, i) => ({ s, i })).filter(({ s }) =>
    !lf || (s.id ?? '').toLowerCase().includes(lf) || (s.name ?? '').toLowerCase().includes(lf)
  );
  const patchProc = (si, pi, p) => mutate((d) => ({
    ...d,
    stations: d.stations.map((s, i) => i !== si ? s : { ...s, processes: s.processes.map((sp, j) => j === pi ? { ...sp, ...p } : sp) }),
  }));
  const addProc = (si) => mutate((d) => ({
    ...d, stations: d.stations.map((s, i) => i !== si ? s : { ...s, processes: [...s.processes, { process_id: procOptions[0] ?? '', parallel_slots: 1, takt_seconds: 30, operators_per_slot: 1, automation_level: 0 }] }),
  }));
  const removeProc = (si, pi) => mutate((d) => ({
    ...d, stations: d.stations.map((s, i) => i !== si ? s : { ...s, processes: s.processes.filter((_, j) => j !== pi) }),
  }));
  return (
    <div>
      <SectionTitle>Stations</SectionTitle>
      <SearchInput value={filter} onChange={setFilter} placeholder="Filter stations…" />
      {filtered.length === 0 && <EmptyState icon="🏭" message="No stations configured" hint="Stations house processes and form your production line." />}
      {filtered.map(({ s, i }) => (
        <EntityCard key={i} testid={`station-card-${s.id || i}`} title={s.id || '(new station)'} onRemove={() => remove('stations', i)} onDuplicate={() => add('stations', { ...s, id: `${s.id}_copy`, processes: s.processes.map((sp) => ({ ...sp })) })}>
          <Grid2>
            <Field label="id" required><TextInput value={s.id} onChange={(v) => patch('stations', i, { id: v })} /></Field>
            <Field label="name"><TextInput value={s.name} onChange={(v) => patch('stations', i, { name: v })} /></Field>
            <Field label="node" required><Select value={s.node_id} onChange={(v) => patch('stations', i, { node_id: v })} options={['', ...nodeOptions]} /></Field>
            <Field label="buffer cap"><Stepper value={s.entry_buffer_capacity} min={1} unit="pcs" onChange={(v) => patch('stations', i, { entry_buffer_capacity: v })} /></Field>
          </Grid2>
          <SectionTitle>Processes at this station</SectionTitle>
          {s.processes.map((sp, pi) => (
            <div key={pi} style={{ border: `1px solid ${T.borderSoft}`, borderRadius: 5, padding: 6, marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
                <Select value={sp.process_id} onChange={(v) => patchProc(i, pi, { process_id: v })} options={['', ...procOptions]} />
                <IconButton onClick={() => removeProc(i, pi)} title="remove">✕</IconButton>
              </div>
              <Grid2>
                <Field label="takt"><Stepper value={sp.takt_seconds} min={1} unit="s" onChange={(v) => patchProc(i, pi, { takt_seconds: v })} /></Field>
                <Field label="slots"><Stepper value={sp.parallel_slots} min={1} onChange={(v) => patchProc(i, pi, { parallel_slots: v })} /></Field>
                <Field label="ops/slot"><Stepper value={sp.operators_per_slot} min={0} step={0.5} onChange={(v) => patchProc(i, pi, { operators_per_slot: v })} /></Field>
                <Field label="automation"><SliderInput value={sp.automation_level} min={0} max={1} step={0.05} format={(n) => `${Math.round(n * 100)}%`} onChange={(v) => patchProc(i, pi, { automation_level: v })} /></Field>
              </Grid2>
            </div>
          ))}
          <button onClick={() => addProc(i)} style={{ background: 'none', border: `1px dashed ${T.borderSoft}`, color: T.textFaint, borderRadius: 4, fontSize: 11, cursor: 'pointer', padding: '4px', width: '100%' }}>+ add process</button>
        </EntityCard>
      ))}
      <AddBtn testid="add-station" onClick={() => add('stations', { id: `station_${draft.stations.length + 1}`, name: 'New station', node_id: nodeOptions[0] ?? '', entry_buffer_capacity: 10, processes: [] })}>+ Add station</AddBtn>
    </div>
  );
}

function NetworkTab({ draft, nodeOptions, poolOptions, patch, add, remove, setCoord }) {
  return (
    <div>
      <SectionTitle>Nodes</SectionTitle>
      {draft.nodes.map((n, i) => {
        const c = draft.layout_overrides?.[n.id] ?? {};
        return (
        <EntityCard key={i} testid={`node-card-${n.id || i}`} title={n.id || '(new node)'} badge={<Badge color={T.textDim} bg="rgba(148,163,184,0.12)">{n.type}</Badge>} onRemove={() => remove('nodes', i)}>
          <Grid2>
            <Field label="id"><TextInput value={n.id} onChange={(v) => patch('nodes', i, { id: v })} /></Field>
            <Field label="name"><TextInput value={n.name} onChange={(v) => patch('nodes', i, { name: v })} /></Field>
          </Grid2>
          <Field label="type" style={{ marginTop: 8 }}>
            <SegmentedControl value={n.type} onChange={(v) => patch('nodes', i, { type: v })} options={NODE_TYPES} />
          </Field>
          <Field label="position (metres, from floor plan)" style={{ marginTop: 8 }}>
            <Grid2 cols={3}>
              <NumberInput testid={`node-x-${n.id}`} value={c.x ?? ''} step={0.1} onChange={(v) => setCoord(n.id, 'x', v)} />
              <NumberInput testid={`node-y-${n.id}`} value={c.y ?? ''} step={0.1} onChange={(v) => setCoord(n.id, 'y', v)} />
              <NumberInput testid={`node-z-${n.id}`} value={c.z ?? ''} step={0.1} onChange={(v) => setCoord(n.id, 'z', v)} />
            </Grid2>
            <span style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>x = width · y = floor height · z = depth. Blank = auto-placed.</span>
          </Field>
        </EntityCard>
        );
      })}
      <AddBtn testid="add-node" onClick={() => add('nodes', { id: `node_${draft.nodes.length + 1}`, type: 'junction', name: '' })}>+ Add node</AddBtn>

      <SectionTitle>Segments</SectionTitle>
      {draft.segments.map((sg, i) => (
        <EntityCard key={i} testid={`segment-card-${sg.id || i}`} title={`${sg.id || '(new)'}`} badge={<Badge>{sg.class}</Badge>} onRemove={() => remove('segments', i)}>
          <Grid2>
            <Field label="id" required><TextInput value={sg.id} onChange={(v) => patch('segments', i, { id: v })} /></Field>
            <Field label="class"><SegmentedControl value={sg.class} onChange={(v) => patch('segments', i, { class: v })} options={['passive', 'carrier']} /></Field>
            <Field label="from" required><Select value={sg.from_node_id} onChange={(v) => patch('segments', i, { from_node_id: v })} options={['', ...nodeOptions]} /></Field>
            <Field label="to" required><Select value={sg.to_node_id} onChange={(v) => patch('segments', i, { to_node_id: v })} options={['', ...nodeOptions]} /></Field>
            <Field label="length"><Stepper value={sg.length_m} min={0.1} step={0.5} unit="m" onChange={(v) => patch('segments', i, { length_m: v })} /></Field>
            <Field label="capacity"><Stepper value={sg.capacity} min={1} unit="pcs" onChange={(v) => patch('segments', i, { capacity: v })} /></Field>
          </Grid2>
          {sg.class === 'passive' ? (
            <Grid2 style={{ marginTop: 8 }}>
              <Field label="mode"><SegmentedControl value={sg.mode} onChange={(v) => patch('segments', i, { mode: v })} options={TRANSPORT_MODES} /></Field>
              <Field label="speed"><Stepper value={sg.speed_m_per_min} min={1} step={5} unit="m/min" onChange={(v) => patch('segments', i, { speed_m_per_min: v })} /></Field>
            </Grid2>
          ) : (
            <Field label="carrier pool" style={{ marginTop: 8 }}><Select value={sg.pool_id} onChange={(v) => patch('segments', i, { pool_id: v })} options={['', ...poolOptions]} /></Field>
          )}
        </EntityCard>
      ))}
      <AddBtn testid="add-segment" onClick={() => add('segments', { id: `seg_${draft.segments.length + 1}`, from_node_id: '', to_node_id: '', length_m: 10, capacity: 5, class: 'passive', mode: 'conveyor', speed_m_per_min: 60, pool_id: '' })}>+ Add segment</AddBtn>

      <SectionTitle>Exits</SectionTitle>
      {draft.exits.map((e, i) => (
        <EntityCard key={i} testid={`exit-card-${e.id || i}`} title={e.id || '(new exit)'} badge={<Badge color={e.kind === 'scrap' ? T.red : T.green} bg="rgba(16,185,129,0.1)">{e.kind}</Badge>} onRemove={() => remove('exits', i)}>
          <Grid2>
            <Field label="id"><TextInput value={e.id} onChange={(v) => patch('exits', i, { id: v })} /></Field>
            <Field label="kind"><SegmentedControl value={e.kind} onChange={(v) => patch('exits', i, { kind: v })} options={EXIT_KINDS} /></Field>
          </Grid2>
          <Field label="name" style={{ marginTop: 8 }}><TextInput value={e.name} onChange={(v) => patch('exits', i, { name: v })} /></Field>
        </EntityCard>
      ))}
      <AddBtn testid="add-exit" onClick={() => add('exits', { id: `exit_${draft.exits.length + 1}`, kind: 'ship', name: '' })}>+ Add exit</AddBtn>
    </div>
  );
}

function CarriersTab({ draft, patch, add, remove }) {
  return (
    <div>
      <SectionTitle>Carrier pools</SectionTitle>
      {draft.carrierPools.length === 0 && (
        <div style={{ fontSize: 12, color: T.textFaint, fontStyle: 'italic', marginBottom: 8 }}>No carrier pools. Carrier segments need a dedicated pool.</div>
      )}
      {draft.carrierPools.map((p, i) => (
        <EntityCard key={i} testid={`pool-card-${p.id || i}`} title={p.id || '(new pool)'} badge={<Badge color={T.violet} bg="rgba(124,58,237,0.12)">{p.carrier_kind}</Badge>} onRemove={() => remove('carrierPools', i)}>
          <Field label="kind">
            <SegmentedControl value={p.carrier_kind} onChange={(v) => patch('carrierPools', i, { carrier_kind: v })} options={CARRIER_KINDS} />
          </Field>
          <Grid2 style={{ marginTop: 8 }}>
            <Field label="id"><TextInput value={p.id} onChange={(v) => patch('carrierPools', i, { id: v })} /></Field>
            <Field label="count"><Stepper value={p.count} min={1} onChange={(v) => patch('carrierPools', i, { count: v })} /></Field>
            <Field label="units/trip"><Stepper value={p.units_per_trip} min={1} unit="pcs" onChange={(v) => patch('carrierPools', i, { units_per_trip: v })} /></Field>
            <Field label="load/unload"><Stepper value={p.load_unload_seconds} min={0} step={5} unit="s" onChange={(v) => patch('carrierPools', i, { load_unload_seconds: v })} /></Field>
            <Field label="loaded speed"><Stepper value={p.speed_loaded_m_per_min} min={1} step={5} unit="m/min" onChange={(v) => patch('carrierPools', i, { speed_loaded_m_per_min: v })} /></Field>
            <Field label="empty speed"><Stepper value={p.speed_empty_m_per_min} min={1} step={5} unit="m/min" onChange={(v) => patch('carrierPools', i, { speed_empty_m_per_min: v })} /></Field>
          </Grid2>
        </EntityCard>
      ))}
      <AddBtn testid="add-pool" onClick={() => add('carrierPools', { id: `pool_${draft.carrierPools.length + 1}`, carrier_kind: 'amr', count: 1, units_per_trip: 1, speed_loaded_m_per_min: 60, speed_empty_m_per_min: 120, load_unload_seconds: 30 })}>+ Add pool</AddBtn>
    </div>
  );
}

function ShiftsTab({ draft, patch, add, remove }) {
  return (
    <div>
      <SectionTitle>Shifts</SectionTitle>
      {draft.shifts.map((s, i) => (
        <EntityCard key={i} testid={`shift-card-${s.id || i}`} title={s.id || '(new shift)'} onRemove={() => remove('shifts', i)}>
          <Grid2>
            <Field label="id" required><TextInput value={s.id} onChange={(v) => patch('shifts', i, { id: v })} /></Field>
            <Field label="name"><TextInput value={s.name} onChange={(v) => patch('shifts', i, { name: v })} /></Field>
            <Field label="start" required>
              <input
                type="time"
                value={s.start_time ?? ''}
                onChange={(e) => patch('shifts', i, { start_time: e.target.value })}
                style={{
                  background: T.surfaceSolid, border: '1px solid #334155', borderRadius: T.radiusSm,
                  color: T.text, padding: '4px 8px', fontSize: 12, fontFamily: T.mono,
                  width: '100%', boxSizing: 'border-box', outline: 'none', colorScheme: 'dark',
                }}
              />
            </Field>
            <Field label="duration"><Stepper value={s.duration_hours} min={1} max={24} step={0.5} unit="hrs" onChange={(v) => patch('shifts', i, { duration_hours: v })} /></Field>
          </Grid2>
          <Field label="days" style={{ marginTop: 8 }}>
            <WeekdayPicker value={s.days ?? []} onChange={(v) => patch('shifts', i, { days: v })} />
          </Field>
          <Field label="staffing (people per station)" style={{ marginTop: 8 }}>
            <StaffingEditor staffing={s.staffing} stations={draft.stations} onChange={(v) => patch('shifts', i, { staffing: v })} />
          </Field>
        </EntityCard>
      ))}
      <AddBtn testid="add-shift" onClick={() => add('shifts', { id: `shift_${draft.shifts.length + 1}`, name: 'New shift', start_time: '07:00', duration_hours: 7, days: ['mon', 'tue', 'wed', 'thu', 'fri'], staffing: {} })}>+ Add shift</AddBtn>
    </div>
  );
}

function SimTab({ draft, mutate }) {
  return (
    <div>
      <SectionTitle>Simulation</SectionTitle>
      <EntityCard title="Run parameters">
        <Field label="seed (deterministic RNG)">
          <NumberInput testid="sim-seed" value={draft.seed} min={0} onChange={(v) => mutate((d) => ({ ...d, seed: Math.max(0, parseInt(v, 10) || 0) }))} />
        </Field>
        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8, lineHeight: 1.5 }}>
          The seed makes inspection pass/fail rolls reproducible. Apply to re-initialise the run with the new seed.
        </div>
      </EntityCard>
    </div>
  );
}
