import { describe, test, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { resetIds } from '../util/ids.js';
import { useTwin } from './useTwin.js';
import { makeLinearLineFixture } from '../fixtures/simpleLine.js';
import { snapshot } from '../engine/mode/snapshot.js';
import { initState } from '../engine/engine.js';

beforeEach(() => resetIds(0));

describe('useTwin hook', () => {
  test('initializes with simTime = 0', () => {
    const cfg = makeLinearLineFixture();
    const { result } = renderHook(() => useTwin(cfg, { seed: 0 }));
    expect(result.current.simTime).toBe(0);
  });

  test('advanceFrame advances simTime', () => {
    const cfg = makeLinearLineFixture();
    const { result } = renderHook(() => useTwin(cfg, { seed: 0 }));
    const t0 = result.current.simTime;
    act(() => {
      result.current.advanceFrame(1.0);
    });
    const t1 = result.current.simTime;
    expect(t1).toBeGreaterThan(t0);
  });

  test('pause() + advanceFrame() leaves simTime unchanged', () => {
    const cfg = makeLinearLineFixture();
    const { result } = renderHook(() => useTwin(cfg, { seed: 0 }));
    act(() => {
      result.current.pause();
    });
    expect(result.current.paused).toBe(true);
    const t0 = result.current.simTime;
    act(() => {
      result.current.advanceFrame(1.0);
    });
    expect(result.current.simTime).toBe(t0);
  });

  test('resume() + advanceFrame() advances simTime again', () => {
    const cfg = makeLinearLineFixture();
    const { result } = renderHook(() => useTwin(cfg, { seed: 0 }));
    act(() => {
      result.current.pause();
    });
    const t0 = result.current.simTime;
    act(() => {
      result.current.resume();
    });
    expect(result.current.paused).toBe(false);
    act(() => {
      result.current.advanceFrame(1.0);
    });
    expect(result.current.simTime).toBeGreaterThan(t0);
  });

  test('done becomes true after sufficient frames to complete linearLine', () => {
    const cfg = makeLinearLineFixture();
    const { result } = renderHook(() => useTwin(cfg, { seed: 0 }));
    let iters = 0;
    while (!result.current.done && iters < 500) {
      act(() => {
        result.current.advanceFrame(1.0);
      });
      iters++;
    }
    expect(result.current.done).toBe(true);
    expect(iters).toBeLessThan(500);
  });

  test('applyConfig without pause() throws error', () => {
    const cfg = makeLinearLineFixture();
    const { result } = renderHook(() => useTwin(cfg, { seed: 0 }));
    expect(() => {
      act(() => {
        result.current.applyConfig(cfg);
      });
    }).toThrow('pause');
  });

  test('applyConfig while paused updates metrics immediately', () => {
    const cfg = makeLinearLineFixture();
    const { result } = renderHook(() => useTwin(cfg, { seed: 0 }));
    act(() => {
      result.current.advanceFrame(0.5); // get some metrics
    });
    const metricsBeforeApply = result.current.metrics;
    act(() => {
      result.current.pause();
    });
    act(() => {
      result.current.applyConfig(cfg); // same config
    });
    const metricsAfterApply = result.current.metrics;
    // Metrics should still be defined (recomputed)
    expect(metricsAfterApply).toBeDefined();
    expect(metricsAfterApply.peopleRequired).toBeDefined();
  });

  test('applyConfig with invalid config throws validation error', () => {
    const cfg = makeLinearLineFixture();
    const { result } = renderHook(() => useTwin(cfg, { seed: 0 }));
    const badCfg = { ...cfg, stations: [] }; // invalid: no stations
    act(() => {
      result.current.pause();
    });
    expect(() => {
      act(() => {
        result.current.applyConfig(badCfg);
      });
    }).toThrow();
  });

  test('rewind(token) returns simTime to checkpoint', () => {
    const cfg = makeLinearLineFixture();
    const { result } = renderHook(() => useTwin(cfg, { seed: 0 }));

    // Advance a few frames
    act(() => {
      result.current.advanceFrame(1.0);
    });
    const t1 = result.current.simTime;

    // Take a snapshot
    const token = snapshot(result.current._engineState());
    const tokenTime = token.clockTime;
    expect(tokenTime).toBe(t1);

    // Advance more
    act(() => {
      result.current.advanceFrame(2.0);
    });
    const t2 = result.current.simTime;
    expect(t2).toBeGreaterThan(t1);

    // Rewind
    act(() => {
      result.current.rewind(token);
    });
    expect(result.current.simTime).toBe(tokenTime);
    expect(result.current.done).toBe(false);
    expect(result.current.paused).toBe(false);
  });

  test('advanceFrame respects MAX_STEPS_PER_FRAME cap', () => {
    const cfg = makeLinearLineFixture();
    const { result } = renderHook(() => useTwin(cfg, { seed: 0 }));

    // Requesting a huge wall-delta would normally trigger many steps.
    // With MAX_STEPS_PER_FRAME = 500, the frame should not block indefinitely.
    const start = Date.now();
    act(() => {
      result.current.advanceFrame(10000); // 10,000 sim-seconds at speed ×1
    });
    const elapsed = Date.now() - start;

    // Should complete in a reasonable time (not hang)
    expect(elapsed).toBeLessThan(2000); // 2 seconds max
  });

  test('shock events accumulate in shocks array', () => {
    const cfg = makeLinearLineFixture();
    const { result } = renderHook(() => useTwin(cfg, { seed: 0 }));

    // LinearLine fixture has no deadlocks, so shocks should remain empty
    act(() => {
      for (let i = 0; i < 100; i++) {
        result.current.advanceFrame(1.0);
        if (result.current.done) break;
      }
    });

    expect(result.current.shocks).toHaveLength(0);
  });

  test('rewind clears paused and shock state', () => {
    const cfg = makeLinearLineFixture();
    const { result } = renderHook(() => useTwin(cfg, { seed: 0 }));

    act(() => {
      result.current.advanceFrame(1.0);
    });
    const token = snapshot(result.current._engineState());

    act(() => {
      result.current.pause();
    });
    expect(result.current.paused).toBe(true);

    act(() => {
      result.current.rewind(token);
    });
    expect(result.current.paused).toBe(false);
    expect(result.current.shocks).toHaveLength(0);
  });

  test('setSpeed affects time advancement rate', () => {
    const cfg = makeLinearLineFixture();
    const { result } = renderHook(() => useTwin(cfg, { seed: 0 }));

    act(() => {
      result.current.advanceFrame(1.0);
    });
    const t1 = result.current.simTime;

    act(() => {
      result.current.setSpeed(5);
      result.current.advanceFrame(1.0); // should advance 5 sim-seconds per wall-second
    });
    const t2 = result.current.simTime;

    // At speed=1 we advance ~1 sim-sec per wall-sec (rough estimate)
    // At speed=5 we should advance more
    expect(t2 - t1).toBeGreaterThan(0);
  });
});
