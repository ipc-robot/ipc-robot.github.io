import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const FingerSegment = ({ length, radius, angle, isTip, forceIndex, forces, triboIndex, tribo, children }) => {

  const tex = useMemo(() => {
    const data = new Uint8Array(8 * 8 * 4);
    const texture = new THREE.DataTexture(data, 8, 8, THREE.RGBAFormat);
    texture.magFilter = THREE.NearestFilter; // Sharp edges for the patch
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }, []);

  // Update dynamic texture map
  // Force values
  let forceMag = 0;
  if (forceIndex !== undefined && forces) {
    const fX = forces[forceIndex * 3] || 0;
    const fY = forces[forceIndex * 3 + 1] || 0;
    const fZ = forces[forceIndex * 3 + 2] || 0;
    forceMag = Math.sqrt(fX * fX + fY * fY + fZ * fZ);
  }
  const fColor = new THREE.Color("#BAE6FD").lerp(new THREE.Color("#0284C7"), Math.min(forceMag / 20, 1));

  // Tribo values
  let tIntensity = 0;
  if (triboIndex !== undefined && tribo) {
    const tIdx = Array.isArray(triboIndex) ? triboIndex[0] : triboIndex;
    tIntensity = Math.min((tribo[tIdx] || 0) / 100, 1);
  }
  const tColor = new THREE.Color("#C084FC").lerp(new THREE.Color("#4C1D95"), tIntensity);

  // Paint the 8x8 DataTexture
  const d = tex.image.data;
  // 1. Fill base gray color (#CBD5E1 -> R:203, G:213, B:225)
  for (let i = 0; i < 64; i++) {
    d[i * 4] = 203;
    d[i * 4 + 1] = 213;
    d[i * 4 + 2] = 225;
    d[i * 4 + 3] = 255;
  }

  // 2. Paint patches
  // u (cols) maps around circumference. -Z (palmar front) is around u=0.75 (col 6). Span col 5,6,7.
  // v (rows) maps length. Bottom is row 0, top is row 7.
  if (triboIndex !== undefined) {
    const rV = Math.round(tColor.r * 255), gV = Math.round(tColor.g * 255), bV = Math.round(tColor.b * 255);
    // Tribo spans full length to connect cross joints
    for (let r = 0; r <= 7; r++) {
      for (let c = 5; c <= 7; c++) {
        const idx = (r * 8 + c) * 4;
        d[idx] = rV; d[idx + 1] = gV; d[idx + 2] = bV;
      }
    }
  } else if (forceIndex !== undefined) {
    const rV = Math.round(fColor.r * 255), gV = Math.round(fColor.g * 255), bV = Math.round(fColor.b * 255);
    // Force patch is shorter, located in middle
    for (let r = 2; r <= 5; r++) {
      for (let c = 5; c <= 7; c++) {
        const idx = (r * 8 + c) * 4;
        d[idx] = rV; d[idx + 1] = gV; d[idx + 2] = bV;
      }
    }
  }
  tex.needsUpdate = true;

  return (
    <group rotation={[angle * Math.PI / 180, 0, 0]}>
      {/* Joint sphere */}
      <mesh>
        <sphereGeometry args={[radius * 1.05, 16, 16]} />
        <meshStandardMaterial color="#94A3B8" roughness={0.95} metalness={0.0} />
      </mesh>

      {/* Base Bone cylinder painted with Dynamic DataTexture */}
      <mesh position={[0, length / 2, 0]}>
        <cylinderGeometry args={[radius * (isTip ? 0.6 : 0.8), radius, length, 16]} />
        <meshStandardMaterial map={tex} roughness={0.95} metalness={0.0} />
      </mesh>

      {/* Rounded Tip Cap */}
      {isTip && (
        <mesh position={[0, length, 0]}>
          <sphereGeometry args={[radius * 0.6, 16, 16]} />
          <meshStandardMaterial color="#CBD5E1" roughness={0.95} metalness={0.0} />
        </mesh>
      )}
      {/* Next segment anchor */}
      <group position={[0, length, 0]}>
        {children}
      </group>
    </group>
  );
};

