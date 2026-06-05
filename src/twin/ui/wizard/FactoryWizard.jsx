// FactoryWizard.jsx — guided, step-by-step builder for a FactoryConfig.
//
// Coexists with ConfigPanel (the expert editor). The wizard's canonical state is
// a flat config draft (configDraft shape) plus a parallel `links` array; topology
// is auto-generated via lineTopology so users never draw the graph. Steps are
// non-linear (click any step). The final "Build & apply" is gated by validity and
// replaces the live config via setConfig (clean re-init; auto-save persists it).

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTwinContext } from '../TwinProvider.jsx';
import { T, Button, IconButton } from '../kit.jsx';
import { toDraft, buildAndValidate } from '../configDraft.js';
import { makeLinearLineFixture } from '../../fixtures/linearLine.js';
import { makeAssemblyLineFixture } from '../../fixtures/assemblyLine.js';
import { makeCarrierLineFixture } from '../../fixtures/carrierLine.js';
import {
  blankDraft, regenTopology, initFromDraft, stepStatus, defaultLink,
} from './wizardState.js';

import StartStep from './steps/StartStep.jsx';
import MaterialsStep from './steps/MaterialsStep.jsx';
import ProcessesStep from './steps/ProcessesStep.jsx';
import LineStep from './steps/LineStep.jsx';
import FlowStep from './steps/FlowStep.jsx';
import ShiftsStep from './steps/ShiftsStep.jsx';
import OrdersStep from './steps/OrdersStep.jsx';
import ReviewStep from './steps/ReviewStep.jsx';

const STEPS = [
  { key: 'start', label: 'Start', Comp: StartStep },
  { key: 'materials', label: 'Materials', Comp: MaterialsStep },
  { key: 'processes', label: 'Processes', Comp: ProcessesStep },
  { key: 'line', label: 'Line', Comp: LineStep },
  { key: 'flow', label: 'Flow', Comp: FlowStep },
  { key: 'shifts', label: 'Shifts', Comp: ShiftsStep },
  { key: 'orders', label: 'Orders', Comp: OrdersStep },
  { key: 'review', label: 'Review', Comp: ReviewStep },
];

const TEMPLATES = {
  linearLine: makeLinearLineFixture,
  assemblyLine: makeAssemblyLineFixture,
  carrierLine: makeCarrierLineFixture,
};

const alignLinks = (links, n) => {
  const out = links.slice(0, n);
  while (out.length < n) out.push(defaultLink());
  return out;
};

