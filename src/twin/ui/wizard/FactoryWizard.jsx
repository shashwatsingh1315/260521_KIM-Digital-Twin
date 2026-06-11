// FactoryWizard.jsx — guided, step-by-step builder for a FactoryConfig.
//
// Coexists with ConfigPanel (the expert editor). The wizard's canonical state is
// a flat config draft (configDraft shape) plus a parallel `links` array; topology
// is auto-generated via lineTopology so users never draw the graph. Steps are
// non-linear (click any step). The final "Build & apply" is gated by validity and
// replaces the live config via setConfig (clean re-init; auto-save persists it).

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTwinContext } from '../TwinProvider.jsx';
import { T, Button, IconButton, ConfirmDialog, useSessionStorage, useKeyboardShortcuts } from '../kit.jsx';
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

  // Dirty-state + confirmation dialogs
  const [dirty, setDirty] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);

  // Draft autosave
  const [storedDraft, setStoredDraft] = useSessionStorage('wizardDraft', null);

  // Pause the sim while the wizard is open.
  useEffect(() => { pause(); return () => resume(); }, [pause, resume]);

  // Autosave draft to localStorage whenever base/links/shipLink change (after start)
  useEffect(() => {
    if (step === 'start') return;
    setStoredDraft({ base, links, shipLink, mode, reason, step });
  }, [base, links, shipLink, step, mode, reason, setStoredDraft]);

  // Close confirmation helper
  const handleCloseAttempt = useCallback(() => {
    if (dirty) {
      setShowCloseConfirm(true);
    } else {
      resume();
      onClose?.();
    }
  }, [dirty, resume, onClose]);

  // Escape key handler
  useKeyboardShortcuts([{
    key: 'Escape',
    action: () => {
      if (showCloseConfirm) { setShowCloseConfirm(false); }
      else if (showApplyConfirm) { setShowApplyConfirm(false); }
      else { handleCloseAttempt(); }
    },
  }], [showCloseConfirm, showApplyConfirm, handleCloseAttempt]);

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
    setDirty(false);
  }, [config, seed]);

  // ── generic + station-coupled mutators ────────────────────────────────────
  const patch = useCallback((key, idx, p) => { setDirty(true); setBase((b) => ({ ...b, [key]: b[key].map((it, i) => (i === idx ? { ...it, ...p } : it)) })); }, []);
  const add = useCallback((key, item) => { setDirty(true); setBase((b) => ({ ...b, [key]: [...b[key], item] })); }, []);
  const remove = useCallback((key, idx) => { setDirty(true); setBase((b) => ({ ...b, [key]: b[key].filter((_, i) => i !== idx) })); }, []);

  const addStation = useCallback((st) => { setDirty(true); setBase((b) => ({ ...b, stations: [...b.stations, st] })); setLinks((l) => [...l, defaultLink()]); }, []);
  const removeStation = useCallback((idx) => { setDirty(true); setBase((b) => ({ ...b, stations: b.stations.filter((_, i) => i !== idx) })); setLinks((l) => l.filter((_, i) => i !== idx)); }, []);
  const moveStation = useCallback((from, to) => {
    if (to < 0) return;
    setDirty(true);
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
  const addStationProc = useCallback((si, sp) => { setDirty(true); setBase((b) => ({ ...b, stations: b.stations.map((s, i) => (i === si ? { ...s, processes: [...(s.processes ?? []), sp] } : s)) })); }, []);
  const removeStationProc = useCallback((si, pi) => { setDirty(true); setBase((b) => ({ ...b, stations: b.stations.map((s, i) => (i === si ? { ...s, processes: s.processes.filter((_, j) => j !== pi) } : s)) })); }, []);
  const patchStationProc = useCallback((si, pi, p) => { setDirty(true); setBase((b) => ({ ...b, stations: b.stations.map((s, i) => (i === si ? { ...s, processes: s.processes.map((sp, j) => (j === pi ? { ...sp, ...p } : sp)) } : s)) })); }, []);

  const setLink = useCallback((idx, link) => { setDirty(true); setLinks((l) => l.map((x, i) => (i === idx ? link : x))); }, []);
  const setShipLinkDirty = useCallback((v) => { setDirty(true); setShipLink(v); }, []);

  const openNetworkPanel = useCallback(() => { onOpenNetwork?.(); onClose?.(); }, [onOpenNetwork, onClose]);

  const apply = useCallback(() => {
    if (errors.length || !candidate) return;
    if (setSeed && draft.seed !== seed) setSeed(draft.seed);
    setConfig(candidate);
    setStoredDraft(null);
    resume();
    onClose?.();
  }, [errors, candidate, setConfig, setSeed, draft.seed, seed, resume, onClose, setStoredDraft]);

  // Process ids in flow order (for OrdersStep auto-fill).
  const lineProcessOrder = useMemo(() => {
    const out = [];
    for (const s of base.stations) for (const sp of (s.processes ?? [])) if (sp.process_id && !out.includes(sp.process_id)) out.push(sp.process_id);
    return out;
  }, [base.stations]);

  // Resume a stored draft from localStorage
  const resumeDraft = useCallback(() => {
    if (!storedDraft) return;
    setBase(storedDraft.base);
    setLinks(storedDraft.links);
    setShipLink(storedDraft.shipLink);
    setMode(storedDraft.mode ?? 'guided');
    setReason(storedDraft.reason ?? null);
    setStep(storedDraft.step ?? 'materials');
    setDirty(true);
  }, [storedDraft]);

  const ctx = {
    base, draft, mode, reason, errors, warnings,
    links: alignLinks(links, base.stations.length), shipLink,
    matOptions: base.materials.map((m) => m.id).filter(Boolean),
    procOptions: base.processes.map((p) => p.id).filter(Boolean),
    lineProcessOrder,
    patch, add, remove,
    addStation, removeStation, moveStation, patchStation,
    addStationProc, removeStationProc, patchStationProc,
    setLink, setShipLink: setShipLinkDirty,
    start, openNetworkPanel,
  };

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const Current = STEPS[stepIdx].Comp;
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <div data-testid="factory-wizard-overlay" style={overlay} onClick={(e) => { if (e.target === e.currentTarget) handleCloseAttempt(); }}>
      <div data-testid="factory-wizard" style={modal}>
        {/* Header */}
        <div style={header}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, fontFamily: T.mono, color: T.text, letterSpacing: 0.5 }}>✦ Factory Wizard</span>
          <span style={{ fontSize: 11, color: errors.length ? '#fca5a5' : T.green, fontFamily: T.mono, marginRight: 8 }}>
            {errors.length ? `${errors.length} to fix` : '✓ valid'}
          </span>
          <IconButton onClick={handleCloseAttempt} testid="wizard-close" title="Close">✕</IconButton>
        </div>

        {/* Resume draft banner */}
        {step === 'start' && storedDraft && (
          <div style={resumeBanner}>
            <span style={{ flex: 1, fontSize: 12, fontFamily: T.mono, color: T.textDim }}>You have an unsaved draft from a previous session.</span>
            <Button variant="primary" onClick={resumeDraft} style={{ fontSize: 11, padding: '4px 10px' }}>Resume previous session</Button>
            <Button variant="ghost" onClick={() => setStoredDraft(null)} style={{ fontSize: 11, padding: '4px 10px' }}>Dismiss</Button>
          </div>
        )}

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

        {/* Progress bar */}
        <div style={{ height: 2, background: T.borderSoft }}>
          <div style={{ height: '100%', width: (stepIdx / (STEPS.length - 1)) * 100 + '%', background: T.accent, transition: 'width 0.25s ease' }} />
        </div>

        {/* Footer */}
        <div style={footer}>
          <Button variant="ghost" disabled={stepIdx === 0} onClick={() => setStep(STEPS[Math.max(0, stepIdx - 1)].key)}>← Back</Button>
          <span style={{ fontSize: 11, color: T.textFaint, fontFamily: T.mono }}>Step {stepIdx + 1} of {STEPS.length}</span>
          <div style={{ flex: 1 }} />
          {!isLast ? (
            <Button variant="primary" testid="wizard-next" onClick={() => setStep(STEPS[stepIdx + 1].key)}>Next →</Button>
          ) : (
            <Button variant="primary" testid="wizard-apply" disabled={errors.length > 0} onClick={() => setShowApplyConfirm(true)}>Build &amp; apply</Button>
          )}
        </div>
      </div>

      {/* Confirm: discard unsaved changes */}
      <ConfirmDialog
        open={showCloseConfirm}
        title="Discard unsaved changes?"
        message="You have unsaved edits. Closing the wizard will discard them."
        confirmLabel="Discard"
        variant="danger"
        onConfirm={() => { setShowCloseConfirm(false); setStoredDraft(null); resume(); onClose?.(); }}
        onCancel={() => setShowCloseConfirm(false)}
      />

      {/* Confirm: apply factory config */}
      <ConfirmDialog
        open={showApplyConfirm}
        title="Apply factory configuration?"
        message="This will restart the simulation from scratch. All in-flight units, metrics, and history will be reset."
        confirmLabel="Build & apply"
        variant="primary"
        onConfirm={() => { setShowApplyConfirm(false); apply(); }}
        onCancel={() => setShowApplyConfirm(false)}
      />
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
const resumeBanner = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(59,130,246,0.08)', borderBottom: `1px solid ${T.borderSoft}` };
const sidebar = { width: 150, padding: 8, borderRight: `1px solid ${T.borderSoft}`, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' };
const content = { flex: 1, padding: '8px 14px 14px', overflowY: 'auto' };
const footer = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: `1px solid ${T.borderSoft}` };
