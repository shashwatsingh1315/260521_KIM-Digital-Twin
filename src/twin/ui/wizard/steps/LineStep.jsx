// LineStep — the heart of the wizard. List stations IN FLOW ORDER; the wizard
// auto-generates the network (intake → station → … → ship, plus scrap for
// inspect) from this order. In 'advanced' mode (non-linear graph) the list is
// read-only and topology is edited via the Network panel.

import { T, Field, TextInput, NumberInput, Select, Button, IconButton, SectionTitle, EntityCard, Grid2 } from '../../kit.jsx';
import { ReorderControls, AddBtn } from '../widgets.jsx';
import { uniqueId } from '../wizardState.js';
import { effectiveSlots, capacityPerHour } from '../../../engine/derive.js';

export default function LineStep({ ctx }) {
  const { base, mode, procOptions, openNetworkPanel,
    addStation, removeStation, moveStation, patchStation,
    addStationProc, removeStationProc, patchStationProc } = ctx;

  if (mode === 'advanced') {
    return (
      <div>
        <SectionTitle>Production line</SectionTitle>
        <div style={{ padding: 12, borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: `1px solid ${T.amber}`, color: '#fcd34d', fontSize: 12, lineHeight: 1.5 }}>
          This scenario's network isn't a simple line, so the visual line builder is
          disabled. Station parameters are still editable below; to change the topology
          (nodes & segments) use the Network panel.
          <div style={{ marginTop: 10 }}>
            <Button variant="violet" testid="wiz-open-network" onClick={openNetworkPanel}>Open Network panel</Button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          {base.stations.map((s, i) => (
            <StationCard key={i} s={s} i={i} count={base.stations.length} ctx={ctx} procOptions={procOptions}
              readOnlyOrder
              patchStation={patchStation} addStationProc={addStationProc} removeStationProc={removeStationProc} patchStationProc={patchStationProc} />
          ))}
        </div>
      </div>
    );
  }

  const ids = base.stations.map((s) => s.id);
  return (
    <div>
      <SectionTitle>Production line (in order)</SectionTitle>
      <p style={hintP}>Add stations in the order material flows. Use ▲▼ to reorder. The wizard wires the
        conveyors, intake and exits automatically — set per-link distances in the next step.</p>
      {base.stations.map((s, i) => (
        <StationCard key={i} s={s} i={i} count={base.stations.length} ctx={ctx} procOptions={procOptions}
          moveStation={moveStation} removeStation={removeStation}
          patchStation={patchStation} addStationProc={addStationProc} removeStationProc={removeStationProc} patchStationProc={patchStationProc} />
      ))}
      <AddBtn testid="wiz-add-station" onClick={() => {
        const id = uniqueId('station', ids, 'station');
        addStation({ id, name: 'New station', node_id: `${id}_input`, entry_buffer_capacity: 10, processes: [] });
      }}>+ Add station</AddBtn>
    </div>
  );
}

function StationCard({ s, i, count, procOptions, readOnlyOrder, moveStation, removeStation, patchStation, addStationProc, removeStationProc, patchStationProc }) {
  return (
    <EntityCard
      testid={`wiz-station-${i}`}
      title={`${i + 1}. ${s.name || s.id}`}
      badge={!readOnlyOrder && <ReorderControls index={i} count={count} onMove={moveStation} onRemove={removeStation} />}
    >
      <Grid2>
        <Field label="name"><TextInput value={s.name} onChange={(v) => patchStation(i, { name: v })} /></Field>
        <Field label="buffer cap" hint="units that can queue before this station">
          <NumberInput value={s.entry_buffer_capacity} min={1} onChange={(v) => patchStation(i, { entry_buffer_capacity: v })} />
        </Field>
      </Grid2>

      <SectionTitle>Processes here</SectionTitle>
      {(s.processes ?? []).map((sp, pi) => {
        const eff = effectiveSlots(Number(sp.parallel_slots) || 1, Number(sp.operators_per_slot) || 0);
        const cph = capacityPerHour(Number(sp.takt_seconds) || 1, eff);
        return (
          <div key={pi} style={{ border: `1px solid ${T.borderSoft}`, borderRadius: 5, padding: 6, marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
              <Select value={sp.process_id} onChange={(v) => patchStationProc(i, pi, { process_id: v })} options={['', ...procOptions]} />
              <IconButton onClick={() => removeStationProc(i, pi)} title="remove">✕</IconButton>
            </div>
            <Grid2>
              <Field label="takt (s)" hint="seconds per unit"><NumberInput value={sp.takt_seconds} min={1} onChange={(v) => patchStationProc(i, pi, { takt_seconds: v })} /></Field>
              <Field label="slots" hint="parallel work positions"><NumberInput value={sp.parallel_slots} min={1} onChange={(v) => patchStationProc(i, pi, { parallel_slots: v })} /></Field>
              <Field label="ops/slot" hint="operators each slot needs"><NumberInput value={sp.operators_per_slot} min={0} step={0.5} onChange={(v) => patchStationProc(i, pi, { operators_per_slot: v })} /></Field>
              <Field label="automation (0–1)"><NumberInput value={sp.automation_level} min={0} max={1} step={0.1} onChange={(v) => patchStationProc(i, pi, { automation_level: v })} /></Field>
            </Grid2>
            <div style={readout}>eff. slots: {eff} · capacity: {cph.toFixed(1)}/hr</div>
          </div>
        );
      })}
      <button onClick={() => addStationProc(i, { process_id: procOptions[0] ?? '', parallel_slots: 1, takt_seconds: 30, operators_per_slot: 1, automation_level: 0 })}
        style={{ background: 'none', border: `1px dashed ${T.borderSoft}`, color: T.textFaint, borderRadius: 4, fontSize: 11, cursor: 'pointer', padding: '4px', width: '100%' }}>+ add process</button>
    </EntityCard>
  );
}

const hintP = { fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 10px' };
const readout = { fontSize: 11, color: T.textFaint, background: T.surfaceSolid, borderRadius: 4, padding: '3px 8px', fontFamily: T.mono, marginTop: 6 };
