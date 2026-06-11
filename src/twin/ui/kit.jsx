// kit.jsx — small design system for the Twin UI.
//
// Centralises design tokens + reusable primitives (Panel, Field, TextInput,
// NumberInput, Select, Button, Tabs, Badge, Row, IconButton, Tooltip,
// ConfirmDialog, SearchInput, useSessionStorage, useKeyboardShortcuts)
// so editors share one consistent, modern look.

import { useState, useEffect, useCallback, useRef } from 'react';

export const T = {
  // surfaces
  bg: '#0a1120',
  surface: 'rgba(15,23,42,0.92)',
  surfaceSolid: '#0f172a',
  raised: '#15203a',
  // lines
  border: '#1e3a5f',
  borderSoft: '#1e293b',
  // text
  text: '#e2e8f0',
  textDim: '#94a3b8',
  textFaint: '#64748b',
  // accents
  accent: '#3b82f6',
  accentDeep: '#1e40af',
  violet: '#7c3aed',
  violetDeep: '#4c1d95',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: '#38bdf8',
  // misc
  radius: 8,
  radiusSm: 5,
  // font roles: display for panel titles/KPIs, sans for body/labels,
  // mono ONLY for ids, numbers, and clock readouts.
  sans: "'Inter', system-ui, sans-serif",
  display: "'Outfit', 'Inter', sans-serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  // scales
  font: { xs: 9, sm: 10, md: 11, base: 12, lg: 13, xl: 14, kpi: 18 },
  weight: { normal: 400, semi: 600, bold: 700 },
  space: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16 },
  transition: '0.18s ease',
  // process-family palette — keep in sync with MAT.family* tones in
  // src/materials/factoryMaterials.js (single source of truth for UI side).
  family: { production: '#22d3ee', inspect: '#e879f9', storage: '#a78bfa', logistics: '#fbbf24' },
  shadow: { panel: '0 8px 24px rgba(0,0,0,0.35)', pop: '0 4px 12px rgba(0,0,0,0.4)' },
  z: { canvasOverlay: 50, rail: 100, toolbar: 300, dock: 400, modal: 1000, confirm: 10000 },
};
T.state = { ok: T.green, warn: T.amber, alert: T.red };

const focusRing = `0 0 0 2px ${T.accent}`;

export function Panel({ title, right, children, style, testid }) {
  return (
    <div
      data-testid={testid}
      role={style?.position === 'absolute' ? 'dialog' : undefined}
      style={{
        background: T.surface,
        backdropFilter: 'blur(10px)',
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        color: T.text,
        ...style,
      }}
    >
      {title != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${T.borderSoft}` }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.textDim, fontFamily: T.display }}>{title}</span>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0 6px' }}>
      <span style={{ flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: T.textFaint, fontFamily: T.display }}>{children}</span>
      {right}
    </div>
  );
}

export function Field({ label, hint, children, style, required, error }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, ...style }}>
      {label != null && (
        <span style={{ fontSize: 10, fontFamily: T.sans, color: error ? T.red : T.textFaint }}>
          {label}{required && <span style={{ color: T.red }}> *</span>}
        </span>
      )}
      {children}
      {error && <span style={{ fontSize: 10, fontFamily: T.sans, color: T.red }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: 10, fontFamily: T.sans, color: T.textFaint, fontStyle: 'italic' }}>{hint}</span>}
    </label>
  );
}

const baseInput = {
  background: T.surfaceSolid,
  border: `1px solid #334155`,
  borderRadius: T.radiusSm,
  color: T.text,
  padding: '5px 8px',
  fontSize: 12,
  fontFamily: T.mono,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
};

function inputFocusProps(hasError) {
  return {
    onFocus: (e) => { e.target.style.boxShadow = hasError ? `0 0 0 2px ${T.red}` : focusRing; },
    onBlur: (e) => { e.target.style.boxShadow = 'none'; },
  };
}

export function TextInput({ value, onChange, disabled, placeholder, testid, style, error }) {
  const borderColor = error ? T.red : '#334155';
  return (
    <input
      data-testid={testid}
      type="text"
      value={value ?? ''}
      placeholder={placeholder}
      disabled={disabled}
      aria-invalid={error ? 'true' : undefined}
      onChange={(e) => onChange(e.target.value)}
      {...inputFocusProps(error)}
      style={{ ...baseInput, borderColor, opacity: disabled ? 0.55 : 1, ...style }}
    />
  );
}

export function NumberInput({ value, onChange, disabled, min, max, step = 1, testid, style, error }) {
  const borderColor = error ? T.red : '#334155';
  return (
    <input
      data-testid={testid}
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-invalid={error ? 'true' : undefined}
      onChange={(e) => onChange(e.target.value)}
      {...inputFocusProps(error)}
      style={{ ...baseInput, borderColor, opacity: disabled ? 0.55 : 1, ...style }}
    />
  );
}

export function Select({ value, onChange, options, disabled, testid, style }) {
  return (
    <select
      data-testid={testid}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => { e.target.style.boxShadow = focusRing; }}
      onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
      style={{ ...baseInput, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1, ...style }}
    >
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const lab = typeof o === 'string' ? o : o.label;
        return <option key={val} value={val}>{lab}</option>;
      })}
    </select>
  );
}

