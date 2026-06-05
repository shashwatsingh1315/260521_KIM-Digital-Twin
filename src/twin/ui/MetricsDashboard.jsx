// MetricsDashboard.jsx — live analytics rail panel.
//
// Turns the engine's per-frame metrics snapshot into a rolling picture of how
// the line is performing: realised throughput, WIP in the system, completion
// progress + ETA, the theoretical bottleneck, and compact sparklines of
// throughput and WIP over sim time. Collapsible to stay out of the way.

import { useEffect, useRef, useState, useMemo } from 'react';
import { useTwinContext } from './TwinProvider.jsx';
import { bottleneck } from '../engine/derive.js';
import {
  pushSample, throughputPerHour, etaSeconds, orderProgress,
  formatDuration, sparklinePoints,
} from './metricsHistory.js';
import { T } from './kit.jsx';

const HISTORY_CAP = 600;        // ~ up to 600 samples
const SAMPLE_MIN_DT = 2;        // sim-seconds between samples (bounds growth)
const THROUGHPUT_WINDOW = 600;  // trailing window for realised throughput (s)

export default function MetricsDashboard() {
  const { config, twinHook } = useTwinContext();
  const { metrics, simTime } = twinHook;

  const [open, setOpen] = useState(true);
  const [history, setHistory] = useState([]);
  const lastSampleT = useRef(-Infinity);

  // Reset the series whenever the config identity changes (fixture swap / apply
  // re-inits the engine clock to 0).
  useEffect(() => {
    setHistory([]);
    lastSampleT.current = -Infinity;
  }, [config]);

  // Sample the rolling series as sim time advances.
  useEffect(() => {
    if (!metrics || metrics.orders == null) return;
    const t = metrics.simTime ?? simTime ?? 0;
    if (t < lastSampleT.current) {            // rewind → restart the series
      lastSampleT.current = -Infinity;
      setHistory([]);
      return;
    }
    if (t - lastSampleT.current < SAMPLE_MIN_DT) return;
    lastSampleT.current = t;
    const prog = orderProgress(metrics.orders);
    setHistory((h) => pushSample(h, {
      t,
      completed: prog.completed,
      wip: metrics.unitsInSystem ?? 0,
    }, HISTORY_CAP));
  }, [metrics, simTime]);

  const bottle = useMemo(() => bottleneck(config), [config]);

  if (!metrics || metrics.orders == null) return null;

  const prog = orderProgress(metrics.orders);
  const rate = throughputPerHour(history, THROUGHPUT_WINDOW);
  const eta = etaSeconds(prog.remaining, rate);
  const throughputSeries = history.map((s, i) =>
    i === 0 ? 0 : ((s.completed - history[i - 1].completed) /
      Math.max(1e-6, s.t - history[i - 1].t)) * 3600);
  const wipSeries = history.map((s) => s.wip);

  return (
    <div
      data-testid="metrics-dashboard"
      style={{
        position: 'relative', width: '100%', boxSizing: 'border-box',
        background: 'rgba(12,19,34,0.85)', backdropFilter: 'blur(8px)',
        border: `1px solid ${T.border}`, borderRadius: 8, color: T.text,
        padding: '10px 14px',
      }}
    >
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: open ? 10 : 0 }}
      >
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: 1, color: T.textFaint, textTransform: 'uppercase' }}>
          Analytics
        </span>
        <span style={{ fontSize: 11, color: T.textFaint }}>{open ? '▾' : '▸'}</span>
      </div>

      {open && (
        <>
          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <Kpi testid="kpi-throughput" label="Throughput" value={rate >= 1 ? Math.round(rate) : rate.toFixed(1)} unit="/hr" color={T.cyan} />
            <Kpi testid="kpi-wip" label="In system" value={metrics.unitsInSystem ?? 0} unit="WIP" color={T.violet} />
            <Kpi testid="kpi-completed" label="Completed" value={`${prog.completed}/${prog.target}`} unit={`${Math.round(prog.fraction * 100)}%`} color={T.green} />
            <Kpi testid="kpi-eta" label="ETA" value={formatDuration(eta)} unit="left" color={T.amber} />
          </div>

          {/* Completion progress */}
          <Bar label="Completion" fraction={prog.fraction} color={T.green} testid="progress-completion" />
          {prog.scrapped > 0 && (
            <div style={{ fontSize: 10, color: T.red, marginTop: 2 }}>{prog.scrapped} scrapped</div>
          )}

          {/* Sparklines */}
          <Spark label="Throughput /hr" values={throughputSeries} color={T.cyan} testid="spark-throughput" />
          <Spark label="WIP" values={wipSeries} color={T.violet} testid="spark-wip" />

          {/* Bottleneck */}
          {bottle && (
            <div data-testid="bottleneck-readout" style={{ marginTop: 8, fontSize: 11, color: T.textDim }}>
              <span style={{ color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>Bottleneck</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontFamily: T.mono }}>
                <span>{bottle.station_id}<span style={{ color: T.textFaint }}> · {bottle.process_id}</span></span>
                <span style={{ color: T.amber }}>{Math.round(bottle.throughput)}/hr</span>
              </div>
            </div>
          )}

          {/* Per-order progress */}
          {metrics.orders.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Orders</div>
              {metrics.orders.map((o) => {
                const frac = o.quantity > 0 ? o.units_completed / o.quantity : 0;
                return (
                  <div key={o.id} data-testid={`order-progress-${o.id}`} style={{ marginBottom: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textDim, marginBottom: 2 }}>
                      <span style={{ fontFamily: T.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{o.id}</span>
                      <span>{o.units_completed}/{o.quantity}</span>
                    </div>
                    <Track fraction={frac} color={o.status === 'completed' ? T.green : o.status === 'short' ? T.red : T.accent} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, unit, color, testid }) {
  return (
    <div data-testid={testid} style={{ background: 'rgba(8,14,28,0.6)', border: `1px solid ${T.borderSoft}`, borderRadius: 6, padding: '6px 8px' }}>
      <div style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: T.mono, color }}>{value}</span>
        <span style={{ fontSize: 10, color: T.textFaint }}>{unit}</span>
      </div>
    </div>
  );
}

function Bar({ label, fraction, color, testid }) {
  return (
    <div style={{ marginTop: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textFaint, marginBottom: 2 }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
        <span>{Math.round(fraction * 100)}%</span>
      </div>
      <Track fraction={fraction} color={color} testid={testid} />
    </div>
  );
}

function Track({ fraction, color, testid }) {
  return (
    <div data-testid={testid} style={{ background: T.borderSoft, borderRadius: 2, height: 5, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, fraction * 100))}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
    </div>
  );
}

function Spark({ label, values, color, testid }) {
  const W = 196, H = 28;
  const points = sparklinePoints(values, W, H);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{label}</div>
      <svg data-testid={testid} width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: H, background: 'rgba(8,14,28,0.5)', borderRadius: 4 }}>
        {points && <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  );
}
