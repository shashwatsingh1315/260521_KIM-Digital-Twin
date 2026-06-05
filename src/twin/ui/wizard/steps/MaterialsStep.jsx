// MaterialsStep — the physical items that flow through the factory.

import { Field, TextInput, SectionTitle, EntityCard, Grid2 } from '../../kit.jsx';
import { Chips, KVEditor, AddBtn } from '../widgets.jsx';
import { uniqueId } from '../wizardState.js';

export default function MaterialsStep({ ctx }) {
  const { base, patch, add, remove, procOptions } = ctx;
  const ids = base.materials.map((m) => m.id);

  return (
    <div>
      <SectionTitle>Materials</SectionTitle>
      <p style={hintP}>What comes in, the intermediate states, and what ships out (e.g. raw PCB → assembled device).</p>
      {base.materials.map((m, i) => (
        <EntityCard key={i} testid={`wiz-material-${i}`} title={m.id || '(new material)'} onRemove={() => remove('materials', i)}>
          <Grid2>
            <Field label="name" hint="human-friendly; the id is derived from it">
              <TextInput value={m.name ?? ''} onChange={(v) => patch('materials', i, { name: v, id: m._locked ? m.id : uniqueId(v, ids.filter((_, j) => j !== i), 'mat') })} />
            </Field>
            <Field label="id" hint="referenced by processes & orders">
              <TextInput value={m.id} onChange={(v) => patch('materials', i, { id: v, _locked: true })} />
            </Field>
          </Grid2>
          <Field label="allowed processes" hint="leave empty to allow all" style={{ marginTop: 8 }}>
            <Chips values={m.allowed_processes} options={procOptions} onChange={(v) => patch('materials', i, { allowed_processes: v })} addLabel="+ proc" />
          </Field>
          <Field label="properties" hint="optional (weight_kg, sku…)" style={{ marginTop: 8 }}>
            <KVEditor obj={m.properties} onChange={(v) => patch('materials', i, { properties: v })} keyLabel="prop" valLabel="val" />
          </Field>
        </EntityCard>
      ))}
      <AddBtn testid="wiz-add-material" onClick={() => add('materials', { id: uniqueId('material', ids, 'mat'), name: '', allowed_processes: [], properties: {} })}>+ Add material</AddBtn>
    </div>
  );
}

const hintP = { fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 10px' };
