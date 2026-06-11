// SimControls.jsx — play/pause/step/speed/rewind strip at bottom of Twin UI.

import { useState, useCallback, useEffect } from 'react';
import { snapshot } from '../engine/mode/snapshot.js';
import { step } from '../engine/engine.js';
import { useTwinContext } from './TwinProvider.jsx';
import { T, useKeyboardShortcuts, useSessionStorage } from './kit.jsx';
import { fmtClock } from './metricsHistory.js';

const SPEEDS = [1, 5, 10, 100];

export default function SimControls() {
  const { twinHook } = useTwinContext();
  const { simTime, paused, done, pause, resume, setSpeed, rewind, _engineState } = twinHook;

  const [activeSpeed, setActiveSpeed] = useSessionStorage('simSpeed', 1);
  const [rewindToken, setRewindToken] = useState(null);
  const [rewindBanner, setRewindBanner] = useState(null);

  // Restore persisted speed on mount.
  useEffect(() => { setSpeed(activeSpeed); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      setRewindBanner(`Checkpoint saved at T=${fmtClock(state.clock.now())}`);
      setTimeout(() => setRewindBanner(null), 3000);
    } else {
      // Second click: rewind to saved token
      const tokTime = rewindToken.clockTime;
      rewind(rewindToken);
      setRewindToken(null);
      setRewindBanner(`Rewound to T=${fmtClock(tokTime)}`);
      setTimeout(() => setRewindBanner(null), 3000);
    }
  }, [_engineState, rewindToken, rewind]);

  useKeyboardShortcuts([
    { key: 'Space', action: handlePlayPause },
    { key: '.', action: handleStep },
    { key: '1', action: () => handleSpeed(1) },
    { key: '2', action: () => handleSpeed(5) },
    { key: '3', action: () => handleSpeed(10) },
    { key: '4', action: () => handleSpeed(100) },
    { key: 'r', action: handleRewind },
  ], [handlePlayPause, handleStep, handleSpeed, handleRewind]);

  const btnBase = {
    padding: '4px 10px',
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: T.sans,
    fontWeight: 600,
    transition: `background ${T.transition}, color ${T.transition}`,
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
        background: T.surface,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        padding: '8px 16px',
        color: T.textDim,
        userSelect: 'none',
        zIndex: T.z.rail,
        boxShadow: T.shadow.panel,
      }}
    >
      {/* Play/Pause */}
      <button
        data-testid="play-btn"
        onClick={handlePlayPause}
        style={{ ...btnBase, background: paused ? T.accent : '#374151', color: '#fff', minWidth: 64 }}
      >
        {paused ? '▶ Play' : '⏸ Pause'}
      </button>

      {/* Step */}
      <button
        onClick={handleStep}
        style={{ ...btnBase, background: '#374151', color: T.textDim }}
        title="Advance one tick (.)"
      >
        ▶|
      </button>

      {/* Speed */}
      {SPEEDS.map((s, i) => (
        <button
          key={s}
          data-testid={`speed-${s}`}
          onClick={() => handleSpeed(s)}
          title={`${s}× speed (${i + 1})`}
          style={{
            ...btnBase,
            fontFamily: T.mono,
            background: activeSpeed === s ? T.accentDeep : T.borderSoft,
            color: activeSpeed === s ? '#93c5fd' : T.textFaint,
            border: activeSpeed === s ? `1px solid ${T.accent}` : '1px solid transparent',
          }}
        >
          ×{s}
        </button>
      ))}

      {/* Sim time */}
      <span data-testid="sim-time" style={{ fontFamily: T.mono, fontSize: 14, color: T.cyan, minWidth: 80, textAlign: 'center' }}>
        {fmtClock(simTime)}
      </span>

      {/* Done badge */}
      {done && (
        <span
          data-testid="done-badge"
          style={{ background: '#059669', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700, fontFamily: T.display }}
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
          background: rewindToken ? T.violet : '#374151',
          color: rewindToken ? '#ddd6fe' : T.textDim,
          border: rewindToken ? `1px solid ${T.violet}` : '1px solid transparent',
        }}
        title={rewindToken ? 'Click to rewind to checkpoint' : 'Click to save checkpoint'}
      >
        {rewindToken ? '⏪ Rewind' : '📍 Mark'}
      </button>

      {/* Banner */}
      {rewindBanner && (
        <span style={{ fontSize: 12, color: '#a78bfa', fontFamily: T.mono }}>
          {rewindBanner}
        </span>
      )}

      {/* Keyboard hints */}
      <span style={{ fontSize: 10, color: '#475569', fontFamily: T.sans, marginLeft: 4 }}>
        Space: play/pause &middot; 1-4: speed &middot; R: rewind &middot; .: step
      </span>
    </div>
  );
}
