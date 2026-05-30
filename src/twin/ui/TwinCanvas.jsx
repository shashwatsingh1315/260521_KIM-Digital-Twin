// TwinCanvas.jsx — React Three Fiber 3D scene for the deterministic twin.
//
// Reuses: SceneAtmosphere (lighting), ScenePostFX (AA + bloom),
//         LocationNode (stations with selection ring + fill color).
// New:    TrackSegmentLines, UnitStream, CarrierAgents (carrier-specific rendering).

import { useRef, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import TwinAtmosphere from './TwinAtmosphere.jsx';
import LocationNode from '../../scene/LocationNode.jsx';
import TrackSegmentLines from './TrackSegmentLines.jsx';
import UnitStream from './UnitStream.jsx';
import CarrierAgents from './CarrierAgents.jsx';
import { computeTwinLayout } from './twinLayout.js';
import { useTwinContext } from './TwinProvider.jsx';

// Adapter: converts a Twin Station to the shape LocationNode expects.
function toLocShape(station) {
  return {
    location_id: station.id,
    name: station.name,
    location_type: 'machine',
    zone: station.name,
    floor: 'GF',
  };
}

function SceneContent({ onSelectStation, selectedStationId }) {
  const { config, twinHook } = useTwinContext();
  const engineStateRef = useRef(null);

  // Keep engineStateRef pointing at the live state so UnitStream/CarrierAgents
  // can read it each frame without triggering re-renders.
  engineStateRef.current = twinHook._engineState();

  const layout = useMemo(() => computeTwinLayout(config), [config]);
  const metrics = twinHook.metrics;

  return (
    <>
      <TwinAtmosphere />

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
              loc={toLocShape(station)}
              pos={pos}
              fillRatio={fillRatio}
              isSelected={selectedStationId === station.id}
              onSelect={() => onSelectStation?.(station.id)}
              simState={null}
            />
            {/* Invisible HTML anchor for E2E test targeting */}
            <Html position={[pos.x, pos.y + 3, pos.z]} center style={{ pointerEvents: 'none' }}>
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

      {/* Track segments */}
      <TrackSegmentLines
        segments={config.segments}
        nodePositions={layout}
        flowState={engineStateRef.current?.flowState}
      />

      {/* In-flight units */}
      <UnitStream
        engineStateRef={engineStateRef}
        nodePositions={layout}
        config={config}
      />

      {/* Carrier agents */}
      <CarrierAgents
        engineStateRef={engineStateRef}
        nodePositions={layout}
        config={config}
      />

      <OrbitControls makeDefault minDistance={5} maxDistance={150} />
    </>
  );
}

export default function TwinCanvas({ onSelectStation, selectedStationId, isMobile = false }) {
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
        />
      </Canvas>
    </div>
  );
}
