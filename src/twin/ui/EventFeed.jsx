// EventFeed.jsx — live event log content for the right rail.
//
// Streams the engine's notable events (coalesced unit completions, scraps,
// shocks, order completions) latest-first with sim-clock timestamps. The feed
// itself is captured in useTwin's ring buffer (cap 100).

import { useTwinContext } from './TwinProvider.jsx';
import { T, EmptyState } from './kit.jsx';
import { fmtClock } from './metricsHistory.js';

const STYLE = {
  units_completed: { icon: '✓', color: T.state.ok },
  scrapped:        { icon: '✕', color: T.state.alert },
  shock_raised:    { icon: '⚠', color: T.state.alert },
  order_completed: { icon: '◆', color: T.state.ok },
  order_short:     { icon: '◆', color: T.state.warn },
};

function describe(ev) {
  switch (ev.type) {
    case 'units_completed':
      return ev.count > 1 ? `+${ev.count} units completed` : `Unit ${ev.unit_id ?? ''} completed`;
    case 'scrapped':
      return `Unit ${ev.unit_id ?? ''} scrapped`;
    case 'shock_raised':
      return `Shock: ${ev.reason ?? 'deadlock'}`;
    case 'order_completed':
      return `Order ${ev.order_id} completed`;
    case 'order_short':
      return `Order ${ev.order_id} closed short`;
    default:
      return ev.type;
  }
}

export default function EventFeedContent() {
  const { twinHook } = useTwinContext();
  const events = twinHook.events ?? [];

  if (events.length === 0) {
    return (
      <EmptyState
        icon="≡"
        message="No events yet"
        hint="Unit completions, scrap and order milestones appear here as the line runs."
      />
    );
  }

  return (
    <ul data-testid="event-feed" style={{ margin: 0, padding: '6px 0 8px', listStyle: 'none', maxHeight: 320, overflowY: 'auto' }}>
      {[...events].reverse().map((ev, i) => {
        const s = STYLE[ev.type] ?? { icon: '·', color: T.textFaint };
        return (
          <li
            key={`${ev.timestamp}-${ev.type}-${i}`}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              padding: '4px 12px', borderTop: i > 0 ? `1px solid ${T.borderSoft}` : 'none',
            }}
          >
            <span style={{ color: s.color, fontSize: 11, flexShrink: 0, width: 12, textAlign: 'center' }}>{s.icon}</span>
            <span style={{ flex: 1, fontSize: 11, color: T.textDim, fontFamily: T.sans }}>{describe(ev)}</span>
            <span style={{ color: T.textFaint, fontFamily: T.mono, fontSize: 10, flexShrink: 0 }}>{fmtClock(ev.timestamp)}</span>
          </li>
        );
      })}
    </ul>
  );
}
