// ShockConsole.jsx — deadlock/shock event list content for the right rail.
//
// Read/unread state is owned by RightRail (so the unread badge on the rail tab
// stays live while this content is hidden) and passed down as props.

import { useState } from 'react';
import { useTwinContext } from './TwinProvider.jsx';
import { T, Button } from './kit.jsx';
import { fmtClock } from './metricsHistory.js';

export default function ShockConsoleContent({ readIds, onAck, onAckAll }) {
  const { twinHook } = useTwinContext();
  const { shocks } = twinHook;

  const [expandedIds, setExpandedIds] = useState(new Set());
  const [filter, setFilter] = useState('');

  const unreadCount = shocks.filter((s) => !readIds.has(s.id ?? shocks.indexOf(s))).length;

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredShocks = filter
    ? shocks.filter((shock) => {
        const members = shock.members ?? shock.cycle ?? [];
        return members.join(' ').toLowerCase().includes(filter.toLowerCase());
      })
    : shocks;

  return (
    <div data-testid="shock-console">
      {unreadCount > 0 && (
        <div style={{ padding: '8px 12px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onAckAll} style={{ padding: '2px 8px', fontSize: 10 }}>
            Ack all ({unreadCount})
          </Button>
        </div>
      )}
      {shocks.length > 3 && (
        <div style={{ padding: '8px 12px 0' }}>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter shocks…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: T.borderSoft, border: `1px solid ${T.border}`,
              borderRadius: 4, color: T.text, fontSize: 11, fontFamily: T.sans,
              padding: '3px 8px', outline: 'none',
            }}
          />
        </div>
      )}
      <ul style={{ margin: 0, padding: '6px 0 8px', listStyle: 'none', maxHeight: 260, overflowY: 'auto' }}>
        {filteredShocks.length === 0 && (
          <li style={{ padding: '6px 12px', fontSize: 12, color: T.textFaint, fontStyle: 'italic', fontFamily: T.sans }}>
            {shocks.length === 0
              ? 'No shocks detected — the simulation is running normally.'
              : 'No shocks match the filter.'}
          </li>
        )}
        {filteredShocks.map((shock) => {
          const id = shock.id ?? shocks.indexOf(shock);
          const read = readIds.has(id);
          const expanded = expandedIds.has(id);
          const members = shock.members ?? shock.cycle ?? [];
          const t = shock.time ?? shock.t ?? shock.timestamp ?? 0;

          return (
            <li
              key={id}
              data-testid="shock-row"
              style={{
                padding: '6px 12px',
                borderTop: `1px solid ${T.borderSoft}`,
                opacity: read ? 0.5 : 1,
              }}
            >
              <div
                onClick={() => toggleExpand(id)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 6 }}
              >
                <span style={{ color: T.textFaint, fontFamily: T.mono, fontSize: 11, flexShrink: 0 }}>
                  [{fmtClock(t)}]
                </span>
                <span style={{ fontSize: 12, color: 'rgba(239,68,68,0.7)', flex: 1, fontFamily: T.sans }}>
                  DEADLOCK — cycle: {members.slice(0, 3).join(' → ')}
                  {members.length > 3 ? ' …' : ''}
                </span>
                {!read && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAck(id); }}
                    style={{
                      background: 'none', border: `1px solid ${T.raised}`,
                      borderRadius: 3, color: T.textDim, cursor: 'pointer',
                      fontSize: 10, fontFamily: T.sans, padding: '1px 5px', flexShrink: 0,
                    }}
                  >
                    ack
                  </button>
                )}
              </div>
              {expanded && members.length > 0 && (
                <ul style={{ margin: '4px 0 0 20px', padding: 0, listStyle: 'disc', fontSize: 11, color: T.textDim }}>
                  {members.map((m, j) => (
                    <li key={j} style={{ fontFamily: T.mono }}>{m}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
