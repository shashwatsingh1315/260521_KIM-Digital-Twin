// widgets.jsx — small composite inputs shared across wizard steps.
// Built on the kit.jsx primitives for a consistent look.

import { T, TextInput, NumberInput, Select, IconButton } from '../kit.jsx';

/** Tag list. With `options` it's a picker (dropdown to add); without, free text. */
export function Chips({ values = [], options, onChange, addLabel = '+ add', testid }) {
  const remaining = options ? options.filter((o) => !values.includes(o)) : [];
  return (
    <div data-testid={testid} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {values.map((v, i) => (
        <span key={`${v}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: T.raised, border: `1px solid ${T.borderSoft}`, borderRadius: 4, padding: '1px 4px 1px 7px', fontSize: 11, fontFamily: T.mono, color: T.textDim }}>
          {v || '—'}
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
        <button onClick={() => onChange([...values, ''])} style={dashBtn}>{addLabel}</button>
      )}
    </div>
  );
}

/** Editable free-text list, one input per row. */
export function FreeChips({ values = [], onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {values.map((v, i) => (
        <div key={i} style={{ display: 'flex', gap: 4 }}>
          <TextInput value={v} onChange={(nv) => onChange(values.map((x, j) => (j === i ? nv : x)))} />
          <IconButton onClick={() => onChange(values.filter((_, j) => j !== i))} title="remove">✕</IconButton>
        </div>
      ))}
      <button onClick={() => onChange([...values, ''])} style={dashBtn}>+ add</button>
    </div>
  );
}

/** Key/value editor (BOM, staffing, properties). */
export function KVEditor({ obj = {}, onChange, keyOptions, keyLabel = 'key', valLabel = 'qty' }) {
  const entries = Object.entries(obj ?? {});
  const setKey = (oldK, newK) => {
    const next = {}; for (const [k, v] of entries) next[k === oldK ? newK : k] = v; onChange(next);
  };
  const setVal = (k, v) => onChange({ ...obj, [k]: v });
  const remove = (k) => { const next = { ...obj }; delete next[k]; onChange(next); };
  const add = () => onChange({ ...obj, '': '' });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {entries.map(([k, v], i) => (
        <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {keyOptions
            ? <Select value={k} onChange={(nk) => setKey(k, nk)} options={[{ value: '', label: keyLabel }, ...keyOptions]} />
            : <TextInput value={k} placeholder={keyLabel} onChange={(nk) => setKey(k, nk)} />}
          <NumberInput value={v} onChange={(nv) => setVal(k, nv)} style={{ width: 70 }} />
          <IconButton onClick={() => remove(k)} title="remove">✕</IconButton>
        </div>
      ))}
      <button onClick={add} style={dashBtn}>+ {keyLabel}/{valLabel}</button>
    </div>
  );
}

/** Up/down reorder + remove controls for an ordered list row. */
export function ReorderControls({ index, count, onMove, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <IconButton onClick={() => onMove(index, index - 1)} title="move up" testid="move-up">{index > 0 ? '▲' : ' '}</IconButton>
      <IconButton onClick={() => onMove(index, index + 1)} title="move down" testid="move-down">{index < count - 1 ? '▼' : ' '}</IconButton>
      {onRemove && <IconButton onClick={() => onRemove(index)} title="remove">✕</IconButton>}
    </div>
  );
}

export function AddBtn({ onClick, children, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      style={{ width: '100%', background: 'rgba(59,130,246,0.08)', border: `1px dashed ${T.border}`, color: T.cyan, borderRadius: 6, fontSize: 12, fontFamily: T.mono, cursor: 'pointer', padding: '7px', marginTop: 4 }}
    >
      {children}
    </button>
  );
}

const dashBtn = { background: 'none', border: `1px dashed ${T.borderSoft}`, color: T.textFaint, borderRadius: 4, fontSize: 11, cursor: 'pointer', padding: '3px 7px' };
