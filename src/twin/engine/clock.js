// Clock — injected synthetic time source (§5.2).
//
// The engine reads time only via this interface, enabling deterministic,
// reproducible simulation. Created with an initial time (usually 0).

/**
 * Create a synthetic clock starting at initialTime seconds.
 * @param {number} initialTime
 * @returns {object} {now: () => seconds}
 */
export function makeClock(initialTime = 0) {
  let currentTime = initialTime;

  return Object.freeze({
    now: () => currentTime,
    advance: (deltaSeconds) => {
      currentTime += deltaSeconds;
      return currentTime;
    },
    setTime: (newTime) => {
      currentTime = newTime;
      return currentTime;
    },
  });
}
