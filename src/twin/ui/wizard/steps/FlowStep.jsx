// FlowStep — per-link transport: distance, capacity, conveyor speed OR a carrier
// pool. Links mirror the station order from LineStep; the terminal link feeds the
// ship exit. Editing here re-derives the network.

import { T, Field, NumberInput, Select, SectionTitle } from '../../kit.jsx';
import { CARRIER_KINDS, TRANSPORT_MODES } from '../../configDraft.js';
import { defaultCarrierPoolSpec } from '../lineTopology.js';

export default function FlowStep({ ctx }) {
  const { base, mode, links, shipLink, setLink, setShipLink } = ctx;

  if (mode === 'advanced') {
    return (
      <div>
        <SectionTitle>Flow & transport</SectionTitle>
        <div style={note}>Topology is managed in the Network panel for this scenario.</div>
      </div>
    );
  }
  if (base.stations.length === 0) {
    return (
      <div>
        <SectionTitle>Flow & transport</SectionTitle>
        <div style={note}>Add stations in the Line step first — links appear here automatically.</div>
      </div>
    );
  }

  const labelFor = (i) => (i === 0 ? `Intake → ${name(base.stations[0])}` : `${name(base.stations[i - 1])} → ${name(base.stations[i])}`);

  return (
    <div>
      <SectionTitle>Flow & transport</SectionTitle>
      <p style={hintP}>Each link is a conveyor by default. Switch a link to a carrier (AMR / forklift /
        person) when material is moved in batches by a vehicle. Distance + speed set travel time;
        capacity sets how many units can queue (backpressure).</p>

      {links.map((lk, i) => (
        <LinkCard key={i} label={labelFor(i)} link={lk} onChange={(patch) => setLink(i, patch)} testid={`wiz-link-${i}`} />
      ))}
      <LinkCard label={`${name(base.stations[base.stations.length - 1])} → Ship`} link={shipLink} onChange={setShipLink} testid="wiz-link-ship" />
    </div>
  );
}

function LinkCard({ label, link, onChange, testid }) {
  const isCarrier = link.transport.class === 'carrier';
  const setTransport = (t) => onChange({ ...link, transport: t });
  const setPool = (patch) => setTransport({ ...link.transport, pool: { ...defaultCarrierPoolSpec(), ...link.transport.pool, ...patch } });

  return (
    <div data-testid={testid} style={{ border: `1px solid ${T.borderSoft}`, borderRadius: 6, padding: '8px 10px', marginBottom: 8, background: 'rgba(8,14,28,0.5)' }}>
      <div style={{ fontSize: 12, fontFamily: T.mono, color: T.textDim, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <Grid3>
        <Field label="distance (m)"><NumberInput value={link.length_m} min={0.5} step={0.5} onChange={(v) => onChange({ ...link, length_m: Number(v) })} /></Field>
        <Field label="capacity"><NumberInput value={link.capacity} min={1} onChange={(v) => onChange({ ...link, capacity: Number(v) })} /></Field>
        <Field label="transport">
          <Select value={isCarrier ? 'carrier' : 'passive'} onChange={(v) => setTransport(
            v === 'carrier'
              ? { class: 'carrier', pool: link.transport.pool ?? defaultCarrierPoolSpec() }
              : { class: 'passive', mode: 'conveyor', speed_m_per_min: 60 },
          )} options={[{ value: 'passive', label: 'conveyor' }, { value: 'carrier', label: 'carrier' }]} />
        </Field>
      </Grid3>

      {!isCarrier ? (
        <Grid3 style={{ marginTop: 8 }}>
          <Field label="mode"><Select value={link.transport.mode ?? 'conveyor'} onChange={(v) => setTransport({ ...link.transport, mode: v })} options={TRANSPORT_MODES} /></Field>
          <Field label="speed (m/min)"><NumberInput value={link.transport.speed_m_per_min ?? 60} min={1} onChange={(v) => setTransport({ ...link.transport, speed_m_per_min: Number(v) })} /></Field>
        </Grid3>
      ) : (
        <Grid3 style={{ marginTop: 8 }}>
          <Field label="carrier kind"><Select value={link.transport.pool?.carrier_kind ?? 'amr'} onChange={(v) => setPool({ carrier_kind: v })} options={CARRIER_KINDS} /></Field>
          <Field label="count" hint="fleet size"><NumberInput value={link.transport.pool?.count ?? 1} min={1} onChange={(v) => setPool({ count: Number(v) })} /></Field>
          <Field label="units/trip"><NumberInput value={link.transport.pool?.units_per_trip ?? 1} min={1} onChange={(v) => setPool({ units_per_trip: Number(v) })} /></Field>
          <Field label="loaded m/min"><NumberInput value={link.transport.pool?.speed_loaded_m_per_min ?? 60} min={1} onChange={(v) => setPool({ speed_loaded_m_per_min: Number(v) })} /></Field>
          <Field label="empty m/min"><NumberInput value={link.transport.pool?.speed_empty_m_per_min ?? 120} min={1} onChange={(v) => setPool({ speed_empty_m_per_min: Number(v) })} /></Field>
          <Field label="load/unload (s)"><NumberInput value={link.transport.pool?.load_unload_seconds ?? 30} min={0} onChange={(v) => setPool({ load_unload_seconds: Number(v) })} /></Field>
        </Grid3>
      )}
    </div>
  );
}

function Grid3({ children, style }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, ...style }}>{children}</div>;
}

const name = (s) => s?.name || s?.id || '?';
const hintP = { fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 10px' };
const note = { padding: 12, borderRadius: 6, background: 'rgba(148,163,184,0.08)', border: `1px solid ${T.borderSoft}`, color: T.textFaint, fontSize: 12 };
