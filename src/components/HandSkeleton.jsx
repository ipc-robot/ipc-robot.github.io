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
  // u (cols) maps around circumference. +Z (palmar front) is around u=0 (col 0). Span col 7, 0, 1.
  // v (rows) maps length. Bottom is row 0, top is row 7.
  if (triboIndex !== undefined) {
    const rV = Math.round(tColor.r * 255), gV = Math.round(tColor.g * 255), bV = Math.round(tColor.b * 255);
    // Tribo spans full length to connect cross joints
    for (let r = 0; r <= 7; r++) {
      for (let c of [7, 0, 1]) {
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
        <sphereGeometry args={[radius * 1.05, 16, 16, isTip ? Math.PI / 2 : 0]} />
        <meshStandardMaterial
          {...(isTip ? { map: tex, color: "white" } : { color: "#94A3B8" })}
          roughness={0.95}
          metalness={0.0}
        />
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

  return (
    <group ref={group} rotation={[0, Math.PI / 6, 0]} scale={[1, 1, 1]} position={[0, 0, 0]}>
      {/* Palm (Trapezoid) */}
      <mesh position={[0, 0, -0.3]}>
        <extrudeGeometry args={[trapezoidShape, extrudeSettings]} />
        {/* material-0: Face (Front/Back) uses plain color, material-1: Side uses plain color */}
        <meshStandardMaterial attach="material-0" color="#CBD5E1" roughness={0.95} metalness={0.0} />
        <meshStandardMaterial attach="material-1" color="#CBD5E1" roughness={0.95} metalness={0.0} />
      </mesh>

      {/* Palm Sensor Patches (Custom Shapes) */}
      {[5, 6, 7].map(idx => {
        const intensity = Math.min((tribo[idx] || 0) / 100, 1);
        const color = new THREE.Color("#C084FC").lerp(new THREE.Color("#4C1D95"), intensity);

        let shape, pos, scale = [1, 1, 1];
        if (idx === 5) { // Upper horizontal rounded trapezoid
          pos = [0, 1.2, 0.42]; // Lowered slightly from 1.4 to 1.2
          // Create rounded trapezoid shape
          shape = new THREE.Shape();
          const wT = 1.1, wB = 0.9, hh = 0.2, r = 0.15; // Refined sizes and larger radius
          // Start bottom left
          shape.moveTo(-wB + r, -hh);
          shape.lineTo(wB - r, -hh);
          shape.absarc(wB - r, -hh + r, r, -Math.PI / 2, 0);
          shape.lineTo(wT, hh - r);
          shape.absarc(wT - r, hh - r, r, 0, Math.PI / 2);
          shape.lineTo(-wT + r, hh);
          shape.absarc(-wT + r, hh - r, r, Math.PI / 2, Math.PI);
          shape.lineTo(-wB, -hh + r);
          shape.absarc(-wB + r, -hh + r, r, Math.PI, Math.PI * 1.5);
        } else { // Lower vertical rounded rectangles
          pos = [idx === 6 ? -0.8 : 0.8, -0.6, 0.42]; // Adjusted x-spread
          shape = new THREE.Shape();
          const ww = 0.3, hhh = 0.75, rr = 0.2; // Shorter and more rounded
          shape.moveTo(-ww + rr, -hhh);
          shape.lineTo(ww - rr, -hhh);
          shape.absarc(ww - rr, -hhh + rr, rr, -Math.PI / 2, 0);
          shape.lineTo(ww, hhh - rr);
          shape.absarc(ww - rr, hhh - rr, rr, 0, Math.PI / 2);
          shape.lineTo(-ww + rr, hhh);
          shape.absarc(-ww + rr, hhh - rr, rr, Math.PI / 2, Math.PI);
          shape.lineTo(-ww, -hhh + rr);
          shape.absarc(-ww + rr, -hhh + rr, rr, Math.PI, Math.PI * 1.5);
        }

        return (
          <mesh key={idx} position={pos} scale={scale}>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial color={color} roughness={0.8} metalness={0.0} transparent opacity={0.9} emissive={color} emissiveIntensity={0.2} />
          </mesh>
        );
      })}

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
