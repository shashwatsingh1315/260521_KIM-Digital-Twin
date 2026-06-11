// TwinApp.jsx — docked dashboard shell for the deterministic digital twin
// (/twin route).
//
// Layout: a top toolbar (config toggle + quick editors + scenario switch), a
// left Configuration dock (every input/variable, validator-gated), the 3D
// canvas filling the center, a right metrics rail (resources / WIP / shocks),
// and the simulation controls along the bottom. Structural edits replace the
// whole config via setConfig (clean engine re-init); the seed re-inits too.

import { useState, useEffect, useRef } from 'react';
import { Wand2, Settings2, Share2, Truck, Boxes, Map, MoreHorizontal } from 'lucide-react';
import { TwinProvider } from './TwinProvider.jsx';
import TwinCanvas from './TwinCanvas.jsx';
import SimControls from './SimControls.jsx';
import RightRail from './RightRail.jsx';
import ProcessForm from './ProcessForm.jsx';
import FixtureSelector from './FixtureSelector.jsx';
import TrackEditor from './TrackEditor.jsx';
import CarrierPoolPanel from './CarrierPoolPanel.jsx';
import ConfigPanel from './ConfigPanel.jsx';
import FactoryWizard from './wizard/FactoryWizard.jsx';
import ImportExportMenu from './ImportExportMenu.jsx';
import ModelManager from './ModelManager.jsx';
import ProductionFlowOverview from './ProductionFlowOverview.jsx';
import {
  T, Button, Tooltip, DropdownMenu,
  useSessionStorage, useKeyboardShortcuts, useMediaQuery, LoadingState,
} from './kit.jsx';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { toDraft, buildConfig } from './configDraft.js';
import { loadPersistedModels } from '../../scene/ModelRegistry.js';

const SAVE_LABEL = { saving: '● Saving…', saved: '✓ Saved', error: '✕ Save failed' };
const SAVE_COLOR = { saving: T.textFaint, saved: T.cyan, error: T.red };

function ToolbarDivider() {
  return <div style={{ width: 1, alignSelf: 'stretch', background: T.borderSoft, margin: '4px 2px' }} />;
}

function Toolbar({ showConfig, onToggleConfig, openEditor, onToggleEditor, onOpenWizard, onToggleModels, showModels, showFlowMap, onToggleFlowMap, saveStatus }) {
  const compact = useMediaQuery('(max-width: 1199px)');

  const editItems = [
    { label: 'Network', icon: <Share2 size={13} />, testid: 'open-track-editor', active: openEditor === 'track', onClick: () => onToggleEditor('track') },
    { label: 'Carriers', icon: <Truck size={13} />, testid: 'open-carrier-panel', active: openEditor === 'carrier', onClick: () => onToggleEditor('carrier') },
    { label: 'Models', icon: <Boxes size={13} />, testid: 'open-model-manager', active: showModels, onClick: onToggleModels },
    { label: 'Flow Map', icon: <Map size={13} />, testid: 'toggle-flow-map', active: showFlowMap, onClick: onToggleFlowMap },
  ];

  return (
    <div
      data-testid="twin-toolbar"
      style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, zIndex: T.z.toolbar }}
    >
      {/* Brand + save status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: T.cyan, boxShadow: `0 0 8px ${T.cyan}` }} />
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: T.display, color: T.text, letterSpacing: 0.5 }}>Factory Twin</span>
      </div>
      {saveStatus && (
        <span style={{ fontSize: 11, color: SAVE_COLOR[saveStatus], fontFamily: T.sans }}>
          {SAVE_LABEL[saveStatus]}
        </span>
      )}

      <ToolbarDivider />

      {/* Build */}
      <Tooltip text="Open guided factory builder">
        <Button testid="open-wizard" icon={<Wand2 size={13} />} variant="default" onClick={onOpenWizard}>
          Wizard
        </Button>
      </Tooltip>
      <Tooltip text="Edit all factory parameters">
        <Button testid="toggle-config" icon={<Settings2 size={13} />} variant={showConfig ? 'violet' : 'default'} onClick={onToggleConfig}>
          Configuration
        </Button>
      </Tooltip>

      <ToolbarDivider />

      {/* Edit + View — fold into an overflow menu on narrow screens */}
      {compact ? (
        <DropdownMenu label="More" icon={<MoreHorizontal size={13} />} items={editItems} />
      ) : (
        <>
          <Tooltip text="Edit transport network topology">
            <Button testid="open-track-editor" icon={<Share2 size={13} />} variant={openEditor === 'track' ? 'violet' : 'default'} onClick={() => onToggleEditor('track')}>Network</Button>
          </Tooltip>
          <Tooltip text="Edit carrier pool parameters">
            <Button testid="open-carrier-panel" icon={<Truck size={13} />} variant={openEditor === 'carrier' ? 'violet' : 'default'} onClick={() => onToggleEditor('carrier')}>Carriers</Button>
          </Tooltip>
          <Tooltip text="Upload custom 3D models">
            <Button testid="open-model-manager" icon={<Boxes size={13} />} variant={showModels ? 'violet' : 'default'} onClick={onToggleModels}>Models</Button>
          </Tooltip>
          <ToolbarDivider />
          <Tooltip text="Toggle production flow diagram">
            <Button testid="toggle-flow-map" icon={<Map size={13} />} variant={showFlowMap ? 'violet' : 'default'} onClick={onToggleFlowMap}>Flow Map</Button>
          </Tooltip>
        </>
      )}

      <ImportExportMenu />
    </div>
  );
}

