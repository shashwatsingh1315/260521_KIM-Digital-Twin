// SchemaMatrixPanel.jsx — §9 schema-impact documentation for a station's
// processes. Static schema-level documentation (CRUD × {SAP,MES,WMS,Noviga});
// NOT live per-unit values and NOT a sync mechanism.
//
// Read mode lists the documented matrices. Edit mode (pause-and-apply) lets the
// user ADD or change schema impact for any of the station's processes: the
// system column is a fixed dropdown over SYSTEMS so an invalid system name can
// never reach makeSchemaMatrix (which would otherwise throw).

import { useState, useCallback, useEffect } from 'react';
import { useTwinContext } from './TwinProvider.jsx';
import { makeSchemaMatrix, SYSTEMS } from '../domain/schemaMatrix.js';
import { makeProcess } from '../domain/process.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';

const OPS = ['create', 'read', 'update', 'delete'];

function cell(fields) {
  return fields && fields.length ? fields.join(', ') : '—';
}

// "a, b , c" -> ['a','b','c']; "" -> []
function parseFields(text) {
  return (text ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Build the editable draft for one process: { [system]: { create, read, update, delete } }
// where each value is the comma-joined string of field names.
function draftFromProcess(proc) {
  const rowsBySystem = new Map((proc?.schema_impact?.rows ?? []).map((r) => [r.system, r]));
  const draft = {};
  for (const sys of SYSTEMS) {
    const row = rowsBySystem.get(sys);
    draft[sys] = {};
    for (const op of OPS) draft[sys][op] = (row?.[op] ?? []).join(', ');
  }
  return draft;
}

// Draft -> schema_impact (or null if every cell is empty).
function schemaFromDraft(processId, draft) {
  const rows = SYSTEMS
    .map((sys) => {
      const row = { system: sys };
      let any = false;
      for (const op of OPS) {
        const fields = parseFields(draft[sys]?.[op]);
        if (fields.length) {
          row[op] = fields;
          any = true;
        }
      }
      return any ? row : null;
    })
    .filter(Boolean);
  return rows.length ? makeSchemaMatrix({ process_id: processId, rows }) : null;
}

function MatrixTable({ matrix }) {
  const rowsBySystem = new Map((matrix.rows ?? []).map((r) => [r.system, r]));
  return (
    <table
      data-testid={`schema-table-${matrix.process_id}`}
      style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}
    >
      <thead>
        <tr style={{ color: '#64748b' }}>
          <th style={thStyle}></th>
          {OPS.map((op) => (
            <th key={op} style={thStyle}>{op[0].toUpperCase()}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SYSTEMS.map((sys) => {
          const row = rowsBySystem.get(sys);
          return (
            <tr key={sys} data-testid={`schema-row-${sys}`}>
              <td style={{ ...tdStyle, color: '#94a3b8', fontWeight: 600 }}>{sys}</td>
              {OPS.map((op) => (
                <td key={op} style={tdStyle}>{cell(row?.[op])}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function EditTable({ procId, draft, onChange }) {
  return (
    <table
      data-testid={`schema-edit-table-${procId}`}
      style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}
    >
      <thead>
        <tr style={{ color: '#64748b' }}>
          <th style={thStyle}>System</th>
          {OPS.map((op) => (
            <th key={op} style={thStyle}>{op[0].toUpperCase()}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SYSTEMS.map((sys) => (
          <tr key={sys} data-testid={`schema-edit-row-${sys}`}>
            <td style={{ ...tdStyle, color: '#94a3b8', fontWeight: 600 }}>{sys}</td>
            {OPS.map((op) => (
              <td key={op} style={tdStyle}>
                <input
                  data-testid={`schema-input-${procId}-${sys}-${op}`}
                  value={draft[sys]?.[op] ?? ''}
                  placeholder="—"
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      [sys]: { ...draft[sys], [op]: e.target.value },
                    })
                  }
                  style={editInputStyle}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function SchemaMatrixPanel({ stationId }) {
  const { config, twinHook } = useTwinContext();
  const { pause, resume, applyConfig } = twinHook;

  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState(null); // Map<process_id, draft>
  const [error, setError] = useState(null);

  const station = config.stations.find((s) => s.id === stationId);
  const processMap = new Map(config.processes.map((p) => [p.id, p]));

  // Station's process defs, in order (deduped — a process may repeat across slots).
  const stationProcs = [];
  const seen = new Set();
  for (const sp of station?.processes ?? []) {
    if (seen.has(sp.process_id)) continue;
    seen.add(sp.process_id);
    const def = processMap.get(sp.process_id);
    if (def) stationProcs.push(def);
  }

  const handleEdit = useCallback(() => {
    pause();
    const next = new Map();
    for (const sp of station?.processes ?? []) {
      const def = processMap.get(sp.process_id);
      if (def && !next.has(def.id)) next.set(def.id, draftFromProcess(def));
    }
    setDrafts(next);
    setError(null);
    setEditing(true);
  }, [pause, station, processMap]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setDrafts(null);
    setError(null);
    resume();
  }, [resume]);

  const handleApply = useCallback(() => {
    try {
      const newProcesses = config.processes.map((p) => {
        if (!drafts.has(p.id)) return p;
        const schema_impact = schemaFromDraft(p.id, drafts.get(p.id));
        return makeProcess({ ...p, schema_impact });
      });

      const newConfig = makeFactoryConfig({
        materials: config.materials,
        processes: newProcesses,
        stations: config.stations,
        segments: config.segments,
        nodes: config.nodes,
        exits: config.exits,
        carrierPools: config.carrierPools,
        shifts: config.shifts,
        orders: config.orders,
        layout_overrides: config.layout_overrides,
      });

      applyConfig(newConfig);
      setEditing(false);
      setDrafts(null);
      setError(null);
      resume();
    } catch (err) {
      setError(err.message);
    }
  }, [config, drafts, applyConfig, resume]);

  // Resume the twin if the panel unmounts mid-edit.
  useEffect(() => {
    return () => {
      if (editing) resume();
    };
  }, [editing, resume]);

  if (!station) return null;

  const documented = stationProcs.filter((p) => p && p.schema_impact);

  return (
    <div data-testid="schema-matrix-panel" style={{ marginTop: 8, borderTop: '1px solid #1e293b', paddingTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ flex: 1, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
          Schema impact (C/R/U/D)
        </span>
        {!editing && (
          <button
            data-testid="schema-edit-btn"
            onClick={handleEdit}
            style={{ ...btnStyle, background: '#1e293b', color: '#94a3b8' }}
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div>
          {stationProcs.map((proc) => (
            <div key={proc.id} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: '#cbd5e1' }}>{proc.name}</div>
              <EditTable
                procId={proc.id}
                draft={drafts.get(proc.id) ?? draftFromProcess(proc)}
                onChange={(updated) =>
                  setDrafts((prev) => {
                    const next = new Map(prev);
                    next.set(proc.id, updated);
                    return next;
                  })
                }
              />
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
            Comma-separate field names. Empty cells are dropped.
          </div>
          {error && <div data-testid="schema-error" style={{ color: '#fca5a5', fontSize: 11, marginTop: 6 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button data-testid="schema-apply-btn" onClick={handleApply} style={{ ...btnStyle, background: '#2563eb', color: '#fff', flex: 1 }}>
              Apply
            </button>
            <button data-testid="schema-cancel-btn" onClick={handleCancel} style={{ ...btnStyle, background: '#374151', color: '#94a3b8', flex: 1 }}>
              Cancel
            </button>
          </div>
        </div>
      ) : documented.length === 0 ? (
        <div data-testid="schema-empty" style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
          No schema impact documented for this station.
        </div>
      ) : (
        documented.map((proc) => (
          <div key={proc.id} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: '#cbd5e1' }}>{proc.name}</div>
            <MatrixTable matrix={proc.schema_impact} />
          </div>
        ))
      )}
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '2px 6px', borderBottom: '1px solid #1e293b', fontWeight: 600 };
const tdStyle = { textAlign: 'left', padding: '2px 6px', borderBottom: '1px solid #131c2e', color: '#cbd5e1' };
const btnStyle = {
  padding: '3px 10px',
  borderRadius: 4,
  border: 'none',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'monospace',
};
const editInputStyle = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 3,
  color: '#e2e8f0',
  padding: '2px 4px',
  fontSize: 11,
  fontFamily: 'monospace',
  width: 70,
  boxSizing: 'border-box',
};
