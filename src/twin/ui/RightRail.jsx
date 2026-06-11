// RightRail.jsx — tabbed right-hand rail replacing the old 4-panel stack.
//
// One section visible at a time (Analytics / Resources / WIP / Shocks /
// Events) so the rail never overflows the viewport. The shock unread badge
// lives on the Shocks tab and stays mounted regardless of the active section
// (the e2e suite reads it at any time).

import { useState } from 'react';
import { BarChart3, Users, Boxes, AlertTriangle, ScrollText } from 'lucide-react';
import { useTwinContext } from './TwinProvider.jsx';
import { T, Panel, SegmentedTabs, useSessionStorage, useMediaQuery } from './kit.jsx';
import MetricsDashboardContent from './MetricsDashboard.jsx';
import HeadcountContent from './HeadcountPanel.jsx';
import WipHeatmapContent from './WipHeatmap.jsx';
import ShockConsoleContent from './ShockConsole.jsx';
import EventFeedContent from './EventFeed.jsx';

const TITLES = {
  analytics: 'Analytics',
  resources: 'Resources',
  wip: 'WIP / Buffer',
  shocks: 'Shocks / Deadlocks',
  events: 'Event Feed',
};

export default function RightRail({ highlightOrderId, onToggleOrderHighlight }) {
  const { twinHook } = useTwinContext();
  const { shocks } = twinHook;
  const compact = useMediaQuery('(max-width: 1199px)');

  const [tab, setTab] = useSessionStorage('railTab', 'analytics');
  const [readIds, setReadIds] = useState(new Set());

  const unreadCount = shocks.filter((s, i) => !readIds.has(s.id ?? i)).length;
  const ack = (id) => setReadIds((prev) => new Set([...prev, id]));
  const ackAll = () => setReadIds(new Set(shocks.map((s, i) => s.id ?? i)));

  // e2e contract: with zero shocks the badge reads exactly "0"; otherwise
  // unread/total. Always mounted, whatever section is active.
  const shockBadge = (
    <span
      data-testid="shock-count"
      style={{
        background: unreadCount > 0 ? T.red : T.borderSoft,
        color: unreadCount > 0 ? '#fff' : T.textFaint,
        borderRadius: 8,
        padding: '0 5px',
        fontSize: 9,
        fontWeight: 700,
        fontFamily: T.mono,
        minWidth: 14,
        lineHeight: '14px',
        textAlign: 'center',
        display: 'inline-block',
      }}
    >
      {shocks.length === 0 ? '0' : `${unreadCount}/${shocks.length}`}
    </span>
  );

  const tabs = [
    { key: 'analytics', label: 'Stats', icon: <BarChart3 size={14} /> },
    { key: 'resources', label: 'Crew', icon: <Users size={14} /> },
    { key: 'wip', label: 'WIP', icon: <Boxes size={14} /> },
    { key: 'shocks', label: 'Shocks', icon: <AlertTriangle size={14} />, badge: shockBadge },
    { key: 'events', label: 'Events', icon: <ScrollText size={14} /> },
  ];

  return (
    <div
      data-testid="metrics-rail"
      style={{
        position: 'absolute', top: 56, right: 12,
        width: compact ? 224 : 264,
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: T.z.rail,
        maxHeight: 'calc(100vh - 150px)',
      }}
    >
      <SegmentedTabs items={tabs} active={tab} onChange={setTab} compact={compact} />
      <Panel
        title={TITLES[tab]}
        style={{
          overflowY: 'auto', minHeight: 0,
          animation: 'twinFadeIn 0.18s ease',
          boxShadow: T.shadow.panel,
        }}
      >
        <div key={tab} style={{ animation: 'twinFadeIn 0.18s ease' }}>
          {tab === 'analytics' && (
            <MetricsDashboardContent
              highlightOrderId={highlightOrderId}
              onToggleOrderHighlight={onToggleOrderHighlight}
            />
          )}
          {tab === 'resources' && <HeadcountContent />}
          {tab === 'wip' && <WipHeatmapContent />}
          {tab === 'shocks' && <ShockConsoleContent readIds={readIds} onAck={ack} onAckAll={ackAll} />}
          {tab === 'events' && <EventFeedContent />}
        </div>
      </Panel>
    </div>
  );
}
