// Factory Digital Twin — public entry point (§1).
//
// Usage: import { runTwin } from 'src/twin'
// config = makeFactoryConfig({...})
// result = runTwin(config)

export { runTwin } from './engine/engine.js';
export { validateFactoryConfig } from './engine/validator.js';

// Domain exports for config assembly
export { makeMaterial } from './domain/material.js';
export { makeProcess, KIND } from './domain/process.js';
export { makeOrder, ORDER_STATUS } from './domain/order.js';
export { makeUnit, LOCATION_TYPE } from './domain/unit.js';
export { makeShift } from './domain/shift.js';
export { makeSchemaMatrix, SYSTEMS } from './domain/schemaMatrix.js';

// Network exports
export { makeTrackNode, NODE_TYPE } from './network/trackNode.js';
export { makeTrackSegment, TRANSPORT_MODE } from './network/trackSegment.js';
export { makeStation } from './network/station.js';
export { makeCarrierPool, CARRIER_KIND } from './network/carrierPool.js';
export { makeExitNode, EXIT_KIND } from './network/exitNode.js';
export { makeFactoryConfig } from './network/factoryConfig.js';

// Utilities
export { newId, resetIds } from './util/ids.js';
export { invariant } from './util/assert.js';