export function Button({ children, onClick, variant = 'default', disabled, testid, style, title, icon }) {
  const variants = {
    primary: { background: disabled ? '#334155' : T.accent, color: '#fff', border: 'none' },
    default: { background: T.raised, color: T.textDim, border: `1px solid ${T.borderSoft}` },
    ghost: { background: 'transparent', color: T.textFaint, border: `1px solid ${T.borderSoft}` },
    danger: { background: 'transparent', color: T.red, border: `1px solid #4c1d24` },
    violet: { background: disabled ? '#334155' : T.violet, color: '#fff', border: 'none' },
  };
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 12px',
        borderRadius: T.radiusSm,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontFamily: T.sans,
        fontWeight: 600,
        transition: `background ${T.transition}, filter ${T.transition}`,
        outline: 'none',
        ...variants[variant],
        ...style,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = 'brightness(1.18)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
      onFocus={(e) => { e.target.style.boxShadow = focusRing; }}
      onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ children, onClick, title, testid, color = T.textFaint }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 2, outline: 'none', transition: `filter ${T.transition}` }}
      onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.4)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
      onFocus={(e) => { e.target.style.boxShadow = focusRing; e.target.style.borderRadius = '4px'; }}
      onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
    >
      {children}
    </button>
  );
}

export function Badge({ children, color = T.accent, bg }) {
  return (
    <span style={{
      fontSize: 10,
      fontFamily: T.mono,
      fontWeight: 700,
      color,
      background: bg ?? 'rgba(59,130,246,0.12)',
      borderRadius: 4,
      padding: '1px 6px',
    }}>
      {children}
    </span>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 10px', borderBottom: `1px solid ${T.borderSoft}` }}>
      {tabs.map((t) => {
        const on = active === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            data-testid={`config-tab-${t.key}`}
            onClick={() => onChange(t.key)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: `1px solid ${on ? T.accent : 'transparent'}`,
              background: on ? T.accentDeep : 'transparent',
              color: on ? '#dbeafe' : T.textFaint,
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: T.sans,
              fontWeight: 600,
              outline: 'none',
              transition: `background ${T.transition}, color ${T.transition}`,
            }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = T.textDim; }}
            onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = T.textFaint; }}
            onFocus={(e) => { e.target.style.boxShadow = focusRing; }}
            onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function EntityCard({ title, badge, onRemove, onDuplicate, children, testid }) {
  return (
    <div
      data-testid={testid}
      style={{ border: `1px solid ${T.borderSoft}`, borderRadius: 6, padding: '8px 10px', marginBottom: 8, background: 'rgba(8,14,28,0.5)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ flex: 1, fontSize: 12, fontFamily: T.mono, color: T.textDim, fontWeight: 600 }}>{title}</span>
        {badge}
        {onDuplicate && <IconButton onClick={onDuplicate} title="Duplicate" color={T.textFaint}>⧉</IconButton>}
        {onRemove && <IconButton onClick={onRemove} title="Remove" color={T.textFaint}>✕</IconButton>}
      </div>
      {children}
    </div>
  );
}

export function Grid2({ children, cols = 2, style }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, ...style }}>
      {children}
    </div>
  );
}

