// ShiftsStep — operating hours and per-station staffing.

import { Field, TextInput, NumberInput, SectionTitle, EntityCard, Grid2 } from '../../kit.jsx';
import { Chips, KVEditor, AddBtn } from '../widgets.jsx';
import { uniqueId } from '../wizardState.js';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function ShiftsStep({ ctx }) {
  const { base, patch, add, remove } = ctx;
  const ids = base.shifts.map((s) => s.id);
  const stationIds = base.stations.map((s) => s.id);

  return (
    <div>
      <SectionTitle>Shifts & staffing</SectionTitle>
      <p style={hintP}>Working hours gate human operators (and shift-gated carriers). Staffing sets how many
        people each station has during the shift.</p>
      {base.shifts.map((s, i) => (
        <EntityCard key={i} testid={`wiz-shift-${i}`} title={s.id || '(new shift)'} onRemove={() => remove('shifts', i)}>
          <Grid2>
            <Field label="name"><TextInput value={s.name} onChange={(v) => patch('shifts', i, { name: v, id: s._locked ? s.id : uniqueId(v, ids.filter((_, j) => j !== i), 'shift') })} /></Field>
            <Field label="id"><TextInput value={s.id} onChange={(v) => patch('shifts', i, { id: v, _locked: true })} /></Field>
            <Field label="start (HH:MM)"><TextInput value={s.start_time} onChange={(v) => patch('shifts', i, { start_time: v })} /></Field>
            <Field label="duration (h)"><NumberInput value={s.duration_hours} min={1} max={24} step={0.5} onChange={(v) => patch('shifts', i, { duration_hours: v })} /></Field>
          </Grid2>
          <Field label="days" style={{ marginTop: 8 }}>
            <Chips values={s.days} options={WEEKDAYS} onChange={(v) => patch('shifts', i, { days: v })} addLabel="+ day" />
          </Field>
          <Field label="staffing (station → people)" style={{ marginTop: 8 }}>
            <KVEditor obj={s.staffing} onChange={(v) => patch('shifts', i, { staffing: v })} keyOptions={stationIds} keyLabel="station" valLabel="people" />
          </Field>
        </EntityCard>
      ))}
      <AddBtn testid="wiz-add-shift" onClick={() => add('shifts', { id: uniqueId('shift', ids, 'shift'), name: 'New shift', start_time: '07:00', duration_hours: 8, days: ['mon', 'tue', 'wed', 'thu', 'fri'], staffing: {} })}>+ Add shift</AddBtn>
    </div>
  );
}

const hintP = { fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 10px' };
