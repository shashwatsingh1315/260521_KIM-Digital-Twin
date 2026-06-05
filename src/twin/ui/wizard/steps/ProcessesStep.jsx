// ProcessesStep — the transformations (the "math") each station can perform.

import { Field, TextInput, NumberInput, Select, SectionTitle, EntityCard, Grid2, Badge } from '../../kit.jsx';
import { Chips, KVEditor, FreeChips, AddBtn } from '../widgets.jsx';
import { PROCESS_KINDS } from '../../configDraft.js';
import { uniqueId } from '../wizardState.js';

const KIND_HINT = {
  transform: '1→1: changes a unit into the output material (paint, bake, solder).',
  assembly: 'N→1: consumes a recipe of parts to make a new unit.',
  inspect: 'Pass/fail by rate; failures route to scrap (auto-added).',
  label: 'Adds enrichment tags (e.g. a label) without changing the material.',
  seal: 'Adds enrichment tags (e.g. a seal) without changing the material.',
  hold: 'Dwell for a fixed time across N slots (curing, soak).',
  store: 'Buffer/storage with N slots.',
  intake: 'Entry point that can introduce the output material.',
  offload: 'Removes the unit from the line.',
};

export default function ProcessesStep({ ctx }) {
  const { base, patch, add, remove, matOptions } = ctx;
  const ids = base.processes.map((p) => p.id);

  return (
    <div>
      <SectionTitle>Processes</SectionTitle>
      <p style={hintP}>Define each manufacturing step once here; you'll attach them to stations (with takt times) in the next step.</p>
      {base.processes.map((p, i) => (
        <EntityCard key={i} testid={`wiz-process-${i}`} title={p.id || '(new process)'} badge={<Badge>{p.kind}</Badge>} onRemove={() => remove('processes', i)}>
          <Grid2>
            <Field label="name" hint="id derived from it">
              <TextInput value={p.name} onChange={(v) => patch('processes', i, { name: v, id: p._locked ? p.id : uniqueId(v, ids.filter((_, j) => j !== i), 'proc') })} />
            </Field>
            <Field label="id"><TextInput value={p.id} onChange={(v) => patch('processes', i, { id: v, _locked: true })} /></Field>
          </Grid2>
          <Field label="kind" hint={KIND_HINT[p.kind]} style={{ marginTop: 8 }}>
            <Select value={p.kind} onChange={(v) => patch('processes', i, { kind: v })} options={PROCESS_KINDS} />
          </Field>

          {(p.kind === 'transform' || p.kind === 'assembly' || p.kind === 'intake') && (
            <Field label="output material" style={{ marginTop: 8 }}>
              <Select value={p.output_material} onChange={(v) => patch('processes', i, { output_material: v })} options={['', ...matOptions]} />
            </Field>
          )}
          {p.kind === 'assembly' && (
            <Field label="bill of materials" hint="parts consumed per unit" style={{ marginTop: 8 }}>
              <KVEditor obj={p.bom} onChange={(v) => patch('processes', i, { bom: v })} keyOptions={matOptions} keyLabel="material" valLabel="qty" />
            </Field>
          )}
          {p.kind === 'inspect' && (
            <Field label="pass rate (0–1)" hint="fraction that passes; rest is scrapped" style={{ marginTop: 8 }}>
              <NumberInput value={p.pass_rate} min={0} max={1} step={0.01} onChange={(v) => patch('processes', i, { pass_rate: v })} />
            </Field>
          )}
          {p.kind === 'hold' && (
            <Grid2 style={{ marginTop: 8 }}>
              <Field label="dwell (s)"><NumberInput value={p.dwell_seconds} min={1} onChange={(v) => patch('processes', i, { dwell_seconds: v })} /></Field>
              <Field label="slots"><NumberInput value={p.slots} min={1} onChange={(v) => patch('processes', i, { slots: v })} /></Field>
            </Grid2>
          )}
          {p.kind === 'store' && (
            <Field label="slots" style={{ marginTop: 8 }}><NumberInput value={p.slots} min={1} onChange={(v) => patch('processes', i, { slots: v })} /></Field>
          )}
          {(p.kind === 'label' || p.kind === 'seal') && (
            <Field label="adds enrichments" style={{ marginTop: 8 }}><FreeChips values={p.adds_enrichments} onChange={(v) => patch('processes', i, { adds_enrichments: v })} /></Field>
          )}
        </EntityCard>
      ))}
      <AddBtn testid="wiz-add-process" onClick={() => add('processes', { id: uniqueId('process', ids, 'proc'), name: 'New process', kind: 'transform', output_material: matOptions[0] ?? '', pass_rate: 0.9, dwell_seconds: 60, slots: 1, bom: {}, adds_enrichments: [] })}>+ Add process</AddBtn>
    </div>
  );
}

const hintP = { fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 10px' };
