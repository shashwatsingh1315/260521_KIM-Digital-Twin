// ProductionFlowOverview.jsx — live value-stream overlay derived from the
// active config. Stations appear in flow order (BFS from the intake nodes)
// with live buffer fill and busy-slot counts; the transport edges between
// them show live in-transit counts colored by occupancy. Works for every
// fixture and wizard-built config — the rich KMP annotations from
// stationInfo.js apply when station ids match the linearLine fixture.

import { useMemo } from 'react';
import { useTwinContext } from './TwinProvider.jsx';
import { fillStateColor } from '../../materials/factoryMaterials.js';
import { T, IconButton } from './kit.jsx';
import { STATION_INFO } from './stationInfo.js';

// Family color for a station via its first process kind.
function stationColor(station, procMap) {
  const info = STATION_INFO[station.id];
  if (info) return info.color;
  const kind = procMap.get(station.processes?.[0]?.process_id)?.kind;
  if (kind === 'inspect') return T.family.inspect;
  if (kind === 'store' || kind === 'hold') return T.family.storage;
  if (kind === 'offload' || kind === 'intake') return T.family.logistics;
  return T.family.production;
}

// BFS over the segment graph from intake nodes → stations in flow order.
function flowOrder(config) {
  const out = [];
  const seen = new Set();
  const stationByNode = new Map(config.stations.map((s) => [s.node_id, s]));
  const bySource = new Map();
  for (const seg of config.segments) {
    if (!bySource.has(seg.from_node_id)) bySource.set(seg.from_node_id, []);
    bySource.get(seg.from_node_id).push(seg);
  }
  const queue = config.nodes.filter((n) => n.type === 'intake').map((n) => n.id);
  const visited = new Set(queue);
  while (queue.length) {
    const nodeId = queue.shift();
    const station = stationByNode.get(nodeId);
    if (station && !seen.has(station.id)) {
      seen.add(station.id);
      out.push(station);
    }
    for (const seg of bySource.get(nodeId) ?? []) {
      if (!visited.has(seg.to_node_id)) {
        visited.add(seg.to_node_id);
        queue.push(seg.to_node_id);
      }
    }
  }
  // Anything unreached (cycles, detached subgraphs) appends in config order.
  for (const s of config.stations) if (!seen.has(s.id)) out.push(s);
  return out;
}

function FillBar({ ratio }) {
  const color = fillStateColor(ratio);
  return (
    <div style={{ flex: 1, minWidth: 30, maxWidth: 60, height: 4, background: T.borderSoft, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, ratio * 100)}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
    </div>
  );
}

