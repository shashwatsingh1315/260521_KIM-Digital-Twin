// TwinCanvas.jsx — React Three Fiber 3D scene for the deterministic twin.
//
// Reuses: SceneAtmosphere (lighting), ScenePostFX (AA + bloom),
//         LocationNode (stations with selection ring + fill color).
// New:    TrackSegmentLines (+flow arrows & hover), UnitStream (hover + order
//         tint), CarrierAgents, WorkerAgents (staffed crew), BufferGauge
//         (always-on fill pillars), BottleneckMarker, SceneTooltip.

import { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import TwinAtmosphere from './TwinAtmosphere.jsx';
import LocationNode from '../../scene/LocationNode.jsx';
import TrackSegmentLines from './TrackSegmentLines.jsx';
import UnitStream from './UnitStream.jsx';
import CarrierAgents from './CarrierAgents.jsx';
import WorkerAgents from './WorkerAgents.jsx';
import SceneTooltip from './SceneTooltip.jsx';
import BuildingShells from '../../scene/BuildingShells.jsx';
import SetDressing from '../../scene/SetDressing.jsx';
import ScenePostFX from '../../scene/ScenePostFX.jsx';
import { computeTwinLayout } from './twinLayout.js';
import { useTwinContext } from './TwinProvider.jsx';
import { useModelRegistryVersion } from '../../scene/ModelRegistry.js';
import { bottleneck } from '../engine/derive.js';
import { fillStateColor } from '../../materials/factoryMaterials.js';
import { T, useSessionStorage } from './kit.jsx';
import { STATION_INFO } from './stationInfo.js';

function StationLabel({ station, pos }) {
  const info = STATION_INFO[station.id];
  if (!info) return null;
  return (
    <Html position={[pos.x, pos.y + 5.5, pos.z]} center distanceFactor={28} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{
        background: 'rgba(10,17,32,0.88)',
        border: `1px solid ${info.color}44`,
        borderRadius: 5,
        padding: '3px 8px',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: info.color,
          fontFamily: T.display,
          letterSpacing: 0.4,
        }}>
          {info.label}
        </div>
        <div style={{
          fontSize: 8, color: T.textDim,
          fontFamily: T.mono,
          marginTop: 1,
        }}>
          {info.transform}
        </div>
      </div>
    </Html>
  );
}

// ─── Zone banners — large area labels on the factory floor ───────────────────
const ZONE_BANNERS = [
  { id: 'kmp-gf', label: 'KMP GROUND FLOOR', sub: 'Electronics Inbound · SMT · FCT', pos: [-26, 1, -30], color: T.family.production },
  { id: 'kmp-sf', label: 'KMP 2ND FLOOR',    sub: 'TRSS Sub-Assembly · 1P Assembly · SFG Packing', pos: [-20, 11, 12], color: T.family.logistics },
  { id: 'kmp-3f', label: 'KMP 3RD FLOOR',    sub: 'FAT Quality Lab', pos: [-26, 16, 10], color: T.family.inspect },
  { id: 'wh-gf',  label: 'WAREHOUSE GF',      sub: 'ASRS Storage · Automated Packaging · Dispatch', pos: [50, 1, -12], color: T.family.storage },
  { id: 'wh-ff',  label: 'WAREHOUSE FF',       sub: 'Value Creation — VC Line A', pos: [55, 6, 15], color: T.family.production },
  { id: 'wh-sf',  label: 'WAREHOUSE SF',       sub: 'Value Creation — VC Line B', pos: [55, 11, 15], color: T.family.production },
];

function ZoneBanners() {
  return (
    <>
      {ZONE_BANNERS.map(z => (
        <Html key={z.id} position={z.pos} center distanceFactor={60} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center', opacity: 0.7 }}>
            <div style={{
              fontSize: 14, fontWeight: 800, color: z.color,
              fontFamily: T.display,
              letterSpacing: 2, textShadow: `0 0 12px ${z.color}44`,
            }}>
              {z.label}
            </div>
            <div style={{
              fontSize: 10, color: T.textDim,
              fontFamily: T.sans,
              marginTop: 2, letterSpacing: 0.5,
            }}>
              {z.sub}
            </div>
          </div>
        </Html>
      ))}
    </>
  );
}

