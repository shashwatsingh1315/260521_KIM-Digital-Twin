// ShockConsole.jsx — collapsible panel showing deadlock/shock events.

import { useState } from 'react';
import { useTwinContext } from './TwinProvider.jsx';

function fmt(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function ShockConsole() {
  const { twinHook } = useTwinContext();
  const { shocks } = twinHook;

  const [collapsed, setCollapsed] = useState(false);
  const [readIds, setReadIds] = useState(new Set());
  const [expandedIds, setExpandedIds] = useState(new Set());

  const unreadCount = shocks.filter((s) => !readIds.has(s.id ?? shocks.indexOf(s))).length;

  const acknowledge = (id) => {
    setReadIds((prev) => new Set([...prev, id]));
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      data-testid="shock-console"
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
        background: 'rgba(12,19,34,0.9)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${unreadCount > 0 ? '#dc2626' : '#1e3a5f'}`,
        borderRadius: 8,
        color: '#cbd5e1',
      }}
    >
      {/* Header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: '#64748b', textTransform: 'uppercase', flex: 1 }}>
          Shocks / Deadlocks
        </span>
        <span
          data-testid="shock-count"
          style={{
            background: unreadCount > 0 ? '#dc2626' : '#1e293b',
            color: unreadCount > 0 ? '#fff' : '#64748b',
            borderRadius: 10,
            padding: '1px 7px',
            fontSize: 11,
            fontWeight: 700,
            minWidth: 20,
            textAlign: 'center',
          }}
        >
          {unreadCount}
        </span>
        <span style={{ color: '#475569', fontSize: 12 }}>{collapsed ? '▲' : '▼'}</span>
      </div>

      {/* List */}
      {!collapsed && (
        <ul style={{ margin: 0, padding: '0 0 8px', listStyle: 'none', maxHeight: 220, overflowY: 'auto' }}>
          {shocks.length === 0 && (
            <li style={{ padding: '4px 12px', fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
              No shocks detected.
            </li>
          )}
          {shocks.map((shock, i) => {
            const id = shock.id ?? i;
            const read = readIds.has(id);
            const expanded = expandedIds.has(id);
            const members = shock.members ?? shock.cycle ?? [];
            const t = shock.time ?? shock.t ?? 0;

            return (
              <li
                key={id}
                data-testid="shock-row"
                style={{
                  padding: '6px 12px',
                  borderTop: '1px solid #1e293b',
                  opacity: read ? 0.5 : 1,
                }}
              >
                <div
                  onClick={() => toggleExpand(id)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 6 }}
                >
                  <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 11, flexShrink: 0 }}>
                    [{fmt(t)}]
                  </span>
                  <span style={{ fontSize: 12, color: '#fca5a5', flex: 1 }}>
                    DEADLOCK — cycle: {members.slice(0, 3).join(' → ')}
                    {members.length > 3 ? ' …' : ''}
                  </span>
                  {!read && (
                    <button
                      onClick={(e) => { e.stopPropagation(); acknowledge(id); }}
                      style={{
                        background: 'none',
                        border: '1px solid #374151',
                        borderRadius: 3,
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: 10,
                        padding: '1px 5px',
                        flexShrink: 0,
                      }}
                    >
                      ack
                    </button>
                  )}
                </div>
                {expanded && members.length > 0 && (
                  <ul style={{ margin: '4px 0 0 20px', padding: 0, listStyle: 'disc', fontSize: 11, color: '#94a3b8' }}>
                    {members.map((m, j) => (
                      <li key={j} style={{ fontFamily: 'monospace' }}>{m}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