export default function FactoryWizard({ onClose, onOpenNetwork }) {
  const { config, setConfig, seed = 0, setSeed, twinHook } = useTwinContext();
  const { pause, resume } = twinHook;

  const [base, setBase] = useState(() => blankDraft());
  const [links, setLinks] = useState([]);
  const [shipLink, setShipLink] = useState(() => defaultLink());
  const [mode, setMode] = useState('guided');
  const [reason, setReason] = useState(null);
  const [step, setStep] = useState('start');

  // Pause the sim while the wizard is open.
  useEffect(() => { pause(); return () => resume(); }, [pause, resume]);

  // Derived live draft: regenerate topology in guided mode.
  const draft = useMemo(() => {
    if (mode !== 'guided' || base.stations.length === 0) return base;
    try { return regenTopology(base, alignLinks(links, base.stations.length), shipLink); }
    catch { return base; }
  }, [base, links, shipLink, mode]);

  const { config: candidate, errors, warnings } = useMemo(() => buildAndValidate(draft), [draft]);

  // ── start / seed selection ──────────────────────────────────────────────
  const start = useCallback((kind) => {
    let next;
    if (kind === 'blank') {
      next = { draft: { ...blankDraft(), seed }, links: [], shipLink: defaultLink(), mode: 'guided', reason: null };
    } else {
      const source = kind === 'current' ? config : TEMPLATES[kind]?.();
      const d = { ...toDraft(source), seed };
      const init = initFromDraft(d);
      next = { ...init, reason: init.reason ?? null };
    }
    setBase(next.draft);
    setLinks(next.links);
    setShipLink(next.shipLink);
    setMode(next.mode);
    setReason(next.reason);
    setStep('materials');
  }, [config, seed]);

  // ── generic + station-coupled mutators ────────────────────────────────────
  const patch = useCallback((key, idx, p) => setBase((b) => ({ ...b, [key]: b[key].map((it, i) => (i === idx ? { ...it, ...p } : it)) })), []);
  const add = useCallback((key, item) => setBase((b) => ({ ...b, [key]: [...b[key], item] })), []);
  const remove = useCallback((key, idx) => setBase((b) => ({ ...b, [key]: b[key].filter((_, i) => i !== idx) })), []);

  const addStation = useCallback((st) => { setBase((b) => ({ ...b, stations: [...b.stations, st] })); setLinks((l) => [...l, defaultLink()]); }, []);
  const removeStation = useCallback((idx) => { setBase((b) => ({ ...b, stations: b.stations.filter((_, i) => i !== idx) })); setLinks((l) => l.filter((_, i) => i !== idx)); }, []);
  const moveStation = useCallback((from, to) => {
    if (to < 0) return;
    setBase((b) => {
      if (to >= b.stations.length) return b;
      const stations = [...b.stations];
      const [m] = stations.splice(from, 1);
      stations.splice(to, 0, m);
      return { ...b, stations };
    });
    setLinks((l) => {
      if (to >= l.length) return l;
      const next = [...l];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }, []);
  const patchStation = useCallback((idx, p) => patch('stations', idx, p), [patch]);
  const addStationProc = useCallback((si, sp) => setBase((b) => ({ ...b, stations: b.stations.map((s, i) => (i === si ? { ...s, processes: [...(s.processes ?? []), sp] } : s)) })), []);
  const removeStationProc = useCallback((si, pi) => setBase((b) => ({ ...b, stations: b.stations.map((s, i) => (i === si ? { ...s, processes: s.processes.filter((_, j) => j !== pi) } : s)) })), []);
  const patchStationProc = useCallback((si, pi, p) => setBase((b) => ({ ...b, stations: b.stations.map((s, i) => (i === si ? { ...s, processes: s.processes.map((sp, j) => (j === pi ? { ...sp, ...p } : sp)) } : s)) })), []);

  const setLink = useCallback((idx, link) => setLinks((l) => l.map((x, i) => (i === idx ? link : x))), []);

  const openNetworkPanel = useCallback(() => { onOpenNetwork?.(); onClose?.(); }, [onOpenNetwork, onClose]);

  const apply = useCallback(() => {
    if (errors.length || !candidate) return;
    if (setSeed && draft.seed !== seed) setSeed(draft.seed);
    setConfig(candidate);
    resume();
    onClose?.();
  }, [errors, candidate, setConfig, setSeed, draft.seed, seed, resume, onClose]);

  // Process ids in flow order (for OrdersStep auto-fill).
  const lineProcessOrder = useMemo(() => {
    const out = [];
    for (const s of base.stations) for (const sp of (s.processes ?? [])) if (sp.process_id && !out.includes(sp.process_id)) out.push(sp.process_id);
    return out;
  }, [base.stations]);

  const ctx = {
    base, draft, mode, reason, errors, warnings,
    links: alignLinks(links, base.stations.length), shipLink,
    matOptions: base.materials.map((m) => m.id).filter(Boolean),
    procOptions: base.processes.map((p) => p.id).filter(Boolean),
    lineProcessOrder,
    patch, add, remove,
    addStation, removeStation, moveStation, patchStation,
    addStationProc, removeStationProc, patchStationProc,
    setLink, setShipLink,
    start, openNetworkPanel,
  };

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const Current = STEPS[stepIdx].Comp;
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <div data-testid="factory-wizard-overlay" style={overlay}>
      <div data-testid="factory-wizard" style={modal}>
        {/* Header */}
        <div style={header}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, fontFamily: T.mono, color: T.text, letterSpacing: 0.5 }}>✦ Factory Wizard</span>
          <span style={{ fontSize: 11, color: errors.length ? '#fca5a5' : T.green, fontFamily: T.mono, marginRight: 8 }}>
            {errors.length ? `${errors.length} to fix` : '✓ valid'}
          </span>
          <IconButton onClick={() => { resume(); onClose?.(); }} testid="wizard-close" title="Close">✕</IconButton>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={sidebar}>
            {STEPS.map((s, i) => {
              const status = (s.key === 'start' || s.key === 'review') ? null : stepStatus(s.key, draft, errors);
              const on = s.key === step;
              return (
                <button
                  key={s.key}
                  data-testid={`wizard-step-${s.key}`}
                  onClick={() => setStep(s.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                    padding: '8px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: on ? T.accentDeep : 'transparent',
                    color: on ? '#dbeafe' : T.textFaint, fontSize: 12, fontFamily: T.mono, fontWeight: 600,
                  }}
                >
                  <span style={{ width: 16, color: T.textFaint, fontSize: 10 }}>{i}</span>
                  <span style={{ flex: 1 }}>{s.label}</span>
                  {status === 'error' && <span style={{ color: '#fca5a5' }}>⚠</span>}
                  {status === 'ok' && <span style={{ color: T.green }}>✓</span>}
                  {status === 'empty' && <span style={{ color: T.textFaint }}>·</span>}
                </button>
              );
            })}
          </div>

          <div data-testid="wizard-content" style={content}>
            <Current ctx={ctx} />
          </div>
        </div>

        {/* Footer */}
        <div style={footer}>
          <Button variant="ghost" disabled={stepIdx === 0} onClick={() => setStep(STEPS[Math.max(0, stepIdx - 1)].key)}>← Back</Button>
          <div style={{ flex: 1 }} />
          {!isLast ? (
            <Button variant="primary" testid="wizard-next" onClick={() => setStep(STEPS[stepIdx + 1].key)}>Next →</Button>
          ) : (
            <Button variant="primary" testid="wizard-apply" disabled={errors.length > 0} onClick={apply}>Build &amp; apply</Button>
          )}
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'absolute', inset: 0, zIndex: 400,
  background: 'rgba(2,6,16,0.6)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modal = {
  width: 'min(760px, 94vw)', height: 'min(680px, 92vh)',
  display: 'flex', flexDirection: 'column',
  background: T.surface, backdropFilter: 'blur(10px)',
  border: `1px solid ${T.border}`, borderRadius: T.radius, color: T.text, overflow: 'hidden',
};
const header = { display: 'flex', alignItems: 'center', gap: 4, padding: '10px 12px', borderBottom: `1px solid ${T.borderSoft}` };
const sidebar = { width: 150, padding: 8, borderRight: `1px solid ${T.borderSoft}`, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' };
const content = { flex: 1, padding: '8px 14px 14px', overflowY: 'auto' };
const footer = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: `1px solid ${T.borderSoft}` };