// ── Tooltip ─────────────────────────────────────────────────────────────────
export function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  const handleEnter = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
    setShow(true);
  };

  return (
    <span
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
      style={{ display: 'inline-flex' }}
    >
      {children}
      {show && text && (
        <div style={{
          position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)',
          background: '#1e293b', color: T.text, fontSize: 11, fontFamily: T.mono,
          padding: '4px 8px', borderRadius: 5, border: `1px solid ${T.border}`,
          whiteSpace: 'nowrap', zIndex: 9999, pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

// ── Confirm Dialog ──────────────────────────────────────────────────────────
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger', onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(2,6,16,0.6)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        role="alertdialog"
        aria-label={title}
        style={{
          background: T.surfaceSolid, border: `1px solid ${T.border}`,
          borderRadius: T.radius, padding: '20px 24px',
          minWidth: 320, maxWidth: 440, color: T.text,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: T.mono, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.5, marginBottom: 18 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Search Input ────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Filter…' }) {
  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: T.textFaint, pointerEvents: 'none' }}>⌕</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...baseInput, paddingLeft: 26 }}
        onFocus={(e) => { e.target.style.boxShadow = focusRing; }}
        onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
      />
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────────
export function EmptyState({ icon = '○', message, hint }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 12px', color: T.textFaint }}>
      <div style={{ fontSize: 20, marginBottom: 6, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 12, fontFamily: T.mono }}>{message}</div>
      {hint && <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4, fontStyle: 'italic' }}>{hint}</div>}
    </div>
  );
}

// ── Loading Spinner ─────────────────────────────────────────────────────────
export function LoadingState({ message = 'Loading…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20, color: T.textDim }}>
      <span style={{ fontSize: 14, animation: 'spin 1s linear infinite' }}>⟳</span>
      <span style={{ fontSize: 12, fontFamily: T.mono }}>{message}</span>
    </div>
  );
}

// ── Stepper ─────────────────────────────────────────────────────────────────
// Number input flanked by −/+ buttons, with an optional unit suffix.
// The testid sits on the inner <input> so existing e2e selectors keep working.
export function Stepper({ value, onChange, min, max, step = 1, unit, testid, style, error, disabled }) {
  const num = Number(value);
  const clamp = (v) => {
    let n = v;
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    // Avoid float dust from repeated +/- (e.g. 0.5 steps).
    return Math.round(n * 1000) / 1000;
  };
  const bump = (dir) => {
    const base = Number.isFinite(num) ? num : (min ?? 0);
    onChange(String(clamp(base + dir * step)));
  };
  const btn = (label, dir, isDisabled) => (
    <button
      onClick={() => bump(dir)}
      disabled={isDisabled || disabled}
      tabIndex={-1}
      aria-label={dir > 0 ? 'increase' : 'decrease'}
      style={{
        width: 22, alignSelf: 'stretch', flexShrink: 0,
        background: T.raised, color: T.textDim,
        border: `1px solid ${error ? T.red : '#334155'}`,
        borderRadius: dir < 0 ? `${T.radiusSm}px 0 0 ${T.radiusSm}px` : `0 ${T.radiusSm}px ${T.radiusSm}px 0`,
        cursor: isDisabled || disabled ? 'default' : 'pointer',
        fontSize: 13, lineHeight: 1, padding: 0,
        opacity: isDisabled || disabled ? 0.4 : 1,
        transition: `filter ${T.transition}`,
      }}
      onMouseEnter={(e) => { if (!isDisabled && !disabled) e.currentTarget.style.filter = 'brightness(1.25)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', width: '100%', ...style }}>
      {btn('−', -1, Number.isFinite(num) && min != null && num <= min)}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <input
          data-testid={testid}
          type="number"
          value={value ?? ''}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          onChange={(e) => onChange(e.target.value)}
          {...inputFocusProps(error)}
          style={{
            ...baseInput,
            borderColor: error ? T.red : '#334155',
            borderLeft: 'none', borderRight: 'none', borderRadius: 0,
            textAlign: 'center',
            paddingRight: unit ? 26 : 8,
            opacity: disabled ? 0.55 : 1,
            MozAppearance: 'textfield',
          }}
        />
        {unit && (
          <span style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            fontSize: 10, color: T.textFaint, fontFamily: T.sans, pointerEvents: 'none',
          }}>
            {unit}
          </span>
        )}
      </div>
      {btn('+', 1, Number.isFinite(num) && max != null && num >= max)}
    </div>
  );
}

// ── SliderInput ─────────────────────────────────────────────────────────────
// Range slider + live value readout, for bounded ratios (e.g. automation 0–1).
export function SliderInput({ value, onChange, min = 0, max = 1, step = 0.05, format, disabled, testid }) {
  const num = Number(value);
  const shown = format ? format(Number.isFinite(num) ? num : min) : String(value ?? '');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <input
        data-testid={testid}
        type="range"
        value={Number.isFinite(num) ? num : min}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, accentColor: T.accent, cursor: disabled ? 'default' : 'pointer', minWidth: 0 }}
      />
      <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textDim, minWidth: 36, textAlign: 'right' }}>{shown}</span>
    </div>
  );
}

