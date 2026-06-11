// MetricsDashboard.jsx — live analytics content for the right rail.
//
// Turns the engine's per-frame metrics snapshot into a rolling picture of how
// the line is performing: KPI cards with trend deltas and the theoretical
// throughput target, completion progress + ETA, area sparklines of throughput
// and WIP, the bottleneck readout, and clickable per-order rows that highlight
// that order's in-flight units in the 3D scene.

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useTwinContext } from './TwinProvider.jsx';
import { bottleneck } from '../engine/derive.js';
import {
  pushSample, throughputPerHour, etaSeconds, orderProgress,
  formatDuration, sparklinePoints, sparklineAreaPath, seriesMinMax, trendDelta,
} from './metricsHistory.js';
import { T, Kpi } from './kit.jsx';
import { orderHex } from './orderColors.js';

const HISTORY_CAP = 600;        // ~ up to 600 samples
const SAMPLE_MIN_DT = 2;        // sim-seconds between samples (bounds growth)
const THROUGHPUT_WINDOW = 600;  // trailing window for realised throughput (s)
const TREND_WINDOW = 300;       // window pair compared for the KPI deltas (s)

export default function MetricsDashboardContent({ highlightOrderId, onToggleOrderHighlight }) {
  const { config, twinHook } = useTwinContext();
  const { metrics, simTime } = twinHook;

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

  const wipDelta = trendDelta(history, TREND_WINDOW, (s) => s.wip);
  const rateDelta = trendDelta(history, TREND_WINDOW, (s) => s.completed);
  const target = bottle ? Math.round(bottle.throughput) : null;
  // Realised vs theoretical: amber the throughput KPI when under 70% of target.
  const underTarget = target != null && rate > 0 && rate < target * 0.7;

  return (
    <div data-testid="metrics-dashboard" style={{ padding: '10px 12px' }}>
      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <Kpi testid="kpi-throughput" label="Throughput /hr" value={rate >= 1 ? Math.round(rate) : rate.toFixed(1)}
          color={underTarget ? T.amber : T.cyan} delta={rateDelta} target={target != null ? `${target}/hr max` : undefined} />
        <Kpi testid="kpi-wip" label="In system" value={metrics.unitsInSystem ?? 0} unit="WIP" color={T.violet} delta={wipDelta} />
        <Kpi testid="kpi-completed" label="Completed" value={`${prog.completed}/${prog.target}`} unit={`${Math.round(prog.fraction * 100)}%`} color={T.green} />
        <Kpi testid="kpi-eta" label="ETA" value={formatDuration(eta)} unit="left" color={T.amber} />
      </div>

      {/* Completion progress */}
      <Bar label="Completion" fraction={prog.fraction} color={T.green} testid="progress-completion" />
      {prog.scrapped > 0 && (
        <div style={{ fontSize: 10, color: T.red, marginTop: 2, fontFamily: T.sans }}>{prog.scrapped} scrapped</div>
      )}

      {/* Sparklines */}
      <Spark label="Throughput /hr" values={throughputSeries} color={T.cyan} testid="spark-throughput" />
      <Spark label="WIP" values={wipSeries} color={T.violet} testid="spark-wip" />

      {/* Bottleneck */}
      {bottle && (
        <div data-testid="bottleneck-readout" style={{ marginTop: 8, fontSize: 11, color: T.textDim }}>
          <span style={{ color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, fontFamily: T.display, fontWeight: 700 }}>Bottleneck</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontFamily: T.mono }}>
            <span>{bottle.station_id}<span style={{ color: T.textFaint }}> · {bottle.process_id}</span></span>
            <span style={{ color: T.amber }}>{Math.round(bottle.throughput)}/hr</span>
          </div>
        </div>
      )}

      {/* Per-order progress — click a row to tint that order's units in 3D */}
      {metrics.orders.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontFamily: T.display, fontWeight: 700 }}>
            Orders
            <span style={{ fontFamily: T.sans, fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6, opacity: 0.8 }}>
              click to highlight
            </span>
          </div>
          {metrics.orders.map((o, idx) => {
            const frac = o.quantity > 0 ? o.units_completed / o.quantity : 0;
            const hl = highlightOrderId === o.id;
            const swatch = orderHex(idx);
            return (
              <div
                key={o.id}
                data-testid={`order-progress-${o.id}`}
                onClick={() => onToggleOrderHighlight?.(o.id)}
                style={{
                  marginBottom: 5,
                  padding: '3px 5px',
                  margin: '0 -5px 5px',
                  borderRadius: 5,
                  cursor: onToggleOrderHighlight ? 'pointer' : 'default',
                  background: hl ? 'rgba(59,130,246,0.12)' : 'transparent',
                  border: `1px solid ${hl ? T.accent : 'transparent'}`,
                  transition: `background ${T.transition}, border-color ${T.transition}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.textDim, marginBottom: 2 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: swatch, flexShrink: 0, boxShadow: hl ? `0 0 5px ${swatch}` : 'none' }} />
                  <span title={o.id} style={{ flex: 1, fontFamily: T.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.id}</span>
                  <span style={{ fontFamily: T.mono }}>{o.units_completed}/{o.quantity}</span>
                </div>
                <Track fraction={frac} color={o.status === 'completed' ? T.green : o.status === 'short' ? T.red : T.accent} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Bar({ label, fraction, color, testid }) {
  return (
    <div style={{ marginTop: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textFaint, marginBottom: 2, fontFamily: T.sans }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
        <span style={{ fontFamily: T.mono }}>{Math.round(fraction * 100)}%</span>
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
  const area = sparklineAreaPath(values, W, H);
  const { min, max } = seriesMinMax(values);
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // { index, x, y, value }

  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || !values || values.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const fraction = relX / rect.width;
    const idx = Math.min(values.length - 1, Math.max(0, Math.round(fraction * (values.length - 1))));
    setHover({ index: idx, x: relX, y: rect.top - 4, value: values[idx] });
  }, [values]);

  const handleMouseLeave = useCallback(() => setHover(null), []);

  // Last-value dot position (same scaling as sparklinePoints).
  let dot = null;
  if (values.length > 1) {
    const span = (max - min) || 1;
    const y = 1 + (H - 2) - ((values[values.length - 1] - min) / span) * (H - 2);
    dot = { x: W, y };
  }

  return (
    <div style={{ marginTop: 8, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textFaint, marginBottom: 2, fontFamily: T.sans }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
        {values.length > 1 && (
          <span style={{ fontFamily: T.mono, fontSize: 9 }}>
            {min.toFixed(0)}–{max.toFixed(0)}
          </span>
        )}
      </div>
      <svg
        ref={svgRef}
        data-testid={testid}
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: 'block', height: H, background: 'rgba(8,14,28,0.5)', borderRadius: 4, cursor: values.length > 0 ? 'crosshair' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {area && <path d={area} fill={`${color}22`} stroke="none" />}
        {points && <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
        {dot && <circle cx={dot.x} cy={dot.y} r="2" fill={color} />}
      </svg>
      {hover != null && (
        <div
          style={{
            position: 'absolute',
            left: hover.x,
            top: -18,
            transform: 'translateX(-50%)',
            background: T.borderSoft,
            color: T.text,
            fontSize: 10,
            fontFamily: T.mono,
            padding: '2px 6px',
            borderRadius: 4,
            border: `1px solid ${T.border}`,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {(hover.value ?? 0).toFixed(1)}
        </div>
      )}
    </div>
  );
}