// Adapter: converts a Twin Station to the shape LocationNode expects.
// Generic fixture stations (no M-800 name match) derive their family from the
// process kind so every config gets the family color treatment.
function toLocShape(station, config) {
  let zone = station.name;
  let type = 'machine';

  if (zone.includes('SMT')) zone = 'SMT';
  else if (zone.includes('FCT')) zone = 'FCT';
  else if (zone.includes('TRSS')) zone = 'TRSS';
  else if (zone.includes('1P')) zone = '1P Assembly';
  else if (zone.includes('SFG')) zone = 'SFG Packing';
  else if (zone.includes('VC')) zone = 'VC';
  else if (zone.includes('Pack')) zone = 'Packaging';
  else if (zone.includes('IQC') || zone.includes('FAT')) {
    type = 'inspection_area';
  } else if (zone.includes('ASRS')) {
    type = 'ASRS';
  } else if (config) {
    // Generic fixture: classify by the station's first process kind.
    const procMap = new Map(config.processes.map((p) => [p.id, p]));
    const kind = procMap.get(station.processes?.[0]?.process_id)?.kind;
    if (kind === 'inspect') type = 'inspection_area';
    else if (kind === 'store' || kind === 'hold') type = 'ASRS';
    else if (kind != null) zone = 'SMT'; // production family tint
  }

  return {
    location_id: station.id,
    name: station.name,
    location_type: type,
    zone: zone,
    floor: 'GF', // We use layout_overrides for Y position now
  };
}

// ─── Always-on buffer gauge — a fill pillar beside each station ──────────────
function BufferGauge({ pos, ratio }) {
  const H = 2.6;
  const fillH = Math.max(0.05, Math.min(1, ratio)) * H;
  const color = fillStateColor(ratio);
  return (
    <group position={[pos.x + 2.4, pos.y, pos.z + 1.4]}>
      {/* backdrop pillar */}
      <mesh position={[0, H / 2, 0]}>
        <boxGeometry args={[0.22, H, 0.22]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* fill */}
      <mesh position={[0, fillH / 2, 0]} scale={[1, fillH, 1]}>
        <boxGeometry args={[0.34, 1, 0.34]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ratio >= 0.9 ? 1.2 : 0.5} />
      </mesh>
    </group>
  );
}

// ─── Bottleneck callout — pulsing ring + badge on the constraint station ─────
function BottleneckMarker({ pos, throughput }) {
  const ringRef = useRef(null);
  useFrame(({ clock }) => {
    const ring = ringRef.current;
    if (!ring) return;
    const s = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.12;
    ring.scale.set(s, s, s);
    ring.material.opacity = 0.45 + Math.sin(clock.elapsedTime * 2.4) * 0.2;
  });
  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[2.3, 2.9, 40]} />
        <meshBasicMaterial color={T.amber} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <Html position={[0, 7.2, 0]} center distanceFactor={30} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(69,42,4,0.92)',
          border: `1px solid ${T.amber}`,
          borderRadius: 5,
          padding: '2px 8px',
          whiteSpace: 'nowrap',
          fontSize: 10,
          fontWeight: 700,
          color: '#fde68a',
          fontFamily: T.display,
          letterSpacing: 0.5,
        }}>
          ⚠ BOTTLENECK · {Math.round(throughput)}/hr
        </div>
      </Html>
    </group>
  );
}

