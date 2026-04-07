import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ManoHand Component
 * Renders a high-quality MANO hand mesh driven by sensor data.
 */
export default function ManoHand({ currentData }) {
  const [manoData, setManoData] = useState(null);
  const meshRef = useRef();
  
  // Extract data from currentData row
  // Schema: [time(0), joints(1-10), forces(11-52), tribo(53-60)]
  const rawJoints = currentData ? currentData.slice(1, 11) : new Array(10).fill(0);
  const forces = currentData ? currentData.slice(11, 53) : new Array(42).fill(0);

  // Load MANO JSON
  useEffect(() => {
    fetch('/mano_right.json')
      .then(res => res.json())
      .then(data => setManoData(data))
      .catch(err => console.error("Failed to load MANO data:", err));
  }, []);

  // Prepare Geometry (Rest Pose)
  const geometry = useMemo(() => {
    if (!manoData) return null;
    
    const geo = new THREE.BufferGeometry();
    const vertices = new Float32Array(manoData.v_template.flat());
    const indices = new Uint32Array(manoData.f.flat());
    
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [manoData]);

  // Skinning logic (CPU-based for simplicity and high control)
  useFrame(() => {
    if (!meshRef.current || !manoData || !geometry) return;

    const vertices = geometry.attributes.position.array;
    const vTemplate = manoData.v_template; // [778][3]
    const weights = manoData.weights;      // [778][16]
    const J = manoData.J;                  // [16][3]
    const kintree = manoData.kintree_table; // [[parent...], [child...]]

    // Map 10 sensors to 15 internal joints (excluding root)
    // Internal indices: 
    // Index: 1(MCP), 2(PIP), 3(DIP)
    // Middle: 4, 5, 6
    // Pinky: 7, 8, 9
    // Ring: 10, 11, 12
    // Thumb: 13, 14, 15
    // Mapping 10 CSV joints [0-9] to MCP and PIP of each finger:
    const rotations = new Array(16).fill(0).map(() => new THREE.Euler());
    
    // Convert degrees to radians and apply to joints
    const toRad = Math.PI / 180;
    
    // Index (joints[0,1])
    rotations[1].x = rawJoints[0] * toRad; rotations[2].x = rawJoints[1] * toRad;
    // Middle (joints[2,3])
    rotations[4].x = rawJoints[2] * toRad; rotations[5].x = rawJoints[3] * toRad;
    // Ring (joints[4,5])
    rotations[10].x = rawJoints[4] * toRad; rotations[11].x = rawJoints[5] * toRad;
    // Pinky (joints[6,7])
    rotations[7].x = rawJoints[6] * toRad; rotations[8].x = rawJoints[7] * toRad;
    // Thumb (joints[8,9])
    rotations[13].z = -rawJoints[8] * toRad; // Thumb needs different axis
    rotations[14].x = rawJoints[9] * toRad;

    // Calculate World Matrices for each joint
    const worldMatrices = new Array(16).fill(null).map(() => new THREE.Matrix4());
    const bindMatricesInv = new Array(16).fill(null).map(() => new THREE.Matrix4());

    for (let i = 0; i < 16; i++) {
        const parentIdx = kintree[0][i];
        const localMatrix = new THREE.Matrix4().makeRotationFromEuler(rotations[i]);
        
        // Offset to joint position
        const jointPos = new THREE.Vector3(...J[i]);
        const parentPos = parentIdx === -1 ? new THREE.Vector3(0,0,0) : new THREE.Vector3(...J[parentIdx]);
        const relPos = jointPos.clone().sub(parentPos);
        
        localMatrix.setPosition(relPos);

        if (parentIdx === -1) {
            worldMatrices[i].copy(localMatrix);
        } else {
            worldMatrices[i].multiplyMatrices(worldMatrices[parentIdx], localMatrix);
        }
        
        // Bind matrix inverse (T_j in rest pose)
        const bindMatrix = new THREE.Matrix4();
        bindMatrix.setPosition(jointPos);
        // This is a simplification; full LBS needs relative transforms.
        // For MANO, common practice is: M_j = G_j * G_j_rest_inv
    }

    // Rest pose joint matrices
    const restMatrices = new Array(16).fill(null).map((_, i) => {
        const m = new THREE.Matrix4();
        m.setPosition(new THREE.Vector3(...J[i]));
        return m;
    });
    const restMatricesInv = restMatrices.map(m => m.clone().invert());

    const skinMatrices = worldMatrices.map((m, i) => {
        return new THREE.Matrix4().multiplyMatrices(m, restMatricesInv[i]);
    });

    // Apply vertex transformation
    const v = new THREE.Vector3();
    const tempV = new THREE.Vector3();
    const targetV = new THREE.Vector3();

    for (let i = 0; i < vTemplate.length; i++) {
        v.set(vTemplate[i][0], vTemplate[i][1], vTemplate[i][2]);
        targetV.set(0, 0, 0);
        
        for (let j = 0; j < 16; j++) {
            const w = weights[i][j];
            if (w > 0) {
                tempV.copy(v).applyMatrix4(skinMatrices[j]);
                targetV.add(tempV.multiplyScalar(w));
            }
        }
        vertices[i * 3] = targetV.x;
        vertices[i * 3 + 1] = targetV.y;
        vertices[i * 3 + 2] = targetV.z;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  // Prepare custom meshes for Force Arrows to avoid re-constructing `arrowHelper` args every frame
  const arrowMaterial = useMemo(() => new THREE.MeshBasicMaterial(), []);
  const arrowGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.01, 0.01, 1, 8);
    geo.translate(0, 0.5, 0); // Origin at bottom
    return geo;
  }, []);

  if (!manoData) return null;

  const tipJoints = [3, 6, 12, 9, 15]; // Index, Middle, Ring, Pinky, Thumb

  return (
    <group rotation={[Math.PI / 2, Math.PI, 0]} scale={[13, 13, 13]} position={[0, -1, 0]}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshPhysicalMaterial 
          color="#f5d5c5" 
          roughness={0.2} 
          metalness={0.1} 
          transmission={0.05}
          thickness={1}
          clearcoat={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Dynamic Sensors placed at joint tips */}
      {tipJoints.map((jointIdx, i) => {
        const fX = forces[i * 3] || 0;
        const fY = forces[i * 3 + 1] || 0;
        const fZ = forces[i * 3 + 2] || 0;
        const magnitude = Math.sqrt(fX*fX + fY*fY + fZ*fZ);
        const length = magnitude * 0.1;
        const colorHex = new THREE.Color().lerpColors(new THREE.Color('#FB7185'), new THREE.Color('#F43F5E'), Math.min(magnitude / 20, 1)).getHex();
        
        return (
            <group key={`arrow-${i}`} position={new THREE.Vector3(...manoData.J[jointIdx])} visible={length >= 0.01}>
                {/* Arrow Shaft Base */}
                <mesh geometry={arrowGeo} scale={[1, length, 1]}>
                    <meshBasicMaterial color={colorHex} />
                </mesh>
            </group>
        );
      })}

      {/* Tribo regions on fingertips */}
      {tipJoints.slice(0, 4).map((jointIdx, i) => {
          const intensity = (currentData ? currentData[53 + i] : 0) || 0;
          return (
            <mesh key={`tribo-${i}`} position={new THREE.Vector3(...manoData.J[jointIdx])} scale={[0.02, 0.02, 0.02]} visible={intensity >= 10}>
              <sphereGeometry args={[1, 16, 16]} />
              <meshBasicMaterial color="#2DD4BF" transparent opacity={0.6 * (intensity / 100)} />
            </mesh>
          );
      })}
    </group>
  );
}
