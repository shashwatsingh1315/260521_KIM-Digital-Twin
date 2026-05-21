# 🏭 M800 Digital Twin — 3D Model Upgrade Guide
### A Step-by-Step Plan for the Intern Who Just Joined

---

> **TL;DR for the impatient:** The 3D factory machines in this app look like blocky grey cubes right now. Your job is to make each one look like the real machine it represents — with panels, lights, screens, and details. You'll also build a popup "Model Gallery" so you can view each machine in isolation to verify your work.

---

## 📋 Table of Contents

1. [What is this project?](#1-what-is-this-project)
2. [Tech Stack Orientation](#2-tech-stack-orientation)
3. [File Map — Where Everything Lives](#3-file-map--where-everything-lives)
4. [How 3D Models Work in This App](#4-how-3d-models-work-in-this-app)
5. [What Needs to Change and Why](#5-what-needs-to-change-and-why)
6. [Step 1 — Understand the Material System](#step-1--understand-the-material-system)
7. [Step 2 — Upgrade Each Machine Model (All 17)](#step-2--upgrade-each-machine-model-all-17)
8. [Step 3 — Build the Asset Inspector UI](#step-3--build-the-asset-inspector-ui)
9. [Step 4 — Wire the Inspector into App.jsx](#step-4--wire-the-inspector-into-appjsx)
10. [Step 5 — Add Inspector CSS Styles](#step-5--add-inspector-css-styles)
11. [Step 6 — Write the Screenshot Automation Script](#step-6--write-the-screenshot-automation-script)
12. [Step 7 — Run Everything and Verify](#step-7--run-everything-and-verify)
13. [Quality Checklist](#quality-checklist)
14. [Common Mistakes to Avoid](#common-mistakes-to-avoid)

---

## 1. What is This Project?

This is a **Digital Twin** — a real-time 3D visualization of the M800 factory. It shows the flow of materials through two physical sites:
- **KMP Plant** — electronics manufacturing (3 floors)
- **Warehouse (WH)** — storage and dispatch

The app runs live in a browser. You can see buffers fill up, machines process parts, and trucks dispatch goods — all in 3D.

**The problem right now:** The machines look like plain grey rectangles. A dock gate looks the same as an inspection bench. There's no visual identity. We need to fix this.

---

## 2. Tech Stack Orientation

| Technology | Version | What it's for |
|---|---|---|
| React | 18.3 | UI framework — components, state |
| Three.js | 0.160 | 3D graphics engine |
| @react-three/fiber (R3F) | 8.15 | React wrapper around Three.js |
| @react-three/drei | 9.96 | Ready-made helpers (OrbitControls, Html labels, etc.) |
| Vite | 5.2 | Build tool / dev server |
| Playwright | 1.44 | Browser automation for screenshots |

> **If you don't know Three.js:** Think of it as LEGO for 3D shapes. You stack boxes (`<boxGeometry>`), cylinders (`<cylinderGeometry>`), and spheres together to build complex assemblies. Materials define color, shininess, and glow.

**To run the dev server:**
```bash
# In the project directory:
npm run dev
# Then open http://localhost:5173 in your browser
```

---

## 3. File Map — Where Everything Lives

```
/home/shashwatsingh/250620_Project/260521_Digital Twin/
│
├── src/
│   ├── App.jsx                         ← Main app shell (add Inspector button here)
│   ├── index.css                       ← All app styles (add Inspector CSS here)
│   │
│   ├── components/
│   │   ├── FactoryTwin.jsx             ← The main 3D Canvas for the factory scene
│   │   ├── LayoutEditor.jsx            ← The drag-and-drop layout tool (don't touch)
│   │   └── AssetInspector.jsx          ← [NEW] You will create this file
│   │
│   ├── scene/
│   │   ├── MachineMeshes.jsx           ← [MAIN FILE YOU WILL EDIT] All 17 machine 3D models
│   │   ├── LocationNode.jsx            ← Renders each machine at its world position
│   │   ├── SceneAtmosphere.jsx         ← Lighting for the main factory scene
│   │   └── BuildingShells.jsx          ← The building walls/columns
│   │
│   ├── materials/
│   │   └── factoryMaterials.js         ← Color + material properties dictionary
│   │
│   └── data/
│       └── m800_model.js               ← Location definitions (don't touch the data)
│
├── scratch_capture_models.js           ← [NEW] Screenshot automation script (root dir)
└── package.json
```

---

## 4. How 3D Models Work in This App

### The Primitive Helpers

At the top of `MachineMeshes.jsx`, three tiny helper components are defined:

```jsx
// A box/rectangular shape
<Box pos={[x, y, z]} size={[width, height, depth]} mat={MAT.metalDark} rot={[rx, ry, rz]} />

// A cylinder shape
<Cyl pos={[x, y, z]} r={0.1} h={0.5} mat={MAT.metalLight} />

// A sphere shape
<Sph pos={[x, y, z]} r={0.05} mat={MAT.signalGreen} />
```

All machines are just **groups of these primitives assembled together**. Like LEGO.

### Coordinate System

- **X axis** → Left/Right
- **Y axis** → Up/Down (y=0 is the floor)
- **Z axis** → Forward/Backward

Build your machine models so they roughly sit between **y=0 (floor) and y=3 (ceiling)**, centered at the origin `[0, 0, 0]`. The `LocationNode.jsx` component then places it at the correct world position on the factory floor.

### The Material Dictionary

All materials are defined in `src/materials/factoryMaterials.js` as the `MAT` object. You reference them like:
```jsx
mat={MAT.safetyYellow}   // bright yellow painted metal
mat={MAT.emissiveCyan}   // glowing cyan LED
mat={MAT.metalDark}      // dark brushed steel
mat={MAT.glass}          // transparent glass panel
```

---

## 5. What Needs to Change and Why

Right now, every location in the factory uses simple rectangular blocks. When you look at the 3D view, you can't tell a warehouse rack from a quality inspection bench. The goal is:

1. **Each machine should visually represent what it actually does** in real life.
2. **Each model must have enough detail** (panels, lights, screens, labels) to be recognizable from the camera angles used in the app.
3. **An "Asset Inspector" modal** must be built so you can preview each model in isolation with clean studio lighting — allowing verification before the final build.

---

## Step 1 — Understand the Material System

**File to edit:** `src/materials/factoryMaterials.js`

Before writing any models, understand the materials you have available. Here's the full reference:

| Key | Color | Use Case |
|---|---|---|
| `MAT.metalDark` | Very dark navy/steel | Machine chassis bodies |
| `MAT.metalLight` | Medium grey | Poles, frames, brackets |
| `MAT.metalSteel` | Mid-tone steel grey | Structural beams, rails |
| `MAT.concrete` | Dark grey concrete | Floors, ramps |
| `MAT.safetyYellow` | Amber yellow + slight glow | Safety rails, robot arms |
| `MAT.signalRed` | Red + glow | Status lights (STOP) |
| `MAT.signalGreen` | Green + glow | Status lights (GO) |
| `MAT.signalAmber` | Amber + glow | Status lights (WARN) |
| `MAT.glass` | Near-transparent blue-white | Safety glass windows |
| `MAT.glassOrange` | Near-transparent orange | Laser safety windows |
| `MAT.emissiveCyan` | Glowing cyan | Scanner lasers, LED strips |
| `MAT.emissiveBlue` | Glowing blue | Screens, monitors |
| `MAT.emissiveOrange` | Glowing orange | Heating elements, step LEDs |
| `MAT.glowWhite` | Glowing white | Overhead LED panels |
| `MAT.woodPallet` | Woody brown | Pallets |
| `MAT.cardboardBox` | Cardboard tan | Boxes |
| `MAT.pcbGreen` | Dark green | PCB boards, ESD mats |
| `MAT.siliconChip` | Very dark, reflective | Chips, ICs |
| `MAT.goldContacts` | Gold | Connector pins |
| `MAT.plasticBlue` | Royal blue | Plastic bins |
| `MAT.plasticYellow` | Yellow | Plastic bins |
| `MAT.carbonPanel` | Near-black | Machine panel fascias |
| `MAT.wrapFilm` | Barely visible silver | Stretch wrap film |

> **You do NOT need to add new materials.** All the colors you need are already defined. Just use `MAT.<key>` in your mesh components.

---

## Step 2 — Upgrade Each Machine Model (All 17)

**File to edit:** `src/scene/MachineMeshes.jsx`

Each machine is an exported function that returns a `<group>` of 3D primitives. Your job is to **replace the existing simple versions** with richer, more detailed ones.

Below is the spec for each. Follow the exact structure: start with the largest shapes (chassis, base), then add mid-level elements (frames, panels), then add fine details (lights, screens, cables).

---

### 2.1 — `DockMesh` (Cargo Portal / Loading Gate)

**What it represents:** An industrial dock door where trucks back in to load/unload.

**Visual requirements:**
- Heavy steel portal arch (the existing frame is fine — keep it)
- A solid concrete wall on either side of the arch (two thick Box panels, dark grey)
- A rolling steel shutter gate (a flat panel with horizontal rib lines pressed into it)
- **Yellow/black striped hazard bumper** along the bottom edge
- **Red/green signal light stack** on the right column — indicates if dock is occupied
- **Cyan glowing strip** running vertically inside the arch to highlight the opening

**Key primitives:**
```
Two tall concrete wall panels flanking the opening:
  <Box pos={[-1.8, 1.2, -0.1]} size={[1.2, 2.4, 0.3]} mat={MAT.concrete} />
  <Box pos={[1.8, 1.2, -0.1]}  size={[1.2, 2.4, 0.3]} mat={MAT.concrete} />

Horizontal overhead concrete lintel:
  <Box pos={[0, 2.55, -0.1]} size={[4.0, 0.3, 0.3]} mat={MAT.concrete} />

The rolling gate slats: use 5-6 horizontal box strips at different Y heights, each slightly different shade
Red status indicator above door:
  <Cyl pos={[1.6, 2.3, 0.1]} r={0.06} h={0.08} mat={MAT.signalRed} />
Green below it:
  <Cyl pos={[1.6, 2.1, 0.1]} r={0.06} h={0.08} mat={MAT.signalGreen} />
```

---

### 2.2 — `BufferMesh` (Pallet / Bin Storage Area)

**What it represents:** A temporary holding zone where pallets or bins wait.

**Visual requirements:**
- A wooden pallet base (already exists as `WoodPallet` helper — keep it)
- Stack of cardboard or plastic boxes (vary by `fillRatio` prop — 0 boxes at 0%, 3 boxes at 100%)
- Stretch-film wrap over the stack (a semi-transparent box)
- A small digital `quantity counter display` (tiny blue emissive box on a post beside the stack)

> **Note:** This mesh receives `fillRatio` as a prop (0.0 to 1.0). Use `Math.round(fillRatio * 3)` to decide how many boxes to stack.

---

### 2.3 — `InspectionMesh` (Quality Control / FAT Lab)

**What it represents:** A bench where engineers inspect and test components.

**Visual requirements:**
- Steel-legged workbench (4 cylinder legs, metal-light colored)
- Glass-topped work surface
- **Stereo microscope**: a box body + cylindrical adjustable arm + round base
- **Oscilloscope box** with a glowing green screen (emissiveCyan panel)
- **Probe cables**: thin angled cylinders (like wires) drooping off the box
- Dual overhead LED illumination bar (long thin white emissive box on two posts)
- A **monitor** on a stand at the right end of the bench

---

### 2.4 — `StoreMesh` (Electronic Parts Store / Kitting Shelves)

**What it represents:** A component store with bins of SMD parts, reels, etc.

**Visual requirements:**
- **Heavy-duty shelving frame**: two tall vertical beams (Box) left and right, with diagonal cross-brace cylinders at the back
- **4 horizontal shelf levels** (flat thin boxes between the uprights)
- On each shelf: **2-3 bins** (blue and yellow plastic cubes), **SMD reel** (cylinder on its side), and a small pick-to-light LED indicator (tiny emissive sphere per bin)
- Rear panel: a wire mesh or pegboard (thin flat box with `wireframe: true`)

---

### 2.5 — `SMTMesh` (Surface Mount Technology Line)

**What it represents:** A machine that places tiny electronic components on circuit boards.

**Visual requirements:**
- Long rectangular chassis base (machine body)
- **Dual conveyor rails**: two thin flat bars running the full length
- **PCB boards** sitting on the rails (thin flat green boxes with tiny grey chip squares on top)
- **Reflow oven section** in the middle: an enclosed box with side walls, a glass viewport panel on the front, and a glowing orange element visible through the glass
- **Feeder banks**: a row of 5-6 small vertical boxes with cylinders (feeder spools) on the left side
- **3-stack status light tower** (the existing `StackLight` helper is already correct — use it)

---

### 2.6 — `FCTMesh` (Functional Circuit Test Station)

**What it represents:** A bench where finished PCBs are tested electrically.

**Visual requirements:**
- **Heavy test console chassis** (a large dark rectangular box as base)
- **Dual monitors** on arms (the existing `ComputerMonitor` helper works — use 2 of them at angles)
- **Keyboard shelf** (thin flat shelf with a flat dark panel representing keyboard)
- **Pneumatic test fixture** (a mechanical platform on the right): a metal base box, a "lid" that closes down (another box slightly above), and gold contact pin rows (a flat gold box)
- Two **probe arm cylinders** rising vertically with a laser indicator at the tip (thin emissiveCyan Cyl)

---

### 2.7 — `TRSSMesh` (Manual TRSS Assembly Bench)

**What it represents:** A manual assembly workstation where technicians build sub-assemblies.

**Visual requirements:**
- Worktable with 4 legs
- **ESD green mat** on the table surface (flat pcbGreen panel)
- **Parts organizer bins** across the back rail (5 small boxes alternating blue/yellow)
- **Tool pegboard panel** behind the bench (thin upright panel with `wireframe: true` mesh)
- **Swing-arm magnifier lamp**: a vertical pole, a horizontal arm extending outward, a cylinder at the end representing the lens housing, with a white glow ring around it
- **Soldering iron holder**: a small blue box with a narrow cylinder (iron) resting at an angle
- **Workpiece on the bench**: a grey assembly on a fixture jig

---

### 2.8 — `Assembly1PMesh` (1P Robotic SPM Cell)

**What it represents:** An enclosed robotic machine that assembles one product (1P) at a time.

**Visual requirements:**
- **Conveyor run base**: long flat box (keep existing version — it's good)
- **Safety enclosure cage** with 4 corner posts and a roof panel
- **Safety glass side panels** (existing glass material, slightly transparent)
- **Pick & place head**: a horizontal gantry bar running left-right (Box), with a vertical shaft hanging down from it, ending in a round nozzle tip (small Cyl)
- **Green glowing interior light** visible through the glass (add a point light or emissive panel inside)
- **Stack light tower** on the enclosure roof
- **Warning yellow door handle** on the front glass panel

---

### 2.9 — `SFGPackMesh` (SFG Boxing and Palletizing Robot)

**What it represents:** A large 6-axis robot that picks packed boxes and stacks them on pallets.

**Visual requirements:**
- **Robot base pedestal**: a thick cylinder bolted to the floor (existing code is already good)
- **6-Axis arm chain**: base rotation plate (cylinder, yellow), upper arm (long box, yellow), elbow joint (cylinder, grey), forearm (shorter box, yellow), wrist (small cylinder), gripper (forked metal hand)
- **Hydraulic hoses**: 2-3 thin dark cylinders along the arm joints
- **Box being gripped**: a cardboard box held in the gripper hand
- **Wooden pallet + stacked boxes** on the floor beside the robot
- **Safety fence**: 4 corner posts (cylinders) connected by horizontal safety-yellow rails
- **Red light curtain emitters**: a pair of thin red emissive cylinders standing vertically at the fence entry gap

---

### 2.10 — `VCMesh` (Value Creation / Laser Engraving)

**What it represents:** A laser engraving machine that marks serial numbers, QR codes, or logos on products.

**Visual requirements:**
- **Enclosure box** with 4 side panels of carbonPanel material (existing code is correct)
- **Amber/orange safety glass front window** (existing `glassOrange` material is correct)
- **Internal laser scan head**: a rectangular box mounted on the ceiling of the enclosure, with a cylindrical lens barrel hanging downward
- **Red laser beam**: a very thin, tall Cyl of `signalRed` from scan head to the workpiece table
- **Fume extraction port**: a cylinder on the top of the enclosure, slightly offset, pointing upward
- **Control box**: a small panel on the side with a blue screen and indicator lights

---

### 2.11 — `PackMesh` (Automated Packaging / Shrink Wrapper)

**What it represents:** A machine that wraps finished products in plastic or cardboard.

**Visual requirements:**
- **Machine body**: large rectangular chassis (existing is fine)
- **Film roll system**: two horizontal cylinders at the back/top — one full roll (larger radius), one depleted (smaller radius), both on metal spindle cylinders
- **Input conveyor deck**: a shorter conveyor section entering the machine from the left, with rollers (cylinders rotated on their side axis)
- **Output conveyor deck**: same on the right, with a wrapped box sitting on it (SmartBox with a thin transparent outer layer)
- **HMI touchscreen console**: the existing `ComputerMonitor` helper is perfect here — place it on an arm on the machine side

---

### 2.12 — `ASRSMesh` (Automated Storage & Retrieval System Racking)

**What it represents:** A tall, dense warehouse racking system that a robotic crane navigates to fetch bins.

**Visual requirements:**
- **4 corner vertical columns** (tall thin boxes), with **diagonal cross-brace cylinders** between them
- **5 horizontal shelf levels**: each shelf is two thin flat beams running front-to-back (left and right sides), with bins placed on them. Use alternating blue/yellow bins with status LEDs (tiny green/red spheres per bin)
- **Crane mast**: a single tall vertical cylinder running up the center aisle
- **Crane carriage**: a small box that slides up and down the mast (animate using `useFrame` + `useRef` — existing `LiftMesh` animation code is a good reference)
- **Telescoping forks**: two thin horizontal boxes projecting from the carriage

---

### 2.13 — `ASRSPointMesh` (ASRS I/O Transfer Station)

**What it represents:** The conveyor station where the ASRS crane hands off pallets to the main conveyor.

**Visual requirements:**
- **Speed roller conveyor**: existing code is already good — keep the rollers (multiple Cyl in a row)
- **Scanner arch**: two vertical cylinder pillars, with a horizontal cross-bar connecting them at the top
- **Downward scanner lasers**: 3-4 thin red emissive cylinders hanging vertically from the cross-bar, pointing down
- **2 camera modules**: small grey boxes mounted on the arch with a tiny blue lens circle
- **Status display panel**: the existing code has a small box with a cyan emissive strip — make it slightly bigger and more visible

---

### 2.14 — `LiftMesh` (Vertical Lift / VRC)

**What it represents:** A vertical reciprocating conveyor that moves pallets between floors.

**Visual requirements:**
- **4 corner guide rail columns** (tall thin boxes running the full shaft height)
- **Gear rack details**: small rectangular teeth boxes spaced every 0.5 units along one rail
- **Motor box at the top**: a rectangular enclosure with 2 cable drum cylinders (horizontal)
- **Wire ropes**: very thin dark cylinders running from the motor down to the platform
- **Moving platform** (already animated with `useFrame`):
  - Solid base plate
  - Rollers across the platform
  - Yellow safety toe-guard strips around the edges
  - Chain link side rails (thin wireframe boxes as side panels)

> The animation already works — don't remove the `useRef` and `useFrame` parts. Just make the platform itself look better.

---

### 2.15 — `RampMesh` (Inter-Floor Vehicle Ramp)

**What it represents:** A concrete ramp connecting two floor levels, used by forklifts and AGVs.

**Visual requirements:**
- **Concrete ramp slab**: a flat box rotated slightly on the X axis (about 12 degrees / 0.2 radians). Make it wide and long.
- **Under-structure steel trusses**: 3 cross-beam boxes running underneath the slab, perpendicular to its length
- **Dual guardrails**: two long thin boxes running the full ramp length on each side, painted `safetyYellow`
- **Vertical rail posts**: 5-6 cylinder posts at even intervals along each side
- **Step marker lights**: a pair of tiny emissiveOrange rectangles at each slab section edge — like runway lights

---

### 2.16 — `DispatchMesh` (Dispatch Dock / Outgoing Staging Area)

**What it represents:** A loading bay where finished goods trucks back in for final dispatch.

**Visual requirements:**
- **Concrete floor pad** with diagonal yellow/white safety chevron striping (alternating angled thin boxes)
- **Loading dock leveler**: a thick metal plate that hinges down to bridge the gap between floor and truck
- **Dock seal compression pads**: two tall black rectangular cushions flanking the door (left and right)
- **Overhead shutter door**: a slatted panel recessed into the back wall (same as DockMesh gate)
- **Red/green signal lights**: indicate if bay is occupied
- **Rubber dock bumpers**: two large rectangular yellow-black striped blocks projecting from the floor where the truck wheels stop

---

### 2.17 — `ExternalMesh` (Supplier / Customer Road)

**What it represents:** The external road connecting the factory sites to the outside world.

**Visual requirements:**
- **Dark asphalt road surface**: a wide flat dark box (keep existing)
- **Lane markings**: dashed yellow center line and white outer lane lines (keep existing)
- **Road curbs**: two narrow raised concrete strips along the long edges
- **Steel guardrail**: a horizontal bar on posts on one side (existing code is good)
- **Solar street lamp pole**: vertical cylinder + angled arm + lamp head box (existing code is good). Add a small **battery box** attached to the pole mid-height (small grey box) and a small **solar panel** on a tilt bracket (existing code has this — clean it up)

---

## Step 3 — Build the Asset Inspector UI

**File to create:** `src/components/AssetInspector.jsx`

This is a modal overlay that renders each machine model in isolation with studio lighting, so you can verify it looks correct before committing.

**What it must do:**
- Display as a full-screen overlay with a dark translucent background
- Left sidebar: title, dropdown to pick any of the 17 models, asset info card, camera preset buttons, auto-rotate toggle, reset camera button
- Right side: a Three.js `<Canvas>` with good studio lighting, a circular stage/platform, and the selected model rendered at center
- Read the initial model from the URL query string `?model=SMTMesh` if present (so the screenshot automation script can set it)

**Studio Lighting Setup inside the Canvas:**
```jsx
<ambientLight intensity={0.5} />
{/* Key light — bright, from front-right, casts shadows */}
<directionalLight position={[5, 8, 5]} intensity={1.8} castShadow />
{/* Cool fill light — from front-left */}
<directionalLight position={[-5, 5, 5]} intensity={0.6} color="#8ec5fc" />
{/* Warm rim light — from behind-left */}
<directionalLight position={[-5, 4, -5]} intensity={1.2} color="#ffeaa7" />
{/* Warm uplight — illuminates bottom faces */}
<directionalLight position={[0, -5, 0]} intensity={0.4} color="#ffd2fc" />
```

**The circular showroom stage:**
```jsx
<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
  <circleGeometry args={[2.5, 64]} />
  <meshStandardMaterial color="#141822" roughness={0.7} metalness={0.2} />
</mesh>
<gridHelper args={[6, 12, '#2563eb', '#1e293b']} />
```

**Camera presets:**
```jsx
// Front view
camera.position.set(0, 3, 6);
// Side view
camera.position.set(6, 3, 0);
// Top down
camera.position.set(0, 7, 0.01);
// Isometric (default)
camera.position.set(4, 4, 4);
// Then always: controls.target.set(0, 1, 0); controls.update();
```

**The MODELS array** in this file should list all 17 models like:
```jsx
const MODELS = [
  { id: 'SMTMesh', name: 'SMT Conveyor Line', component: SMTMesh, type: 'station_zone (SMT)', desc: '...' },
  // ... all 17
];
```

**URL query parameter handling** (so the automation script can control which model is shown):
```jsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const modelParam = params.get('model');
  if (modelParam) {
    const match = MODELS.find(m => m.id === modelParam);
    if (match) setSelectedModelId(match.id);
  }
}, []);
```

> **Important:** Add `gl={{ preserveDrawingBuffer: true }}` to the Canvas so Playwright can take screenshots of it.

---

## Step 4 — Wire the Inspector into App.jsx

**File to edit:** `src/App.jsx`

### 4.1 Add the import at the top
```jsx
import AssetInspector from './components/AssetInspector.jsx';
```

### 4.2 Add state variable (with the other `useState` declarations)
```jsx
const [showInspector, setShowInspector] = useState(false);
```

### 4.3 Check URL on load (add inside the existing `useEffect` section or add a new one)
```jsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('inspector') === 'true') {
    setShowInspector(true);
  }
}, []);
```

### 4.4 Mount the component (just before the closing `</div>` of `dashboard-container`)
```jsx
{showInspector && <AssetInspector onClose={() => setShowInspector(false)} />}
```

### 4.5 Add the button (inside the `viewport-controls` div, next to the `Edit Layout` button)
```jsx
<button
  className="btn-ctrl"
  onClick={() => setShowInspector(true)}
  style={{ display: 'flex', alignItems: 'center', gap: 5 }}
>
  <Boxes size={13} /> Model Gallery
</button>
```
> Add `Boxes` to the existing lucide-react import at the top of the file.

---

## Step 5 — Add Inspector CSS Styles

**File to edit:** `src/index.css`

Add these styles at the end of the file:

```css
/* ══════════════════════════════════════
   Asset Inspector Modal Overlay
══════════════════════════════════════ */

.inspector-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.2s ease;
}

.inspector-panel {
  background: rgba(18, 22, 32, 0.97);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  width: 100%;
  max-width: 1100px;
  height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(59, 130, 246, 0.15);
}

.inspector-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(15, 17, 21, 0.6);
}

.inspector-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.inspector-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  font-family: var(--font-heading);
  background: linear-gradient(135deg, #e2e8f0, #94a3b8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.inspector-subtitle {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--text-muted);
  font-family: monospace;
}

.inspector-close-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--danger);
  border-radius: 6px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.inspector-close-btn:hover {
  background: rgba(239, 68, 68, 0.25);
}

.inspector-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
}

.inspector-sidebar {
  width: 280px;
  flex-shrink: 0;
  padding: 16px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  background: rgba(13, 16, 24, 0.4);
}

.inspector-viewport {
  flex: 1;
  min-width: 0;
  padding: 12px;
}

.inspector-viewport canvas {
  border-radius: 8px;
}

.inspector-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.inspector-select {
  width: 100%;
  background: #1a1f2e;
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-family: var(--font-family);
}

.inspector-select:focus {
  outline: none;
  border-color: var(--primary);
}

.inspector-info-card {
  background: rgba(30, 36, 50, 0.6);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
}

.inspector-info-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}

.inspector-spec-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.spec-label {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.spec-val {
  font-size: 10px;
  color: var(--text-color);
  text-align: right;
}

.font-mono {
  font-family: monospace;
  color: var(--primary) !important;
}

.inspector-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 8px 0 0;
}

.inspector-section {
  display: flex;
  flex-direction: column;
}

.camera-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.row-align {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.checkbox-container {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label {
  font-size: 12px;
  color: var(--text-color);
  user-select: none;
}

.glow-icon {
  color: var(--primary);
  filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.5));
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
```

---

## Step 6 — Write the Screenshot Automation Script

**File to create:** `scratch_capture_models.js` (in the project root directory)

This Playwright script will:
1. Open the app in a headless browser.
2. Open the inspector for each model by visiting `http://localhost:5173/?inspector=true&model=<id>`.
3. Wait for the 3D canvas to fully render.
4. Take a screenshot.
5. Save it to the scratch directory.

```javascript
// scratch_capture_models.js
// Run with: node scratch_capture_models.js
// Requires the dev server to be running at http://localhost:5173

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';

const SCRATCH_DIR = '/home/shashwatsingh/.gemini/antigravity-cli/brain/e65ed2e0-5463-450d-b15d-0e5d773a26b6/scratch';

const MODELS = [
  'DockMesh',
  'BufferMesh',
  'InspectionMesh',
  'StoreMesh',
  'SMTMesh',
  'FCTMesh',
  'TRSSMesh',
  'Assembly1PMesh',
  'SFGPackMesh',
  'VCMesh',
  'PackMesh',
  'ASRSMesh',
  'ASRSPointMesh',
  'LiftMesh',
  'RampMesh',
  'DispatchMesh',
  'ExternalMesh',
];

(async () => {
  await mkdir(SCRATCH_DIR, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  
  for (const modelId of MODELS) {
    console.log(`Capturing ${modelId}...`);
    const page = await context.newPage();
    
    await page.goto(`http://localhost:5173/?inspector=true&model=${modelId}`, {
      waitUntil: 'networkidle',
    });
    
    // Wait for the canvas to appear and render (3D takes a moment)
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(2000); // Give the 3D scene time to settle
    
    const screenshotPath = path.join(SCRATCH_DIR, `model_${modelId}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
    });
    
    console.log(`  ✓ Saved to ${screenshotPath}`);
    await page.close();
  }
  
  await browser.close();
  console.log('\n✅ All 17 model screenshots captured!');
})();
```

**To run this script:**
```bash
# Make sure the dev server is running in another terminal (npm run dev)
# Then in a new terminal:
node scratch_capture_models.js
```

---

## Step 7 — Run Everything and Verify

### 7.1 — Build check (no compilation errors)
```bash
npm run build
```
If this fails, check the error message — it will tell you exactly which file and which line broke.

### 7.2 — Check in the browser
Open `http://localhost:5173` and verify:
- [ ] The "Model Gallery" button appears in the viewport header
- [ ] Clicking it opens the inspector overlay
- [ ] The dropdown shows all 17 models
- [ ] Each model renders correctly in the studio canvas
- [ ] Camera preset buttons (Front, Side, Top, Iso) work
- [ ] Auto-rotate checkbox works
- [ ] Pressing X closes the overlay
- [ ] The factory floor scene still looks correct (no regression)

### 7.3 — Capture screenshots
```bash
node scratch_capture_models.js
```
Check the scratch directory for 17 PNG files named `model_<ID>.png`.

### 7.4 — Run unit tests
```bash
npm test
```
All tests should still pass. We haven't touched any simulation logic, only visual components.

---

## Quality Checklist

Before submitting, verify each model against this checklist:

- [ ] **Readable at distance** — when the factory overview camera is pulled back, can you identify what the machine is?
- [ ] **Status lights** — every machine that operates should have at least one green/red/amber indicator
- [ ] **Materials are varied** — not everything should be `metalDark`. Mix in `metalLight`, `metalSteel`, `safetyYellow`, emissive colors.
- [ ] **No floating elements** — all parts should be attached to something (no boxes floating in the air with no logical connection)
- [ ] **Proportions are correct** — the machine should be roughly human-scale (1.8m tall people can walk past it)
- [ ] **No z-fighting** — if two surfaces overlap perfectly, one will flicker. Add a tiny offset (0.001) to avoid this.
- [ ] **Inspector shows it cleanly** — view the model in the Asset Inspector from all 4 camera presets and it should look great from all angles

---

## Common Mistakes to Avoid

| Mistake | Fix |
|---|---|
| Accidentally deleting the helper functions `Box`, `Cyl`, `Sph` at the top of the file | DON'T touch anything above the first `export function` — the helpers must stay |
| Forgetting to export the function | Every mesh function must start with `export function` |
| Changing `MESH_BY_TYPE` or `MESH_BY_ZONE` at the bottom | Only add new meshes here if you add new location types. Don't rename keys. |
| Building a model that only looks good from the front | Test from top, side, and isometric views |
| Using a material that doesn't exist in `MAT` | Only use keys that exist in `factoryMaterials.js` |
| Removing `useRef` and `useFrame` from `LiftMesh` | These power the animation — do not remove them |
| Creating a model taller than y=4 units | It will clip through the ceiling panels in the factory scene |
| Using `meshBasicMaterial` when you should use `meshStandardMaterial` | Basic material ignores lighting — always use `{...MAT.something}` spread for proper lighting response |
| Forgetting to add the `preserveDrawingBuffer` prop to the Inspector Canvas | Playwright screenshots will be blank without it |

---

## Summary — Files You Will Create or Modify

| Action | File | What Changes |
|---|---|---|
| **MODIFY** | `src/scene/MachineMeshes.jsx` | All 17 machine model functions upgraded with detailed geometry |
| **CREATE** | `src/components/AssetInspector.jsx` | New isolated model viewer component |
| **MODIFY** | `src/App.jsx` | Add import, state, button, and Inspector component mount |
| **MODIFY** | `src/index.css` | Add Inspector CSS styles |
| **CREATE** | `scratch_capture_models.js` | Playwright screenshot automation (root dir) |

---

*This document was written for the M800 Digital Twin project. If anything is unclear, look at the existing working code (e.g. `SMTMesh`, `ASRSMesh`) as reference implementations before writing new ones.*
