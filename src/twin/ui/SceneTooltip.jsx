// SceneTooltip.jsx — cursor-following tooltip for 3D scene hovers.
//
// Mounted as a DOM sibling of the <Canvas>. The payload (which object is
// hovered) lives in React state, but the cursor position is written straight
// to the element's transform from a window mousemove listener — zero React
// work per mouse move. Live numbers (occupancy, buffer fill) re-render
// naturally because the provider subtree updates every RAF.

import { useEffect, useRef } from 'react';
import { useTwinContext } from './TwinProvider.jsx';
import { fillStateColor } from '../../materials/factoryMaterials.js';
import { T } from './kit.jsx';

function Row({ label, children, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: T.textFaint }}>{label}</span>
      <span style={{ color: color ?? T.text, fontFamily: T.mono }}>{children}</span>
    </div>
  );
}

function StationTip({ stationId }) {
  const { config, twinHook } = useTwinContext();
  const station = config.stations.find((s) => s.id === stationId);
  if (!station) return null;
  const ratio = twinHook.metrics?.bufferFullness?.[stationId] ?? 0;
  const procMap = new Map(config.processes.map((p) => [p.id, p]));
  return (
    <>
      <div style={{ fontWeight: 700, color: T.text, fontFamily: T.display, marginBottom: 3 }}>{station.name}</div>
      {station.processes.map((sp) => (
        <Row key={sp.process_id} label={procMap.get(sp.process_id)?.name ?? sp.process_id}>
          {sp.takt_seconds != null ? `${sp.takt_seconds}s takt` : '—'}
        </Row>
      ))}
      <Row label="Buffer" color={fillStateColor(ratio)}>{Math.round(ratio * 100)}%</Row>
      <div style={{ color: T.textFaint, marginTop: 3, fontStyle: 'italic' }}>click to inspect</div>
    </>
  );
}

function SegmentTip({ segId }) {
  const { config, twinHook } = useTwinContext();
  const seg = config.segments.find((s) => s.id === segId);
  if (!seg) return null;
  const flowState = twinHook._engineState()?.flowState;
  const inTransit = flowState?.segmentUnits?.get(segId)?.length ?? 0;
  const held = flowState?.segmentHeld?.get(segId)?.length ?? 0;
  const occ = seg.capacity > 0 ? (inTransit + held) / seg.capacity : 0;
  return (
    <>
      <div style={{ fontWeight: 700, color: T.text, fontFamily: T.mono, marginBottom: 3 }}>{seg.id}</div>
      <Row label="Class">{seg.transport?.class}{seg.transport?.mode ? ` · ${seg.transport.mode}` : ''}</Row>
      <Row label="Occupancy" color={fillStateColor(occ)}>{inTransit + held}/{seg.capacity}</Row>
      {held > 0 && <Row label="Held" color={T.red}>{held}</Row>}
      {seg.transport?.speed_m_per_min != null && <Row label="Speed">{seg.transport.speed_m_per_min} m/min</Row>}
      <Row label="Length">{seg.length_m} m</Row>
    </>
  );
}

function UnitTip({ unit }) {
  return (
    <>
      <div style={{ fontWeight: 700, color: T.cyan, fontFamily: T.mono, marginBottom: 3 }}>{unit.unitId}</div>
      <Row label="Order">{unit.orderId}</Row>
      <Row label="Material">{unit.material}</Row>
      {unit.nextProcess && <Row label="Next">{unit.nextProcess}</Row>}
    </>
  );
}

function WorkerTip({ worker }) {
  return (
    <>
      <div style={{ fontWeight: 700, color: T.text, fontFamily: T.display, marginBottom: 3 }}>Operator</div>
      <Row label="Station">{worker.stationName}</Row>
      <Row label="Status" color={worker.working ? T.amber : T.textFaint}>
        {worker.working ? 'working' : 'idle'}
      </Row>
    </>
  );
}

export default function SceneTooltip({ hover }) {
  const ref = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      const el = ref.current;
      if (!el) return;
      // Keep the tip on-screen near the right/bottom edges.
      const flipX = e.clientX > window.innerWidth - 230;
      const flipY = e.clientY > window.innerHeight - 160;
      el.style.transform = `translate(${e.clientX + (flipX ? -14 : 14)}px, ${e.clientY + (flipY ? -14 : 14)}px) translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  if (!hover) return null;

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: T.z.toolbar + 10,
        pointerEvents: 'none',
        background: 'rgba(10,17,32,0.94)',
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        padding: '7px 10px',
        minWidth: 150,
        maxWidth: 220,
        fontSize: 11,
        fontFamily: T.sans,
        color: T.textDim,
        boxShadow: T.shadow.pop,
        backdropFilter: 'blur(6px)',
      }}
    >
      {hover.kind === 'station' && <StationTip stationId={hover.stationId} />}
      {hover.kind === 'segment' && <SegmentTip segId={hover.segId} />}
      {hover.kind === 'unit' && <UnitTip unit={hover} />}
      {hover.kind === 'worker' && <WorkerTip worker={hover} />}
    </div>
  );
}
