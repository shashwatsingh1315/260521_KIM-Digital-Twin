const DB_NAME = 'factory-twin-models';
const STORE_NAME = 'glb-files';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, mode);
    const store = t.objectStore(STORE_NAME);
    const result = fn(store);
    t.oncomplete = () => resolve(result.result ?? result);
    t.onerror = () => reject(t.error);
  }));
}

export async function saveModel(key, arrayBuffer, filename) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readwrite');
    const store = t.objectStore(STORE_NAME);
    store.put({ blob: arrayBuffer, filename, size: arrayBuffer.byteLength, timestamp: Date.now() }, key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function loadModel(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readonly');
    const store = t.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => {
      const val = req.result;
      if (!val) return resolve(null);
      const objectUrl = URL.createObjectURL(new Blob([val.blob], { type: 'model/gltf-binary' }));
      resolve({ ...val, objectUrl });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteModel(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readwrite');
    const store = t.objectStore(STORE_NAME);
    store.delete(key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function listModels() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readonly');
    const store = t.objectStore(STORE_NAME);
    const keys = store.getAllKeys();
    const vals = store.getAll();
    t.oncomplete = () => {
      const result = {};
      for (let i = 0; i < keys.result.length; i++) {
        const v = vals.result[i];
        result[keys.result[i]] = { filename: v.filename, size: v.size, timestamp: v.timestamp };
      }
      resolve(result);
    };
    t.onerror = () => reject(t.error);
  });
}

const GLB_MAGIC = 0x46546C67;

export function validateGlb(arrayBuffer) {
  if (arrayBuffer.byteLength < 12) return 'File too small to be a valid GLB';
  const view = new DataView(arrayBuffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) return 'Not a valid GLB file (wrong magic bytes)';
  if (view.getUint32(4, true) !== 2) return 'Unsupported GLB version (expected version 2)';
  return null;
}
