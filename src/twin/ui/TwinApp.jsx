// TwinApp.jsx — top-level page for the deterministic digital twin (/twin route).
//
// Mounts TwinProvider (engine context + RAF loop) with the linearLine fixture.
// Additional panels (SimControls, WipHeatmap, etc.) are layered on top of the canvas.

import { useState } from 'react';
import { TwinProvider } from './TwinProvider.jsx';
import TwinCanvas from './TwinCanvas.jsx';
import SimControls from './SimControls.jsx';
import WipHeatmap from './WipHeatmap.jsx';
import HeadcountPanel from './HeadcountPanel.jsx';
import ShockConsole from './ShockConsole.jsx';
import ProcessForm from './ProcessForm.jsx';
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
        <HeadcountPanel />
        <WipHeatmap />
        <SimControls />
        <ShockConsole />
        {selectedStationId && (
          <ProcessForm
            selectedStationId={selectedStationId}
            onClose={() => setSelectedStationId(null)}
          />
        )}
      </TwinProvider>
    </div>
  );
}
