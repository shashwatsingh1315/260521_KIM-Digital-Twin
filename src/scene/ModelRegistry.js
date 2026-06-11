import { useState, useEffect } from 'react';
import { loadModel, listModels } from './modelStore.js';

// Static registry — add GLB files to public/models/ and register here.
export const MODEL_REGISTRY = {
  // 'ASRS:SFG-ASRS':     '/models/kenney/storageRackDouble.glb',
};

// Runtime registry — populated from IndexedDB blob URLs at startup and
// when users upload models via the Model Manager.
const runtimeRegistry = new Map();

let version = 0;
const listeners = new Set();

function notify() {
  version++;
  listeners.forEach(fn => fn(version));
}

export function subscribeModelRegistry(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useModelRegistryVersion() {
  const [v, setV] = useState(version);
  useEffect(() => subscribeModelRegistry(setV), []);
  return v;
}

export function registerModel(typeKey, objectUrl) {
  const prev = runtimeRegistry.get(typeKey);
  if (prev) {
    try { URL.revokeObjectURL(prev); } catch { /* ignore */ }
  }
  runtimeRegistry.set(typeKey, objectUrl);
  notify();
}

export function unregisterModel(typeKey) {
  const prev = runtimeRegistry.get(typeKey);
  if (prev) {
    try { URL.revokeObjectURL(prev); } catch { /* ignore */ }
  }
  runtimeRegistry.delete(typeKey);
  notify();
}

export function getRegisteredTypes() {
  return [...runtimeRegistry.keys()];
}

export function modelPath(loc) {
  const compositeKey = `${loc.location_type}:${loc.zone}`;
  return runtimeRegistry.get(compositeKey)
      ?? runtimeRegistry.get(loc.zone)
      ?? runtimeRegistry.get(loc.location_type)
      ?? MODEL_REGISTRY[compositeKey]
      ?? MODEL_REGISTRY[loc.location_type]
      ?? null;
}

export async function loadPersistedModels() {
  try {
    const index = await listModels();
    for (const key of Object.keys(index)) {
      const entry = await loadModel(key);
      if (entry?.objectUrl) {
        runtimeRegistry.set(key, entry.objectUrl);
      }
    }
    if (Object.keys(index).length > 0) notify();
  } catch {
    // IndexedDB unavailable — degrade silently
  }
}