export default function HandSkeleton({ currentData }) {
  const group = useRef();

  // Helper to extract specific data ranges based on the mockup schema
  const joints = currentData ? currentData.slice(1, 11) : new Array(10).fill(0);
  const forces = currentData ? currentData.slice(11, 53) : new Array(42).fill(0);
  const tribo = currentData ? currentData.slice(53, 61) : new Array(8).fill(0);

  const trapezoidShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1, -1.75);
    shape.lineTo(1, -1.75);
    shape.lineTo(1.5, 1.75);
    shape.lineTo(-1.5, 1.75);
    shape.lineTo(-1, -1.75);
    return shape;
  }, []);

  const extrudeSettings = {
    depth: 0.6,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 3,
  };

  const palmTex = useMemo(() => {
    const data = new Uint8Array(16 * 16 * 4);
    const texture = new THREE.DataTexture(data, 16, 16, THREE.RGBAFormat);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }, []);

  // Update Palm Texture Content
  const pd = palmTex.image.data;
  // Fill base color #CBD5E1
  for (let i = 0; i < 256; i++) {
    pd[i * 4] = 203; pd[i * 4 + 1] = 213; pd[i * 4 + 2] = 225; pd[i * 4 + 3] = 255;
  }

  // Paint Palm Sensors on 16x16 map
  // Helper to paint a block on palm map
  const paintPalmBlock = (px, py, color, w = 2, h = 2) => {
    const u = (px + 1.5) / 3.0;
    const v = (py + 1.75) / 3.5;
    const centerC = Math.floor(u * 16);
    const centerR = Math.floor(v * 16);
    for (let r = Math.max(0, centerR - Math.floor(h / 2)); r < Math.min(16, centerR + Math.ceil(h / 2)); r++) {
      for (let c = Math.max(0, centerC - Math.floor(w / 2)); c < Math.min(16, centerC + Math.ceil(w / 2)); c++) {
        const idx = (r * 16 + c) * 4;
        pd[idx] = Math.round(color.r * 255);
        pd[idx + 1] = Math.round(color.g * 255);
        pd[idx + 2] = Math.round(color.b * 255);
      }
    }
  };

  // 1. Palm Force Spots (5, 6, 7)
  [5, 6, 7].forEach(idx => {
    const fX = forces[idx * 3] || 0, fY = forces[idx * 3 + 1] || 0, fZ = forces[idx * 3 + 2] || 0;
    const mag = Math.sqrt(fX * fX + fY * fY + fZ * fZ);
    const c = new THREE.Color("#BAE6FD").lerp(new THREE.Color("#0284C7"), Math.min(mag / 20, 1));
    // Re-position to match user circles: F6,7 at top, F5 at bottom-left
    const pos = idx === 5 ? [-0.6, -1.0] : idx === 6 ? [-0.8, 1.3] : [0.8, 1.3];
    paintPalmBlock(pos[0], pos[1], c, 2, 2);
  });

  // 2. Palm Tribo (5, 6, 7)
  [5, 6, 7].forEach(idx => {
    const intensity = Math.min((tribo[idx] || 0) / 100, 1);
    const c = new THREE.Color("#C084FC").lerp(new THREE.Color("#4C1D95"), intensity);
    if (idx === 5) { // Upper horizontal strip (Top circle)
      paintPalmBlock(0, 1.2, c, 12, 3);
    } else if (idx === 6) { // Lower left spot (Bottom-left circle)
      paintPalmBlock(-0.7, -1.0, c, 4, 5);
    } else { // Lower right spot (Bottom-right circle)
      paintPalmBlock(0.7, -1.0, c, 4, 5);
    }
  });
  palmTex.needsUpdate = true;

  return (
    <group ref={group} rotation={[0, Math.PI / 6, 0]} scale={[1, 1, 1]} position={[0, 0, 0]}>
      {/* Palm (Trapezoid) */}
      <mesh position={[0, 0, -0.3]}>
        <extrudeGeometry args={[trapezoidShape, extrudeSettings]} />
        {/* material-0: Face (Front/Back) uses the sensor texture, material-1: Side uses plain color */}
        <meshStandardMaterial attach="material-0" map={palmTex} roughness={0.95} metalness={0.0} side={THREE.DoubleSide} />
        <meshStandardMaterial attach="material-1" color="#CBD5E1" roughness={0.95} metalness={0.0} />
      </mesh>

      {/* Index Finger */}
      <group position={[-1.1, 1.75, 0]}>
        <FingerSegment length={1.2} radius={0.3} angle={joints[0]} forceIndex={8} forces={forces}>
          <FingerSegment length={0.8} radius={0.28} angle={joints[1]} triboIndex={0} tribo={tribo}>
            <FingerSegment length={0.6} radius={0.25} angle={joints[1] * 0.5} isTip forceIndex={0} triboIndex={0} tribo={tribo} forces={forces} />
          </FingerSegment>
        </FingerSegment>
      </group>

      {/* Middle Finger */}
      <group position={[-0.35, 1.85, 0]}>
        <FingerSegment length={1.3} radius={0.32} angle={joints[2]} forceIndex={9} forces={forces}>
          <FingerSegment length={0.9} radius={0.3} angle={joints[3]} triboIndex={1} tribo={tribo}>
            <FingerSegment length={0.7} radius={0.27} angle={joints[3] * 0.5} isTip forceIndex={1} triboIndex={1} tribo={tribo} forces={forces} />
          </FingerSegment>
        </FingerSegment>
      </group>

      {/* Ring Finger */}
      <group position={[0.35, 1.8, 0]}>
        <FingerSegment length={1.2} radius={0.3} angle={joints[4]} forceIndex={10} forces={forces}>
          <FingerSegment length={0.8} radius={0.28} angle={joints[5]} triboIndex={2} tribo={tribo}>
            <FingerSegment length={0.6} radius={0.25} angle={joints[5] * 0.5} isTip forceIndex={2} triboIndex={2} tribo={tribo} forces={forces} />
          </FingerSegment>
        </FingerSegment>
      </group>

      {/* Pinky Finger */}
      <group position={[1.1, 1.6, 0]}>
        <FingerSegment length={0.9} radius={0.25} angle={joints[6]} forceIndex={11} forces={forces}>
          <FingerSegment length={0.6} radius={0.23} angle={joints[7]} triboIndex={3} tribo={tribo}>
            <FingerSegment length={0.5} radius={0.2} angle={joints[7] * 0.5} isTip forceIndex={3} triboIndex={3} tribo={tribo} forces={forces} />
          </FingerSegment>
        </FingerSegment>
      </group>

      {/* Thumb */}
      <group position={[-1.5, -0.5, 0]} rotation={[0, -Math.PI / 6, Math.PI / 4]}>
        <FingerSegment length={1.0} radius={0.35} angle={joints[8] * 0.5} forceIndex={13} forces={forces}>
          <FingerSegment length={0.8} radius={0.32} angle={joints[9]} forceIndex={12} triboIndex={4} tribo={tribo} forces={forces}>
            <FingerSegment length={0.6} radius={0.3} angle={joints[9] * 0.5} isTip forceIndex={4} triboIndex={4} tribo={tribo} forces={forces} />
          </FingerSegment>
        </FingerSegment>
      </group>
    </group>
  );
}
