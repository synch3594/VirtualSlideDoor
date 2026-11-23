import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { liveSim, useDoorStore } from '../../store/useDoorStore';

/**
 * Motorized retractable side step + Hands-free kick sensor zone under the left sliding doorway.
 */
export function PowerStep() {
  const stepGroupRef = useRef<THREE.Group>(null);
  const stepLightMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const kickRingMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const powerStepEnabled = useDoorStore((s) => s.powerStepEnabled);
  const showHotspots = useDoorStore((s) => s.showHotspots);
  const triggerDoorToggle = useDoorStore((s) => s.triggerDoorToggle);

  useFrame(({ clock }) => {
    // Extend step smoothly outward along +X from under the sill
    if (stepGroupRef.current) {
      const p = liveSim.powerStepProgress;
      // Retracted: tucked beneath sill at x = 0.65; Extended: sticks out to x = 0.89
      stepGroupRef.current.position.x = 0.65 + p * 0.24;
      stepGroupRef.current.position.y = 0.175 - p * 0.015;
    }

    if (stepLightMatRef.current) {
      const intensity = liveSim.interiorLight * liveSim.powerStepProgress;
      stepLightMatRef.current.emissiveIntensity = intensity * 2.2;
    }

    if (kickRingMatRef.current) {
      const t = clock.getElapsedTime();
      if (liveSim.kickGlowTimer > 0) {
        kickRingMatRef.current.color.set('#38bdf8');
        kickRingMatRef.current.opacity = 0.85 * Math.min(1, liveSim.kickGlowTimer * 2);
      } else if (showHotspots) {
        kickRingMatRef.current.color.set('#7dd3fc');
        kickRingMatRef.current.opacity = 0.22 + 0.14 * Math.sin(t * 2.6);
      } else {
        kickRingMatRef.current.opacity = 0;
      }
    }
  });

  return (
    <group>
      {/* Motorized Retractable Side Step */}
      {powerStepEnabled && (
        <group ref={stepGroupRef} position={[0.65, 0.175, -0.3]}>
          {/* Main aluminum/steel step board */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.24, 0.028, 0.96]} />
            <meshStandardMaterial color="#1e293b" metalness={0.55} roughness={0.45} />
          </mesh>
          {/* Silver metallic front trim strip */}
          <mesh position={[0.118, 0.002, 0]}>
            <boxGeometry args={[0.012, 0.022, 0.95]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.22} />
          </mesh>
          {/* Anti-slip rubber tread ribs */}
          {[-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36].map((zOff) => (
            <mesh key={zOff} position={[0.02, 0.016, zOff]}>
              <boxGeometry args={[0.16, 0.006, 0.055]} />
              <meshStandardMaterial color="#0f172a" roughness={0.95} />
            </mesh>
          ))}
          {/* Subtle LED edge welcome light on step */}
          <mesh position={[0.11, -0.012, 0]}>
            <boxGeometry args={[0.012, 0.006, 0.72]} />
            <meshStandardMaterial
              ref={stepLightMatRef}
              color="#fef9c3"
              emissive="#fef08a"
              emissiveIntensity={0}
            />
          </mesh>
          {/* Support scissor brackets */}
          <mesh position={[-0.1, 0.04, 0.34]}>
            <boxGeometry args={[0.16, 0.03, 0.04]} />
            <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[-0.1, 0.04, -0.34]}>
            <boxGeometry args={[0.16, 0.03, 0.04]} />
            <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.5} />
          </mesh>
        </group>
      )}

      {/* Hands-Free Kick Sensor Projection & Tap Zone (right under B-pillar / front doorway) */}
      <group position={[0.96, 0.012, 0.05]}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            triggerDoorToggle('kick_sensor');
          }}
        >
          <ringGeometry args={[0.11, 0.16, 28]} />
          <meshBasicMaterial
            ref={kickRingMatRef}
            color="#7dd3fc"
            transparent
            opacity={0.28}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Invisible generous tap target for little fingers */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
          onClick={(e) => {
            e.stopPropagation();
            triggerDoorToggle('kick_sensor');
          }}
        >
          <circleGeometry args={[0.26, 16]} />
          <meshBasicMaterial />
        </mesh>
      </group>
    </group>
  );
}
