// ImportExportMenu.jsx — toolbar control for bulk config import/export.
//
// Export: download the whole factory (JSON, incl. measured coordinates) or just
// the node coordinates (CSV). Import: load a config JSON to replace the live
// factory, or a coordinates CSV to reposition nodes from an engineering drawing.
// All parsing/validation lives in configIO.js; this component only handles the
// browser file plumbing and surfaces success/error status.

import { useRef, useState, useCallback, useEffect } from 'react';
import { useTwinContext } from './TwinProvider.jsx';
import { Button, T, ConfirmDialog } from './kit.jsx';
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
  const [confirmImport, setConfirmImport] = useState(null); // { type:'json'|'csv', file }
  const jsonInput = useRef(null);
  const csvInput = useRef(null);
  const menuRef = useRef(null);
  const containerRef = useRef(null);

  const flash = useCallback((kind, text) => {
    setStatus({ kind, text });
    setTimeout(() => setStatus(null), 4000);
  }, []);

  // Close menu on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const onExportConfig = () => {
    download('factory-config.json', exportConfigJSON(config), 'application/json');
    setOpen(false);
  };
  const onExportCoords = () => {
    download('factory-coordinates.csv', exportCoordinatesCSV(config), 'text/csv');
    setOpen(false);
  };

  const processConfigImport = async (file) => {
    const { config: next, errors } = importConfigJSON(await readFile(file));
    if (next && errors.length === 0) {
      setConfig(next);
      flash('ok', `Loaded ${file.name}`);
    } else {
      flash('err', errors[0] || 'Invalid config file');
    }
  };

  const processCoordsImport = async (file) => {
    const { config: next, errors, applied, unknown } = importCoordinatesCSV(await readFile(file), config);
    if (next && errors.length === 0) {
      setConfig(next);
      const note = unknown.length ? ` (${unknown.length} unknown id${unknown.length > 1 ? 's' : ''} skipped)` : '';
      flash('ok', `Placed ${applied} node${applied > 1 ? 's' : ''}${note}`);
    } else {
      flash('err', errors[0] || 'Invalid coordinates CSV');
    }
  };

  const onImportConfig = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setConfirmImport({ type: 'json', file });
  };

  const onImportCoords = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setConfirmImport({ type: 'csv', file });
  };

  const handleConfirmImport = async () => {
    if (!confirmImport) return;
    const { type, file } = confirmImport;
    setConfirmImport(null);
    setOpen(false);
    if (type === 'json') {
      await processConfigImport(file);
    } else {
      await processCoordsImport(file);
    }
  };

  const handleCancelImport = () => {
    setConfirmImport(null);
  };

  // Drag-and-drop handlers
  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'json') {
      setConfirmImport({ type: 'json', file });
    } else if (ext === 'csv') {
      setConfirmImport({ type: 'csv', file });
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
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
          ref={menuRef}
          data-testid="io-menu"
          onDragOver={onDragOver}
          onDrop={onDrop}
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
          <div style={{
            fontSize: 10, color: T.textFaint, textAlign: 'center',
            padding: '6px 4px', marginTop: 2,
            border: `1px dashed ${T.borderSoft}`, borderRadius: 4,
          }}>
            or drag &amp; drop files here
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmImport}
        title="Import configuration?"
        message="This will replace the current factory configuration and restart the simulation. This cannot be undone."
        confirmLabel="Import"
        variant="danger"
        onConfirm={handleConfirmImport}
        onCancel={handleCancelImport}
      />

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