function SceneContent({ onSelectStation, selectedStationId, isMobile, highlightOrderId, showWorkers, onHover }) {
  const { config, twinHook } = useTwinContext();
  const engineStateRef = useRef(null);
  useModelRegistryVersion();

  // Keep engineStateRef pointing at the live state so UnitStream/CarrierAgents
  // can read it each frame without triggering re-renders.
  engineStateRef.current = twinHook._engineState();

  const layout = useMemo(() => computeTwinLayout(config, config.layout_overrides || {}), [config]);
  const metrics = twinHook.metrics;

  // Bottleneck is config-static; resolve its station position once per config.
  const bottle = useMemo(() => {
    const b = bottleneck(config);
    if (!b) return null;
    const station = config.stations.find((s) => s.id === b.station_id);
    const pos = station ? layout.get(station.node_id) : null;
    return pos ? { ...b, pos } : null;
  }, [config, layout]);

  return (
    <>
      <TwinAtmosphere />
      <BuildingShells />
      <SetDressing />
      <ZoneBanners />

      {/* Ground grid */}
      <Grid
        position={[0, -0.01, 0]}
        args={[200, 200]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#1e3a5f"
        sectionSize={20}
        sectionThickness={1}
        sectionColor="#1e40af"
        fadeDistance={150}
        fadeStrength={1}
        infiniteGrid
      />

      {/* Stations */}
      {config.stations.map((station) => {
        const pos = layout.get(station.node_id);
        if (!pos) return null;
        const fillRatio = metrics?.bufferFullness?.[station.id] ?? 0;
        return (
          <group key={station.id}>
            <LocationNode
              loc={toLocShape(station, config)}
              pos={pos}
              fillRatio={fillRatio}
              isSelected={selectedStationId === station.id}
              onSelect={() => onSelectStation?.(station.id)}
              onHoverChange={(on) => onHover(on ? { kind: 'station', stationId: station.id } : null)}
              simState={null}
            />
            <StationLabel station={station} pos={pos} />
            <BufferGauge pos={pos} ratio={fillRatio} />
            {/* Invisible HTML anchor for E2E test targeting. zIndexRange keeps
                it below every 2D panel (T.z.rail+) so it can never swallow
                clicks aimed at the UI. */}
            <Html position={[pos.x, pos.y + 3, pos.z]} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
              <div
                data-testid={`station-${station.id}`}
                onClick={() => onSelectStation?.(station.id)}
                style={{
                  width: 40,
                  height: 40,
                  cursor: 'pointer',
                  pointerEvents: 'all',
                  background: 'transparent',
                }}
              />
            </Html>
          </group>
        );
      })}

      {/* Bottleneck callout */}
      {bottle && <BottleneckMarker pos={bottle.pos} throughput={bottle.throughput} />}

      {/* Track segments */}
      <TrackSegmentLines
        segments={config.segments}
        nodePositions={layout}
        flowState={engineStateRef.current?.flowState}
        onHoverSegment={(segId) => onHover(segId ? { kind: 'segment', segId } : null)}
      />

      {/* In-flight units */}
      <UnitStream
        engineStateRef={engineStateRef}
        nodePositions={layout}
        config={config}
        highlightOrderId={highlightOrderId}
        onHoverUnit={(u) => onHover(u ? { kind: 'unit', ...u } : null)}
      />

      {/* Carrier agents */}
      <CarrierAgents
        engineStateRef={engineStateRef}
        nodePositions={layout}
        config={config}
      />

      {/* Staffed crew at stations */}
      {showWorkers && (
        <WorkerAgents
          config={config}
          nodePositions={layout}
          engineStateRef={engineStateRef}
          onHoverWorker={(w) => onHover(w ? { kind: 'worker', ...w } : null)}
        />
      )}

      <OrbitControls makeDefault minDistance={5} maxDistance={150} />

      <ScenePostFX isMobile={isMobile} />
    </>
  );
}

// ─── Legend overlay (HTML, outside Canvas) ───────────────────────────────────
function LegendItem({ color, label, square }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: square ? 2 : '50%', background: color, boxShadow: `0 0 4px ${color}`, flexShrink: 0 }} />
      <span style={{ color: T.textDim }}>{label}</span>
    </div>
  );
}

function LegendHeading({ children }) {
  return <div style={{ color: T.textFaint, fontWeight: 700, marginTop: 4, fontFamily: T.display, letterSpacing: 0.5 }}>{children}</div>;
}

