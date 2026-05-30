// TwinApp.jsx — top-level page for the deterministic digital twin (/twin route).
//
// Mounts TwinProvider (engine context + RAF loop) with a selectable fixture and
// the full HUD: 3D canvas, sim controls, WIP/headcount/shock panels, the
// station ProcessForm (with schema-impact), and the global network + carrier
// editors. Structural editors replace the whole config via setConfig, which
// re-initialises the engine cleanly.

import { useState } from 'react';
import { TwinProvider } from './TwinProvider.jsx';
import TwinCanvas from './TwinCanvas.jsx';
import SimControls from './SimControls.jsx';
import WipHeatmap from './WipHeatmap.jsx';
import HeadcountPanel from './HeadcountPanel.jsx';
import ShockConsole from './ShockConsole.jsx';
import ProcessForm from './ProcessForm.jsx';
import FixtureSelector from './FixtureSelector.jsx';
import TrackEditor from './TrackEditor.jsx';
import CarrierPoolPanel from './CarrierPoolPanel.jsx';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';

function EditorToolbar({ open, onToggle }) {
  const btn = (active) => ({
    padding: '6px 10px',
    borderRadius: 6,
    border: `1px solid ${active ? '#7c3aed' : '#1e3a5f'}`,
    background: active ? '#312e81' : 'rgba(12,19,34,0.85)',
    color: active ? '#ddd6fe' : '#94a3b8',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'monospace',
    backdropFilter: 'blur(8px)',
  });
  return (
    <div
      data-testid="editor-toolbar"
      style={{ position: 'absolute', top: '50%', left: 16, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 150 }}
    >
      <button data-testid="open-track-editor" onClick={() => onToggle('track')} style={btn(open === 'track')}>Network</button>
      <button data-testid="open-carrier-panel" onClick={() => onToggle('carrier')} style={btn(open === 'carrier')}>Carriers</button>
    </div>
  );
}

export default function TwinApp() {
  const [config, setConfig] = useState(() => makeLinearLineFixture());
  const [fixtureKey, setFixtureKey] = useState('linearLine');
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [openEditor, setOpenEditor] = useState(null); // 'track' | 'carrier' | null

  const handleFixtureChange = (key) => {
    setFixtureKey(key);
    setSelectedStationId(null);
    setOpenEditor(null);
  };

  const toggleEditor = (which) => setOpenEditor((cur) => (cur === which ? null : which));

  return (
    <div
      data-testid="twin-app"
      style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#0c1322' }}
    >
      <TwinProvider config={config} seed={0} setConfig={setConfig}>
        <TwinCanvas
          onSelectStation={setSelectedStationId}
          selectedStationId={selectedStationId}
        />
        <HeadcountPanel />
        <WipHeatmap />
        <SimControls />
        <ShockConsole />
        <FixtureSelector value={fixtureKey} onChange={handleFixtureChange} />
        <EditorToolbar open={openEditor} onToggle={toggleEditor} />

        {openEditor === 'track' && <TrackEditor onClose={() => setOpenEditor(null)} />}
        {openEditor === 'carrier' && <CarrierPoolPanel onClose={() => setOpenEditor(null)} />}

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