export default function ProductionFlowOverview({ open, onClose }) {
  const { config, twinHook } = useTwinContext();

  const procMap = useMemo(() => new Map(config.processes.map((p) => [p.id, p])), [config]);
  const stations = useMemo(() => flowOrder(config), [config]);
  const exitIds = useMemo(() => new Set(config.exits.map((e) => e.id)), [config]);
  const segsBySource = useMemo(() => {
    const m = new Map();
    for (const seg of config.segments) {
      if (!m.has(seg.from_node_id)) m.set(seg.from_node_id, []);
      m.get(seg.from_node_id).push(seg);
    }
    return m;
  }, [config]);

  if (!open) return null;

  const metrics = twinHook.metrics;
  const state = twinHook._engineState();
  const flowState = state?.flowState;
  const slots = state?.schedulerState?.slots;
  const stationByNode = new Map(config.stations.map((s) => [s.node_id, s]));
  const isLinearLine = STATION_INFO[stations[0]?.id] != null;

  const busyAt = (stationId, procs) => {
    if (!slots) return 0;
    let busy = 0;
    for (const sp of procs) {
      const arr = slots.get(`${stationId}|${sp.process_id}`);
      if (arr) for (const s of arr) if (s.busy) busy++;
    }
    return busy;
  };

  const segLoad = (seg) => {
    const inTransit = flowState?.segmentUnits?.get(seg.id)?.length ?? 0;
    const held = flowState?.segmentHeld?.get(seg.id)?.length ?? 0;
    return { n: inTransit + held, held, occ: seg.capacity > 0 ? (inTransit + held) / seg.capacity : 0 };
  };

  return (
    <div
      data-testid="production-flow-overview"
      style={{
        position: 'absolute', bottom: 70, left: 12, width: 390,
        background: T.surface, backdropFilter: 'blur(12px)',
        border: `1px solid ${T.border}`, borderRadius: T.radius,
        zIndex: 200, overflow: 'hidden', boxShadow: T.shadow.panel,
        animation: 'twinFadeIn 0.18s ease',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 12px',
        borderBottom: `1px solid ${T.borderSoft}`,
      }}>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.textDim, fontFamily: T.display }}>
          Production Flow — Live
        </span>
        {isLinearLine && <span style={{ fontSize: 10, color: T.cyan, fontWeight: 600, marginRight: 8, fontFamily: T.sans }}>KORA M-800</span>}
        <IconButton onClick={onClose} title="Close flow map">✕</IconButton>
      </div>

      {/* Flow strip */}
      <div style={{ padding: '8px 12px 10px', maxHeight: 'min(420px, calc(100vh - 280px))', overflowY: 'auto' }}>
        {stations.map((station) => {
          const info = STATION_INFO[station.id];
          const color = stationColor(station, procMap);
          const ratio = metrics?.bufferFullness?.[station.id] ?? 0;
          const totalSlots = station.processes.reduce((a, p) => a + (p.parallel_slots ?? 1), 0);
          const busy = busyAt(station.id, station.processes);
          const outgoing = segsBySource.get(station.node_id) ?? [];

          return (
            <div key={station.id}>
              {/* Station row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: color, boxShadow: `0 0 4px ${color}66`, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: T.text, fontFamily: T.sans, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
                  {info?.label ?? station.name}
                </span>
                {info?.transform && (
                  <span style={{ fontSize: 8, color: T.textFaint, fontFamily: T.mono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>
                    {info.transform}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <FillBar ratio={ratio} />
                  <span style={{ fontSize: 9, fontFamily: T.mono, color: busy > 0 ? T.cyan : T.textFaint, minWidth: 32, textAlign: 'right' }}>
                    {busy}/{totalSlots}
                  </span>
                </span>
              </div>

              {/* Outgoing transport edges */}
              {outgoing.map((seg) => {
                const load = segLoad(seg);
                const target = stationByNode.get(seg.to_node_id)?.name
                  ?? (exitIds.has(seg.to_node_id) ? `✓ ${seg.to_node_id}` : seg.to_node_id);
                const edgeColor = load.n > 0 ? fillStateColor(load.occ) : T.textFaint;
                return (
                  <div key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '1px 0 1px 14px', fontSize: 9, fontFamily: T.mono }}>
                    <span style={{ color: edgeColor }}>↳</span>
                    <span style={{ color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{target}</span>
                    <span style={{ color: edgeColor, marginLeft: 'auto' }}>
                      {load.n > 0 ? `${load.n} in transit${load.held > 0 ? ` · ${load.held} held` : ''}` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Target banner (linearLine only) */}
        {isLinearLine && (
          <div style={{ marginTop: 8, padding: '5px 8px', background: 'rgba(16,185,129,0.08)', borderRadius: 4, border: '1px solid rgba(16,185,129,0.2)' }}>
            <span style={{ fontSize: 9, color: T.green, fontFamily: T.mono, fontWeight: 600 }}>
              TARGET: 20,000 meters/day · 3 shifts · 77 operators/shift
            </span>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 5, borderTop: `1px solid ${T.borderSoft}`, flexWrap: 'wrap' }}>
          {[
            { color: T.family.production, label: 'Production' },
            { color: T.family.inspect, label: 'Inspection' },
            { color: T.family.storage, label: 'Storage' },
            { color: T.family.logistics, label: 'Transport' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
              <span style={{ fontSize: 9, color: T.textFaint, fontFamily: T.sans }}>{l.label}</span>
            </div>
          ))}
          <span style={{ fontSize: 9, color: T.textFaint, marginLeft: 'auto', fontFamily: T.sans }}>busy/slots</span>
        </div>
      </div>
    </div>
  );
}