function SceneLegend({ showWorkers, onToggleWorkers }) {
  const [open, setOpen] = useSessionStorage('legendOpen', false);
  return (
    <div style={{
      position: 'absolute', bottom: 70, right: 12, zIndex: T.z.canvasOverlay,
      background: T.surface, backdropFilter: 'blur(8px)',
      border: `1px solid ${T.border}`, borderRadius: T.radius, padding: open ? '8px 12px' : '6px 10px',
      color: T.text, fontSize: 10, fontFamily: T.sans,
      userSelect: 'none', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto',
    }}>
      <div onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.textFaint, fontSize: 10, fontFamily: T.display }}>Legend</span>
        <span style={{ color: T.textFaint }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5, animation: 'twinFadeIn 0.18s ease' }}>
          <LegendHeading>STATION FAMILIES</LegendHeading>
          <LegendItem color={T.family.production} label="Production / assembly" square />
          <LegendItem color={T.family.inspect} label="Inspection / quality" square />
          <LegendItem color={T.family.storage} label="Storage / ASRS" square />
          <LegendItem color={T.family.logistics} label="Logistics / kitting" square />

          <LegendHeading>BUFFER STATUS</LegendHeading>
          <LegendItem color={T.state.ok} label="Low (<60%)" />
          <LegendItem color={T.state.warn} label="Medium (60-90%)" />
          <LegendItem color={T.state.alert} label="High (>90%)" />

          <LegendHeading>TRACK SEGMENTS</LegendHeading>
          <LegendItem color={T.state.ok} label="Clear" />
          <LegendItem color={T.state.warn} label="Busy" />
          <LegendItem color={T.state.alert} label="Full / Held" />

          <LegendHeading>CARRIERS</LegendHeading>
          <LegendItem color="#94a3b8" label="Idle" />
          <LegendItem color={T.accent} label="Loaded" />
          <LegendItem color={T.red} label="Held at dest" />
          <LegendItem color="#7dd3fc" label="Returning empty" />

          <LegendHeading>UNITS & CREW</LegendHeading>
          <LegendItem color={T.cyan} label="Unit in transit" />
          <LegendItem color={T.family.logistics} label="Operator working" />
          <LegendItem color="#64748b" label="Operator idle" />

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, cursor: 'pointer', color: T.textDim }}>
            <input
              type="checkbox"
              checked={showWorkers}
              onChange={(e) => onToggleWorkers(e.target.checked)}
              style={{ accentColor: T.accent, margin: 0 }}
            />
            Show workers
          </label>

          <div style={{ borderTop: `1px solid ${T.borderSoft}`, marginTop: 4, paddingTop: 4, color: T.textFaint, fontSize: 9 }}>
            Hover anything for details · click a station to inspect
          </div>
        </div>
      )}
    </div>
  );
}

export default function TwinCanvas({ onSelectStation, selectedStationId, isMobile = false, highlightOrderId }) {
  const [hover, setHover] = useState(null);
  const hoverKeyRef = useRef(null);
  const [showWorkers, setShowWorkers] = useSessionStorage('showWorkers', true);

  // Identity-guarded hover updates: pointer events fire every frame while
  // hovering instanced meshes — only re-render when the hovered object changes.
  const handleHover = useCallback((h) => {
    const key = h
      ? `${h.kind}:${h.stationId ?? h.segId ?? h.unitId ?? ''}:${h.working ?? ''}`
      : null;
    if (key === hoverKeyRef.current) return;
    hoverKeyRef.current = key;
    setHover(h);
  }, []);

  return (
    <div
      data-testid="twin-canvas"
      style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
    >
      <Canvas
        camera={{ position: [20, 25, 20], fov: 55 }}
        gl={{ antialias: true }}
      >
        <SceneContent
          onSelectStation={onSelectStation}
          selectedStationId={selectedStationId}
          isMobile={isMobile}
          highlightOrderId={highlightOrderId}
          showWorkers={showWorkers}
          onHover={handleHover}
        />
      </Canvas>
      <SceneTooltip hover={hover} />
      <SceneLegend showWorkers={showWorkers} onToggleWorkers={setShowWorkers} />
    </div>
  );
}