// ── SegmentedControl ────────────────────────────────────────────────────────
// Pill group for small enums (≤5 options) — replaces dropdowns for kind/mode.
export function SegmentedControl({ options, value, onChange, disabled, testid, style }) {
  return (
    <div
      data-testid={testid}
      role="radiogroup"
      style={{
        display: 'flex', width: '100%', background: T.surfaceSolid,
        border: `1px solid #334155`, borderRadius: T.radiusSm, padding: 2, gap: 2,
        boxSizing: 'border-box', ...style,
      }}
    >
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const lab = typeof o === 'string' ? o : o.label;
        const on = value === val;
        return (
          <button
            key={val}
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(val)}
            style={{
              flex: 1, minWidth: 0, padding: '3px 4px', borderRadius: 3, border: 'none',
              background: on ? T.accentDeep : 'transparent',
              color: on ? '#dbeafe' : T.textFaint,
              fontSize: 10, fontFamily: T.sans, fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: `background ${T.transition}, color ${T.transition}`,
              outline: 'none',
            }}
            onMouseEnter={(e) => { if (!on && !disabled) e.currentTarget.style.color = T.textDim; }}
            onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = T.textFaint; }}
            onFocus={(e) => { e.target.style.boxShadow = focusRing; }}
            onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
          >
            {lab}
          </button>
        );
      })}
    </div>
  );
}

