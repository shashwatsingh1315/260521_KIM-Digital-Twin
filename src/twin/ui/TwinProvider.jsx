// TwinProvider.jsx — React context + RAF loop for the deterministic twin engine.
//
// Wraps children with TwinContext providing:
//   twinHook   — the useTwin handle (advanceFrame, pause, resume, etc.)
//   config     — the FactoryConfig
//   setConfig  — replace the whole config (triggers a clean engine re-init);
//                used by structural editors (network/carrier/fixture swap)

import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import { useTwin } from './useTwin.js';

export const TwinContext = createContext(null);

export function useTwinContext() {
  const ctx = useContext(TwinContext);
  if (!ctx) throw new Error('useTwinContext must be used inside TwinProvider');
  return ctx;
}

export function TwinProvider({ config, seed = 0, setSeed = null, setConfig = null, children }) {
  const twinHook = useTwin(config, { seed });
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);

  useLayoutEffect(() => {
    function loop(now) {
      if (lastTimeRef.current !== null) {
        // Cap delta at 1s: long enough to preserve real-time pacing at low frame
        // rates (headless/throttled RAF can run at ~1-2fps, where a 100ms cap
        // would starve the sim), short enough to bound the per-frame catch-up
        // after the tab is backgrounded. MAX_STEPS_PER_FRAME guards the rest.
        const delta = Math.min((now - lastTimeRef.current) / 1000, 1.0);
        twinHook.advanceFrame(delta);
      }
      lastTimeRef.current = now;
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    };
  }, [twinHook.advanceFrame]);

  return (
    <TwinContext.Provider value={{ config, twinHook, setConfig, seed, setSeed }}>
      {children}
    </TwinContext.Provider>
  );
}
