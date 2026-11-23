import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CameraPreset } from '../simulation/types';
import { useDoorStore } from '../store/useDoorStore';

interface CameraSpec {
  pos: [number, number, number];
  target: [number, number, number];
  fovLandscape: number;
  fovPortrait: number;
}

/**
 * Curated camera presets designed specifically for smartphone portrait & landscape viewing!
 * Default ('exterior_front34') frames the Serena from the exact angle where watching
 * the sliding door glide forward, curve inward, and pull flush with the Easy Closer looks best!
 */
const PRESETS: Record<CameraPreset, CameraSpec> = {
  // 特等席：外から閉まるのを眺める斜め前（フロントVモーショングリル＋スライドドアの引き込み＆ツライチが一望！）
  exterior_front34: {
    pos: [3.35, 1.38, 2.35],
    target: [0.35, 0.96, -0.22],
    fovLandscape: 36,
    fovPortrait: 50,
  },
  // 真横：ドア全体のスライド距離と広い開口部がよく見える
  exterior_side: {
    pos: [4.55, 1.28, -0.18],
    target: [0.25, 0.98, -0.18],
    fovLandscape: 34,
    fovPortrait: 52,
  },
  // レール＆ローラーアーム機構アップ：斜め後ろからセンターレールとアームの動きを観察！
  rail_closeup: {
    pos: [2.15, 1.32, -2.05],
    target: [0.76, 1.02, -0.82],
    fovLandscape: 34,
    fovPortrait: 44,
  },
  // 車内2列目視点：車の中からドア開閉・Bピラーボタン・外の景色を楽しむ
  interior_row2: {
    pos: [-0.36, 1.24, -0.58],
    target: [1.05, 0.98, -0.16],
    fovLandscape: 56,
    fovPortrait: 68,
  },
};

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraPreset = useDoorStore((s) => s.cameraPreset);
  const powerMainOn = useDoorStore((s) => s.powerMainOn);

  const { camera, size } = useThree();
  const isTransitioning = useRef(true);
  const desiredPos = useRef(new THREE.Vector3(...PRESETS.exterior_front34.pos));
  const desiredTarget = useRef(new THREE.Vector3(...PRESETS.exterior_front34.target));

  // Trigger smooth transition whenever preset or screen orientation changes
  useEffect(() => {
    const spec = PRESETS[cameraPreset];
    const isPortrait = size.height > size.width;
    const distanceBoost = isPortrait && cameraPreset !== 'interior_row2' ? 1.18 : 1.0;

    const baseTarget = new THREE.Vector3(...spec.target);
    const basePos = new THREE.Vector3(...spec.pos);
    const offset = basePos.clone().sub(baseTarget).multiplyScalar(distanceBoost);

    desiredTarget.current.copy(baseTarget);
    desiredPos.current.copy(baseTarget).add(offset);
    isTransitioning.current = true;

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = isPortrait ? spec.fovPortrait : spec.fovLandscape;
      camera.updateProjectionMatrix();
    }
  }, [cameraPreset, size.width, size.height, camera]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (!isTransitioning.current || !controlsRef.current) return;

    const lerpFactor = 1 - Math.exp(-5.5 * dt);
    camera.position.lerp(desiredPos.current, lerpFactor);
    controlsRef.current.target.lerp(desiredTarget.current, lerpFactor);
    controlsRef.current.update();

    if (
      camera.position.distanceTo(desiredPos.current) < 0.015 &&
      controlsRef.current.target.distanceTo(desiredTarget.current) < 0.015
    ) {
      isTransitioning.current = false;
    }
  });

  const isInterior = cameraPreset === 'interior_row2';

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      // Disable orbit rotation when Power MAIN is OFF (Manual door drag mode) so dragging the door never spins the camera!
      enableRotate={powerMainOn}
      enableZoom={powerMainOn && !isInterior}
      minDistance={isInterior ? 0.15 : 1.5}
      maxDistance={isInterior ? 0.85 : 8.5}
      minPolarAngle={0.28}
      maxPolarAngle={Math.PI / 2 - 0.04}
      onStart={() => {
        isTransitioning.current = false;
      }}
    />
  );
}
