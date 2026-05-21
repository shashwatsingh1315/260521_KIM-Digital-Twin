import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Play, Pause, Activity, Zap, MonitorPlay, Map, X, Boxes } from 'lucide-react';
import { useSimEngine } from './engine/useSimEngine.js';
import { computeLayout, loadOverrides } from './layout/autoLayout.js';
import { location_node, buffer_capacity } from './data/m800_model.js';
import FactoryTwin from './components/FactoryTwin.jsx';
import LayoutEditor from './components/LayoutEditor.jsx';
import AssetInspector from './components/AssetInspector.jsx';

function App() {
  const engine = useSimEngine();
  const sceneRef = useRef();

  const {
    currentTick, isPlaying, activeScenarios, state, kpis,
    setTick, togglePlay, toggleScenario, resetLive, scenarios, maxTick,
  } = engine;

  const isHistorical = currentTick < maxTick;

  // Layout: auto + overrides from localStorage
  const [layoutOverrides, setLayoutOverrides] = useState(() => loadOverrides());
  const layout = computeLayout(location_node, layoutOverrides);

  const [showEditor, setShowEditor] = useState(false);
  const [isMobile, setIsMobile]     = useState(false);
  const [mobileUnlocked, setMobileUnlocked] = useState(false);
  const [selectedLoc, setSelectedLoc] = useState(null);
  const [showInspector, setShowInspector] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('inspector') === 'true') {
      setShowInspector(true);
    }
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleViewPreset = useCallback(preset => {
    sceneRef.current?.flyTo(preset);
  }, []);

  const handleEditorClose = useCallback(savedOverrides => {
    setShowEditor(false);
    if (savedOverrides) setLayoutOverrides(savedOverrides);
  }, []);

  const hasBottleneck = kpis.bottlenecks?.length > 0;

  return (
    <div className="dashboard-container">
      {showEditor && <LayoutEditor onClose={handleEditorClose} />}

      <header>
        <div>
          <h1>M800 Digital Twin — Factory Pull System</h1>
          <div className="subtitle">KMP Manufacturing (3 floors) + Warehouse ASRS — End-to-End M800 Flow</div>
        </div>
        <div className="badge">{hasBottleneck ? '⚠ BOTTLENECK' : 'RUNNING'}</div>
      </header>

      <div className="main-content">
        {/* 3D VIEWPORT */}
        <div className="viewport-wrapper">
          <div className="viewport-panel" onDoubleClick={() => isMobile && setMobileUnlocked(true)}>
            <div className="viewport-header">
              <div className="viewport-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MonitorPlay size={16} /> 3D Viewport
              </div>
              <div className="viewport-controls">
                <button className="btn-ctrl" onClick={() => handleViewPreset('kmp')}>← KMP</button>
                <button className="btn-ctrl" onClick={() => handleViewPreset('center')}>Center</button>
                <button className="btn-ctrl" onClick={() => handleViewPreset('wh')}>WH →</button>
                <button className="btn-ctrl" onClick={() => handleViewPreset('top')}>Top</button>
                <div style={{ width: 1, height: 16, background: 'var(--border-color)', margin: '0 4px' }} />
                <button
                  className="btn-ctrl"
                  onClick={() => setShowEditor(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <Map size={13} /> Edit Layout
                </button>
                <button
                  className="btn-ctrl"
                  onClick={() => setShowInspector(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <Boxes size={13} /> Model Gallery
                </button>
              </div>
            </div>

            {isMobile && !mobileUnlocked && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
                <div style={{ background: 'var(--panel-bg)', padding: '12px 24px', borderRadius: 20, border: '1px solid var(--border-color)', fontSize: 13 }}>
                  Double-tap to interact with 3D canvas
                </div>
              </div>
            )}

            <div style={{ flex: 1, pointerEvents: isMobile && !mobileUnlocked ? 'none' : 'auto' }}>
              <FactoryTwin
                simState={state}
                layout={layout}
                sceneRef={sceneRef}
                isMobile={isMobile}
                onSelectLoc={setSelectedLoc}
                selectedLocId={selectedLoc?.location_id}
              />
            </div>
          </div>

          {/* TIMELINE */}
          <div className="timeline-panel">
            <div className="timeline-controls">
              <button className="btn-ctrl" onClick={togglePlay} style={{ width: 40, justifyContent: 'center' }}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
            </div>
            <div className="slider-container">
              <span style={{ fontSize: 12, fontWeight: 'bold' }}>Time Travel</span>
              <input
                type="range" min="0" max={maxTick} value={currentTick}
                onChange={e => setTick(parseInt(e.target.value))}
                className="slider"
              />
              <div className={`time-display ${isHistorical ? 'historical' : 'live'}`}>
                {isHistorical ? `T-${maxTick - currentTick} (Historical)` : 'LIVE'}
              </div>
            </div>
            {isHistorical && (
              <button className="btn-resume" onClick={resetLive}>Resume Live</button>
            )}
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="dashboard-sidebar">

          {/* Selected station info */}
          {selectedLoc && (() => {
            const bufVal    = state?.buffers?.[selectedLoc.location_id] ?? null;
            const cap       = buffer_capacity[selectedLoc.location_id] ?? null;
            const fillRatio = (bufVal !== null && cap) ? bufVal / cap : null;
            return (
              <div className="card" style={{ borderColor: '#f59e0b', borderWidth: 1 }}>
                <h3 className="card-title">
                  <span>Station</span>
                  <button onClick={() => setSelectedLoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                    <X size={14} />
                  </button>
                </h3>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{selectedLoc.location_name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'monospace' }}>{selectedLoc.location_id}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {[selectedLoc.site, selectedLoc.floor, selectedLoc.block, selectedLoc.zone].filter(Boolean).map(t => (
                    <span key={t} style={{ fontSize: 10, background: 'rgba(255,255,255,0.07)', padding: '2px 6px', borderRadius: 3, color: '#94a3b8' }}>{t}</span>
                  ))}
                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.07)', padding: '2px 6px', borderRadius: 3, color: '#64748b' }}>{selectedLoc.location_type}</span>
                </div>
                {fillRatio !== null && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Buffer</span>
                      <span style={{ color: fillRatio >= 0.9 ? 'var(--danger)' : fillRatio >= 0.6 ? 'var(--warning)' : 'var(--success)' }}>
                        {bufVal} / {cap}
                      </span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, height: 5 }}>
                      <div style={{
                        width: `${Math.min(100, fillRatio * 100).toFixed(1)}%`,
                        height: '100%',
                        borderRadius: 3,
                        background: fillRatio >= 0.9 ? 'var(--danger)' : fillRatio >= 0.6 ? 'var(--warning)' : 'var(--success)',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* KPIs */}
          <div className="card">
            <h3 className="card-title">
              <span>M800 Flow KPIs</span>
              <span style={{ color: hasBottleneck ? 'var(--danger)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className={`status-dot ${hasBottleneck ? 'bottleneck' : 'running'}`} />
                {hasBottleneck ? 'BOTTLENECK' : 'NOMINAL'}
              </span>
            </h3>
            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-label">In Transit</div>
                <div className="stat-value">{kpis.inTransit ?? 0}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Dispatched</div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>{kpis.totalDispatched ?? 0}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">WH ASRS Level</div>
                <div className="stat-value">{kpis.whAsrsLevel ?? 0}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Dispatch Queue</div>
                <div className="stat-value">{kpis.dispatchLevel ?? 0}</div>
              </div>
            </div>
          </div>

          {/* Bottleneck Diagnosis */}
          <div className="card">
            <h3 className="card-title">
              <Zap size={16} /> Bottleneck Diagnosis
            </h3>
            {!hasBottleneck && kpis.starved?.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                All buffers nominal. Pull signals propagating across KMP → WH.
              </div>
            ) : (
              <div className="diagnose-box">
                {kpis.bottlenecks?.length > 0 && (
                  <div>
                    <strong style={{ color: 'var(--danger)' }}>FULL (backpressure):</strong>
                    {kpis.bottlenecks.map(b => (
                      <div key={b} style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>▲ {b.replace('LOC-', '')}</div>
                    ))}
                  </div>
                )}
                {kpis.starved?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <strong style={{ color: 'var(--warning)' }}>STARVED (no input):</strong>
                    {kpis.starved.map(b => (
                      <div key={b} style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>▼ {b.replace('LOC-', '')}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scenario Overrides (Shocks) */}
          <div className="card">
            <h3 className="card-title">
              <Activity size={16} /> Scenario Overrides
            </h3>
            <div className="queue-list">
              {scenarios.map(scn => {
                const active = activeScenarios.includes(scn.scenario_id);
                return (
                  <div
                    key={scn.scenario_id}
                    className={`queue-item ${active ? 'blocked' : ''}`}
                    style={{ cursor: 'pointer', alignItems: 'flex-start' }}
                    onClick={() => toggleScenario(scn.scenario_id)}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{scn.scenario_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{scn.reason}</div>
                    </div>
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: 10,
                      fontWeight: 700,
                      color: active ? 'var(--danger)' : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      paddingTop: 2,
                    }}>
                      {active ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
      {showInspector && <AssetInspector onClose={() => setShowInspector(false)} />}
    </div>
  );
}

export default App;
