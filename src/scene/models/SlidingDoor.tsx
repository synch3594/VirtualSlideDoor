import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { BODY_COLORS } from '../../simulation/types';
import { computeDoorPose, DOOR_METRICS } from '../../simulation/doorKinematics';
import { liveSim, useDoorStore } from '../../store/useDoorStore';
import {
  bodySideX,
  createCurvedSidePanel,
  createRoundedBoxGeometry,
} from './vehicleGeometry';

/**
 * The Star of the App: Ultra-authentic Sculpted Left Power Sliding Door
 * - Conforms to the EXACT bodySideX(y) tumblehome & convex door curvature for 0mm flush-fit!
 * - 3D Pop-out, Parallel Slide, Pull-in, & Easy Closer Flush-fit kinematics
 * - Contoured Outer Chrome Handle with One-Touch rubber switch
 * - Curved Inner Trim + Interactive Inner Chrome Handle
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
        roughness: 0.12,
        clearcoat: 0.95,
      }),
    []
  );

  const privacyGlassMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#0a121f',
        metalness: 0.12,
        roughness: 0.05,
        opacity: 0.85,
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

  // Curved sliding door geometries matching bodySideX(y) identically!
  const doorGeos = useMemo(() => {
    const cz = DOOR_METRICS.doorClosedCenterZ; // -0.31
    const zFront = cz + 0.526; // +0.216 (4mm crisp shut line to B-pillar at +0.22)
    const zRear = cz - 0.526; // -0.836 (4mm crisp shut line to C-pillar at -0.84)

    return {
      // Sculpted lower painted steel door skin
      outerLowerSkin: createCurvedSidePanel({
        side: 1,
        zMin: zRear,
        zMax: zFront,
        yMin: 0.344,
        yMax: 1.072,
        thickness: 0.044,
        characterCrease: true,
        zShift: cz,
        rows: 16,
        cols: 16,
        usePlanTaper: false,
      }),
      // Curved chrome beltline molding matching front door & rear quarter identically
      beltChrome: createCurvedSidePanel({
        side: 1,
        zMin: zRear + 0.004,
        zMax: zFront - 0.004,
        yMin: 1.064,
        yMax: 1.084,
        xOffset: 0.005,
        thickness: 0.01,
        zShift: cz,
        rows: 2,
        cols: 12,
        usePlanTaper: false,
      }),
      // Curved upper privacy glass leaning smoothly inward with cabin tumblehome
      upperGlass: createCurvedSidePanel({
        side: 1,
        zMin: zRear + 0.056,
        zMax: zFront - 0.056,
        yMin: 1.074,
        yMax: 1.724,
        xOffset: -0.008,
        thickness: 0.014,
        zShift: cz,
        rows: 12,
        cols: 12,
        usePlanTaper: false,
      }),
      // Curved front vertical gloss-black window sash
      sashFront: createCurvedSidePanel({
        side: 1,
        zMin: zFront - 0.06,
        zMax: zFront,
        yMin: 1.072,
        yMax: 1.748,
        xOffset: 0.001,
        thickness: 0.038,
        zShift: cz,
        rows: 12,
        cols: 2,
        usePlanTaper: false,
      }),
      // Curved rear vertical gloss-black window sash
      sashRear: createCurvedSidePanel({
        side: 1,
        zMin: zRear,
        zMax: zRear + 0.06,
        yMin: 1.072,
        yMax: 1.748,
        xOffset: 0.001,
        thickness: 0.038,
        zShift: cz,
        rows: 12,
        cols: 2,
        usePlanTaper: false,
      }),
      // Curved top window frame sash meeting roof cant rail flush
      sashTop: createCurvedSidePanel({
        side: 1,
        zMin: zRear,
        zMax: zFront,
        yMin: 1.718,
        yMax: 1.748,
        xOffset: 0.001,
        thickness: 0.038,
        zShift: cz,
        rows: 3,
        cols: 12,
        usePlanTaper: false,
      }),
      // Curved interior door trim panel
      innerTrim: createCurvedSidePanel({
        side: 1,
        zMin: zRear + 0.022,
        zMax: zFront - 0.022,
        yMin: 0.365,
        yMax: 1.055,
        xOffset: -0.044,
        thickness: 0.028,
        zShift: cz,
        rows: 12,
        cols: 12,
        usePlanTaper: false,
      }),
      // Curved front-edge rubber anti-pinch sensor strip
      antiPinchEdge: createCurvedSidePanel({
        side: 1,
        zMin: zFront - 0.002,
        zMax: zFront + 0.012,
        yMin: 0.35,
        yMax: 1.742,
        xOffset: -0.008,
        thickness: 0.034,
        zShift: cz,
        rows: 16,
        cols: 2,
        usePlanTaper: false,
      }),
      // Curved rear-edge rubber seal
      rearEdgeSeal: createCurvedSidePanel({
        side: 1,
        zMin: zRear - 0.01,
        zMax: zRear + 0.002,
        yMin: 0.35,
        yMax: 1.742,
        xOffset: -0.008,
        thickness: 0.032,
        zShift: cz,
        rows: 16,
        cols: 2,
        usePlanTaper: false,
      }),
      outerHandleBar: createRoundedBoxGeometry(0.025, 0.032, 0.175, 0.008, 3),
      armrestPad: createRoundedBoxGeometry(0.048, 0.062, 0.62, 0.016, 3),
    };
  }, []);

  const handleSurfaceX = bodySideX(0.95);
  const centerRailBodyX = bodySideX(DOOR_METRICS.centerRailY);
  const upperTrackX = bodySideX(1.745);

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
      outerHandleRef.current.rotation.y = pull * 0.28;
    }
    if (oneTouchBtnRef.current) {
      const press = Math.sin(liveSim.outerButtonPress * Math.PI);
      oneTouchBtnRef.current.position.x = 0.018 - press * 0.006;
    }
    if (innerHandleRef.current) {
      const pull = Math.sin(liveSim.innerHandlePull * Math.PI);
      innerHandleRef.current.rotation.y = pull * 0.35;
    }

    // 3. Articulated Center Roller Arm riding precisely inside the body's curved center rail!
    const cosY = Math.cos(pose.yaw);
    const sinY = Math.sin(pose.yaw);
    const localArmX = centerRailBodyX - 0.04;
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
      const lowerX = bodySideX(0.345) - 0.065 + pose.xOffset * 0.5;
      const lowerZ = DOOR_METRICS.doorClosedCenterZ + pose.zOffset + 0.44;
      lowerArmGroupRef.current.position.set(lowerX, 0.345, lowerZ);
      lowerArmGroupRef.current.scale.x = Math.max(
        0.35,
        0.35 + (pose.xOffset / DOOR_METRICS.maxPopoutX) * 0.95
      );
    }

    // 5. Upper Roof Track Guide Arm (neatly tucked inside tumblehome roof cant rail!)
    if (upperArmGroupRef.current) {
      const upperX = upperTrackX - 0.055 + pose.xOffset * 0.5;
      const upperZ = DOOR_METRICS.doorClosedCenterZ + pose.zOffset + 0.42;
      upperArmGroupRef.current.position.set(upperX, 1.735, upperZ);
      upperArmGroupRef.current.scale.x = Math.max(
        0.32,
        0.32 + (pose.xOffset / DOOR_METRICS.maxPopoutX) * 0.92
      );
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
      {/* ===================== MOVING CURVED SLIDING DOOR ASSEMBLY ===================== */}
      <group
        ref={doorGroupRef}
        position={[0, 0, DOOR_METRICS.doorClosedCenterZ]}
        onPointerDown={handleDoorPointerDown}
        onPointerMove={handleDoorPointerMove}
        onPointerUp={handleDoorPointerUp}
        onPointerCancel={handleDoorPointerUp}
      >
        {/* Sculpted Outer Lower Painted Steel Panel */}
        <mesh geometry={doorGeos.outerLowerSkin} material={paintMaterial} castShadow receiveShadow />

        {/* Curved Chrome Window Beltline Trim */}
        <mesh geometry={doorGeos.beltChrome} material={chromeMaterial} />

        {/* Curved Upper Window Privacy Glass & Tumblehome Window Frame Sashes */}
        <mesh geometry={doorGeos.upperGlass} material={privacyGlassMaterial} />
        <mesh geometry={doorGeos.sashFront} material={glossBlackMaterial} />
        <mesh geometry={doorGeos.sashRear} material={glossBlackMaterial} />
        <mesh geometry={doorGeos.sashTop} material={glossBlackMaterial} />

        {/* ===== INNER DOOR TRIM PANEL (visible when open & from 2nd-row interior view) ===== */}
        <mesh geometry={doorGeos.innerTrim}>
          <meshStandardMaterial color="#1f242d" roughness={0.82} />
        </mesh>
        {/* Contoured Inner Armrest Pad */}
        <mesh position={[bodySideX(0.78) - 0.085, 0.78, -0.04]} geometry={doorGeos.armrestPad}>
          <meshStandardMaterial color="#2a303c" roughness={0.85} />
        </mesh>
        {/* Inner Door Bottle Pocket */}
        <mesh position={[bodySideX(0.48) - 0.084, 0.48, 0.24]}>
          <boxGeometry args={[0.036, 0.14, 0.28]} />
          <meshStandardMaterial color="#141820" roughness={0.9} />
        </mesh>

        {/* Interactive Inner Chrome Door Handle (for Interior 2nd-row view!) */}
        <group
          position={[bodySideX(0.92) - 0.075, 0.92, 0.28]}
          onClick={(e) => {
            e.stopPropagation();
            triggerDoorToggle('inner_handle');
          }}
        >
          <mesh>
            <boxGeometry args={[0.018, 0.065, 0.14]} />
            <meshStandardMaterial color="#0f172a" roughness={0.5} />
          </mesh>
          <mesh ref={innerHandleRef} position={[-0.012, 0, 0]} material={chromeMaterial}>
            <boxGeometry args={[0.014, 0.028, 0.1]} />
          </mesh>
          <mesh visible={false}>
            <boxGeometry args={[0.12, 0.18, 0.26]} />
            <meshBasicMaterial />
          </mesh>
        </group>

        {/* ===== OUTER CHROME DOOR HANDLE + ONE-TOUCH SWITCH ===== */}
        <group position={[handleSurfaceX + 0.002, 0.95, 0.34]}>
          {/* Handle recess pocket */}
          <mesh position={[-0.004, 0, 0]}>
            <boxGeometry args={[0.012, 0.062, 0.205]} />
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
            {/* Contoured Chrome Pull Bar */}
            <mesh position={[0.019, 0, 0.075]} geometry={doorGeos.outerHandleBar} material={chromeMaterial} castShadow />
            {/* Front & rear handle mounting posts */}
            <mesh position={[0.006, 0, 0.012]} material={chromeMaterial}>
              <boxGeometry args={[0.022, 0.026, 0.024]} />
            </mesh>
            <mesh position={[0.006, 0, 0.145]} material={chromeMaterial}>
              <boxGeometry args={[0.022, 0.026, 0.024]} />
            </mesh>

            {/* ONE-TOUCH BLACK RUBBER SWITCH on handle! */}
            <mesh
              ref={oneTouchBtnRef}
              position={[0.018, 0, 0.132]}
              onClick={(e) => {
                e.stopPropagation();
                triggerDoorToggle('outer_button');
              }}
            >
              <boxGeometry args={[0.028, 0.018, 0.024]} />
              <meshStandardMaterial color="#111827" roughness={0.55} />
            </mesh>
          </group>

          {/* Subtle glowing hotspot ring on handle so young kids instantly spot it */}
          <mesh
            position={[0.038, 0, 0.01]}
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

        {/* ===== CURVED FRONT DOOR EDGE RUBBER ANTI-PINCH SENSOR STRIP ===== */}
        <mesh
          geometry={doorGeos.antiPinchEdge}
          material={rubberMaterial}
          onClick={(e) => {
            if (isClosing) {
              e.stopPropagation();
              triggerAntiPinch();
            }
          }}
        />
        {isClosing && (
          <mesh
            position={[0.82, 1.05, 0.545]}
            visible={false}
            onClick={(e) => {
              e.stopPropagation();
              triggerAntiPinch();
            }}
          >
            <boxGeometry args={[0.18, 1.42, 0.14]} />
            <meshBasicMaterial />
          </mesh>
        )}

        {/* Curved Rear Edge Rubber Seal & Center Hinge Mounting Bracket */}
        <mesh geometry={doorGeos.rearEdgeSeal} material={rubberMaterial} />
        <mesh position={[centerRailBodyX - 0.04, DOOR_METRICS.centerRailY, DOOR_METRICS.doorRearArmLocalZ]}>
          <boxGeometry args={[0.038, 0.048, 0.052]} />
          <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.35} />
        </mesh>
      </group>

      {/* ===================== ARTICULATED 3-POINT ROLLER ARM MECHANISMS ===================== */}
      {/* 1. Center Roller Carriage riding strictly inside the body's curved center rail */}
      <group
        ref={centerRollerCarriageRef}
        position={[DOOR_METRICS.bodyLeftX - 0.055, DOOR_METRICS.centerRailY, -0.84]}
      >
        <mesh>
          <boxGeometry args={[0.026, 0.03, 0.072]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.024]}>
          <cylinderGeometry args={[0.011, 0.011, 0.024, 12]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, -0.024]}>
          <cylinderGeometry args={[0.011, 0.011, 0.024, 12]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.35} />
        </mesh>
      </group>

      {/* Center Articulating Steel Link Arm */}
      <group
        ref={centerArmPivotRef}
        position={[DOOR_METRICS.bodyLeftX - 0.055, DOOR_METRICS.centerRailY, -0.84]}
      >
        <mesh ref={centerArmBarRef} castShadow>
          <boxGeometry args={[0.02, 0.024, 1]} />
          <meshStandardMaterial color="#1e293b" metalness={0.78} roughness={0.32} />
        </mesh>
      </group>

      {/* 2. Lower Heavy-Duty Gooseneck Roller Arm */}
      <group ref={lowerArmGroupRef} position={[0.76, 0.345, 0.13]}>
        <mesh castShadow>
          <boxGeometry args={[0.14, 0.022, 0.052]} />
          <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.38} />
        </mesh>
        <mesh position={[-0.06, -0.012, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.02, 12]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.35} />
        </mesh>
      </group>

      {/* 3. Upper Roof Guide Roller Arm (aligned inside tumblehome roof track) */}
      <group ref={upperArmGroupRef} position={[upperTrackX - 0.055, 1.735, 0.11]}>
        <mesh>
          <boxGeometry args={[0.125, 0.016, 0.04]} />
          <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.38} />
        </mesh>
      </group>
    </group>
  );
}
