# Business & Technical Guide: Building a Digital Twin Factory

> **Note for engineers:** This guide covers the domain model used by the deterministic twin engine. For the full architecture, engine design, and binding decisions see [`docs/designs/factory-twin-v2-architecture.md`](designs/factory-twin-v2-architecture.md). For a complete working example of the schema below, see [`src/twin/fixtures/linearLine.js`](../src/twin/fixtures/linearLine.js).

This guide is designed for both **Business Analysts** (who need to know what data to collect from the factory floor) and **Engineers** (who need to translate that data into code). 

Our V2 Digital Twin is a **strict physics simulation**. It doesn't just draw pretty pictures; it mathematically calculates exact travel times, conveyor bottlenecks, operator shifts, and machine cycle times. If a real-world factory design is physically impossible (like a conveyor belt with no exit), the system will intentionally refuse to run.

---

## Part 1: Data Gathering (For the Business Team)
Before you write any code, you must walk the real (or planned) factory floor and collect the following exact data points. **You cannot build a simulation without these numbers:**

### 1. The Bill of Materials (BOM) & Inventory
*   **What comes in the door?** (e.g., raw plastic, bare PCBs, uncharged batteries).
*   **What are the intermediate states?** (e.g., painted plastic, soldered PCBA).
*   **What goes out the door?** (e.g., final packaged Smart Meter).

### 2. The Process Times (Machine Specs)
For every single machine or manual workbench, you need to ask the floor manager:
*   **Cycle Time (Takt):** Exactly how many seconds does it take to process one unit?
*   **Yield / Pass Rate:** Does this machine have a failure rate? (e.g., IQC inspection rejects 5% of materials).
*   **Recipe (BOM):** If this is an assembly station, exactly how many of component A and component B are required to make component C?

### 3. The Floorplan (Distances & Conveyors)
You cannot just say "the material goes from IQC to SMT". You need the physical constraints:
*   **Distance:** Exactly how many meters of conveyor belt exist between IQC and SMT?
*   **Speed:** How fast does that conveyor belt move (in meters per minute)?
*   **Capacity:** What is the physical limit of boxes that can fit on that belt before it causes a traffic jam?

### 4. Human Resources & Orders
*   **Shifts:** What are the working hours?
*   **Staffing:** How many human operators are required at each machine for it to run?
*   **Orders:** What is a typical daily production order? (e.g., 200 units starting at 8:00 AM).

---

## Part 2: Translating to Code (For the Tech Team)

Once the business team hands you the data above, here is how you translate it into the strict V2 Javascript schema.

### 1. Materials (`makeMaterial`)
Materials represent the physical items.
```javascript
import { makeMaterial } from '../domain/material.js';

const rawMat = makeMaterial({ 
  id: 'M_RAW', 
  properties: {}, 
  // Safety check: The engine will throw an error if M_RAW tries to enter a packaging machine.
  allowed_processes: ['proc_iqc', 'proc_smt'] 
});
```

### 2. Processes (`makeProcess`)
This is the math behind the transformation.
**A. Transform (1-to-1):** Painting a shell, or baking a PCB.
```javascript
const procSmt = makeProcess({ 
  id: 'proc_smt', 
  name: 'SMT + Wave', 
  kind: KIND.TRANSFORM, 
  output_material: 'M_PCBA' 
});
```
**B. Assembly (Many-to-1):** Combining parts. The machine will wait until all components arrive.
```javascript
const proc1p = makeProcess({ 
  id: 'proc_1p', 
  name: '1P Assembly', 
  kind: KIND.ASSEMBLY, 
  output_material: 'M_SFG', 
  bom: { 'M_PCBA': 1, 'M_BATTERY': 1 } // The Recipe
});
```

### 3. The Roads (`makeTrackSegment`)
This defines the physical conveyor belts and calculates travel time. The `capacity` creates realistic backpressure (traffic jams).
```javascript
const segMainArtery = makeTrackSegment({
  id: 'seg_main_artery', 
  from_node_id: 'n_junction', 
  to_node_id: 'n_smt', 
  length_m: 1000,   // 1,000 meters long
  capacity: 50,     // Only 50 boxes fit at once
  transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
});
```

### 4. The Machines (`makeStation`)
Stations are the physical machines plugged into the roads. They execute the `Processes` and define the cycle times (Takt).
```javascript
const stSmt = makeStation({ 
  id: 'st_smt', 
  name: 'SMT Line', 
  node_id: 'n_smt', // Plugs into this intersection
  entry_buffer_capacity: 10,
  processes: [{ 
    process_id: 'proc_smt', 
    parallel_slots: 1, 
    takt_seconds: 60, // Takes 60 seconds per item
    operators_per_slot: 2 // Requires 2 humans
  }] 
});
```

### 5. Production Orders (`makeOrder`)
Orders are the fuel. They spawn units at the starting gate and tell them their itinerary. The engine's GPS automatically routes them through the shortest path of conveyors to hit every process.
```javascript
const orderBat = makeOrder({
  id: 'ORD-BATTERIES', 
  material_type: 'M_BATTERY', 
  quantity: 200,
  process_sequence: ['proc_1p'], // The itinerary
  arrival_time: 0,
});
```

### 6. The 3D Visuals (`layout_overrides`)
The physics engine runs completely in math and logic. To make it look beautiful for executives, we provide 3D X, Y, Z coordinates. 
*   **X and Z** control the layout on the ground.
*   **Y** controls the floor (e.g., `y: 10` puts the machine on the second floor).

```javascript
return makeFactoryConfig({
  materials: [...],
  processes: [...],
  segments: [...],
  orders: [...],
  layout_overrides: {
    n_supplier: { x: -44, y: 0, z: -10 },
    n_1p:       { x: -4,  y: 10, z: 0 }, // Placed on the 2nd Floor
  },
});
```
*Note: Ensure the `name` field in your `makeStation` uses recognizable keywords (like `'SMT'`, `'Pack'`, `'1P'`) so the 3D renderer knows which high-quality industrial model to draw!*

### 7. Node ↔ Station Binding (V2 requirement)

Every `makeStation` must reference a `node_id` that exists in the node list, and that node's type must be `NODE_TYPE.STATION_INPUT`. The engine validates this at startup and will throw if the binding is missing or mismatched.

```javascript
// ✓ correct — node type matches its role
const nSmt = makeTrackNode({ id: 'n_smt', type: NODE_TYPE.STATION_INPUT, name: 'SMT Line' });
const stSmt = makeStation({ id: 'st_smt', node_id: 'n_smt', ... });

// ✗ wrong — node type must be STATION_INPUT for a station to bind to it
const nSmt = makeTrackNode({ id: 'n_smt', type: NODE_TYPE.JUNCTION, ... });
```

See `linearLine.js` for a complete working example with all nodes, segments, stations, and orders wired together correctly.
