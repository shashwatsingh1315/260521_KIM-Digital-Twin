import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { useGLTF } from '@react-three/drei';
import { T, Button, Badge, ConfirmDialog, SearchInput, useKeyboardShortcuts } from './kit.jsx';
import { MESH_BY_ZONE, MESH_BY_TYPE, familyMatKey, getMeshComponent } from '../../scene/MachineMeshes.jsx';
import { MAT } from '../../materials/factoryMaterials.js';
import { saveModel, loadModel, deleteModel, listModels, validateGlb } from '../../scene/modelStore.js';
import { registerModel, unregisterModel } from '../../scene/ModelRegistry.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const FAMILY_COLORS = {
  familyProduction: '#22d3ee',
  familyLogistics:  '#fbbf24',
  familyStorage:    '#a78bfa',
  familyInspect:    '#e879f9',
};

const FAMILY_LABELS = {
  familyProduction: 'Production',
  familyLogistics:  'Logistics',
  familyStorage:    'Storage',
  familyInspect:    'Inspection',
};

function buildTypeList() {
  const groups = {};
  for (const [key] of Object.entries(MESH_BY_ZONE)) {
    const fam = familyMatKey({ zone: key }) || 'machineBody';
    if (!groups[fam]) groups[fam] = [];
    groups[fam].push({ key, label: key, source: 'zone' });
  }
  for (const [key] of Object.entries(MESH_BY_TYPE)) {
    const fam = familyMatKey({ location_type: key }) || 'machineBody';
    if (!groups[fam]) groups[fam] = [];
    groups[fam].push({ key, label: key, source: 'type' });
  }
  return groups;
}

const TYPE_GROUPS = buildTypeList();

function GlbPreview({ url }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} />;
}

function ProceduralPreview({ typeKey }) {
  const loc = MESH_BY_ZONE[typeKey]
    ? { zone: typeKey, location_type: 'machine' }
    : { zone: '', location_type: typeKey };
  const MeshComp = getMeshComponent(loc);
  const famKey = familyMatKey(loc);
  const familyMat = MAT[famKey] || MAT.machineBody;
  if (!MeshComp) {
    return (
      <mesh>
        <boxGeometry args={[1.2, 0.6, 1.2]} />
        <meshLambertMaterial color="#334155" />
      </mesh>
    );
  }
  return (
    <group scale={[1.6, 1.6, 1.6]}>
      <MeshComp fillRatio={0.4} familyMat={familyMat} dimmed={false} loc={loc} />
    </group>
  );
}

