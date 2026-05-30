// TwinProvider.jsx — React context + RAF loop for the deterministic twin engine.
//
// Wraps children with TwinContext providing:
//   twinHook   — the useTwin handle (advanceFrame, pause, resume, etc.)
//   config     — the FactoryConfig

import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import { useTwin } from './useTwin.js';

export const TwinContext = createContext(null);

export function useTwinContext() {
  const ctx = useContext(TwinContext);
  if (!ctx) throw new Error('useTwinContext must be used inside TwinProvider');
  return ctx;
}

export function TwinProvider({ config, seed = 0, children }) {
  const twinHook = useTwin(config, { seed });
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);

  useLayoutEffect(() => {
    function loop(now) {
      if (lastTimeRef.current !== null) {
        // Cap delta at 100ms to prevent spiral-of-death after tab becomes inactive.
        const delta = Math.min((now - lastTimeRef.current) / 1000, 0.1);
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
    <TwinContext.Provider value={{ config, twinHook }}>
      {children}
    </TwinContext.Provider>
  );
}