export default function TwinApp() {
  const [config, setConfig] = useState(() => makeLinearLineFixture());
  const [seed, setSeed] = useState(0);
  const [fixtureKey, setFixtureKey] = useSessionStorage('fixtureKey', 'linearLine');
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [openEditor, setOpenEditor] = useState(null); // 'track' | 'carrier' | null
  const [showConfig, setShowConfig] = useSessionStorage('showConfig', true);
  const [showWizard, setShowWizard] = useState(false);
  const [showModelManager, setShowModelManager] = useState(false);
  const [showFlowMap, setShowFlowMap] = useSessionStorage('showFlowMap', true);
  const [configTab, setConfigTab] = useState(null); // deep-link target for ConfigPanel
  const [highlightOrderId, setHighlightOrderId] = useState(null); // tint this order's units in 3D
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error' | null
  const [loading, setLoading] = useState(true);
  const loadedFromDb = useRef(false);

  // Hydrate custom GLB models from IndexedDB on first mount.
  useEffect(() => { loadPersistedModels(); }, []);

  // Load saved config from Neon on first mount.
  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        try {
          // Run through draft round-trip to normalise any plain-JSON fields.
          const normalised = buildConfig(toDraft(data));
          setConfig(normalised);
        } catch {
          // Corrupted saved config — ignore, keep fixture default.
        }
      })
      .catch(() => {})
      .finally(() => { loadedFromDb.current = true; setLoading(false); });
  }, []);

  // Auto-save whenever config changes (debounced 600 ms).
  // Skip the very first render (uses the in-memory fixture default).
  useEffect(() => {
    if (!loadedFromDb.current) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
        .then((r) => setSaveStatus(r.ok ? 'saved' : 'error'))
        .catch(() => setSaveStatus('error'))
        .finally(() => setTimeout(() => setSaveStatus(null), 2000));
    }, 600);
    return () => clearTimeout(timer);
  }, [config]);

  // Fixture switch is immediate (FixtureSelector already swapped the config —
  // the engine re-inits on config identity); just sync the dependent UI state.
  const handleFixtureChange = (key) => {
    setFixtureKey(key);
    setSelectedStationId(null);
    setOpenEditor(null);
    setHighlightOrderId(null);
  };

  const toggleEditor = (which) => setOpenEditor((cur) => (cur === which ? null : which));

  // Keyboard shortcut: Escape closes wizard or model manager
  useKeyboardShortcuts([
    { key: 'Escape', action: () => {
      if (showWizard) setShowWizard(false);
      else if (showModelManager) setShowModelManager(false);
    }},
  ], [showWizard, showModelManager]);

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg }}>
        <LoadingState message="Loading factory configuration…" />
      </div>
    );
  }

  return (
    <div
      data-testid="twin-app"
      style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: T.bg }}
    >
      <TwinProvider config={config} seed={seed} setSeed={setSeed} setConfig={setConfig}>
        <TwinCanvas
          onSelectStation={setSelectedStationId}
          selectedStationId={selectedStationId}
          highlightOrderId={highlightOrderId}
        />

        {/* Top toolbar */}
        <Toolbar
          showConfig={showConfig}
          onToggleConfig={() => setShowConfig((s) => !s)}
          openEditor={openEditor}
          onToggleEditor={toggleEditor}
          onOpenWizard={() => setShowWizard(true)}
          onToggleModels={() => setShowModelManager((s) => !s)}
          showModels={showModelManager}
          showFlowMap={showFlowMap}
          onToggleFlowMap={() => setShowFlowMap((s) => !s)}
          saveStatus={saveStatus}
        />

        {/* Scenario switcher (top-center) */}
        <FixtureSelector value={fixtureKey} onChange={handleFixtureChange} />

        {/* Left configuration dock */}
        <ConfigPanel open={showConfig} onClose={() => setShowConfig(false)} initialTab={configTab} />

        {/* Right metrics rail — tabbed sections */}
        <RightRail
          highlightOrderId={highlightOrderId}
          onToggleOrderHighlight={(id) => setHighlightOrderId((cur) => (cur === id ? null : id))}
        />

        {/* Production flow overview (bottom-left) */}
        <ProductionFlowOverview open={showFlowMap} onClose={() => setShowFlowMap(false)} />

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
            onOpenConfig={() => { setConfigTab('stations'); setShowConfig(true); }}
          />
        )}

        {/* Guided builder (modal overlay) */}
        {showWizard && (
          <FactoryWizard
            onClose={() => setShowWizard(false)}
            onOpenNetwork={() => { setConfigTab('network'); setShowConfig(true); }}
          />
        )}

        {/* Model upload/preview manager */}
        {showModelManager && (
          <ModelManager onClose={() => setShowModelManager(false)} />
        )}

      </TwinProvider>
    </div>
  );
}
