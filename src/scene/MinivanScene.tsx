import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDoorStore } from '../store/useDoorStore';
import { EnvironmentRig } from './EnvironmentRig';
import { CameraRig } from './CameraRig';
import { MinivanBody } from './models/MinivanBody';
import { MinivanInterior } from './models/MinivanInterior';
import { SlidingDoor } from './models/SlidingDoor';
import { PowerStep } from './models/PowerStep';

function SimulationTicker() {
  const stepSimulation = useDoorStore((s) => s.stepSimulation);
  useFrame((_, dt) => {
    stepSimulation(dt);
  });
  return null;
}

export function MinivanScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        powerPreference: 'high-performance',
      }}
      camera={{ position: [4.15, 1.52, 2.95], fov: 46, near: 0.08, far: 80 }}
      className="w-full h-full touch-none"
    >
      <SimulationTicker />
      <EnvironmentRig />
      <CameraRig />

      {/* Minivan Assembly */}
      <group>
        <MinivanBody />
        <MinivanInterior />
        <SlidingDoor />
        <PowerStep />
      </group>
    </Canvas>
  );
}