// ── SegmentedTabs ───────────────────────────────────────────────────────────
// Icon + label tab strip for the right rail / section navs. `badge` (if given)
// renders on top of the tab and stays mounted regardless of active state.
export function SegmentedTabs({ items, active, onChange, compact }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 3, width: '100%' }}>
      {items.map((it) => {
        const on = active === it.key;
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={on}
            title={it.label}
            data-testid={it.testid}
            onClick={() => onChange(it.key)}
            style={{
              flex: 1, minWidth: 0, position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: compact ? '6px 2px' : '6px 4px',
              background: on ? T.raised : 'transparent',
              border: `1px solid ${on ? T.border : 'transparent'}`,
              borderRadius: 6,
              color: on ? T.text : T.textFaint,
              cursor: 'pointer', outline: 'none',
              transition: `background ${T.transition}, color ${T.transition}`,
            }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = T.textDim; }}
            onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = T.textFaint; }}
            onFocus={(e) => { e.target.style.boxShadow = focusRing; }}
            onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
          >
            {it.icon}
            {!compact && (
              <span style={{ fontSize: 9, fontFamily: T.sans, fontWeight: 600, letterSpacing: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {it.label}
              </span>
            )}
            {it.badge != null && (
              <span style={{ position: 'absolute', top: 1, right: 2 }}>{it.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── CollapsibleSection ──────────────────────────────────────────────────────
// Animated open/close without height measuring (grid-rows trick).
export function CollapsibleSection({ title, open, onToggle, badge, children }) {
  return (
    <div style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: T.textFaint, fontSize: 9 }}>{open ? '▾' : '▸'}</span>
        <span style={{ flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: T.textFaint, fontFamily: T.display }}>{title}</span>
        {badge}
      </div>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: `grid-template-rows ${T.transition}` }}>
        <div style={{ overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
}

// ── Kpi ─────────────────────────────────────────────────────────────────────
// Dashboard stat cell: big value + label, optional trend delta and target.
export function Kpi({ label, value, unit, color = T.text, delta, target, testid }) {
  const deltaColor = delta > 0 ? T.green : delta < 0 ? T.red : T.textFaint;
  return (
    <div data-testid={testid} style={{ background: 'rgba(8,14,28,0.5)', border: `1px solid ${T.borderSoft}`, borderRadius: 6, padding: '7px 9px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: T.font.kpi, fontWeight: 700, fontFamily: T.display, color, lineHeight: 1.1 }}>{value}</span>
        {unit && <span style={{ fontSize: 9, color: T.textFaint, fontFamily: T.sans }}>{unit}</span>}
        {delta != null && delta !== 0 && Number.isFinite(delta) && (
          <span style={{ fontSize: 9, fontFamily: T.mono, color: deltaColor, marginLeft: 'auto' }}>
            {delta > 0 ? '▲' : '▼'}{Math.abs(Math.round(delta * 100))}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 9, color: T.textFaint, fontFamily: T.sans, marginTop: 2, letterSpacing: 0.3 }}>
        {label}
        {target != null && <span style={{ opacity: 0.8 }}> · of {target}</span>}
      </div>
    </div>
  );
}

// ── DropdownMenu ────────────────────────────────────────────────────────────
// Toolbar overflow menu. Items: { label, onClick, testid, active, icon }.
export function DropdownMenu({ label, icon, items, testid }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <Button testid={testid} icon={icon} variant={open ? 'violet' : 'default'} onClick={() => setOpen((o) => !o)}>
        {label}
      </Button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: 160,
          background: T.surfaceSolid, border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
          boxShadow: T.shadow.pop, zIndex: T.z.toolbar + 1, padding: 4,
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {items.map((it) => (
            <button
              key={it.label}
              data-testid={it.testid}
              onClick={() => { setOpen(false); it.onClick(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left',
                background: it.active ? T.accentDeep : 'transparent',
                color: it.active ? '#dbeafe' : T.textDim,
                border: 'none', borderRadius: 4, padding: '6px 8px',
                fontSize: 12, fontFamily: T.sans, fontWeight: 600, cursor: 'pointer',
                transition: `background ${T.transition}`,
              }}
              onMouseEnter={(e) => { if (!it.active) e.currentTarget.style.background = T.raised; }}
              onMouseLeave={(e) => { if (!it.active) e.currentTarget.style.background = 'transparent'; }}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── WeekdayPicker ───────────────────────────────────────────────────────────
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export function WeekdayPicker({ value = [], onChange, disabled }) {
  const toggle = (d) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : WEEKDAY_KEYS.filter((k) => value.includes(k) || k === d));
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {WEEKDAY_KEYS.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            disabled={disabled}
            onClick={() => toggle(d)}
            aria-pressed={on}
            title={d}
            style={{
              flex: 1, padding: '4px 0', borderRadius: 4,
              border: `1px solid ${on ? T.accent : T.borderSoft}`,
              background: on ? T.accentDeep : 'transparent',
              color: on ? '#dbeafe' : T.textFaint,
              fontSize: 10, fontFamily: T.sans, fontWeight: 700, textTransform: 'uppercase',
              cursor: disabled ? 'default' : 'pointer',
              transition: `background ${T.transition}, color ${T.transition}`,
            }}
          >
            {d[0]}
          </button>
        );
      })}
    </div>
  );
}

// ── ChipList ────────────────────────────────────────────────────────────────
// Removable chips + an adder (dropdown when `options` given, free-add otherwise).
export function ChipList({ values, options, onChange, addLabel = '+ add', testid }) {
  const remaining = options ? options.filter((o) => !values.includes(o)) : [];
  return (
    <div data-testid={testid} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {values.map((v, i) => (
        <span key={`${v}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: T.raised, border: `1px solid ${T.borderSoft}`, borderRadius: 4, padding: '1px 4px 1px 7px', fontSize: 11, fontFamily: T.mono, color: T.textDim }}>
          {v}
          <IconButton onClick={() => onChange(values.filter((_, j) => j !== i))} title="remove">✕</IconButton>
        </span>
      ))}
      {options ? (
        remaining.length > 0 && (
          <Select
            value=""
            onChange={(val) => val && onChange([...values, val])}
            options={[{ value: '', label: addLabel }, ...remaining]}
            style={{ width: 'auto', padding: '2px 6px' }}
          />
        )
      ) : (
        <button
          onClick={() => onChange([...values, ''])}
          style={{ background: 'none', border: `1px dashed ${T.borderSoft}`, color: T.textFaint, borderRadius: 4, fontSize: 11, fontFamily: T.sans, cursor: 'pointer', padding: '1px 7px' }}
        >
          {addLabel}
        </button>
      )}
    </div>
  );
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export function useSessionStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(`twin_${key}`);
      return stored != null ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });

  useEffect(() => {
    try { localStorage.setItem(`twin_${key}`, JSON.stringify(value)); } catch {}
  }, [key, value]);

  return [value, setValue];
}

export function useKeyboardShortcuts(shortcuts, deps = []) {
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      for (const s of shortcuts) {
        if (s.key === e.key || s.key === e.code) {
          if (s.ctrl && !e.ctrlKey && !e.metaKey) continue;
          if (s.shift && !e.shiftKey) continue;
          e.preventDefault();
          s.action();
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, deps);
}
