// TwinApp.jsx — top-level page for the deterministic digital twin (/twin route).
//
// Mounts TwinProvider (engine context + RAF loop) with the linearLine fixture.
// Additional panels (SimControls, WipHeatmap, etc.) are layered on top of the canvas.

import { useState } from 'react';
import { TwinProvider } from './TwinProvider.jsx';
import TwinCanvas from './TwinCanvas.jsx';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';

export default function TwinApp() {
  const [config] = useState(() => makeLinearLineFixture());
  const [selectedStationId, setSelectedStationId] = useState(null);

  return (
    <div
      data-testid="twin-app"
      style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#0c1322' }}
    >
      <TwinProvider config={config} seed={0}>
        <TwinCanvas
          onSelectStation={setSelectedStationId}
          selectedStationId={selectedStationId}
        />
        {/* D4+ panels mount here as position:absolute overlays */}
      </TwinProvider>
    </div>
  );
}
