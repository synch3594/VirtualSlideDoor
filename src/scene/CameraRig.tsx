import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CameraPreset } from '../simulation/types';
import { useDoorStore } from '../store/useDoorStore';
import { getViewportLayout } from '../hooks/useViewportLayout';

interface CameraSpec {
  pos: [number, number, number];
  target: [number, number, number];
  fovLandscape: number;
  fovPortrait: number;
  /** Minimum unobstructed width/height ratio before gently pulling camera back */
  idealAspect: number;
}

/**
 * Curated camera presets designed specifically for smartphone portrait & landscape viewing.
 * Automatically adjusts frustum view-offset & distance so the minivan stays cleanly centered
 * in the unobstructed area away from side/bottom UI docks.
 */
const PRESETS: Record<CameraPreset, CameraSpec> = {
  // 特等席：外から閉まるのを眺める斜め前（フロントVモーショングリル＋スライドドアの引き込み＆ツライチが一望！）
  exterior_front34: {
    pos: [4.15, 1.52, 2.95],
    target: [0.22, 0.94, -0.18],
    fovLandscape: 40,
    fovPortrait: 52,
    idealAspect: 1.75,
  },
  // 真横：ドア全体のスライド距離と広い開口部がよく見える
  exterior_side: {
    pos: [5.25, 1.32, -0.12],
    target: [0.15, 0.96, -0.12],
    fovLandscape: 38,
    fovPortrait: 54,
    idealAspect: 2.05,
  },
  // レール＆ローラーアーム機構アップ：斜め後ろからセンターレールとアームの動きを観察！
  rail_closeup: {
    pos: [2.25, 1.34, -2.12],
    target: [0.76, 1.02, -0.82],
    fovLandscape: 36,
    fovPortrait: 44,
    idealAspect: 1.4,
  },
  // 車内2列目視点：車の中からドア開閉・Bピラーボタン・外の景色を楽しむ
  interior_row2: {
    pos: [-0.36, 1.24, -0.58],
    target: [1.05, 0.98, -0.16],
    fovLandscape: 56,
    fovPortrait: 68,
    idealAspect: 1.0,
  },
};

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraPreset = useDoorStore((s) => s.cameraPreset);
  const powerMainOn = useDoorStore((s) => s.powerMainOn);
  const dockCollapsed = useDoorStore((s) => s.dockCollapsed);

  const { camera, size } = useThree();
  const isTransitioning = useRef(true);
  const userOrbited = useRef(false);
  const lastPreset = useRef<CameraPreset>(cameraPreset);
  const lastOrientationKey = useRef<string>('');
  const desiredPos = useRef(new THREE.Vector3(...PRESETS.exterior_front34.pos));
  const desiredTarget = useRef(new THREE.Vector3(...PRESETS.exterior_front34.target));

  // Smoothly interpolated frustum screen-space offset (px) to keep car clear of HUD panels
  const currentOffset = useRef({ x: 0, y: 0 });
  const desiredOffset = useRef({ x: 0, y: 0 });
  const offsetAppliedOnce = useRef(false);

  // Trigger smooth framing update whenever preset, screen dimensions, or dock collapse changes
  useEffect(() => {
    const spec = PRESETS[cameraPreset];
    const layout = getViewportLayout(size.width, size.height);
    const isInterior = cameraPreset === 'interior_row2';

    const presetChanged = lastPreset.current !== cameraPreset;
    const orientationKey = `${layout.isPortrait ? 'P' : layout.isCompactLandscape ? 'CL' : 'TL'}`;
    const orientationChanged = lastOrientationKey.current !== orientationKey;
    lastPreset.current = cameraPreset;
    lastOrientationKey.current = orientationKey;

    if (presetChanged || orientationChanged) {
      userOrbited.current = false;
    }

    // Compute unobstructed viewport metrics & screen-space frustum shift
    let offsetX = 0;
    let offsetY = 0;
    let distanceBoost = 1.0;

    if (layout.isCompactLandscape) {
      // Right-hand side dock leaves full vertical height open for the car!
      const dockOccupied = dockCollapsed ? 0 : layout.sideDockWidth + 14;
      const visibleWidth = Math.max(220, size.width - dockOccupied);
      offsetX = dockOccupied * (isInterior ? 0.35 : 0.5);
      offsetY = 0;

      if (!isInterior) {
        const visibleAspect = visibleWidth / Math.max(1, size.height);
        if (visibleAspect < spec.idealAspect) {
          distanceBoost = Math.min(1.55, spec.idealAspect / Math.max(0.85, visibleAspect));
        }
      }
    } else if (layout.isPortrait) {
      // Bottom dock in portrait: gently lift framing into the clear upper area
      offsetX = 0;
      offsetY = dockCollapsed
        ? Math.min(22, size.height * 0.025)
        : Math.min(isInterior ? 52 : 84, size.height * (isInterior ? 0.06 : 0.1));
      distanceBoost = isInterior ? 1.0 : 1.22;
    } else {
      // Tall landscape (tablet / desktop): lift framing cleanly above bottom dock
      const dockBottom = dockCollapsed ? 48 : 210;
      const visibleHeight = Math.max(260, size.height - dockBottom - 44);
      offsetX = 0;
      offsetY = dockCollapsed ? 0 : Math.min(isInterior ? 48 : 84, (dockBottom - 44) * 0.5);
      if (!isInterior) {
        const heightBoost = dockCollapsed ? 1.0 : Math.min(1.32, (size.height / visibleHeight) * 0.9);
        const aspect = size.width / Math.max(1, size.height);
        const aspectBoost = aspect < spec.idealAspect ? Math.min(1.28, spec.idealAspect / Math.max(1.0, aspect)) : 1.0;
        distanceBoost = Math.max(heightBoost, aspectBoost);
      }
    }

    desiredOffset.current = { x: offsetX, y: offsetY };

    // On initial mount or orientation flip, snap offset immediately so fullWidth/fullHeight stay synced
    if (!offsetAppliedOnce.current || orientationChanged) {
      currentOffset.current = { x: offsetX, y: offsetY };
      offsetAppliedOnce.current = true;
    }

    const baseTarget = new THREE.Vector3(...spec.target);
    const basePos = new THREE.Vector3(...spec.pos);
    const offsetVec = basePos.clone().sub(baseTarget).multiplyScalar(distanceBoost);

    desiredTarget.current.copy(baseTarget);
    desiredPos.current.copy(baseTarget).add(offsetVec);

    if (!userOrbited.current || presetChanged || orientationChanged) {
      isTransitioning.current = true;
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = layout.isPortrait ? spec.fovPortrait : spec.fovLandscape;
      if (Math.abs(currentOffset.current.x) > 0.2 || Math.abs(currentOffset.current.y) > 0.2) {
        camera.setViewOffset(
          size.width,
          size.height,
          currentOffset.current.x,
          currentOffset.current.y,
          size.width,
          size.height
        );
      } else {
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
    }
  }, [cameraPreset, size.width, size.height, dockCollapsed, camera]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);

    // 1. Smoothly animate screen-space view offset when collapsing/expanding the dock
    if (camera instanceof THREE.PerspectiveCamera) {
      const dx = desiredOffset.current.x - currentOffset.current.x;
      const dy = desiredOffset.current.y - currentOffset.current.y;
      if (Math.abs(dx) > 0.15 || Math.abs(dy) > 0.15) {
        const offsetLerp = 1 - Math.exp(-8.5 * dt);
        currentOffset.current.x += dx * offsetLerp;
        currentOffset.current.y += dy * offsetLerp;
        if (Math.abs(currentOffset.current.x) < 0.2 && Math.abs(currentOffset.current.y) < 0.2 && desiredOffset.current.x === 0 && desiredOffset.current.y === 0) {
          currentOffset.current.x = 0;
          currentOffset.current.y = 0;
          camera.clearViewOffset();
        } else {
          camera.setViewOffset(
            size.width,
            size.height,
            currentOffset.current.x,
            currentOffset.current.y,
            size.width,
            size.height
          );
        }
        camera.updateProjectionMatrix();
      }
    }

    // 2. Smoothly interpolate camera position & orbit target
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
        userOrbited.current = true;
      }}
    />
  );
}
