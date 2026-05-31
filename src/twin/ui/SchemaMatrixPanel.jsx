// SchemaMatrixPanel.jsx — §9 schema-impact documentation for a station's
// processes. Static schema-level documentation (CRUD × {SAP,MES,WMS,Noviga});
// NOT live per-unit values and NOT a sync mechanism.

import { useTwinContext } from './TwinProvider.jsx';

const SYSTEMS = ['SAP', 'MES', 'WMS', 'Noviga'];
const OPS = ['create', 'read', 'update', 'delete'];

function cell(fields) {
  return fields && fields.length ? fields.join(', ') : '—';
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

export default function SchemaMatrixPanel({ stationId }) {
  const { config } = useTwinContext();
  const station = config.stations.find((s) => s.id === stationId);
  if (!station) return null;

  const processMap = new Map(config.processes.map((p) => [p.id, p]));
  const documented = (station.processes ?? [])
    .map((sp) => processMap.get(sp.process_id))
    .filter((p) => p && p.schema_impact);

  return (
    <div data-testid="schema-matrix-panel" style={{ marginTop: 8, borderTop: '1px solid #1e293b', paddingTop: 8 }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        Schema impact (C/R/U/D)
      </div>
      {documented.length === 0 ? (
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
