// kit.jsx — small design system for the Twin UI.
//
// Centralises design tokens + reusable primitives (Panel, Field, TextInput,
// NumberInput, Select, Button, Tabs, Badge, Row, IconButton) so editors share
// one consistent, modern look instead of bespoke inline styles everywhere.

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
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

export function Panel({ title, right, children, style, testid }) {
  return (
    <div
      data-testid={testid}
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
          <span style={{ flex: 1, fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.textDim }}>{title}</span>
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
      <span style={{ flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: T.textFaint }}>{children}</span>
      {right}
    </div>
  );
}

export function Field({ label, hint, children, style }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, ...style }}>
      {label != null && <span style={{ fontSize: 10, color: T.textFaint }}>{label}</span>}
      {children}
      {hint && <span style={{ fontSize: 10, color: T.textFaint, fontStyle: 'italic' }}>{hint}</span>}
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
};

export function TextInput({ value, onChange, disabled, placeholder, testid, style }) {
  return (
    <input
      data-testid={testid}
      type="text"
      value={value ?? ''}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...baseInput, opacity: disabled ? 0.55 : 1, ...style }}
    />
  );
}

export function NumberInput({ value, onChange, disabled, min, max, step = 1, testid, style }) {
  return (
    <input
      data-testid={testid}
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...baseInput, opacity: disabled ? 0.55 : 1, ...style }}
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

export function Button({ children, onClick, variant = 'default', disabled, testid, style }) {
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
      style={{
        padding: '6px 12px',
        borderRadius: T.radiusSm,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontFamily: T.mono,
        fontWeight: 600,
        transition: 'background 0.15s ease',
        ...variants[variant],
        ...style,
      }}
    >
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
      style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 2 }}
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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 10px', borderBottom: `1px solid ${T.borderSoft}` }}>
      {tabs.map((t) => {
        const on = active === t.key;
        return (
          <button
            key={t.key}
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
              fontFamily: T.mono,
              fontWeight: 600,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function EntityCard({ title, badge, onRemove, children, testid }) {
  return (
    <div
      data-testid={testid}
      style={{ border: `1px solid ${T.borderSoft}`, borderRadius: 6, padding: '8px 10px', marginBottom: 8, background: 'rgba(8,14,28,0.5)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ flex: 1, fontSize: 12, fontFamily: T.mono, color: T.textDim, fontWeight: 600 }}>{title}</span>
        {badge}
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