function ModelPreviewCanvas({ typeKey, customUrl }) {
  return (
    <Canvas
      camera={{ position: [4, 3, 4], fov: 50 }}
      style={{ borderRadius: 8, background: '#070b14', width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={0.4} color="#cbd5e1" />
      <directionalLight position={[5, 10, 5]} intensity={1.2} color="#fff3dc" />
      <Suspense fallback={null}>
        <Environment preset="warehouse" background={false} environmentIntensity={0.6} />
      </Suspense>
      <OrbitControls autoRotate autoRotateSpeed={1.5} />
      {customUrl ? (
        <Suspense fallback={<ProceduralPreview typeKey={typeKey} />}>
          <GlbPreview url={customUrl} />
        </Suspense>
      ) : (
        <ProceduralPreview typeKey={typeKey} />
      )}
      <gridHelper args={[6, 6, '#1e3a5f', '#1e293b']} />
    </Canvas>
  );
}

function TypeItem({ item, isSelected, hasCustom, onClick }) {
  const fam = familyMatKey(
    item.source === 'zone' ? { zone: item.key } : { location_type: item.key }
  );
  const color = FAMILY_COLORS[fam] || T.textDim;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: isSelected ? 'rgba(59,130,246,0.15)' : 'transparent',
        border: isSelected ? `1px solid ${T.accent}` : '1px solid transparent',
        borderRadius: 6,
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12, fontFamily: T.mono, color: T.text, fontWeight: isSelected ? 600 : 400 }}>
        {item.label}
      </span>
      {hasCustom && <Badge color="#10b981" bg="rgba(16,185,129,0.15)">GLB</Badge>}
    </button>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ModelManager({ onClose }) {
  const [selected, setSelected] = useState(null);
  const [customModels, setCustomModels] = useState({});
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileRef = useRef(null);

  // Escape key handler
  useKeyboardShortcuts([
    { key: 'Escape', action: () => { if (onClose) onClose(); } },
  ], [onClose]);

  useEffect(() => {
    listModels().then(setCustomModels).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) { setPreviewUrl(null); return; }
    if (customModels[selected]) {
      loadModel(selected).then(entry => {
        if (entry?.objectUrl) setPreviewUrl(entry.objectUrl);
        else setPreviewUrl(null);
      }).catch(() => setPreviewUrl(null));
    } else {
      setPreviewUrl(null);
    }
  }, [selected, customModels]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selected) return;

    if (file.size > MAX_FILE_SIZE) {
      setStatus({ type: 'error', msg: `File too large (${formatSize(file.size)}). Max 20 MB.` });
      return;
    }

    setUploading(true);
    setStatus(null);

    try {
      const buf = await file.arrayBuffer();
      const err = validateGlb(buf);
      if (err) {
        setStatus({ type: 'error', msg: err });
        setUploading(false);
        return;
      }

      await saveModel(selected, buf, file.name);
      const entry = await loadModel(selected);
      if (entry?.objectUrl) {
        registerModel(selected, entry.objectUrl);
        setPreviewUrl(entry.objectUrl);
      }
      setCustomModels(await listModels());
      setStatus({ type: 'ok', msg: `Loaded ${file.name} (${formatSize(file.size)})` });
    } catch (err) {
      setStatus({ type: 'error', msg: `Upload failed: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!selected) return;
    try {
      unregisterModel(selected);
      await deleteModel(selected);
      setCustomModels(await listModels());
      setPreviewUrl(null);
      setStatus({ type: 'ok', msg: 'Custom model removed' });
    } catch (err) {
      setStatus({ type: 'error', msg: `Remove failed: ${err.message}` });
    }
  };

  const allTypes = Object.entries(TYPE_GROUPS);

  // Filter items by search query
  const filteredTypes = searchQuery
    ? allTypes.map(([fam, items]) => {
        const filtered = items.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()));
        return filtered.length > 0 ? [fam, filtered] : null;
      }).filter(Boolean)
    : allTypes;

  return (
    <div
      data-testid="model-manager-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-testid="model-manager-panel"
        style={{
          background: T.surfaceSolid,
          border: `1px solid ${T.border}`,
          borderRadius: T.radius + 4,
          width: 'min(920px, 94vw)',
          height: 'min(640px, 90vh)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '14px 18px',
          borderBottom: `1px solid ${T.border}`,
        }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, fontFamily: T.mono, color: T.text, letterSpacing: 0.5 }}>
            Model Manager
          </span>
          <span style={{ fontSize: 11, color: T.textFaint, marginRight: 12 }}>
            Upload .glb models per station type
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: T.textFaint, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >
            x
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left sidebar — type list */}
          <div style={{
            width: 220, borderRight: `1px solid ${T.border}`,
            overflowY: 'auto', padding: '8px 6px',
          }}>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Filter station types..."
            />
            {filteredTypes.map(([fam, items]) => (
              <div key={fam} style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                  color: FAMILY_COLORS[fam] || T.textFaint, padding: '4px 12px', marginBottom: 2,
                }}>
                  {FAMILY_LABELS[fam] || fam}
                </div>
                {items.map(item => (
                  <TypeItem
                    key={item.key}
                    item={item}
                    isSelected={selected === item.key}
                    hasCustom={!!customModels[item.key]}
                    onClick={() => setSelected(item.key)}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Right main area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 12 }}>
            {selected ? (
              <>
                {/* Info bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, fontFamily: T.mono, color: T.text }}>
                    {selected}
                  </span>
                  {customModels[selected] && (
                    <Badge color="#10b981" bg="rgba(16,185,129,0.15)">
                      {customModels[selected].filename} ({formatSize(customModels[selected].size)})
                    </Badge>
                  )}
                  {!customModels[selected] && (
                    <Badge color={T.textFaint} bg="rgba(100,116,139,0.15)">Procedural</Badge>
                  )}
                </div>

                {/* 3D Preview */}
                <div style={{ flex: 1, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.borderSoft}`, minHeight: 0 }}>
                  <ModelPreviewCanvas typeKey={selected} customUrl={previewUrl} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Button
                    variant="primary"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Upload .glb'}
                  </Button>
                  {customModels[selected] && (
                    <Button variant="danger" onClick={() => setShowRemoveConfirm(true)}>
                      Remove
                    </Button>
                  )}
                  {status && (
                    <span style={{
                      fontSize: 11, fontFamily: T.mono,
                      color: status.type === 'error' ? T.red : T.green,
                    }}>
                      {status.msg}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: T.textFaint, fontSize: 13, fontFamily: T.mono,
              }}>
                Select a station type from the left to preview or upload a model
              </div>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept=".glb"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />

        {/* Confirm remove dialog */}
        <ConfirmDialog
          open={showRemoveConfirm}
          title="Remove custom model?"
          message="The custom 3D model will be deleted and the station will revert to procedural geometry."
          confirmLabel="Remove"
          variant="danger"
          onConfirm={() => {
            setShowRemoveConfirm(false);
            handleRemove();
          }}
          onCancel={() => setShowRemoveConfirm(false)}
        />
      </div>
    </div>
  );
}
