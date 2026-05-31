// SimControls.jsx — play/pause/step/speed/rewind strip at bottom of Twin UI.

import { useState, useCallback } from 'react';
import { snapshot } from '../engine/mode/snapshot.js';
import { step } from '../engine/engine.js';
import { useTwinContext } from './TwinProvider.jsx';

function fmt(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const SPEEDS = [1, 5, 10, 100];

export default function SimControls() {
  const { twinHook } = useTwinContext();
  const { simTime, paused, done, pause, resume, setSpeed, rewind, _engineState } = twinHook;

  const [activeSpeed, setActiveSpeed] = useState(1);
  const [rewindToken, setRewindToken] = useState(null);
  const [rewindBanner, setRewindBanner] = useState(null);

  const handlePlayPause = useCallback(() => {
    if (paused) {
      resume();
    } else {
      pause();
    }
  }, [paused, pause, resume]);

  const handleStep = useCallback(() => {
    const state = _engineState();
    if (!state) return;
    pause();
    step(state);
  }, [_engineState, pause]);

  const handleSpeed = useCallback((s) => {
    setActiveSpeed(s);
    setSpeed(s);
  }, [setSpeed]);

  const handleRewind = useCallback(() => {
    const state = _engineState();
    if (!state) return;
    if (!rewindToken) {
      // First click: take snapshot
      const tok = snapshot(state);
      setRewindToken(tok);
      setRewindBanner(`Checkpoint saved at T=${fmt(state.clock.now())}`);
      setTimeout(() => setRewindBanner(null), 3000);
    } else {
      // Second click: rewind to saved token
      const tokTime = rewindToken.clockTime;
      rewind(rewindToken);
      setRewindToken(null);
      setRewindBanner(`Rewound to T=${fmt(tokTime)}`);
      setTimeout(() => setRewindBanner(null), 3000);
    }
  }, [_engineState, rewindToken, rewind]);

  const btnBase = {
    padding: '4px 10px',
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'monospace',
  };

  return (
    <div
      data-testid="sim-controls"
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(12,19,34,0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #1e3a5f',
        borderRadius: 8,
        padding: '8px 16px',
        color: '#cbd5e1',
        userSelect: 'none',
        zIndex: 100,
      }}
    >
      {/* Play/Pause */}
      <button
        data-testid="play-btn"
        onClick={handlePlayPause}
        style={{ ...btnBase, background: paused ? '#2563eb' : '#374151', color: '#fff', minWidth: 64 }}
      >
        {paused ? '▶ Play' : '⏸ Pause'}
      </button>

      {/* Step */}
      <button
        onClick={handleStep}
        style={{ ...btnBase, background: '#374151', color: '#94a3b8' }}
        title="Advance one engine step"
      >
        ▶|
      </button>

      {/* Speed */}
      {SPEEDS.map((s) => (
        <button
          key={s}
          data-testid={`speed-${s}`}
          onClick={() => handleSpeed(s)}
          style={{
            ...btnBase,
            background: activeSpeed === s ? '#1e40af' : '#1e293b',
            color: activeSpeed === s ? '#93c5fd' : '#64748b',
            border: activeSpeed === s ? '1px solid #3b82f6' : '1px solid transparent',
          }}
        >
          ×{s}
        </button>
      ))}

      {/* Sim time */}
      <span data-testid="sim-time" style={{ fontFamily: 'monospace', fontSize: 14, color: '#38bdf8', minWidth: 80, textAlign: 'center' }}>
        {fmt(simTime)}
      </span>

      {/* Done badge */}
      {done && (
        <span
          data-testid="done-badge"
          style={{ background: '#059669', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}
        >
          DONE ✓
        </span>
      )}

      {/* Rewind */}
      <button
        data-testid="rewind-btn"
        onClick={handleRewind}
        style={{
          ...btnBase,
          background: rewindToken ? '#7c3aed' : '#374151',
          color: rewindToken ? '#ddd6fe' : '#94a3b8',
          border: rewindToken ? '1px solid #7c3aed' : '1px solid transparent',
        }}
        title={rewindToken ? 'Click to rewind to checkpoint' : 'Click to save checkpoint'}
      >
        {rewindToken ? '⏪ Rewind' : '📍 Mark'}
      </button>

      {/* Banner */}
      {rewindBanner && (
        <span style={{ fontSize: 12, color: '#a78bfa', fontFamily: 'monospace' }}>
          {rewindBanner}
        </span>
      )}
    </div>
  );
}
