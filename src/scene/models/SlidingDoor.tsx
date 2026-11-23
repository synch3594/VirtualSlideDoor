import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { BODY_COLORS } from '../../simulation/types';
import { computeDoorPose, DOOR_METRICS } from '../../simulation/doorKinematics';
import { liveSim, useDoorStore } from '../../store/useDoorStore';

/**
 * The Star of the App: Ultra-authentic Left Power Sliding Door
 * - 3D Pop-out, Parallel Slide, Pull-in, & Easy Closer Flush-fit kinematics
 * - Outer Chrome Handle with One-Touch rubber switch
 * - Inner Trim + Interactive Inner Chrome Handle
 * - Front Edge Anti-Pinch Touch Strip (tap while closing to trigger safety reversal!)
 * - Articulated Center, Lower, and Upper Roller Arm Mechanisms riding inside the body rails
 * - Smooth Finger/Mouse Manual Drag Gesture Support
 */
export function SlidingDoor() {
  const doorGroupRef = useRef<THREE.Group>(null);
  const outerHandleRef = useRef<THREE.Group>(null);
  const oneTouchBtnRef = useRef<THREE.Mesh>(null);
  const innerHandleRef = useRef<THREE.Mesh>(null);

  // Articulated roller arm refs
  const centerArmPivotRef = useRef<THREE.Group>(null);
  const centerArmBarRef = useRef<THREE.Mesh>(null);
  const centerRollerCarriageRef = useRef<THREE.Group>(null);
  const lowerArmGroupRef = useRef<THREE.Group>(null);
  const upperArmGroupRef = useRef<THREE.Group>(null);
  const hotspotRingRef = useRef<THREE.MeshBasicMaterial>(null);

  // Drag gesture state
  const dragStateRef = useRef<{
    active: boolean;
    startClientX: number;
    lastClientX: number;
    lastTime: number;
    movedPx: number;
    velocityPxPerSec: number;
  }>({
    active: false,
    startClientX: 0,
    lastClientX: 0,
    lastTime: 0,
    movedPx: 0,
    velocityPxPerSec: 0,
  });

  const bodyColorId = useDoorStore((s) => s.bodyColorId);
  const phase = useDoorStore((s) => s.phase);
  const powerMainOn = useDoorStore((s) => s.powerMainOn);
  const showHotspots = useDoorStore((s) => s.showHotspots);
  const triggerDoorToggle = useDoorStore((s) => s.triggerDoorToggle);
  const triggerAntiPinch = useDoorStore((s) => s.triggerAntiPinch);
  const beginManualDrag = useDoorStore((s) => s.beginManualDrag);
  const updateManualDrag = useDoorStore((s) => s.updateManualDrag);
  const endManualDrag = useDoorStore((s) => s.endManualDrag);

  const colorSpec = useMemo(
    () => BODY_COLORS.find((c) => c.id === bodyColorId) ?? BODY_COLORS[0],
    [bodyColorId]
  );

  const paintMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: colorSpec.hex,
        metalness: colorSpec.metalness,
        roughness: colorSpec.roughness,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        reflectivity: 0.95,
      }),
    [colorSpec]
  );

  const chromeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f8fafc',
        metalness: 0.96,
        roughness: 0.11,
      }),
    []
  );

  const glossBlackMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#0b0f17',
        metalness: 0.25,
        roughness: 0.14,
        clearcoat: 0.9,
      }),
    []
  );

  const privacyGlassMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#0b1320',
        metalness: 0.12,
        roughness: 0.06,
        opacity: 0.84,
        transparent: true,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
      }),
    []
  );

  const rubberMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#14171f',
        roughness: 0.92,
      }),
    []
  );

  useFrame(({ clock }) => {
    const pose = computeDoorPose(liveSim.progress, liveSim.elasticBounce);

    // 1. Update Sliding Door 3D Position & Yaw
    if (doorGroupRef.current) {
      doorGroupRef.current.position.set(
        pose.xOffset,
        0,
        DOOR_METRICS.doorClosedCenterZ + pose.zOffset
      );
      doorGroupRef.current.rotation.y = pose.yaw;
    }

    // 2. Animate Outer Chrome Handle Pull & One-Touch Switch Depress
    if (outerHandleRef.current) {
      const pull = Math.sin(liveSim.outerHandlePull * Math.PI);
      // Positive Y rotation pulls the front (+Z) grip outward toward +X
      outerHandleRef.current.rotation.y = pull * 0.28;
    }
    if (oneTouchBtnRef.current) {
      const press = Math.sin(liveSim.outerButtonPress * Math.PI);
      oneTouchBtnRef.current.position.x = 0.017 - press * 0.006;
    }
    if (innerHandleRef.current) {
      const pull = Math.sin(liveSim.innerHandlePull * Math.PI);
      innerHandleRef.current.rotation.y = pull * 0.35;
    }

    // 3. Articulated Center Roller Arm riding precisely inside the body's curved center rail!
    // Door rear bracket world position (accounting for door yaw)
    const cosY = Math.cos(pose.yaw);
    const sinY = Math.sin(pose.yaw);
    const localArmX = DOOR_METRICS.bodyLeftX - 0.04;
    const localArmZ = DOOR_METRICS.doorRearArmLocalZ;
    const doorBracketWorldX = pose.xOffset + localArmX * cosY + localArmZ * sinY;
    const doorBracketWorldZ =
      DOOR_METRICS.doorClosedCenterZ + pose.zOffset - localArmX * sinY + localArmZ * cosY;

    if (centerRollerCarriageRef.current) {
      centerRollerCarriageRef.current.position.set(
        pose.centerRollerX,
        DOOR_METRICS.centerRailY,
        pose.centerRollerZ
      );
    }

    if (centerArmPivotRef.current && centerArmBarRef.current) {
      const dx = doorBracketWorldX - pose.centerRollerX;
      const dz = doorBracketWorldZ - pose.centerRollerZ;
      const length = Math.max(0.04, Math.hypot(dx, dz));
      const angle = Math.atan2(dx, dz);

      centerArmPivotRef.current.position.set(
        pose.centerRollerX,
        DOOR_METRICS.centerRailY,
        pose.centerRollerZ
      );
      centerArmPivotRef.current.rotation.y = angle;
      centerArmBarRef.current.scale.z = length;
      centerArmBarRef.current.position.z = length * 0.5;
    }

    // 4. Lower Gooseneck Roller Arm (front bottom corner of sliding door)
    if (lowerArmGroupRef.current) {
      const lowerX = DOOR_METRICS.bodyLeftX - 0.06 + pose.xOffset * 0.5;
      const lowerZ = DOOR_METRICS.doorClosedCenterZ + pose.zOffset + 0.44;
      lowerArmGroupRef.current.position.set(lowerX, 0.345, lowerZ);
      lowerArmGroupRef.current.scale.x = Math.max(0.35, 0.35 + (pose.xOffset / DOOR_METRICS.maxPopoutX) * 0.95);
    }

    // 5. Upper Roof Track Guide Arm
    if (upperArmGroupRef.current) {
      const upperX = DOOR_METRICS.bodyLeftX - 0.06 + pose.xOffset * 0.5;
      const upperZ = DOOR_METRICS.doorClosedCenterZ + pose.zOffset + 0.42;
      upperArmGroupRef.current.position.set(upperX, 1.755, upperZ);
      upperArmGroupRef.current.scale.x = Math.max(0.35, 0.35 + (pose.xOffset / DOOR_METRICS.maxPopoutX) * 0.95);
    }

    // 6. Subtle pulsing hotspot cue on the One-Touch Handle
    if (hotspotRingRef.current) {
      if (showHotspots && (phase === 'OPEN' || phase === 'CLOSED' || phase === 'PAUSED')) {
        const t = clock.getElapsedTime();
        hotspotRingRef.current.opacity = 0.25 + 0.2 * Math.sin(t * 3.0);
      } else {
        hotspotRingRef.current.opacity = 0;
      }
    }
  });

  // Pointer handlers for direct manual dragging of the sliding door!
  const handleDoorPointerDown = (e: ThreeEvent<PointerEvent>) => {
    // Only capture drag when Power MAIN is OFF (Manual mode) so OrbitControls works smoothly in Power mode,
    // OR allow tap on handle/body in Power mode!
    if (powerMainOn) return;
    e.stopPropagation();
    (e.target as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
    const now = performance.now();
    dragStateRef.current = {
      active: true,
      startClientX: e.clientX,
      lastClientX: e.clientX,
      lastTime: now,
      movedPx: 0,
      velocityPxPerSec: 0,
    };
    beginManualDrag();
  };

  const handleDoorPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragStateRef.current.active) return;
    e.stopPropagation();
    const now = performance.now();
    const dx = e.clientX - dragStateRef.current.lastClientX;
    const dt = Math.max(0.008, (now - dragStateRef.current.lastTime) / 1000);
    dragStateRef.current.movedPx += Math.abs(dx);
    dragStateRef.current.lastClientX = e.clientX;
    dragStateRef.current.lastTime = now;

    // From exterior left-side view, dragging RIGHT (+clientX) slides door toward REAR (-Z = OPEN, +progress)
    const sensitivity = 0.0046;
    const deltaProgress = dx * sensitivity;
    dragStateRef.current.velocityPxPerSec =
      dragStateRef.current.velocityPxPerSec * 0.6 + (deltaProgress / dt) * 0.4;
    updateManualDrag(deltaProgress);
  };

  const handleDoorPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragStateRef.current.active) return;
    e.stopPropagation();
    dragStateRef.current.active = false;
    endManualDrag(dragStateRef.current.velocityPxPerSec);
  };

  const isClosing =
    phase === 'CLOSING_SLIDE' || phase === 'CLOSING_PULLIN' || phase === 'EASY_CLOSER';

  return (
    <group>
      {/* ===================== MOVING SLIDING DOOR ASSEMBLY ===================== */}
      <group
        ref={doorGroupRef}
        position={[0, 0, DOOR_METRICS.doorClosedCenterZ]}
        onPointerDown={handleDoorPointerDown}
        onPointerMove={handleDoorPointerMove}
        onPointerUp={handleDoorPointerUp}
        onPointerCancel={handleDoorPointerUp}
      >
        {/* Outer Lower Painted Steel Panel (y = 0.345..1.08, width = 1.052m for crisp 4mm shut lines) */}
        <mesh position={[0.822, 0.712, 0]} material={paintMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.058, 0.735, 1.052]} />
        </mesh>

        {/* Sculpted Lower Character Crease */}
        <mesh position={[0.855, 0.48, 0]} material={paintMaterial}>
          <boxGeometry args={[0.016, 0.09, 1.03]} />
        </mesh>

        {/* Chrome Window Beltline Trim */}
        <mesh position={[0.853, 1.084, 0]} material={chromeMaterial}>
          <boxGeometry args={[0.014, 0.02, 1.046]} />
        </mesh>

        {/* Upper Window Privacy Glass */}
        <mesh position={[0.824, 1.425, 0]} material={privacyGlassMaterial}>
          <boxGeometry args={[0.024, 0.67, 0.94]} />
        </mesh>

        {/* Upper Window Frame Sashes (Blackout pillars + Top frame) */}
        {/* Front black sash */}
        <mesh position={[0.822, 1.425, 0.495]} material={glossBlackMaterial}>
          <boxGeometry args={[0.048, 0.695, 0.062]} />
        </mesh>
        {/* Rear black sash */}
        <mesh position={[0.822, 1.425, -0.495]} material={glossBlackMaterial}>
          <boxGeometry args={[0.048, 0.695, 0.062]} />
        </mesh>
        {/* Top window sash */}
        <mesh position={[0.822, 1.76, 0]} material={glossBlackMaterial}>
          <boxGeometry args={[0.048, 0.036, 1.052]} />
        </mesh>

        {/* ===== INNER DOOR TRIM PANEL (visible when door is open & from interior view) ===== */}
        <mesh position={[0.785, 0.71, 0]}>
          <boxGeometry args={[0.032, 0.71, 1.01]} />
          <meshStandardMaterial color="#1f242d" roughness={0.82} />
        </mesh>
        {/* Inner Armrest Pad */}
        <mesh position={[0.758, 0.78, -0.04]}>
          <boxGeometry args={[0.048, 0.065, 0.64]} />
          <meshStandardMaterial color="#2a303c" roughness={0.85} />
        </mesh>
        {/* Inner Door Bottle Pocket */}
        <mesh position={[0.764, 0.48, 0.24]}>
          <boxGeometry args={[0.036, 0.14, 0.28]} />
          <meshStandardMaterial color="#141820" roughness={0.9} />
        </mesh>

        {/* Interactive Inner Chrome Door Handle (for Interior 2nd-row view!) */}
        <group
          position={[0.768, 0.92, 0.28]}
          onClick={(e) => {
            e.stopPropagation();
            triggerDoorToggle('inner_handle');
          }}
        >
          {/* Recess bezel */}
          <mesh>
            <boxGeometry args={[0.018, 0.065, 0.14]} />
            <meshStandardMaterial color="#0f172a" roughness={0.5} />
          </mesh>
          {/* Pivoting chrome pull lever */}
          <mesh ref={innerHandleRef} position={[-0.012, 0, 0]} material={chromeMaterial}>
            <boxGeometry args={[0.014, 0.028, 0.1]} />
          </mesh>
          {/* Generous invisible hit area */}
          <mesh visible={false}>
            <boxGeometry args={[0.12, 0.18, 0.26]} />
            <meshBasicMaterial />
          </mesh>
        </group>

        {/* ===== OUTER CHROME DOOR HANDLE + ONE-TOUCH SWITCH ===== */}
        <group position={[0.854, 0.96, 0.34]}>
          {/* Handle recess pocket */}
          <mesh position={[-0.002, 0, 0]}>
            <boxGeometry args={[0.01, 0.065, 0.21]} />
            <meshStandardMaterial color="#0f172a" roughness={0.5} />
          </mesh>

          {/* Pivoting Chrome Outer Handle */}
          <group
            ref={outerHandleRef}
            position={[0, 0, -0.075]}
            onClick={(e) => {
              e.stopPropagation();
              triggerDoorToggle('outer_handle');
            }}
          >
            {/* Main chrome bar */}
            <mesh position={[0.018, 0, 0.075]} material={chromeMaterial} castShadow>
              <boxGeometry args={[0.024, 0.034, 0.175]} />
            </mesh>
            {/* Front & rear handle posts */}
            <mesh position={[0.006, 0, 0.012]} material={chromeMaterial}>
              <boxGeometry args={[0.022, 0.028, 0.024]} />
            </mesh>
            <mesh position={[0.006, 0, 0.145]} material={chromeMaterial}>
              <boxGeometry args={[0.022, 0.028, 0.024]} />
            </mesh>

            {/* ONE-TOUCH BLACK RUBBER SWITCH on handle! */}
            <mesh
              ref={oneTouchBtnRef}
              position={[0.017, 0, 0.132]}
              onClick={(e) => {
                e.stopPropagation();
                triggerDoorToggle('outer_button');
              }}
            >
              <boxGeometry args={[0.028, 0.02, 0.024]} />
              <meshStandardMaterial color="#111827" roughness={0.55} />
            </mesh>
          </group>

          {/* Subtle glowing hotspot ring on handle so young kids instantly spot it */}
          <mesh
            position={[0.036, 0, 0.01]}
            rotation={[0, Math.PI / 2, 0]}
            onClick={(e) => {
              e.stopPropagation();
              triggerDoorToggle('outer_button');
            }}
          >
            <ringGeometry args={[0.065, 0.088, 24]} />
            <meshBasicMaterial
              ref={hotspotRingRef}
              color="#38bdf8"
              transparent
              opacity={0.35}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Generous invisible hit box for toddler thumbs on smartphone */}
          <mesh
            visible={false}
            onClick={(e) => {
              e.stopPropagation();
              triggerDoorToggle('outer_handle');
            }}
          >
            <boxGeometry args={[0.16, 0.24, 0.34]} />
            <meshBasicMaterial />
          </mesh>
        </group>

        {/* ===== FRONT DOOR EDGE RUBBER ANTI-PINCH SENSOR STRIP ===== */}
        <mesh
          position={[0.815, 1.05, 0.528]}
          material={rubberMaterial}
          onClick={(e) => {
            if (isClosing) {
              e.stopPropagation();
              triggerAntiPinch();
            }
          }}
        >
          <boxGeometry args={[0.042, 1.41, 0.018]} />
        </mesh>
        {/* Invisible wider anti-pinch touch strip active while closing */}
        {isClosing && (
          <mesh
            position={[0.84, 1.05, 0.545]}
            visible={false}
            onClick={(e) => {
              e.stopPropagation();
              triggerAntiPinch();
            }}
          >
            <boxGeometry args={[0.16, 1.42, 0.14]} />
            <meshBasicMaterial />
          </mesh>
        )}

        {/* Rear edge rubber seal & mechanical latch hook */}
        <mesh position={[0.815, 1.05, -0.528]} material={rubberMaterial}>
          <boxGeometry args={[0.04, 1.41, 0.014]} />
        </mesh>
        {/* Door-side Center Hinge Mounting Bracket */}
        <mesh position={[0.805, DOOR_METRICS.centerRailY, DOOR_METRICS.doorRearArmLocalZ]}>
          <boxGeometry args={[0.04, 0.052, 0.055]} />
          <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.35} />
        </mesh>
      </group>

      {/* ===================== ARTICULATED 3-POINT ROLLER ARM MECHANISMS ===================== */}
      {/* 1. Center Roller Carriage riding strictly inside the body's curved center rail */}
      <group
        ref={centerRollerCarriageRef}
        position={[DOOR_METRICS.bodyLeftX - 0.055, DOOR_METRICS.centerRailY, -0.84]}
      >
        {/* Steel carriage body */}
        <mesh>
          <boxGeometry args={[0.028, 0.032, 0.075]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Front & rear white nylon guide rollers */}
        <mesh position={[0, 0, 0.024]}>
          <cylinderGeometry args={[0.012, 0.012, 0.026, 12]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, -0.024]}>
          <cylinderGeometry args={[0.012, 0.012, 0.026, 12]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.35} />
        </mesh>
      </group>

      {/* Center Articulating Steel Link Arm (connects carriage -> door rear edge!) */}
      <group
        ref={centerArmPivotRef}
        position={[DOOR_METRICS.bodyLeftX - 0.055, DOOR_METRICS.centerRailY, -0.84]}
      >
        <mesh ref={centerArmBarRef} castShadow>
          <boxGeometry args={[0.022, 0.026, 1]} />
          <meshStandardMaterial color="#1e293b" metalness={0.78} roughness={0.32} />
        </mesh>
      </group>

      {/* 2. Lower Heavy-Duty Gooseneck Roller Arm (under sliding door front corner) */}
      <group ref={lowerArmGroupRef} position={[0.78, 0.345, 0.13]}>
        <mesh castShadow>
          <boxGeometry args={[0.14, 0.024, 0.055]} />
          <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.38} />
        </mesh>
        <mesh position={[-0.06, -0.012, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.02, 12]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.35} />
        </mesh>
      </group>

      {/* 3. Upper Roof Guide Roller Arm */}
      <group ref={upperArmGroupRef} position={[0.78, 1.755, 0.11]}>
        <mesh>
          <boxGeometry args={[0.13, 0.018, 0.042]} />
          <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.38} />
        </mesh>
      </group>
    </group>
  );
}
