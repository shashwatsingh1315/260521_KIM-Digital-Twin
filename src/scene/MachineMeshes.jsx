import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MAT } from '../materials/factoryMaterials.js';

// ─── Shared Sub-Shapes (Helpers for Detailed Assemblies) ───────────────────

function Box({ pos = [0, 0, 0], size = [1, 1, 1], mat = MAT.metalDark, rot = [0, 0, 0] }) {
  return (
    <mesh position={pos} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

function Cyl({ pos = [0, 0, 0], r = 0.2, h = 1, seg = 8, mat = MAT.metalDark, rot = [0, 0, 0] }) {
  return (
    <mesh position={pos} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, h, seg]} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

function Sph({ pos = [0, 0, 0], r = 0.2, seg = 8, mat = MAT.metalDark }) {
  return (
    <mesh position={pos} castShadow>
      <sphereGeometry args={[r, seg, seg]} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

// Slatted wooden industrial pallet
function WoodPallet({ pos = [0, 0, 0] }) {
  return (
    <group position={pos}>
      {/* 3 Bottom runners */}
      <Box pos={[-0.45, 0.05, 0]} size={[0.08, 0.08, 1.0]} mat={MAT.woodPallet} />
      <Box pos={[0, 0.05, 0]} size={[0.08, 0.08, 1.0]} mat={MAT.woodPallet} />
      <Box pos={[0.45, 0.05, 0]} size={[0.08, 0.08, 1.0]} mat={MAT.woodPallet} />
      {/* 5 Top deck boards */}
      {[-0.4, -0.2, 0, 0.2, 0.4].map((z, idx) => (
        <Box key={idx} pos={[0, 0.11, z]} size={[1.0, 0.03, 0.12]} mat={MAT.woodPallet} />
      ))}
    </group>
  );
}

// Barcode-labeled smart shipping box with strap band
function SmartBox({ pos = [0, 0, 0], size = [0.8, 0.4, 0.6], mat = MAT.cardboardBox, statusColor = null }) {
  return (
    <group position={pos}>
      {/* Main box body */}
      <Box pos={[0, size[1] / 2, 0]} size={size} mat={mat} />
      {/* Barcode label decal */}
      <Box pos={[size[0] / 2 + 0.002, size[1] / 2, 0.1]} size={[0.001, size[1] / 2, 0.15]} mat={MAT.glowWhite} />
      {/* Securing strap */}
      <Box pos={[0, size[1] / 2, 0]} size={[size[0] + 0.005, size[1] + 0.005, 0.04]} mat={MAT.metalDark} />
      {/* Status LED tag if applicable */}
      {statusColor && (
        <mesh position={[-size[0] / 2 - 0.002, size[1] * 0.7, -0.1]}>
          <sphereGeometry args={[0.03, 6, 6]} />
          <meshBasicMaterial color={statusColor} />
        </mesh>
      )}
    </group>
  );
}

// Striped safety hazard bumper
function HazardBumper({ pos = [0, 0, 0], size = [2, 0.25, 0.15] }) {
  const width = size[0];
  const height = size[1];
  const depth = size[2];
  const stripeCount = 6;
  const stripeW = width / (stripeCount * 2);
  return (
    <group position={pos}>
      <Box pos={[0, 0, 0]} size={size} mat={MAT.metalDark} />
      {Array.from({ length: stripeCount }).map((_, i) => (
        <Box
          key={i}
          pos={[-width / 2 + (i * 2 + 0.5) * stripeW, 0, depth / 2 + 0.002]}
          size={[stripeW, height - 0.02, 0.005]}
          mat={MAT.safetyYellow}
        />
      ))}
    </group>
  );
}

// Flat-screen monitor with cyber-blue screen glow
function ComputerMonitor({ pos = [0, 0, 0], rot = [0, 0, 0], size = [0.7, 0.45] }) {
  return (
    <group position={pos} rotation={rot}>
      {/* Heavy base and stand */}
      <Box pos={[0, -size[1] / 2 - 0.1, -0.05]} size={[0.22, 0.02, 0.15]} mat={MAT.metalDark} />
      <Box pos={[0, -size[1] / 4, -0.05]} size={[0.05, size[1] / 2, 0.05]} mat={MAT.metalLight} />
      {/* Outer monitor frame bezel */}
      <Box pos={[0, 0, 0]} size={[size[0] + 0.04, size[1] + 0.04, 0.04]} mat={MAT.metalDark} />
      {/* Glowing screen display */}
      <Box pos={[0, 0, 0.015]} size={[size[0], size[1], 0.02]} mat={MAT.emissiveBlue} />
    </group>
  );
}

// 3-stack stack light tower (Red/Amber/Green status indicators)
function StackLight({ pos = [0, 0, 0], h = 1.8 }) {
  return (
    <group position={pos}>
      {/* Chrome post */}
      <Cyl pos={[0, h / 2 - 0.25, 0]} r={0.02} h={h - 0.5} mat={MAT.metalLight} />
      {/* Stack mounts */}
      <Cyl pos={[0, h - 0.45, 0]} r={0.06} h={0.08} mat={MAT.signalRed} />
      <Cyl pos={[0, h - 0.35, 0]} r={0.06} h={0.08} mat={MAT.signalAmber} />
      <Cyl pos={[0, h - 0.25, 0]} r={0.06} h={0.08} mat={MAT.signalGreen} />
      <Cyl pos={[0, h - 0.18, 0]} r={0.07} h={0.04} mat={MAT.metalLight} />
    </group>
  );
}

// ─── Dock ──────────────────────────────────────────────────────────────────
export function DockMesh() {
  return (
    <group>
      {/* Two tall concrete wall panels flanking the opening */}
      <Box pos={[-1.8, 1.2, -0.1]} size={[1.2, 2.4, 0.3]} mat={MAT.concrete} />
      <Box pos={[1.8, 1.2, -0.1]}  size={[1.2, 2.4, 0.3]} mat={MAT.concrete} />
      
      {/* Horizontal overhead concrete lintel */}
      <Box pos={[0, 2.55, -0.1]} size={[4.0, 0.3, 0.3]} mat={MAT.concrete} />

      {/* Heavy steel structural portal arch (keep existing frame) */}
      <Box pos={[-1.1, 1.4, 0]} size={[0.2, 2.8, 0.2]} mat={MAT.metalDark} />
      <Box pos={[1.1, 1.4, 0]}  size={[0.2, 2.8, 0.2]} mat={MAT.metalDark} />
      <Box pos={[0, 2.9, 0]}   size={[2.4, 0.2, 0.2]} mat={MAT.metalDark} />
      
      {/* Inset cyan guide strip lines */}
      <Box pos={[-1.18, 1.4, 0]} size={[0.02, 2.8, 0.22]} mat={MAT.emissiveCyan} />
      <Box pos={[1.18, 1.4, 0]}  size={[0.02, 2.8, 0.22]} mat={MAT.emissiveCyan} />
      
      {/* Rolling slatted industrial shutter gate */}
      <Box pos={[0, 1.6, -0.05]} size={[2.0, 2.4, 0.05]} mat={MAT.metalSteel} />
      {/* Gate rib lines */}
      {[0.6, 1.0, 1.4, 1.8, 2.2].map((y, idx) => (
        <Box key={idx} pos={[0, y, -0.02]} size={[2.0, 0.04, 0.02]} mat={MAT.metalDark} />
      ))}
      
      {/* Striped hazard bumper */}
      <HazardBumper pos={[0, 0.1, 0.65]} size={[2.2, 0.2, 0.15]} />

      {/* Red/Green status indicator on the right column */}
      <Cyl pos={[1.6, 2.3, 0.1]} r={0.06} h={0.08} rot={[Math.PI / 2, 0, 0]} mat={MAT.signalRed} />
      <Cyl pos={[1.6, 2.1, 0.1]} r={0.06} h={0.08} rot={[Math.PI / 2, 0, 0]} mat={MAT.signalGreen} />
    </group>
  );
}

// ─── Buffer / Pallet Stack ─────────────────────────────────────────────────
export function BufferMesh({ fillRatio = 0.5 }) {
  const stackHeight = Math.max(1, Math.round(fillRatio * 3));
  return (
    <group>
      {/* Slatted wooden base pallet */}
      <WoodPallet pos={[0, 0, 0]} />
      
      {/* Smart boxes stacked based on fill ratio */}
      {Array.from({ length: stackHeight }).map((_, i) => {
        // Color shifts and small tag glow
        const offsetZ = (i % 2 === 0) ? 0.03 : -0.03;
        const color = i === 2 ? '#3b82f6' : '#b45309'; // Cardboard brown with blue bins
        const status = i === 2 ? '#10b981' : null;
        return (
          <group key={i} position={[0, 0.14 + i * 0.38, offsetZ]}>
            <SmartBox
              size={[0.9, 0.35, 0.75]}
              mat={i === 2 ? MAT.plasticBlue : MAT.cardboardBox}
              statusColor={status}
            />
          </group>
        );
      })}

      {/* Semi-transparent protective wrapping film enclosing the stack */}
      {stackHeight > 0 && (
        <Box 
          pos={[0, 0.14 + (stackHeight * 0.38) / 2, 0]} 
          size={[1.05, stackHeight * 0.38 + 0.05, 0.88]} 
          mat={MAT.wrapFilm} 
        />
      )}
      
      {/* Digital quantity counter display */}
      <Cyl pos={[0.6, 0.4, 0.4]} r={0.02} h={0.8} mat={MAT.metalLight} />
      <Box pos={[0.6, 0.85, 0.4]} size={[0.15, 0.1, 0.05]} mat={MAT.metalDark} />
      <Box pos={[0.6, 0.85, 0.43]} size={[0.12, 0.08, 0.01]} mat={MAT.emissiveBlue} />
    </group>
  );
}

// ─── Inspection Area / IQC / FAT ──────────────────────────────────────────
export function InspectionMesh() {
  return (
    <group>
      {/* Ergonomic steel worktable structure */}
      <Box pos={[0, 0.02, 0]} size={[2.0, 0.04, 1.0]} mat={MAT.metalDark} />
      {[[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].map(([x, z], i) => (
        <Cyl key={i} pos={[x, 0.42, z]} r={0.04} h={0.8} mat={MAT.metalSteel} />
      ))}
      {/* Countertop with glass overlay */}
      <Box pos={[0, 0.82, 0]} size={[2.0, 0.06, 1.0]} mat={MAT.metalLight} />
      <Box pos={[0, 0.86, 0]} size={[1.96, 0.02, 0.96]} mat={MAT.glass} />
      
      {/* Integrated oscilloscope/testing module */}
      <Box pos={[-0.5, 1.0, -0.15]} size={[0.5, 0.25, 0.35]} mat={MAT.metalDark} />
      {/* Glowing green diagnostic screen */}
      <Box pos={[-0.5, 1.0, 0.03]} size={[0.35, 0.18, 0.02]} mat={MAT.emissiveCyan} />
      {/* Probe cables */}
      <Cyl pos={[-0.3, 0.9, 0.1]} r={0.01} h={0.2} mat={MAT.safetyYellow} rot={[0.5, 0.2, 0.5]} />
      
      {/* Flat screen display panel */}
      <ComputerMonitor pos={[0.4, 1.15, -0.2]} rot={[0.12, -0.15, 0]} />
      
      {/* Stereo microscope */}
      <group position={[-0.1, 0.95, 0.1]}>
        <Cyl pos={[0, 0, 0]} r={0.1} h={0.02} mat={MAT.metalDark} />
        <Cyl pos={[0, 0.1, 0]} r={0.02} h={0.2} mat={MAT.metalLight} />
        <Box pos={[0, 0.2, 0.05]} size={[0.08, 0.08, 0.15]} mat={MAT.metalDark} />
        <Cyl pos={[0, 0.15, 0.1]} r={0.02} h={0.08} rot={[Math.PI / 4, 0, 0]} mat={MAT.metalSteel} />
      </group>

      {/* Double overhead LED illuminator rig */}
      <Box pos={[-0.8, 1.4, -0.4]} size={[0.04, 1.2, 0.04]} mat={MAT.metalSteel} />
      <Box pos={[0.8, 1.4, -0.4]}  size={[0.04, 1.2, 0.04]} mat={MAT.metalSteel} />
      <Box pos={[0, 2.0, -0.2]} size={[1.8, 0.05, 0.3]} mat={MAT.metalLight} />
      <Box pos={[0, 1.97, -0.2]} size={[1.76, 0.02, 0.26]} mat={MAT.glowWhite} />
    </group>
  );
}

// ─── Electronic Store / Shelving ──────────────────────────────────────────
export function StoreMesh() {
  return (
    <group>
      {/* Heavy-duty steel shelving rack structure */}
      <Box pos={[-1.0, 1.3, -0.35]} size={[0.08, 2.6, 0.7]} mat={MAT.metalDark} />
      <Box pos={[1.0, 1.3, -0.35]}  size={[0.08, 2.6, 0.7]} mat={MAT.metalDark} />
      
      {/* Diagonal rear cross-bracing */}
      <Cyl pos={[0, 1.3, -0.68]} r={0.015} h={2.7} rot={[0, 0, 0.65]} mat={MAT.metalSteel} />
      <Cyl pos={[0, 1.3, -0.68]} r={0.015} h={2.7} rot={[0, 0, -0.65]} mat={MAT.metalSteel} />
      
      {/* Rear panel: a wire mesh or pegboard */}
      <Box pos={[0, 1.3, -0.68]} size={[1.9, 2.6, 0.02]} mat={{ ...MAT.metalSteel, wireframe: true }} />
      
      {/* Shelf levels */}
      {[0.4, 1.0, 1.6, 2.2].map((y, i) => (
        <group key={i}>
          <Box pos={[0, y, -0.35]} size={[1.92, 0.04, 0.68]} mat={MAT.metalLight} />
        </group>
      ))}
      
      {/* Colored industrial crates organized on shelves */}
      {/* Shelf 1 crates */}
      <Box pos={[-0.6, 0.6, -0.35]} size={[0.45, 0.32, 0.55]} mat={MAT.plasticBlue} />
      <Sph pos={[-0.6, 0.45, -0.05]} r={0.02} mat={MAT.signalGreen} /> {/* Pick-to-light LED */}
      <Box pos={[0.0, 0.6, -0.35]}  size={[0.45, 0.32, 0.55]} mat={MAT.plasticYellow} />
      <Sph pos={[0.0, 0.45, -0.05]} r={0.02} mat={MAT.signalGreen} />
      <Box pos={[0.6, 0.6, -0.35]}  size={[0.45, 0.32, 0.55]} mat={MAT.plasticBlue} />
      <Sph pos={[0.6, 0.45, -0.05]} r={0.02} mat={MAT.signalGreen} />
      
      {/* Shelf 2 crates */}
      <Box pos={[-0.3, 1.2, -0.35]} size={[0.55, 0.32, 0.55]} mat={MAT.plasticYellow} />
      <Sph pos={[-0.3, 1.05, -0.05]} r={0.02} mat={MAT.signalGreen} />
      <Box pos={[0.3, 1.2, -0.35]}  size={[0.55, 0.32, 0.55]} mat={MAT.plasticBlue} />
      <Sph pos={[0.3, 1.05, -0.05]} r={0.02} mat={MAT.signalGreen} />
      
      {/* Shelf 3 items (Cardboard boxes and SMD reels) */}
      <Box pos={[-0.6, 1.8, -0.35]} size={[0.4, 0.3, 0.5]} mat={MAT.cardboardBox} />
      <Cyl pos={[0.0, 1.75, -0.35]} r={0.15} h={0.08} rot={[Math.PI / 2, 0, 0]} mat={MAT.metalLight} /> {/* SMD Reel */}
      <Cyl pos={[0.2, 1.75, -0.35]} r={0.15} h={0.08} rot={[Math.PI / 2, 0, 0]} mat={MAT.metalLight} /> {/* SMD Reel */}
      <Box pos={[0.6, 1.8, -0.35]}  size={[0.4, 0.3, 0.5]} mat={MAT.cardboardBox} />
    </group>
  );
}

// ─── SMT Line ──────────────────────────────────────────────────────────────
export function SMTMesh() {
  return (
    <group>
      {/* Machine chassis enclosure base */}
      <Box pos={[0, 0.3, 0]} size={[2.8, 0.6, 1.0]} mat={MAT.metalDark} />
      <Box pos={[0, 0.62, 0]} size={[2.74, 0.04, 0.94]} mat={MAT.carbonPanel} />
      
      {/* Dual conveyor track rails */}
      <Box pos={[0, 0.68, -0.38]} size={[2.8, 0.06, 0.04]} mat={MAT.metalLight} />
      <Box pos={[0, 0.68, 0.38]}  size={[2.8, 0.06, 0.04]} mat={MAT.metalLight} />
      
      {/* Work-in-progress PCB boards on track */}
      {[[-0.9, 0.71, 0], [0.9, 0.71, 0]].map(([x, y, z], idx) => (
        <group key={idx} position={[x, y, z]}>
          <Box pos={[0, 0.01, 0]} size={[0.55, 0.02, 0.68]} mat={MAT.pcbGreen} />
          {/* Silicon chips on PCB */}
          <Box pos={[-0.15, 0.03, -0.1]} size={[0.12, 0.03, 0.12]} mat={MAT.siliconChip} />
          <Box pos={[0.1, 0.03, 0.15]}   size={[0.16, 0.03, 0.16]} mat={MAT.siliconChip} />
          {/* Gold pins */}
          <Box pos={[0.12, 0.02, -0.15]} size={[0.18, 0.01, 0.08]} mat={MAT.goldContacts} />
        </group>
      ))}
      
      {/* Modern reflow oven central heating tunnel */}
      <group position={[0, 0.66, 0]}>
        {/* Chamfered outer frame */}
        <Box pos={[0, 0.45, 0]} size={[1.3, 0.8, 0.98]} mat={MAT.metalLight} />
        {/* Viewing safety glass window */}
        <Box pos={[0, 0.45, 0.5]} size={[0.9, 0.4, 0.02]} mat={MAT.glass} />
        {/* Internal orange heat element glow */}
        <Box pos={[0, 0.45, 0]} size={[0.86, 0.36, 0.86]} mat={MAT.emissiveOrange} />
      </group>
      
      {/* Feeder banks */}
      <group position={[-0.9, 0.45, 0.55]}>
        {Array.from({ length: 5 }).map((_, i) => (
          <group key={i} position={[i * 0.18, 0, 0]}>
            <Box pos={[0, 0, 0]} size={[0.15, 0.3, 0.2]} mat={MAT.metalDark} />
            <Cyl pos={[0, 0.15, 0.1]} r={0.06} h={0.14} rot={[0, 0, Math.PI / 2]} mat={MAT.metalLight} />
          </group>
        ))}
      </group>

      {/* Status indicator tower */}
      <StackLight pos={[1.1, 0.64, -0.38]} h={1.6} />
    </group>
  );
}

// ─── FCT Station ───────────────────────────────────────────────────────────
export function FCTMesh() {
  return (
    <group>
      {/* Operator testing console chassis */}
      <Box pos={[0, 0.4, 0]} size={[1.9, 0.8, 0.8]} mat={MAT.metalDark} />
      
      {/* Console keyboard tray shelf */}
      <Box pos={[-0.4, 0.82, 0.22]} size={[0.9, 0.04, 0.32]} mat={MAT.metalLight} />
      <Box pos={[-0.4, 0.85, 0.22]} size={[0.8, 0.02, 0.2]} mat={MAT.carbonPanel} />
      
      {/* Dual monitor setup */}
      <ComputerMonitor pos={[-0.4, 1.15, -0.15]} rot={[0.1, 0.15, 0]} size={[0.7, 0.45]} />
      <ComputerMonitor pos={[0.38, 1.15, -0.2]} rot={[0.12, -0.22, 0]} size={[0.55, 0.38]} />
      
      {/* ICT automated fixture bed */}
      <group position={[0.4, 0.82, 0.15]}>
        <Box pos={[0, 0.05, 0]} size={[0.65, 0.1, 0.45]} mat={MAT.metalSteel} />
        {/* Test pin matrix (golden contacts) */}
        <Box pos={[0, 0.11, 0]} size={[0.55, 0.02, 0.35]} mat={MAT.goldContacts} />
        
        {/* Pneumatic lid that closes down */}
        <Box pos={[0, 0.25, 0]} size={[0.65, 0.08, 0.45]} mat={MAT.metalLight} />
        
        {/* Robot probe arms */}
        <Cyl pos={[-0.22, 0.3, 0]} r={0.025} h={0.4} mat={MAT.metalLight} />
        <Box pos={[-0.1, 0.5, 0]} size={[0.26, 0.03, 0.03]} mat={MAT.metalLight} />
        <Cyl pos={[-0.02, 0.35, 0]} r={0.008} h={0.3} mat={MAT.emissiveCyan} /> {/* cyan laser probe */}
        
        <Cyl pos={[0.22, 0.3, 0]} r={0.025} h={0.4} mat={MAT.metalLight} />
        <Box pos={[0.1, 0.5, 0]} size={[0.26, 0.03, 0.03]} mat={MAT.metalLight} />
        <Cyl pos={[0.02, 0.35, 0]} r={0.008} h={0.3} mat={MAT.emissiveCyan} />
      </group>
    </group>
  );
}

// ─── TRSS Assembly Area ────────────────────────────────────────────────────
export function TRSSMesh() {
  return (
    <group>
      {/* Assembly table frame and ESD workspace */}
      <Box pos={[0, 0.38, 0]} size={[2.4, 0.76, 1.1]} mat={MAT.metalDark} />
      <Box pos={[0, 0.78, 0]} size={[2.34, 0.04, 1.04]} mat={MAT.pcbGreen} /> {/* ESD Green Mat */}
      
      {/* Small component organizer bins on back ledge */}
      {[-0.8, -0.4, 0, 0.4, 0.8].map((x, idx) => (
        <group key={idx} position={[x, 0.88, -0.42]}>
          <Box pos={[0, 0.08, 0]} size={[0.26, 0.16, 0.18]} mat={idx % 2 === 0 ? MAT.plasticBlue : MAT.plasticYellow} />
        </group>
      ))}
      
      {/* Rear upright tool-hanging panel */}
      <Box pos={[0, 1.4, -0.52]} size={[2.3, 0.8, 0.04]} mat={MAT.metalLight} />
      <Box pos={[0, 1.4, -0.5]}  size={[2.22, 0.74, 0.01]} mat={{ ...MAT.metalSteel, wireframe: true }} />
      
      {/* Detailed workpiece fixture under assembly */}
      <group position={[0, 0.88, 0.05]}>
        <Box pos={[0, 0.02, 0]} size={[0.7, 0.04, 0.5]} mat={MAT.metalLight} />
        <Box pos={[0, 0.05, 0]} size={[0.55, 0.03, 0.4]} mat={MAT.siliconChip} />
        <Cyl pos={[-0.1, 0.08, -0.05]} r={0.06} h={0.08} mat={MAT.metalSteel} />
        <Cyl pos={[0.15, 0.08, 0.08]}  r={0.04} h={0.08} mat={MAT.goldContacts} />
      </group>
      
      {/* Swing-arm magnifier lamp */}
      <Cyl pos={[-0.9, 0.8, 0.2]} r={0.02} h={0.6} mat={MAT.metalLight} />
      <Box pos={[-0.6, 1.1, 0.2]} size={[0.6, 0.03, 0.03]} mat={MAT.metalLight} />
      <Cyl pos={[-0.3, 1.1, 0.2]} r={0.08} h={0.04} rot={[Math.PI / 2, 0, 0]} mat={MAT.metalDark} />
      {/* Magnifier lens housing glow ring */}
      <mesh position={[-0.3, 1.09, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.06, 0.08, 16]} />
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
      
      {/* Soldering iron holder */}
      <group position={[0.7, 0.88, 0.2]}>
        <Box pos={[0, 0.05, 0]} size={[0.1, 0.1, 0.1]} mat={MAT.plasticBlue} />
        <Cyl pos={[0.05, 0.1, 0]} r={0.015} h={0.2} rot={[0, 0, -Math.PI / 4]} mat={MAT.metalSteel} />
      </group>
    </group>
  );
}

// ─── 1P Assembly + Conveyor ───────────────────────────────────────────────
export function Assembly1PMesh() {
  return (
    <group>
      {/* Heavy conveyor run bed */}
      <Box pos={[0, 0.1, 0]} size={[3.0, 0.2, 0.6]} mat={MAT.metalDark} />
      <Box pos={[0, 0.22, 0]} size={[2.96, 0.04, 0.54]} mat={MAT.metalSteel} />
      
      {/* Guide protection rails */}
      <Box pos={[0, 0.28, -0.28]} size={[3.0, 0.12, 0.03]} mat={MAT.safetyYellow} />
      <Box pos={[0, 0.28, 0.28]}  size={[3.0, 0.12, 0.03]} mat={MAT.safetyYellow} />
      
      {/* Conveyor rollers */}
      {Array.from({ length: 12 }).map((_, i) => (
        <Cyl
          key={i}
          pos={[-1.35 + i * 0.245, 0.22, 0]}
          r={0.015}
          h={0.52}
          rot={[Math.PI / 2, 0, 0]}
          mat={MAT.metalSteel}
        />
      ))}
      
      {/* SPM Enclosed Assembly Cabinet */}
      <group position={[0, 0.24, 0]}>
        {/* Structural enclosure frames */}
        <Box pos={[-0.6, 0.7, -0.32]} size={[0.08, 1.4, 0.08]} mat={MAT.metalDark} />
        <Box pos={[0.6, 0.7, -0.32]}  size={[0.08, 1.4, 0.08]} mat={MAT.metalDark} />
        <Box pos={[-0.6, 0.7, 0.32]}  size={[0.08, 1.4, 0.08]} mat={MAT.metalDark} />
        <Box pos={[0.6, 0.7, 0.32]}   size={[0.08, 1.4, 0.08]} mat={MAT.metalDark} />
        
        {/* Roof enclosure top */}
        <Box pos={[0, 1.42, 0]} size={[1.36, 0.06, 0.72]} mat={MAT.metalLight} />
        
        {/* Safety Glass shield panels */}
        <Box pos={[-0.6, 0.7, 0]} size={[0.02, 1.34, 0.62]} mat={MAT.glass} />
        <Box pos={[0.6, 0.7, 0]}  size={[0.02, 1.34, 0.62]} mat={MAT.glass} />
        <Box pos={[0, 0.7, 0.32]} size={[1.12, 1.34, 0.02]} mat={MAT.glass} /> {/* Front glass */}
        
        {/* Warning yellow door handle on the front glass panel */}
        <Box pos={[0, 0.7, 0.34]} size={[0.15, 0.04, 0.04]} mat={MAT.safetyYellow} />

        {/* Green glowing interior light visible through the glass */}
        <pointLight position={[0, 1.2, 0]} intensity={2.0} color="#059669" distance={3} />
        <Box pos={[0, 1.38, 0]} size={[0.4, 0.02, 0.4]} mat={MAT.signalGreen} />

        {/* 3-axis Pick & Place robotic head inside */}
        <Box pos={[0, 1.3, 0]} size={[1.1, 0.04, 0.04]} mat={MAT.metalSteel} />
        <Box pos={[-0.1, 1.15, 0]} size={[0.06, 0.3, 0.06]} mat={MAT.metalLight} />
        <Cyl pos={[-0.1, 0.9, 0]} r={0.012} h={0.25} mat={MAT.goldContacts} />
      </group>
      
      {/* Alert signal beacon */}
      <StackLight pos={[0.5, 1.66, 0.28]} h={1.0} />
    </group>
  );
}

// ─── SFG Boxing / Palletizing ──────────────────────────────────────────────
export function SFGPackMesh() {
  return (
    <group>
      {/* Heavy steel floor robot base pedestal */}
      <Cyl pos={[-0.4, 0.22, 0]} r={0.3} h={0.44} mat={MAT.metalDark} />
      <Cyl pos={[-0.4, 0.44, 0]} r={0.24} h={0.08} mat={MAT.metalLight} />
      
      {/* Industrial Articulated 6-Axis Robot Arm */}
      <group position={[-0.4, 0.48, 0]}>
        {/* Base rotating plate */}
        <Cyl pos={[0, 0.04, 0]} r={0.2} h={0.08} mat={MAT.safetyYellow} />
        {/* Arm link 1 (lower arm) angled */}
        <Box pos={[0.1, 0.38, 0]} size={[0.12, 0.7, 0.16]} rot={[0, 0, -0.45]} mat={MAT.safetyYellow} />
        {/* Elbow pivot joint */}
        <Cyl pos={[0.26, 0.68, 0]} r={0.09} h={0.18} rot={[Math.PI / 2, 0, 0]} mat={MAT.metalLight} />
        {/* Arm link 2 (upper arm) angled back */}
        <Box pos={[0.42, 0.85, 0]} size={[0.08, 0.52, 0.1]} rot={[0, 0, 0.55]} mat={MAT.safetyYellow} />
        {/* Wrist joint assembly */}
        <Cyl pos={[0.58, 1.05, 0]} r={0.05} h={0.12} rot={[0, 0, 1.2]} mat={MAT.metalLight} />
        {/* Parallel claw gripper */}
        <Box pos={[0.7, 1.1, 0]} size={[0.18, 0.04, 0.16]} rot={[0, 0, 0.2]} mat={MAT.metalDark} />
        {/* Box being gripped */}
        <group position={[0.82, 1.05, 0]} rotation={[0, 0, 0.2]}>
          <SmartBox size={[0.45, 0.3, 0.4]} mat={MAT.cardboardBox} />
        </group>

        {/* Hydraulic hoses */}
        <Cyl pos={[0.08, 0.4, 0.1]} r={0.01} h={0.65} rot={[0, 0, -0.45]} mat={MAT.metalDark} />
        <Cyl pos={[0.4, 0.88, 0.1]} r={0.01} h={0.45} rot={[0, 0, 0.55]} mat={MAT.metalDark} />
      </group>
      
      {/* Loading floor target wooden pallet */}
      <WoodPallet pos={[0.65, 0, 0]} />
      {/* Cardboard boxes stacked on floor pallet */}
      <group position={[0.65, 0.14, 0.05]}>
        <SmartBox size={[0.5, 0.3, 0.42]} mat={MAT.cardboardBox} />
      </group>
      <group position={[0.65, 0.44, -0.05]}>
        <SmartBox size={[0.5, 0.3, 0.42]} mat={MAT.cardboardBox} />
      </group>
      
      {/* Outer steel safety perimeter barrier fences */}
      {[[-1.2, -0.8], [-1.2, 0.8], [1.3, -0.8], [1.3, 0.8]].map(([x, z], idx) => (
        <group key={idx}>
          <Cyl pos={[x, 0.5, z]} r={0.025} h={1.0} mat={MAT.metalSteel} />
          {/* Horizontal safety rails */}
          <Box pos={[x, 0.9, z * 0.5]} size={[0.02, 0.02, 1.2]} mat={MAT.safetyYellow} rot={[0, z < 0 ? 0.3 : -0.3, 0]} />
          <Box pos={[x, 0.4, z * 0.5]} size={[0.02, 0.02, 1.2]} mat={MAT.safetyYellow} rot={[0, z < 0 ? 0.3 : -0.3, 0]} />
        </group>
      ))}

      {/* Red light curtain emitters at the fence entry gap */}
      <Cyl pos={[1.3, 0.5, -0.3]} r={0.015} h={1.0} mat={MAT.signalRed} />
      <Cyl pos={[1.3, 0.5, 0.3]} r={0.015} h={1.0} mat={MAT.signalRed} />
    </group>
  );
}

// ─── Value Creation / Laser Area ───────────────────────────────────────────
export function VCMesh() {
  return (
    <group>
      {/* Heavy structural enclosure base */}
      <Box pos={[0, 0.02, 0]} size={[1.4, 0.04, 1.3]} mat={MAT.metalDark} />
      
      {/* Dark premium carbon fiber enclosure panels */}
      <Box pos={[-0.67, 1.0, 0]} size={[0.03, 1.96, 1.26]} mat={MAT.carbonPanel} />
      <Box pos={[0.67, 1.0, 0]}  size={[0.03, 1.96, 1.26]} mat={MAT.carbonPanel} />
      <Box pos={[0, 1.0, -0.63]} size={[1.34, 1.96, 0.03]} mat={MAT.carbonPanel} />
      {/* Top filter housing roof */}
      <Box pos={[0, 1.98, 0]}   size={[1.36, 0.04, 1.28]} mat={MAT.metalLight} />
      
      {/* High-tech orange laser viewing safety window */}
      <Box pos={[0, 1.0, 0.62]} size={[1.2, 1.4, 0.02]} mat={MAT.glassOrange} />
      {/* Window heavy metal bezel */}
      <Box pos={[0, 1.7, 0.63]} size={[1.24, 0.08, 0.04]} mat={MAT.metalDark} />
      <Box pos={[0, 0.3, 0.63]} size={[1.24, 0.08, 0.04]} mat={MAT.metalDark} />
      <Box pos={[-0.6, 1.0, 0.63]} size={[0.08, 1.4, 0.04]} mat={MAT.metalDark} />
      <Box pos={[0.6, 1.0, 0.63]}  size={[0.08, 1.4, 0.04]} mat={MAT.metalDark} />
      
      {/* Internal laser marker generator module */}
      <group position={[0, 0.04, 0]}>
        {/* Support columns */}
        <Box pos={[0, 1.6, 0]} size={[0.3, 0.4, 0.3]} mat={MAT.metalLight} />
        {/* Laser focal lens barrel */}
        <Cyl pos={[0, 1.3, 0]} r={0.08} h={0.25} mat={MAT.metalSteel} />
        <Cyl pos={[0, 1.18, 0]} r={0.06} h={0.04} mat={MAT.goldContacts} />
        
        {/* Bright pulsing neon red laser beam */}
        <Cyl pos={[0, 0.6, 0]} r={0.008} h={1.12} mat={MAT.signalRed} />
        
        {/* Laser strike bright target spark */}
        <mesh position={[0, 0.05, 0]}>
          <ringGeometry args={[0.01, 0.12, 16]} />
          <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.051, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        
        {/* Laser workpiece target table */}
        <Cyl pos={[0, 0.02, 0]} r={0.35} h={0.04} mat={MAT.metalDark} />
        <Box pos={[0, 0.05, 0]} size={[0.2, 0.02, 0.2]} mat={MAT.metalSteel} />
      </group>

      {/* Fume extraction port */}
      <Cyl pos={[0.4, 2.1, -0.4]} r={0.08} h={0.24} mat={MAT.metalLight} />

      {/* Control box on the side */}
      <group position={[0.7, 1.2, 0.3]}>
        <Box pos={[0, 0, 0]} size={[0.08, 0.4, 0.3]} mat={MAT.metalDark} />
        <Box pos={[0.05, 0.05, 0]} size={[0.02, 0.2, 0.2]} mat={MAT.emissiveBlue} />
        <Sph pos={[0.05, 0.15, -0.08]} r={0.015} mat={MAT.signalGreen} />
        <Sph pos={[0.05, 0.15, 0.08]} r={0.015} mat={MAT.signalRed} />
      </group>
    </group>
  );
}

// ─── Automated Packaging ───────────────────────────────────────────────────
export function PackMesh() {
  return (
    <group>
      {/* Machine main body casing with detailing panel lines */}
      <Box pos={[0, 0.6, 0]} size={[1.8, 1.2, 0.9]} mat={MAT.metalDark} />
      <Box pos={[0.4, 0.6, 0.46]} size={[0.6, 0.8, 0.02]} mat={MAT.carbonPanel} />
      
      {/* Double wrapping film feed system rollers */}
      {/* Film roll 1 */}
      <group position={[-0.4, 1.4, -0.2]}>
        <Cyl pos={[0, 0, 0]} r={0.16} h={0.6} mat={MAT.wrapFilm} />
        <Cyl pos={[0, 0, 0]} r={0.02} h={0.68} mat={MAT.metalLight} />
      </group>
      {/* Film roll 2 */}
      <group position={[-0.4, 1.4, 0.2]}>
        <Cyl pos={[0, 0, 0]} r={0.12} h={0.6} mat={MAT.wrapFilm} />
        <Cyl pos={[0, 0, 0]} r={0.02} h={0.68} mat={MAT.metalLight} />
      </group>
      
      {/* Input feed conveyor deck */}
      <group position={[-1.2, 0.1, 0]}>
        <Box pos={[0, 0, 0]} size={[0.7, 0.15, 0.62]} mat={MAT.metalSteel} />
        {/* Conveyor rollers */}
        {Array.from({ length: 4 }).map((_, i) => (
          <Cyl key={`in-${i}`} pos={[-0.25 + i * 0.16, 0.08, 0]} r={0.02} h={0.6} rot={[Math.PI / 2, 0, 0]} mat={MAT.metalLight} />
        ))}
      </group>
      
      {/* Output exit conveyor deck */}
      <group position={[1.2, 0.1, 0]}>
        <Box pos={[0, 0, 0]} size={[0.7, 0.15, 0.62]} mat={MAT.metalSteel} />
        {/* Conveyor rollers */}
        {Array.from({ length: 4 }).map((_, i) => (
          <Cyl key={`out-${i}`} pos={[-0.25 + i * 0.16, 0.08, 0]} r={0.02} h={0.6} rot={[Math.PI / 2, 0, 0]} mat={MAT.metalLight} />
        ))}
        {/* Output packaged box on exit deck */}
        <group position={[0.0, 0.16, 0]}>
          <SmartBox size={[0.42, 0.22, 0.32]} mat={MAT.cardboardBox} />
          <Box pos={[0, 0.11, 0]} size={[0.44, 0.24, 0.34]} mat={MAT.wrapFilm} />
        </group>
      </group>
      
      {/* Modern touch screen HMI console panel */}
      <ComputerMonitor pos={[0.6, 1.4, 0.3]} rot={[0.15, -0.3, 0]} size={[0.48, 0.32]} />
      
      {/* Integrated system status light tower */}
      <StackLight pos={[0.75, 1.22, -0.32]} h={1.2} />
    </group>
  );
}

// ─── ASRS Racking ──────────────────────────────────────────────────────────
export function ASRSMesh() {
  const carriageRef = useRef();
  
  useFrame(({ clock }) => {
    if (carriageRef.current) {
      carriageRef.current.position.y = 1.3 + Math.sin(clock.elapsedTime * 1.5) * 0.8;
    }
  });

  return (
    <group>
      {/* Heavy vertical structural truss pillars */}
      {[[-1.4, -0.35], [-1.4, 0.35], [1.4, -0.35], [1.4, 0.35]].map(([x, z], i) => (
        <group key={i}>
          <Box pos={[x, 1.3, z]} size={[0.08, 2.6, 0.08]} mat={MAT.metalDark} />
          {/* Diagonal lattice struts */}
          <Cyl pos={[x, 1.3, z]} r={0.012} h={2.6} rot={[0, z < 0 ? 0.25 : -0.25, 0.15]} mat={MAT.metalSteel} />
        </group>
      ))}
      
      {/* Horizontal load-bearing racking shelf beams */}
      {[0.3, 0.8, 1.3, 1.8, 2.3].map((y, i) => (
        <group key={i}>
          <Box pos={[0, y, -0.35]} size={[2.72, 0.04, 0.08]} mat={MAT.metalLight} />
          <Box pos={[0, y, 0.35]}  size={[2.72, 0.04, 0.08]} mat={MAT.metalLight} />
          
          {/* Multi-compartment bins with green LEDs representing active space */}
          {[-1.0, -0.5, 0.0, 0.5, 1.0].map((x, j) => {
            const occupied = (i + j) % 2 === 0;
            return occupied ? (
              <group key={j} position={[x, y + 0.03, 0]}>
                {/* Rear storage box */}
                <Box pos={[0, 0.1, -0.3]} size={[0.38, 0.18, 0.3]} mat={MAT.plasticBlue} />
                <Sph pos={[-0.14, 0.14, -0.14]} r={0.015} mat={MAT.signalGreen} />
                
                {/* Front storage box */}
                <Box pos={[0, 0.1, 0.3]} size={[0.38, 0.18, 0.3]} mat={MAT.plasticYellow} />
                <Sph pos={[0.14, 0.14, 0.14]} r={0.015} mat={MAT.signalGreen} />
              </group>
            ) : null;
          })}
        </group>
      ))}
      
      {/* ASRS Central aisle crane hoist column */}
      <Box pos={[-0.8, 2.65, 0]} size={[3.1, 0.08, 0.12]} mat={MAT.safetyYellow} />
      {/* Crane mast vertical track */}
      <Cyl pos={[0.2, 1.25, 0]} r={0.04} h={2.5} mat={MAT.metalLight} />
      {/* Carriage platform and telescoping forks */}
      <group ref={carriageRef} position={[0.2, 1.5, 0]}>
        <Box pos={[0, 0, 0]} size={[0.22, 0.12, 0.22]} mat={MAT.metalSteel} />
        {/* Telescoping forks extending left/right */}
        <Box pos={[0.08, -0.02, 0]} size={[0.32, 0.02, 0.08]} mat={MAT.safetyYellow} />
      </group>
    </group>
  );
}

// ─── ASRS Point (I/O Station) ──────────────────────────────────────────────
export function ASRSPointMesh() {
  return (
    <group>
      {/* Conveyor deck bed */}
      <Box pos={[0, 0.1, 0]} size={[1.6, 0.16, 0.72]} mat={MAT.metalDark} />
      <Box pos={[0, 0.19, 0]} size={[1.56, 0.02, 0.68]} mat={MAT.metalSteel} />
      
      {/* Densely spaced speed rollers */}
      {Array.from({ length: 8 }).map((_, i) => (
        <Cyl
          key={i}
          pos={[-0.65 + i * 0.185, 0.19, 0]}
          r={0.015}
          h={0.66}
          rot={[Math.PI / 2, 0, 0]}
          mat={MAT.metalSteel}
        />
      ))}
      
      {/* Curved scanner sensor arch gate */}
      <group position={[0.5, 0.2, 0]}>
        {/* Support columns */}
        <Cyl pos={[0, 0.6, -0.32]} r={0.025} h={1.2} mat={MAT.metalLight} />
        <Cyl pos={[0, 0.6, 0.32]}  r={0.025} h={1.2} mat={MAT.metalLight} />
        {/* Cross arch header */}
        <Box pos={[0, 1.2, 0]} size={[0.06, 0.06, 0.7]} mat={MAT.metalLight} />
        
        {/* Downward scanning lasers */}
        {[-0.2, 0.0, 0.2].map((z, idx) => (
          <Cyl key={idx} pos={[0, 0.6, z]} r={0.003} h={1.2} mat={MAT.signalRed} />
        ))}

        {/* 2 Camera modules */}
        <group position={[0, 1.15, -0.2]}>
          <Box pos={[0, 0, 0]} size={[0.08, 0.08, 0.08]} mat={MAT.metalDark} />
          <Sph pos={[-0.04, 0, 0]} r={0.025} mat={MAT.emissiveBlue} />
        </group>
        <group position={[0, 1.15, 0.2]}>
          <Box pos={[0, 0, 0]} size={[0.08, 0.08, 0.08]} mat={MAT.metalDark} />
          <Sph pos={[-0.04, 0, 0]} r={0.025} mat={MAT.emissiveBlue} />
        </group>
        
        {/* Sensor feedback terminal screen */}
        <Box pos={[0, 0.9, -0.4]} size={[0.25, 0.2, 0.2]} mat={MAT.metalDark} />
        <Box pos={[-0.13, 0.9, -0.4]} size={[0.01, 0.16, 0.16]} mat={MAT.emissiveCyan} />
      </group>
    </group>
  );
}

// ─── Lift / VRC Shaft ──────────────────────────────────────────────────────
export function LiftMesh() {
  const platformRef = useRef();
  
  // Animate the lift sliding up and down between floors
  useFrame(({ clock }) => {
    if (platformRef.current) {
      platformRef.current.position.y = 2.6 + Math.sin(clock.elapsedTime * 0.8) * 2.2;
    }
  });

  return (
    <group>
      {/* High-rigidity vertical dual guide rails */}
      <Box pos={[-0.65, 2.6, -0.55]} size={[0.06, 5.2, 0.06]} mat={MAT.metalLight} />
      <Box pos={[0.65, 2.6, -0.55]}  size={[0.06, 5.2, 0.06]} mat={MAT.metalLight} />
      <Box pos={[-0.65, 2.6, 0.55]}  size={[0.06, 5.2, 0.06]} mat={MAT.metalLight} />
      <Box pos={[0.65, 2.6, 0.55]}   size={[0.06, 5.2, 0.06]} mat={MAT.metalLight} />
      
      {/* Gear rack teeth styling inside rails */}
      {[-2.0, -1.0, 0, 1.0, 2.0].map((y, idx) => (
        <group key={idx}>
          <Box pos={[-0.65, 2.6 + y, -0.51]} size={[0.04, 0.2, 0.02]} mat={MAT.metalSteel} />
          <Box pos={[0.65, 2.6 + y, -0.51]}  size={[0.04, 0.2, 0.02]} mat={MAT.metalSteel} />
        </group>
      ))}

      {/* Structural cage framing columns with diagonal brace crossbeams */}
      <mesh position={[0, 2.6, 0]} renderOrder={0}>
        <boxGeometry args={[1.42, 5.2, 1.12]} />
        <meshBasicMaterial color="#2a334d" wireframe transparent opacity={0.3} />
      </mesh>
      
      {/* Cable hoist motor block at the top of the shaft */}
      <group position={[0, 5.3, 0]}>
        <Box pos={[0, 0.15, 0]} size={[1.0, 0.3, 0.8]} mat={MAT.metalDark} />
        <Cyl pos={[-0.3, 0.15, 0]} r={0.12} h={0.76} rot={[Math.PI / 2, 0, 0]} mat={MAT.metalSteel} />
        <Cyl pos={[0.3, 0.15, 0]}  r={0.12} h={0.76} rot={[Math.PI / 2, 0, 0]} mat={MAT.metalSteel} />
      </group>
      
      {/* Wire ropes */}
      <Cyl pos={[-0.3, 3.9, 0]} r={0.008} h={2.8} mat={MAT.metalDark} />
      <Cyl pos={[0.3, 3.9, 0]} r={0.008} h={2.8} mat={MAT.metalDark} />
      
      {/* Animated hoist platform */}
      <group ref={platformRef}>
        {/* Robust base carriage with safety yellow borders */}
        <Box pos={[0, 0.05, 0]} size={[1.2, 0.1, 0.98]} mat={MAT.metalDark} />
        
        {/* Yellow toe guards */}
        <Box pos={[0, 0.02, 0.49]} size={[1.18, 0.08, 0.01]} mat={MAT.safetyYellow} />
        <Box pos={[0, 0.02, -0.49]} size={[1.18, 0.08, 0.01]} mat={MAT.safetyYellow} />
        
        {/* Integrated platform conveyor rollers */}
        {[-0.35, -0.18, 0, 0.18, 0.35].map((x, idx) => (
          <Cyl key={idx} pos={[x, 0.11, 0]} r={0.016} h={0.9} rot={[Math.PI / 2, 0, 0]} mat={MAT.metalSteel} />
        ))}
        
        {/* Protective safety chain link guards (side rails) */}
        <Box pos={[-0.56, 0.45, 0]} size={[0.02, 0.8, 0.96]} mat={{ ...MAT.metalSteel, wireframe: true }} />
        <Box pos={[0.56, 0.45, 0]}  size={[0.02, 0.8, 0.96]} mat={{ ...MAT.metalSteel, wireframe: true }} />
        {/* Top rail */}
        <Box pos={[-0.56, 0.86, 0]} size={[0.03, 0.03, 0.98]} mat={MAT.safetyYellow} />
        <Box pos={[0.56, 0.86, 0]}  size={[0.03, 0.03, 0.98]} mat={MAT.safetyYellow} />
      </group>
    </group>
  );
}

// ─── Ramp ──────────────────────────────────────────────────────────────────
export function RampMesh() {
  return (
    <group>
      {/* Concrete deck slab */}
      <Box pos={[0, 0.28, 0]} size={[2.0, 0.16, 4.0]} mat={MAT.concrete} rot={[0.2, 0, 0]} />
      
      {/* Steel structural support frames under the ramp */}
      {[-1.5, 0, 1.5].map((z, idx) => (
        <group key={idx} position={[0, 0.28 + z * -0.06, z]} rotation={[0.2, 0, 0]}>
          <Box pos={[0, -0.2, 0]} size={[1.8, 0.12, 0.12]} mat={MAT.metalSteel} />
        </group>
      ))}
      
      {/* Dual safety yellow guardrails */}
      <group rotation={[0.2, 0, 0]}>
        {/* Rails */}
        <Box pos={[-0.92, 0.62, 0]} size={[0.04, 0.04, 4.1]} mat={MAT.safetyYellow} />
        <Box pos={[0.92, 0.62, 0]}  size={[0.04, 0.04, 4.1]} mat={MAT.safetyYellow} />
        <Box pos={[-0.92, 0.32, 0]} size={[0.04, 0.04, 4.1]} mat={MAT.safetyYellow} />
        <Box pos={[0.92, 0.32, 0]}  size={[0.04, 0.04, 4.1]} mat={MAT.safetyYellow} />
        {/* Support posts */}
        {[-1.8, -0.9, 0, 0.9, 1.8].map((z, idx) => (
          <group key={idx}>
            <Cyl pos={[-0.92, 0.3, z]} r={0.02} h={0.6} mat={MAT.metalLight} />
            <Cyl pos={[0.92, 0.3, z]}  r={0.02} h={0.6} mat={MAT.metalLight} />
          </group>
        ))}
      </group>
      
      {/* High-traction dark grid plates with glowing yellow LED edge lights */}
      {[-1.5, -0.5, 0.5, 1.5].map((z, idx) => (
        <group key={idx} position={[0, 0.28, z]} rotation={[0.2, 0, 0]}>
          {/* Non-slip plates */}
          <Box pos={[0, 0.09, 0]} size={[1.8, 0.01, 0.22]} mat={MAT.carbonPanel} />
          {/* LED Step light strips */}
          <Box pos={[-0.88, 0.095, 0]} size={[0.02, 0.005, 0.22]} mat={MAT.emissiveOrange} />
          <Box pos={[0.88, 0.095, 0]}  size={[0.02, 0.005, 0.22]} mat={MAT.emissiveOrange} />
        </group>
      ))}
    </group>
  );
}

// ─── Dispatch Dock ─────────────────────────────────────────────────────────
export function DispatchMesh() {
  return (
    <group>
      {/* Ground safety warnings and chevron markings */}
      <Box pos={[0, 0.01, 0]} size={[3.0, 0.02, 2.0]} mat={MAT.concrete} />
      {[-0.8, -0.4, 0, 0.4, 0.8].map((x, idx) => (
        <Box key={idx} pos={[x, 0.02, 0.5]} size={[0.1, 0.005, 0.8]} mat={MAT.safetyYellow} rot={[0, 0.78, 0]} />
      ))}
      
      {/* Adjustable heavy loading dock leveler ramp */}
      <group position={[0, 0.01, -0.2]}>
        <Box pos={[0, 0.06, 0]} size={[1.8, 0.12, 1.2]} mat={MAT.metalDark} />
        <Box pos={[0, 0.125, 0]} size={[1.76, 0.01, 1.16]} mat={MAT.metalSteel} />
        {/* Leveler lip board */}
        <Box pos={[0, 0.12, 0.58]} size={[1.7, 0.02, 0.16]} mat={MAT.metalLight} />
      </group>
      
      {/* Black compression dock seals / shelters framing the door */}
      <Box pos={[-1.0, 1.2, -0.85]} size={[0.16, 2.4, 0.26]} mat={MAT.metalDark} />
      <Box pos={[1.0, 1.2, -0.85]}  size={[0.16, 2.4, 0.26]} mat={MAT.metalDark} />
      <Box pos={[0, 2.4, -0.85]}   size={[2.16, 0.16, 0.26]} mat={MAT.metalDark} />
      
      {/* Overhead shutter door */}
      <Box pos={[0, 1.2, -0.9]} size={[1.84, 2.4, 0.05]} mat={MAT.metalSteel} />
      {[0.4, 0.8, 1.2, 1.6, 2.0].map((y, idx) => (
        <Box key={`shut-${idx}`} pos={[0, y, -0.88]} size={[1.84, 0.04, 0.02]} mat={MAT.metalDark} />
      ))}
      
      {/* Detailed LED signal light tower */}
      <Cyl pos={[1.3, 1.0, -0.6]} r={0.03} h={2.0} mat={MAT.metalLight} />
      <Box pos={[1.3, 1.9, -0.6]} size={[0.12, 0.38, 0.12]} mat={MAT.metalDark} />
      <Sph pos={[1.3, 2.02, -0.54]} r={0.05} mat={MAT.signalRed} />
      <Sph pos={[1.3, 1.78, -0.54]} r={0.05} mat={MAT.signalGreen} />
      
      {/* Heavy-duty spring dock bumpers */}
      <Box pos={[-0.85, 0.15, 0.42]} size={[0.16, 0.3, 0.12]} mat={MAT.safetyYellow} />
      <Box pos={[0.85, 0.15, 0.42]}  size={[0.16, 0.3, 0.12]} mat={MAT.safetyYellow} />
    </group>
  );
}

// ─── External Node (Supplier / Customer Roadway) ──────────────────────────
export function ExternalMesh() {
  return (
    <group>
      {/* Asphalt highway roadbed */}
      <Box pos={[0, 0.01, 0]} size={[4.0, 0.02, 2.0]} mat={MAT.concrete} />
      <Box pos={[0, 0.02, 0]} size={[3.96, 0.01, 1.92]} mat={MAT.metalDark} />
      
      {/* Road outer white solid lane lines */}
      <Box pos={[0, 0.026, -0.9]} size={[3.96, 0.002, 0.04]} mat={MAT.glowWhite} />
      <Box pos={[0, 0.026, 0.9]}  size={[3.96, 0.002, 0.04]} mat={MAT.glowWhite} />
      
      {/* Dashed double yellow center lane marking */}
      {[-1.4, -0.5, 0.5, 1.4].map((x, idx) => (
        <group key={idx} position={[x, 0.026, 0]}>
          <Box pos={[0, 0, -0.04]} size={[0.4, 0.002, 0.02]} mat={MAT.safetyYellow} />
          <Box pos={[0, 0, 0.04]}  size={[0.4, 0.002, 0.02]} mat={MAT.safetyYellow} />
        </group>
      ))}
      
      {/* Steel roadside safety guardrails */}
      <Box pos={[0, 0.32, -0.94]} size={[3.96, 0.08, 0.03]} mat={MAT.metalLight} />
      {[-1.8, -0.6, 0.6, 1.8].map((x, idx) => (
        <Box key={idx} pos={[x, 0.16, -0.93]} size={[0.04, 0.3, 0.04]} mat={MAT.metalSteel} />
      ))}
      
      {/* Solar-powered street light post */}
      <group position={[1.7, 0.02, 0.94]}>
        <Cyl pos={[0, 1.25, 0]} r={0.03} h={2.5} mat={MAT.metalLight} />
        {/* Battery box */}
        <Box pos={[-0.05, 1.0, 0]} size={[0.1, 0.2, 0.15]} mat={MAT.metalSteel} />
        
        <Cyl pos={[-0.15, 2.4, 0]} r={0.015} h={0.4} rot={[0, 0, Math.PI / 3]} mat={MAT.metalLight} />
        {/* Lamp head casting warm light downward */}
        <Box pos={[-0.32, 2.2, 0]} size={[0.2, 0.04, 0.08]} mat={MAT.metalDark} />
        <Box pos={[-0.32, 2.17, 0]} size={[0.18, 0.01, 0.06]} mat={{ ...MAT.safetyYellow, emissiveIntensity: 1.0 }} />
        {/* Top solar panel grid */}
        <Box pos={[0.08, 2.5, 0.0]} size={[0.3, 0.01, 0.22]} mat={MAT.carbonPanel} rot={[0.3, 0.3, 0.2]} />
      </group>
    </group>
  );
}

// ─── Dispatch Table Mapping ────────────────────────────────────────────────
export const MESH_BY_TYPE = {
  dock:             DockMesh,
  buffer:           BufferMesh,
  inspection_area:  InspectionMesh,
  store:            StoreMesh,
  lift:             LiftMesh,
  ramp:             RampMesh,
  dispatch:         DispatchMesh,
  external:         ExternalMesh,
  ASRS:             ASRSMesh,
  ASRS_point:       ASRSPointMesh,
  ASRS_zone:        ASRSMesh,
};

export const MESH_BY_ZONE = {
  SMT:              SMTMesh,
  FCT:              FCTMesh,
  TRSS:             TRSSMesh,
  '1P Assembly':    Assembly1PMesh,
  'SFG Packing':    SFGPackMesh,
  VC:               VCMesh,
  Packaging:        PackMesh,
};

export function getMeshComponent(loc) {
  return MESH_BY_ZONE[loc.zone] ?? MESH_BY_TYPE[loc.location_type] ?? null;
}
