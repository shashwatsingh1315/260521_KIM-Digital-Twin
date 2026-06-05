// OrdersStep — production requests. process_sequence is order-sensitive and can
// be reordered or auto-filled from the line.

import { T, Field, TextInput, NumberInput, Select, Button, IconButton, SectionTitle, EntityCard, Grid2 } from '../../kit.jsx';
import { AddBtn } from '../widgets.jsx';
import { uniqueId } from '../wizardState.js';

export default function OrdersStep({ ctx }) {
  const { base, patch, add, remove, matOptions, procOptions, lineProcessOrder } = ctx;
  const ids = base.orders.map((o) => o.id);

  return (
    <div>
      <SectionTitle>Production orders</SectionTitle>
      <p style={hintP}>What to build and when. The process sequence is the route a unit takes — order matters.</p>
      {base.orders.map((o, i) => (
        <EntityCard key={i} testid={`wiz-order-${i}`} title={o.id || '(new order)'} onRemove={() => remove('orders', i)}>
          <Grid2>
            <Field label="id"><TextInput value={o.id} onChange={(v) => patch('orders', i, { id: v })} /></Field>
            <Field label="material"><Select value={o.material_type} onChange={(v) => patch('orders', i, { material_type: v })} options={['', ...matOptions]} /></Field>
            <Field label="quantity"><NumberInput value={o.quantity} min={1} onChange={(v) => patch('orders', i, { quantity: v })} /></Field>
            <Field label="arrival (s)" hint="when the order starts"><NumberInput value={o.arrival_time} min={0} onChange={(v) => patch('orders', i, { arrival_time: v })} /></Field>
          </Grid2>
          <Field label="process sequence" hint="the route, in order" style={{ marginTop: 8 }}>
            <Sequence value={o.process_sequence} options={procOptions} onChange={(v) => patch('orders', i, { process_sequence: v })} />
          </Field>
          {lineProcessOrder.length > 0 && (
            <Button variant="ghost" testid={`wiz-autofill-seq-${i}`} style={{ marginTop: 6 }} onClick={() => patch('orders', i, { process_sequence: [...lineProcessOrder] })}>
              ↡ Auto-fill from line
            </Button>
          )}
        </EntityCard>
      ))}
      <AddBtn testid="wiz-add-order" onClick={() => add('orders', { id: uniqueId('order', ids, 'order'), material_type: matOptions[0] ?? '', quantity: 10, process_sequence: [...lineProcessOrder], arrival_time: 0 })}>+ Add order</AddBtn>
    </div>
  );
}

// Reorderable sequence: each step is a row with ▲▼ and a process picker.
function Sequence({ value = [], options, onChange }) {
  const move = (from, to) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  };
  const remaining = options.filter((o) => !value.includes(o));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {value.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: T.textFaint, width: 16, fontFamily: T.mono }}>{i + 1}.</span>
          <Select value={step} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} options={[step, ...remaining]} />
          <IconButton onClick={() => move(i, i - 1)} title="up">▲</IconButton>
          <IconButton onClick={() => move(i, i + 1)} title="down">▼</IconButton>
          <IconButton onClick={() => onChange(value.filter((_, j) => j !== i))} title="remove">✕</IconButton>
        </div>
      ))}
      {remaining.length > 0 && (
        <Select value="" onChange={(v) => v && onChange([...value, v])} options={[{ value: '', label: '+ step' }, ...remaining]} style={{ width: 'auto' }} />
      )}
    </div>
  );
}

const hintP = { fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 10px' };
