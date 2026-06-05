// ImportExportMenu.jsx — toolbar control for bulk config import/export.
//
// Export: download the whole factory (JSON, incl. measured coordinates) or just
// the node coordinates (CSV). Import: load a config JSON to replace the live
// factory, or a coordinates CSV to reposition nodes from an engineering drawing.
// All parsing/validation lives in configIO.js; this component only handles the
// browser file plumbing and surfaces success/error status.

import { useRef, useState, useCallback } from 'react';
import { useTwinContext } from './TwinProvider.jsx';
import { Button, T } from './kit.jsx';
import {
  exportConfigJSON, importConfigJSON,
  exportCoordinatesCSV, importCoordinatesCSV,
} from './configIO.js';

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export default function ImportExportMenu() {
  const { config, setConfig } = useTwinContext();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null); // { kind:'ok'|'err', text }
  const jsonInput = useRef(null);
  const csvInput = useRef(null);

  const flash = useCallback((kind, text) => {
    setStatus({ kind, text });
    setTimeout(() => setStatus(null), 4000);
  }, []);

  const onExportConfig = () => {
    download('factory-config.json', exportConfigJSON(config), 'application/json');
    setOpen(false);
  };
  const onExportCoords = () => {
    download('factory-coordinates.csv', exportCoordinatesCSV(config), 'text/csv');
    setOpen(false);
  };

  const onImportConfig = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { config: next, errors } = importConfigJSON(await readFile(file));
    if (next && errors.length === 0) {
      setConfig(next);
      flash('ok', `Loaded ${file.name}`);
    } else {
      flash('err', errors[0] || 'Invalid config file');
    }
  };

  const onImportCoords = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { config: next, errors, applied, unknown } = importCoordinatesCSV(await readFile(file), config);
    if (next && errors.length === 0) {
      setConfig(next);
      const note = unknown.length ? ` (${unknown.length} unknown id${unknown.length > 1 ? 's' : ''} skipped)` : '';
      flash('ok', `Placed ${applied} node${applied > 1 ? 's' : ''}${note}`);
    } else {
      flash('err', errors[0] || 'Invalid coordinates CSV');
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <Button testid="open-io-menu" variant={open ? 'violet' : 'default'} onClick={() => setOpen((o) => !o)}>
        ⤓ Data
      </Button>

      {status && (
        <div
          data-testid="io-status"
          style={{
            position: 'absolute', top: '110%', left: 0, marginTop: 4, whiteSpace: 'nowrap',
            fontSize: 11, fontFamily: T.mono, padding: '4px 8px', borderRadius: 5,
            background: status.kind === 'ok' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: status.kind === 'ok' ? T.green : T.red,
            border: `1px solid ${status.kind === 'ok' ? T.green : T.red}`,
            maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {status.kind === 'ok' ? '✓ ' : '⚠ '}{status.text}
        </div>
      )}

      {open && (
        <div
          data-testid="io-menu"
          style={{
            position: 'absolute', top: '110%', left: 0, marginTop: 4, zIndex: 400,
            background: T.surface, backdropFilter: 'blur(10px)', border: `1px solid ${T.border}`,
            borderRadius: 8, padding: 6, width: 220, display: 'flex', flexDirection: 'column', gap: 4,
          }}
        >
          <MenuLabel>Export</MenuLabel>
          <MenuItem testid="export-config" onClick={onExportConfig}>Factory config (.json)</MenuItem>
          <MenuItem testid="export-coords" onClick={onExportCoords}>Coordinates (.csv)</MenuItem>
          <div style={{ height: 1, background: T.borderSoft, margin: '4px 0' }} />
          <MenuLabel>Import</MenuLabel>
          <MenuItem testid="import-config" onClick={() => jsonInput.current?.click()}>Factory config (.json)</MenuItem>
          <MenuItem testid="import-coords" onClick={() => csvInput.current?.click()}>Coordinates (.csv)</MenuItem>
          <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4, lineHeight: 1.4 }}>
            Coordinates are metres (node_id,x,y,z) — trace them from the floor plan.
          </div>
        </div>
      )}

      <input ref={jsonInput} type="file" accept=".json,application/json" data-testid="import-config-input" onChange={onImportConfig} style={{ display: 'none' }} />
      <input ref={csvInput} type="file" accept=".csv,text/csv" data-testid="import-coords-input" onChange={onImportCoords} style={{ display: 'none' }} />
    </div>
  );
}

function MenuLabel({ children }) {
  return <div style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1, padding: '2px 4px' }}>{children}</div>;
}

function MenuItem({ children, onClick, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      style={{
        textAlign: 'left', background: T.raised, border: `1px solid ${T.borderSoft}`,
        color: T.textDim, borderRadius: 5, padding: '6px 8px', fontSize: 12,
        fontFamily: T.mono, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
