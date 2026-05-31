// TwinApp.jsx — docked dashboard shell for the deterministic digital twin
// (/twin route).
//
// Layout: a top toolbar (config toggle + quick editors + scenario switch), a
// left Configuration dock (every input/variable, validator-gated), the 3D
// canvas filling the center, a right metrics rail (resources / WIP / shocks),
// and the simulation controls along the bottom. Structural edits replace the
// whole config via setConfig (clean engine re-init); the seed re-inits too.

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
import ConfigPanel from './ConfigPanel.jsx';
import { T, Button } from './kit.jsx';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';

function Toolbar({ showConfig, onToggleConfig, openEditor, onToggleEditor }) {
  return (
    <div
      data-testid="twin-toolbar"
      style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 8, zIndex: 300 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: T.cyan, boxShadow: `0 0 8px ${T.cyan}` }} />
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: T.mono, color: T.text, letterSpacing: 0.5 }}>Factory Twin</span>
      </div>
      <Button testid="toggle-config" variant={showConfig ? 'violet' : 'default'} onClick={onToggleConfig}>
        ⚙ Configuration
      </Button>
      <Button testid="open-track-editor" variant={openEditor === 'track' ? 'violet' : 'default'} onClick={() => onToggleEditor('track')}>Network</Button>
      <Button testid="open-carrier-panel" variant={openEditor === 'carrier' ? 'violet' : 'default'} onClick={() => onToggleEditor('carrier')}>Carriers</Button>
    </div>
  );
}

export default function TwinApp() {
  const [config, setConfig] = useState(() => makeLinearLineFixture());
  const [seed, setSeed] = useState(0);
  const [fixtureKey, setFixtureKey] = useState('linearLine');
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [openEditor, setOpenEditor] = useState(null); // 'track' | 'carrier' | null
  const [showConfig, setShowConfig] = useState(true);

  const handleFixtureChange = (key) => {
    setFixtureKey(key);
    setSelectedStationId(null);
    setOpenEditor(null);
  };

  const toggleEditor = (which) => setOpenEditor((cur) => (cur === which ? null : which));

  return (
    <div
      data-testid="twin-app"
      style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: T.bg }}
    >
      <TwinProvider config={config} seed={seed} setSeed={setSeed} setConfig={setConfig}>
        <TwinCanvas
          onSelectStation={setSelectedStationId}
          selectedStationId={selectedStationId}
        />

        {/* Top toolbar */}
        <Toolbar
          showConfig={showConfig}
          onToggleConfig={() => setShowConfig((s) => !s)}
          openEditor={openEditor}
          onToggleEditor={toggleEditor}
        />

        {/* Scenario switcher (top-center) */}
        <FixtureSelector value={fixtureKey} onChange={handleFixtureChange} />

        {/* Left configuration dock */}
        <ConfigPanel open={showConfig} onClose={() => setShowConfig(false)} />

        {/* Right metrics rail */}
        <div
          data-testid="metrics-rail"
          style={{ position: 'absolute', top: 56, right: 12, width: 244, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 100, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}
        >
          <HeadcountPanel />
          <WipHeatmap />
          <ShockConsole />
        </div>

        {/* Bottom sim controls */}
        <SimControls />

        {/* Quick structural editors (modal-ish, centered) */}
        {openEditor === 'track' && <TrackEditor onClose={() => setOpenEditor(null)} />}
        {openEditor === 'carrier' && <CarrierPoolPanel onClose={() => setOpenEditor(null)} />}

        {/* Click-a-station inspector */}
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
