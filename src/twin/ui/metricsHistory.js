// metricsHistory.js — pure helpers for the analytics dashboard.
//
// The twin engine emits an instantaneous metrics snapshot each frame; these
// functions turn a rolling series of snapshots into the derived figures the
// dashboard shows (throughput, ETA, sparkline geometry). Kept DOM-free and
// pure so the maths is unit-tested independently of React.

/**
 * Append a sample, keeping at most `cap` most-recent points.
 * A sample is `{ t, completed, wip, scrapped? }` (t = sim seconds).
 * Out-of-order or duplicate-time samples are ignored (the engine clock is
 * monotonic within a run; a smaller t means a re-init/rewind happened, so the
 * caller should reset the history instead).
 * @returns {Array} new history array (input is never mutated)
 */
export function pushSample(history, sample, cap = 600) {
  if (history.length > 0 && sample.t <= history[history.length - 1].t) {
    return history;
  }
  const next = history.length >= cap
    ? history.slice(history.length - cap + 1)
    : history.slice();
  next.push(sample);
  return next;
}

/**
 * Realised throughput in units/hour over the trailing `windowSeconds` of sim
 * time (defaults to the whole history). Uses completed-unit deltas, so it
 * reflects what the line actually shipped — not theoretical capacity.
 */
export function throughputPerHour(history, windowSeconds = Infinity) {
  if (history.length < 2) return 0;
  const last = history[history.length - 1];
  let first = history[0];
  for (let i = history.length - 1; i >= 0; i--) {
    if (last.t - history[i].t <= windowSeconds) first = history[i];
    else break;
  }
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return ((last.completed - first.completed) / dt) * 3600;
}

/**
 * Seconds to finish `remaining` units at the given units/hour rate.
 * Returns 0 when nothing remains and Infinity when the line is stalled.
 */
export function etaSeconds(remaining, ratePerHour) {
  if (remaining <= 0) return 0;
  if (!Number.isFinite(ratePerHour) || ratePerHour <= 0) return Infinity;
  return (remaining / ratePerHour) * 3600;
}

/**
 * Roll an orders array up into a single progress figure.
 * @param {Array<{quantity:number, units_completed:number, scrap?:number}>} orders
 */
export function orderProgress(orders = []) {
  let target = 0, completed = 0, scrapped = 0;
  for (const o of orders) {
    target += o.quantity ?? 0;
    completed += o.units_completed ?? 0;
    scrapped += o.scrap ?? 0;
  }
  const remaining = Math.max(0, target - completed);
  const fraction = target > 0 ? completed / target : 0;
  return { target, completed, scrapped, remaining, fraction };
}

/**
 * Human-readable duration. Infinity → "—", otherwise compact H/M/S.
 */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/**
 * Build an SVG polyline `points` string for a sparkline of `values`.
 * Scales to [0,width] × [0,height] with a 1px top/bottom pad; a flat series
 * renders along the vertical middle.
 */
export function sparklinePoints(values, width, height) {
  if (!values || values.length === 0) return '';
  if (values.length === 1) return `0,${height / 2} ${width},${height / 2}`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min;
  const span = max - min || 1;
  const pad = 1;
  const h = height - pad * 2;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      // A flat series has no meaningful amplitude — render along the vertical middle.
      const y = flat ? height / 2 : pad + h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
