import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BODY_COLORS } from '../../simulation/types';
import { liveSim, useDoorStore } from '../../store/useDoorStore';
import { DOOR_METRICS } from '../../simulation/doorKinematics';
import {
  aPillarZ,
  bodySideX,
  createAPillarGeometry,
  createCurvedSidePanel,
  createCurvedWindshieldGeometry,
  createFlushFrontStripGeometry,
  createFlushRearStripGeometry,
  createFrontNoseGeometry,
  createHeadlightSideWingGeometry,
  createMirrorCapGeometry,
  createRearGlassGeometry,
  createRearTailgateGeometry,
  createRoundedBoxGeometry,
  createSculptedRoofGeometry,
  createSculptedTireGeometry,
  createSharkFinGeometry,
  createWheelArchFlareGeometry,
  dPillarRearZ,
  frontBeltlineY,
  frontCornerZ,
  frontFasciaPoint,
  hoodEdgeY,
  rearCornerZ,
  rearFasciaPoint,
  VEHICLE_DIMS,
} from './vehicleGeometry';

function createLicensePlateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 496, 240);

    ctx.fillStyle = '#14532d';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('東京 300', 256, 82);

    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('あ', 78, 198);
    ctx.font = 'bold 112px sans-serif';
    ctx.fillText('12-34', 292, 206);

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(96, 48, 9, 0, Math.PI * 2);
    ctx.arc(416, 48, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function AlloyWheel({
  position,
  isLeft,
  tireGeometry,
}: {
  position: [number, number, number];
  isLeft: boolean;
  tireGeometry: THREE.BufferGeometry;
}) {
  const dir = isLeft ? 1 : -1;
  return (
    <group position={position}>
      {/* Sculpted rounded-profile rubber tire */}
      <mesh geometry={tireGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#15181e" roughness={0.86} metalness={0.04} />
      </mesh>
      {/* Dark alloy inner barrel */}
      <mesh position={[dir * 0.015, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.208, 0.208, 0.185, 28]} />
        <meshStandardMaterial color="#0f172a" metalness={0.55} roughness={0.48} />
      </mesh>
      {/* Ventilated steel brake rotor disc */}
      <mesh position={[dir * 0.042, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.152, 0.152, 0.018, 28]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.86} roughness={0.34} />
      </mesh>
      {/* Brake caliper */}
      <mesh position={[dir * 0.044, 0.04, -0.115]}>
        <boxGeometry args={[0.045, 0.09, 0.065]} />
        <meshStandardMaterial color="#475569" metalness={0.65} roughness={0.4} />
      </mesh>
      {/* Machined outer alloy rim lip */}
      <mesh position={[dir * 0.095, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.204, 0.015, 12, 32]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.93} roughness={0.16} />
      </mesh>
      {/* 5-twin-spoke machined two-tone alloy spokes */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i * Math.PI * 2) / 5;
        return (
          <group key={i} rotation={[angle, 0, 0]}>
            <mesh position={[dir * 0.096, 0.096, 0.019]} rotation={[0.14, 0, 0]}>
              <boxGeometry args={[0.014, 0.185, 0.022]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.16} />
            </mesh>
            <mesh position={[dir * 0.093, 0.096, -0.019]} rotation={[-0.14, 0, 0]}>
              <boxGeometry args={[0.014, 0.185, 0.022]} />
              <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.28} />
            </mesh>
          </group>
        );
      })}
      {/* Center hub dish + lug nuts */}
      <mesh position={[dir * 0.098, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.046, 0.052, 0.02, 20]} />
        <meshStandardMaterial color="#1e293b" metalness={0.78} roughness={0.24} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i * Math.PI * 2) / 5 + 0.3;
        return (
          <mesh
            key={`lug-${i}`}
            position={[dir * 0.104, Math.cos(a) * 0.06, Math.sin(a) * 0.06]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.008, 0.008, 0.012, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.15} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Enclosed dark wheel-well liner drum behind each wheel arch so the chassis never looks hollow.
 */
function WheelWellHousing({ position, side }: { position: [number, number, number]; side: 1 | -1 }) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.372, 0.372, 0.3, 24, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color="#0b0e14" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-side * 0.145, 0.14, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.37, 24, 0, Math.PI]} />
        <meshStandardMaterial color="#090c11" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * Sculpted Modern Japanese Minivan Body Shell:
 * - Seamless corner-matched front nose, fenders, rear quarter, and tailgate (0mm flange/gap)
 * - Flush contoured wrap-around LED headlights, curved chrome grille, and vertical LED taillights
 * - Authentic cabin tumblehome, curved windshield & rear glass tightly framed by sloped A/B/C/D pillars
 * - Continuous arched roofline flowing cleanly from windshield header to integrated rear roof spoiler
 * - Left-side sliding doorway cutout with curved weatherstrip, crisp 6mm shut line, & recessed center slide rail
 */
export function MinivanBody() {
  const bodyColorId = useDoorStore((s) => s.bodyColorId);
  const timeOfDay = useDoorStore((s) => s.timeOfDay);

  const colorSpec = useMemo(
    () => BODY_COLORS.find((c) => c.id === bodyColorId) ?? BODY_COLORS[0],
    [bodyColorId]
  );

  const plateTexture = useMemo(() => createLicensePlateTexture(), []);

  // ===================== SHARED AUTOMOTIVE PBR MATERIALS =====================
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

  const roofMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: colorSpec.roofHex,
        metalness: colorSpec.roofHex === '#0f172a' ? 0.45 : colorSpec.metalness,
        roughness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
      }),
    [colorSpec]
  );

  const chromeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f1f5f9',
        metalness: 0.96,
        roughness: 0.12,
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

  const matteRubberMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#171a21',
        roughness: 0.92,
        metalness: 0.04,
      }),
    []
  );

  const privacyGlassMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#0a121f',
        metalness: 0.12,
        roughness: 0.05,
        opacity: 0.86,
        transparent: true,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
      }),
    []
  );

  const clearGlassMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#1a2638',
        metalness: 0.1,
        roughness: 0.04,
        opacity: 0.52,
        transparent: true,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
      }),
    []
  );

  const hazardMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#78350f',
        emissive: '#ff9500',
        emissiveIntensity: 0.05,
        roughness: 0.22,
      }),
    []
  );

  const headlightMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f8fafc',
        emissive: '#e0f2fe',
        emissiveIntensity: 0.5,
        roughness: 0.12,
      }),
    []
  );

  const taillightMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#7f1d1d',
        emissive: '#ef4444',
        emissiveIntensity: 0.35,
        roughness: 0.18,
      }),
    []
  );

  useFrame(() => {
    const on = liveSim.hazardOn;
    hazardMaterial.emissiveIntensity = on ? 5.2 : 0.05;
    hazardMaterial.color.set(on ? '#ffb703' : '#78350f');

    headlightMaterial.emissiveIntensity =
      timeOfDay === 'night' ? 3.4 : timeOfDay === 'sunset' ? 1.85 : 0.45;
    taillightMaterial.emissiveIntensity =
      timeOfDay === 'night' ? 2.9 : timeOfDay === 'sunset' ? 1.65 : 0.35;
  });

  // ===================== PARAMETRIC SCULPTED GEOMETRIES =====================
  const geos = useMemo(() => {
    const frontArch = {
      centerZ: VEHICLE_DIMS.frontAxleZ,
      centerY: VEHICLE_DIMS.wheelArchCenterY,
      radius: VEHICLE_DIMS.wheelArchRadius,
    };
    const rearArch = {
      centerZ: VEHICLE_DIMS.rearAxleZ,
      centerY: VEHICLE_DIMS.wheelArchCenterY,
      radius: VEHICLE_DIMS.wheelArchRadius,
    };

    const fenderTopY = (z: number) => (z >= 1.44 ? hoodEdgeY(z) : frontBeltlineY(z));

    return {
      // Major lofted shells
      frontNose: createFrontNoseGeometry(),
      roof: createSculptedRoofGeometry(),
      windshield: createCurvedWindshieldGeometry(0.012, 0.026),
      aPillarL: createAPillarGeometry(1),
      aPillarR: createAPillarGeometry(-1),
      rearTailgate: createRearTailgateGeometry(),
      rearGlass: createRearGlassGeometry(),
      tire: createSculptedTireGeometry(),
      mirrorCap: createMirrorCapGeometry(),
      sharkFin: createSharkFinGeometry(),
      handleBar: createRoundedBoxGeometry(0.026, 0.032, 0.165, 0.008, 3),

      // ===== FLUSH CURVED FRONT FASCIA GRILLE & WRAP-AROUND LED HEADLIGHTS =====
      grilleHousing: createFlushFrontStripGeometry(-0.62, 0.62, 0.49, 0.85, 0.008, 0.018, 18, 6),
      grilleTopChrome: createFlushFrontStripGeometry(-0.74, 0.74, 0.85, 0.88, 0.014, 0.014, 20, 2),
      grilleBars: [0.805, 0.73, 0.655, 0.58].map((yBar, idx) => {
        const span = 0.58 - idx * 0.025;
        return createFlushFrontStripGeometry(-span, span, yBar - 0.011, yBar + 0.011, 0.015, 0.012, 16, 2);
      }),
      lowerIntake: createFlushFrontStripGeometry(-0.56, 0.56, 0.275, 0.405, 0.008, 0.016, 16, 4),
      fogBezelL: createFlushFrontStripGeometry(0.64, 0.88, 0.30, 0.425, 0.009, 0.014, 8, 4),
      fogBezelR: createFlushFrontStripGeometry(-0.88, -0.64, 0.30, 0.425, 0.009, 0.014, 8, 4),

      // Flush wrap-around front headlights (front fascia face + fender side wrap!)
      hlHousingL: createFlushFrontStripGeometry(0.62, 1.0, 0.765, 0.885, 0.009, 0.016, 12, 5),
      hlHousingR: createFlushFrontStripGeometry(-1.0, -0.62, 0.765, 0.885, 0.009, 0.016, 12, 5),
      hlSideWingL: createHeadlightSideWingGeometry(1, 0.765, 0.885, 1.92, 0.007),
      hlSideWingR: createHeadlightSideWingGeometry(-1, 0.765, 0.885, 1.92, 0.007),
      hlDrlTopL: createFlushFrontStripGeometry(0.64, 0.99, 0.852, 0.874, 0.014, 0.01, 10, 2),
      hlDrlTopR: createFlushFrontStripGeometry(-0.99, -0.64, 0.852, 0.874, 0.014, 0.01, 10, 2),
      hlDrlBotL: createFlushFrontStripGeometry(0.66, 0.96, 0.778, 0.796, 0.014, 0.01, 10, 2),
      hlDrlBotR: createFlushFrontStripGeometry(-0.96, -0.66, 0.778, 0.796, 0.014, 0.01, 10, 2),
      hlLampCoreL: createFlushFrontStripGeometry(0.68, 0.86, 0.805, 0.842, 0.013, 0.01, 8, 2),
      hlLampCoreR: createFlushFrontStripGeometry(-0.86, -0.68, 0.805, 0.842, 0.013, 0.01, 8, 2),
      hlTurnL: createFlushFrontStripGeometry(0.87, 0.99, 0.806, 0.842, 0.015, 0.01, 6, 2),
      hlTurnR: createFlushFrontStripGeometry(-0.99, -0.87, 0.806, 0.842, 0.015, 0.01, 6, 2),

      // ===== FLUSH CURVED REAR FASCIA & WRAP-AROUND VERTICAL LED TAILLIGHTS =====
      rearDiffuser: createFlushRearStripGeometry(-0.78, 0.78, 0.215, 0.305, 0.007, 0.018, 18, 3),
      rearGarnishChrome: createFlushRearStripGeometry(-0.56, 0.56, 0.955, 0.992, 0.013, 0.012, 16, 2),
      // Vertical slim LED taillights nestled seamlessly into left/right rear D-pillar edges!
      tlHousingL: createFlushRearStripGeometry(0.87, 1.0, 1.075, 1.66, 0.008, 0.022, 6, 12),
      tlHousingR: createFlushRearStripGeometry(-1.0, -0.87, 1.075, 1.66, 0.008, 0.022, 6, 12),
      tlBladeL: createFlushRearStripGeometry(0.905, 0.975, 1.24, 1.62, 0.014, 0.012, 4, 10),
      tlBladeR: createFlushRearStripGeometry(-0.975, -0.905, 1.24, 1.62, 0.014, 0.012, 4, 10),
      tlReverseL: createFlushRearStripGeometry(0.905, 0.975, 1.175, 1.225, 0.014, 0.012, 4, 3),
      tlReverseR: createFlushRearStripGeometry(-0.975, -0.905, 1.175, 1.225, 0.014, 0.012, 4, 3),
      tlTurnL: createFlushRearStripGeometry(0.905, 0.975, 1.095, 1.162, 0.014, 0.012, 4, 4),
      tlTurnR: createFlushRearStripGeometry(-0.975, -0.905, 1.095, 1.162, 0.014, 0.012, 4, 4),
      // Taillight side wrap strip on rear D-pillar corner
      tlSideWrapL: createCurvedSidePanel({
        side: 1,
        zMin: -2.18,
        zMax: -2.02,
        yMin: 1.075,
        yMax: 1.64,
        zMinAtY: (y) => dPillarRearZ(y) - 0.004,
        zMaxAtY: (y) => dPillarRearZ(y) + 0.055,
        xOffset: 0.007,
        thickness: 0.016,
        rows: 10,
        cols: 3,
      }),
      tlSideWrapR: createCurvedSidePanel({
        side: -1,
        zMin: -2.18,
        zMax: -2.02,
        yMin: 1.075,
        yMax: 1.64,
        zMinAtY: (y) => dPillarRearZ(y) - 0.004,
        zMaxAtY: (y) => dPillarRearZ(y) + 0.055,
        xOffset: 0.007,
        thickness: 0.016,
        rows: 10,
        cols: 3,
      }),

      // ===== LEFT SIDE (+X) PANELS WITH REAL SLIDING DOORWAY CUTOUT =====
      leftFrontFender: createCurvedSidePanel({
        side: 1,
        zMin: 1.18,
        zMax: 2.165,
        yMin: VEHICLE_DIMS.sillBottomY,
        yMax: fenderTopY,
        zMaxAtY: (y) => frontCornerZ(y),
        wheelArch: frontArch,
        thickness: 0.042,
        characterCrease: true,
        rows: 16,
        cols: 30,
      }),
      // Extended rearward to zMin = 0.222 for a crisp 6mm shut line against the closed sliding door!
      leftFrontDoorLower: createCurvedSidePanel({
        side: 1,
        zMin: 0.222,
        zMax: 1.176,
        yMin: VEHICLE_DIMS.doorBottomY,
        yMax: frontBeltlineY,
        thickness: 0.042,
        characterCrease: true,
        rows: 14,
        cols: 16,
      }),
      // Curved front door + quarter window strictly bounded by aPillarZ(y) — ZERO protrusion!
      leftFrontWindowGlass: createCurvedSidePanel({
        side: 1,
        zMin: 0.295,
        zMax: 1.42,
        yMin: frontBeltlineY,
        yMax: 1.735,
        zMinAtY: () => 0.295,
        zMaxAtY: (y) => Math.max(0.32, aPillarZ(y) - 0.048),
        xOffset: -0.008,
        thickness: 0.012,
        rows: 14,
        cols: 14,
      }),
      // Slim black vertical mullion strictly tucked beneath A-pillar line (yMax = 1.46)
      leftQuarterDivider: createCurvedSidePanel({
        side: 1,
        zMin: 1.078,
        zMax: 1.106,
        yMin: frontBeltlineY(1.09),
        yMax: 1.465,
        xOffset: 0.001,
        thickness: 0.024,
        rows: 10,
        cols: 2,
      }),
      leftFrontBeltChrome: createCurvedSidePanel({
        side: 1,
        zMin: 0.224,
        zMax: 1.43,
        yMin: (z) => frontBeltlineY(z) - 0.01,
        yMax: (z) => frontBeltlineY(z) + 0.01,
        xOffset: 0.005,
        thickness: 0.01,
        rows: 3,
        cols: 18,
      }),
      leftLowerSill: createCurvedSidePanel({
        side: 1,
        zMin: -1.075,
        zMax: 1.18,
        yMin: 0.205,
        yMax: 0.342,
        thickness: 0.065,
        rows: 6,
        cols: 16,
      }),
      leftRockerAeroSkirt: createCurvedSidePanel({
        side: 1,
        zMin: -1.07,
        zMax: 1.08,
        yMin: 0.192,
        yMax: 0.24,
        xOffset: 0.008,
        thickness: 0.05,
        rows: 4,
        cols: 12,
      }),
      leftBPillarUpper: createCurvedSidePanel({
        side: 1,
        zMin: 0.222,
        zMax: 0.298,
        yMin: 1.065,
        yMax: 1.758,
        xOffset: 0.002,
        thickness: 0.044,
        rows: 12,
        cols: 3,
      }),
      // Structural B-pillar jamb backing the shut line (lower painted + upper dark frame) so zero light leaks through!
      leftBPillarLowerJamb: createCurvedSidePanel({
        side: 1,
        zMin: 0.205,
        zMax: 0.255,
        yMin: 0.335,
        yMax: 1.072,
        xOffset: -0.024,
        thickness: 0.068,
        rows: 10,
        cols: 2,
      }),
      leftBPillarUpperBacking: createCurvedSidePanel({
        side: 1,
        zMin: 0.202,
        zMax: 0.255,
        yMin: 1.07,
        yMax: 1.748,
        xOffset: -0.022,
        thickness: 0.042,
        rows: 10,
        cols: 2,
      }),
      leftRoofCantRail: createCurvedSidePanel({
        side: 1,
        zMin: -2.14,
        zMax: 0.89,
        yMin: 1.732,
        yMax: 1.768,
        xOffset: 0.002,
        thickness: 0.05,
        rows: 4,
        cols: 24,
      }),

      // Curved weatherstrip seals around the open sliding doorway
      sealFront: createCurvedSidePanel({
        side: 1,
        zMin: 0.206,
        zMax: 0.226,
        yMin: 0.34,
        yMax: 1.74,
        xOffset: -0.026,
        thickness: 0.024,
        rows: 16,
        cols: 2,
        usePlanTaper: false,
      }),
      sealRear: createCurvedSidePanel({
        side: 1,
        zMin: -0.854,
        zMax: -0.834,
        yMin: 0.34,
        yMax: 1.74,
        xOffset: -0.026,
        thickness: 0.024,
        rows: 16,
        cols: 2,
        usePlanTaper: false,
      }),
      sealTop: createCurvedSidePanel({
        side: 1,
        zMin: -0.848,
        zMax: 0.22,
        yMin: 1.728,
        yMax: 1.748,
        xOffset: -0.024,
        thickness: 0.024,
        rows: 2,
        cols: 12,
        usePlanTaper: false,
      }),
      sealBottom: createCurvedSidePanel({
        side: 1,
        zMin: -0.848,
        zMax: 0.22,
        yMin: 0.332,
        yMax: 0.352,
        xOffset: -0.024,
        thickness: 0.024,
        rows: 2,
        cols: 12,
        usePlanTaper: false,
      }),

      // Left Rear Quarter Panel seamlessly meeting rearCornerZ(y) + split along recessed center rail!
      leftRearQuarterBelowRail: createCurvedSidePanel({
        side: 1,
        zMin: -2.18,
        zMax: -0.844,
        yMin: VEHICLE_DIMS.sillBottomY,
        yMax: DOOR_METRICS.centerRailY - 0.021,
        zMinAtY: (y) => rearCornerZ(y),
        wheelArch: rearArch,
        thickness: 0.045,
        characterCrease: true,
        rows: 16,
        cols: 30,
      }),
      leftRearQuarterAboveRail: createCurvedSidePanel({
        side: 1,
        zMin: -2.18,
        zMax: -0.844,
        yMin: DOOR_METRICS.centerRailY + 0.021,
        yMax: 1.075,
        zMinAtY: (y) => rearCornerZ(y),
        thickness: 0.045,
        rows: 4,
        cols: 16,
      }),
      leftRearQuarterBehindRail: createCurvedSidePanel({
        side: 1,
        zMin: -2.18,
        zMax: -1.96,
        yMin: DOOR_METRICS.centerRailY - 0.023,
        yMax: DOOR_METRICS.centerRailY + 0.023,
        zMinAtY: (y) => rearCornerZ(y),
        thickness: 0.045,
        rows: 3,
        cols: 6,
      }),
      leftCenterRailBacking: createCurvedSidePanel({
        side: 1,
        zMin: -1.97,
        zMax: -0.84,
        yMin: DOOR_METRICS.centerRailY - 0.022,
        yMax: DOOR_METRICS.centerRailY + 0.022,
        xOffset: -0.045,
        thickness: 0.012,
        rows: 3,
        cols: 16,
        usePlanTaper: false,
      }),
      leftCPillarUpper: createCurvedSidePanel({
        side: 1,
        zMin: -0.92,
        zMax: -0.844,
        yMin: 1.068,
        yMax: 1.758,
        xOffset: 0.002,
        thickness: 0.044,
        rows: 12,
        cols: 3,
      }),
      leftRearQuarterGlass: createCurvedSidePanel({
        side: 1,
        zMin: -2.06,
        zMax: -0.916,
        yMin: 1.074,
        yMax: 1.735,
        zMinAtY: (y) => dPillarRearZ(y) + 0.145,
        zMaxAtY: () => -0.916,
        xOffset: -0.008,
        thickness: 0.012,
        rows: 12,
        cols: 14,
      }),
      leftDPillarUpper: createCurvedSidePanel({
        side: 1,
        zMin: -2.18,
        zMax: -1.92,
        yMin: 1.068,
        yMax: 1.758,
        zMinAtY: (y) => dPillarRearZ(y) - 0.004,
        zMaxAtY: (y) => dPillarRearZ(y) + 0.155,
        xOffset: 0.002,
        thickness: 0.045,
        rows: 12,
        cols: 4,
      }),
      leftRearBeltChrome: createCurvedSidePanel({
        side: 1,
        zMin: -2.02,
        zMax: -0.844,
        yMin: 1.064,
        yMax: 1.084,
        xOffset: 0.005,
        thickness: 0.01,
        rows: 2,
        cols: 16,
      }),

      // ===== RIGHT SIDE (-X) FULL ENCLOSED SYMMETRIC BODY =====
      rightFrontFender: createCurvedSidePanel({
        side: -1,
        zMin: 1.18,
        zMax: 2.165,
        yMin: VEHICLE_DIMS.sillBottomY,
        yMax: fenderTopY,
        zMaxAtY: (y) => frontCornerZ(y),
        wheelArch: frontArch,
        thickness: 0.042,
        characterCrease: true,
        rows: 16,
        cols: 30,
      }),
      rightCabinLowerBody: createCurvedSidePanel({
        side: -1,
        zMin: -0.844,
        zMax: 1.18,
        yMin: VEHICLE_DIMS.sillBottomY,
        yMax: frontBeltlineY,
        thickness: 0.045,
        characterCrease: true,
        rows: 16,
        cols: 24,
      }),
      rightRearQuarterLower: createCurvedSidePanel({
        side: -1,
        zMin: -2.18,
        zMax: -0.844,
        yMin: VEHICLE_DIMS.sillBottomY,
        yMax: 1.075,
        zMinAtY: (y) => rearCornerZ(y),
        wheelArch: rearArch,
        thickness: 0.045,
        characterCrease: true,
        rows: 16,
        cols: 30,
      }),
      rightFrontWindowGlass: createCurvedSidePanel({
        side: -1,
        zMin: 0.295,
        zMax: 1.42,
        yMin: frontBeltlineY,
        yMax: 1.735,
        zMinAtY: () => 0.295,
        zMaxAtY: (y) => Math.max(0.32, aPillarZ(y) - 0.048),
        xOffset: -0.008,
        thickness: 0.012,
        rows: 14,
        cols: 14,
      }),
      rightQuarterDivider: createCurvedSidePanel({
        side: -1,
        zMin: 1.078,
        zMax: 1.106,
        yMin: frontBeltlineY(1.09),
        yMax: 1.465,
        xOffset: 0.001,
        thickness: 0.024,
        rows: 10,
        cols: 2,
      }),
      rightRearSideGlass: createCurvedSidePanel({
        side: -1,
        zMin: -2.06,
        zMax: 0.225,
        yMin: 1.074,
        yMax: 1.735,
        zMinAtY: (y) => dPillarRearZ(y) + 0.145,
        zMaxAtY: () => 0.225,
        xOffset: -0.008,
        thickness: 0.012,
        rows: 12,
        cols: 22,
      }),
      rightBPillarUpper: createCurvedSidePanel({
        side: -1,
        zMin: 0.222,
        zMax: 0.298,
        yMin: 1.065,
        yMax: 1.758,
        xOffset: 0.002,
        thickness: 0.044,
        rows: 12,
        cols: 3,
      }),
      rightCPillarUpper: createCurvedSidePanel({
        side: -1,
        zMin: -0.92,
        zMax: -0.844,
        yMin: 1.068,
        yMax: 1.758,
        xOffset: 0.002,
        thickness: 0.044,
        rows: 12,
        cols: 3,
      }),
      rightDPillarUpper: createCurvedSidePanel({
        side: -1,
        zMin: -2.18,
        zMax: -1.92,
        yMin: 1.068,
        yMax: 1.758,
        zMinAtY: (y) => dPillarRearZ(y) - 0.004,
        zMaxAtY: (y) => dPillarRearZ(y) + 0.155,
        xOffset: 0.002,
        thickness: 0.045,
        rows: 12,
        cols: 4,
      }),
      rightRoofCantRail: createCurvedSidePanel({
        side: -1,
        zMin: -2.14,
        zMax: 0.89,
        yMin: 1.732,
        yMax: 1.768,
        xOffset: 0.002,
        thickness: 0.05,
        rows: 4,
        cols: 24,
      }),
      rightBeltChrome: createCurvedSidePanel({
        side: -1,
        zMin: -2.02,
        zMax: 1.43,
        yMin: (z) => frontBeltlineY(z) - 0.01,
        yMax: (z) => frontBeltlineY(z) + 0.01,
        xOffset: 0.005,
        thickness: 0.01,
        rows: 2,
        cols: 28,
      }),
      rightRockerAeroSkirt: createCurvedSidePanel({
        side: -1,
        zMin: -1.07,
        zMax: 1.08,
        yMin: 0.192,
        yMax: 0.24,
        xOffset: 0.008,
        thickness: 0.05,
        rows: 4,
        cols: 12,
      }),

      // Wheel arch subtle sculpted flare moldings (4 corners)
      flareFL: createWheelArchFlareGeometry(1, VEHICLE_DIMS.frontAxleZ),
      flareFR: createWheelArchFlareGeometry(-1, VEHICLE_DIMS.frontAxleZ),
      flareRL: createWheelArchFlareGeometry(1, VEHICLE_DIMS.rearAxleZ),
      flareRR: createWheelArchFlareGeometry(-1, VEHICLE_DIMS.rearAxleZ),
    };
  }, []);

  const frontEmblemPos = useMemo(() => frontFasciaPoint(0, 0.74, 0.019), []);
  const frontPlatePos = useMemo(() => frontFasciaPoint(0, 0.455, 0.018), []);
  const rearPlatePos = useMemo(() => rearFasciaPoint(0, 0.785, 0.014), []);

  return (
    <group>
      {/* ===================== UNDERBODY & CHASSIS ===================== */}
      <mesh position={[0, 0.22, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[1.38, 0.1, 4.02]} />
        <meshStandardMaterial color="#0d1118" roughness={0.92} />
      </mesh>
      {/* Front & rear dark wheel-well inner housings */}
      <WheelWellHousing position={[0.68, 0.33, VEHICLE_DIMS.frontAxleZ]} side={1} />
      <WheelWellHousing position={[-0.68, 0.33, VEHICLE_DIMS.frontAxleZ]} side={-1} />
      <WheelWellHousing position={[0.68, 0.33, VEHICLE_DIMS.rearAxleZ]} side={1} />
      <WheelWellHousing position={[-0.68, 0.33, VEHICLE_DIMS.rearAxleZ]} side={-1} />

      {/* ===================== SCULPTED FRONT NOSE, HOOD & BUMPER ===================== */}
      <mesh geometry={geos.frontNose} material={paintMaterial} castShadow receiveShadow />

      {/* Black Windshield Cowl Vent Panel & Dual Wiper Blades */}
      <mesh position={[0, 1.092, 1.448]} rotation={[-0.22, 0, 0]} material={matteRubberMaterial}>
        <boxGeometry args={[1.5, 0.032, 0.12]} />
      </mesh>
      <mesh position={[0.25, 1.13, 1.472]} rotation={[0.06, -0.14, 0.08]} material={matteRubberMaterial}>
        <boxGeometry args={[0.52, 0.014, 0.016]} />
      </mesh>
      <mesh position={[-0.31, 1.13, 1.468]} rotation={[0.06, 0.16, -0.06]} material={matteRubberMaterial}>
        <boxGeometry args={[0.5, 0.014, 0.016]} />
      </mesh>

      {/* Flush Curved Wide Front Grille, Chrome Louvers, Lower Intake & Fog Lamp Bezels */}
      <mesh geometry={geos.grilleHousing} material={glossBlackMaterial} />
      <mesh geometry={geos.grilleTopChrome} material={chromeMaterial} />
      {geos.grilleBars.map((barGeo, i) => (
        <mesh key={`gbar-${i}`} geometry={barGeo} material={chromeMaterial} />
      ))}
      <mesh geometry={geos.lowerIntake} material={matteRubberMaterial} />
      <mesh geometry={geos.fogBezelL} material={glossBlackMaterial} />
      <mesh geometry={geos.fogBezelR} material={glossBlackMaterial} />

      {/* Center Front Chrome Emblem */}
      <mesh position={frontEmblemPos} rotation={[Math.PI / 2, 0, 0]} material={chromeMaterial}>
        <cylinderGeometry args={[0.058, 0.062, 0.016, 28]} />
      </mesh>
      <mesh
        position={[frontEmblemPos.x, frontEmblemPos.y, frontEmblemPos.z + 0.005]}
        rotation={[Math.PI / 2, 0, 0]}
        material={glossBlackMaterial}
      >
        <cylinderGeometry args={[0.044, 0.044, 0.012, 24]} />
      </mesh>

      {/* Front Japanese License Plate */}
      <mesh position={frontPlatePos}>
        <planeGeometry args={[0.33, 0.165]} />
        <meshStandardMaterial map={plateTexture} roughness={0.35} />
      </mesh>

      {/* Flush Contoured Wrap-Around LED Headlights & Turn Signals (Left + Right) */}
      <mesh geometry={geos.hlHousingL} material={glossBlackMaterial} />
      <mesh geometry={geos.hlHousingR} material={glossBlackMaterial} />
      <mesh geometry={geos.hlSideWingL} material={glossBlackMaterial} />
      <mesh geometry={geos.hlSideWingR} material={glossBlackMaterial} />
      <mesh geometry={geos.hlDrlTopL} material={headlightMaterial} />
      <mesh geometry={geos.hlDrlTopR} material={headlightMaterial} />
      <mesh geometry={geos.hlDrlBotL} material={headlightMaterial} />
      <mesh geometry={geos.hlDrlBotR} material={headlightMaterial} />
      <mesh geometry={geos.hlLampCoreL} material={headlightMaterial} />
      <mesh geometry={geos.hlLampCoreR} material={headlightMaterial} />
      <mesh geometry={geos.hlTurnL} material={hazardMaterial} />
      <mesh geometry={geos.hlTurnR} material={hazardMaterial} />

      {/* ===================== CURVED WINDSHIELD & SCULPTED A-PILLARS ===================== */}
      <mesh geometry={geos.windshield} material={clearGlassMaterial} />
      <mesh geometry={geos.aPillarL} material={glossBlackMaterial} castShadow />
      <mesh geometry={geos.aPillarR} material={glossBlackMaterial} castShadow />

      {/* ===================== SMOOTHLY ARCHED ROOF & SHARK-FIN ANTENNA ===================== */}
      <mesh geometry={geos.roof} material={roofMaterial} castShadow receiveShadow />
      <mesh position={[0, 1.835, -1.62]} geometry={geos.sharkFin} material={roofMaterial} castShadow />
      {/* Rear Roof Spoiler High-Mount Red LED Stop Lamp */}
      <mesh position={[0, 1.765, -2.295]} material={taillightMaterial}>
        <boxGeometry args={[0.32, 0.018, 0.016]} />
      </mesh>

      {/* ===================== LEFT SIDE (+X) WITH REAL SLIDING DOORWAY CUTOUT ===================== */}
      <group>
        <mesh geometry={geos.leftFrontFender} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.leftFrontDoorLower} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.leftFrontWindowGlass} material={clearGlassMaterial} />
        <mesh geometry={geos.leftQuarterDivider} material={glossBlackMaterial} />
        <mesh geometry={geos.leftFrontBeltChrome} material={chromeMaterial} />

        {/* Front Door Outer Chrome Handle */}
        <mesh
          position={[bodySideX(0.95) + 0.016, 0.95, 0.39]}
          geometry={geos.handleBar}
          material={chromeMaterial}
          castShadow
        />

        {/* Sculpted Aerodynamic Left Side Mirror with LED Turn Signal Repeater */}
        <group position={[bodySideX(1.09) + 0.008, 1.09, 1.07]}>
          <mesh position={[0.042, 0.015, -0.01]} rotation={[0, 0, 0.42]} material={glossBlackMaterial}>
            <boxGeometry args={[0.11, 0.036, 0.062]} />
          </mesh>
          <group position={[0.125, 0.048, -0.025]} rotation={[0, -0.14, 0]}>
            <mesh geometry={geos.mirrorCap} material={roofMaterial} castShadow />
            <mesh position={[0, 0, -0.064]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[0.145, 0.085]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.08} />
            </mesh>
            <mesh position={[0.02, 0.002, 0.062]} material={hazardMaterial}>
              <boxGeometry args={[0.125, 0.016, 0.012]} />
            </mesh>
          </group>
        </group>

        {/* B-Pillar, Lower Jamb & Door Latch Striker */}
        <mesh geometry={geos.leftBPillarUpper} material={glossBlackMaterial} castShadow />
        <mesh geometry={geos.leftBPillarUpperBacking} material={glossBlackMaterial} />
        <mesh geometry={geos.leftBPillarLowerJamb} material={paintMaterial} />
        <mesh position={[bodySideX(0.76) - 0.075, 0.76, 0.214]} material={chromeMaterial}>
          <boxGeometry args={[0.03, 0.06, 0.018]} />
        </mesh>

        {/* Lower Side Sill, Aero Rocker Skirt & Roof Cant Rail */}
        <mesh geometry={geos.leftLowerSill} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.leftRockerAeroSkirt} material={matteRubberMaterial} />
        <mesh geometry={geos.leftRoofCantRail} material={roofMaterial} castShadow />

        {/* Curved Weatherstrip Gasket around Sliding Doorway */}
        <mesh geometry={geos.sealFront} material={matteRubberMaterial} />
        <mesh geometry={geos.sealRear} material={matteRubberMaterial} />
        <mesh geometry={geos.sealTop} material={matteRubberMaterial} />
        <mesh geometry={geos.sealBottom} material={matteRubberMaterial} />
        <mesh position={[0.74, 0.318, -0.31]}>
          <boxGeometry args={[0.038, 0.016, 1.04]} />
          <meshStandardMaterial color="#090c12" metalness={0.5} roughness={0.6} />
        </mesh>

        {/* Left Rear Quarter Panel & Iconic Recessed Center Slide Rail */}
        <mesh geometry={geos.leftRearQuarterBelowRail} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.leftRearQuarterAboveRail} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.leftRearQuarterBehindRail} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.leftCenterRailBacking}>
          <meshStandardMaterial color="#090d14" metalness={0.55} roughness={0.45} />
        </mesh>
        <mesh position={[bodySideX(DOOR_METRICS.centerRailY) - 0.025, DOOR_METRICS.centerRailY - 0.014, -1.4]}>
          <boxGeometry args={[0.022, 0.008, 1.12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.86} roughness={0.26} />
        </mesh>

        {/* Rear Quarter C/D Pillars, Privacy Glass & Chrome Beltline */}
        <mesh geometry={geos.leftCPillarUpper} material={glossBlackMaterial} />
        <mesh geometry={geos.leftRearQuarterGlass} material={privacyGlassMaterial} />
        <mesh geometry={geos.leftDPillarUpper} material={glossBlackMaterial} />
        <mesh geometry={geos.leftRearBeltChrome} material={chromeMaterial} />

        {/* Wheel Arch Sculpted Flares */}
        <mesh geometry={geos.flareFL} material={paintMaterial} />
        <mesh geometry={geos.flareRL} material={paintMaterial} />
      </group>

      {/* ===================== RIGHT SIDE (-X, FULL ENCLOSED SYMMETRIC BODY) ===================== */}
      <group>
        <mesh geometry={geos.rightFrontFender} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.rightCabinLowerBody} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.rightRearQuarterLower} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.rightFrontWindowGlass} material={clearGlassMaterial} />
        <mesh geometry={geos.rightQuarterDivider} material={glossBlackMaterial} />
        <mesh geometry={geos.rightRearSideGlass} material={privacyGlassMaterial} />
        <mesh geometry={geos.rightBPillarUpper} material={glossBlackMaterial} />
        <mesh geometry={geos.rightCPillarUpper} material={glossBlackMaterial} />
        <mesh geometry={geos.rightDPillarUpper} material={glossBlackMaterial} />
        <mesh geometry={geos.rightRoofCantRail} material={roofMaterial} />
        <mesh geometry={geos.rightBeltChrome} material={chromeMaterial} />
        <mesh geometry={geos.rightRockerAeroSkirt} material={matteRubberMaterial} />
        <mesh geometry={geos.flareFR} material={paintMaterial} />
        <mesh geometry={geos.flareRR} material={paintMaterial} />

        {/* Right Side Aerodynamic Mirror */}
        <group position={[-(bodySideX(1.09) + 0.008), 1.09, 1.07]}>
          <mesh position={[-0.042, 0.015, -0.01]} rotation={[0, 0, -0.42]} material={glossBlackMaterial}>
            <boxGeometry args={[0.11, 0.036, 0.062]} />
          </mesh>
          <group position={[-0.125, 0.048, -0.025]} rotation={[0, 0.14, 0]} scale={[-1, 1, 1]}>
            <mesh geometry={geos.mirrorCap} material={roofMaterial} castShadow />
            <mesh position={[0.02, 0.002, 0.062]} material={hazardMaterial}>
              <boxGeometry args={[0.125, 0.016, 0.012]} />
            </mesh>
          </group>
        </group>

        {/* Right Side Chrome Handles */}
        <mesh
          position={[-(bodySideX(0.95) + 0.016), 0.95, 0.39]}
          geometry={geos.handleBar}
          material={chromeMaterial}
        />
        <mesh
          position={[-(bodySideX(0.95) + 0.016), 0.95, 0.04]}
          geometry={geos.handleBar}
          material={chromeMaterial}
        />
      </group>

      {/* ===================== SCULPTED REAR TAILGATE, GLASS & FLUSH VERTICAL LED TAILLIGHTS ===================== */}
      <group>
        <mesh geometry={geos.rearTailgate} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.rearGlass} material={privacyGlassMaterial} />
        <mesh geometry={geos.rearDiffuser} material={matteRubberMaterial} />
        <mesh geometry={geos.rearGarnishChrome} material={chromeMaterial} />

        {/* Rear Japanese License Plate */}
        <mesh position={rearPlatePos} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.33, 0.165]} />
          <meshStandardMaterial map={plateTexture} roughness={0.35} />
        </mesh>

        {/* Rear Wiper Blade resting neatly at base of rear glass */}
        <mesh position={[0.11, 1.115, -2.285]} rotation={[0, 0, -0.08]} material={matteRubberMaterial}>
          <boxGeometry args={[0.32, 0.018, 0.018]} />
        </mesh>

        {/* Flush Wrap-Around Vertical Slim LED Taillights (Left + Right) */}
        <mesh geometry={geos.tlHousingL} material={glossBlackMaterial} />
        <mesh geometry={geos.tlHousingR} material={glossBlackMaterial} />
        <mesh geometry={geos.tlSideWrapL} material={taillightMaterial} />
        <mesh geometry={geos.tlSideWrapR} material={taillightMaterial} />
        <mesh geometry={geos.tlBladeL} material={taillightMaterial} />
        <mesh geometry={geos.tlBladeR} material={taillightMaterial} />
        <mesh geometry={geos.tlReverseL}>
          <meshStandardMaterial color="#e2e8f0" roughness={0.18} metalness={0.2} />
        </mesh>
        <mesh geometry={geos.tlReverseR}>
          <meshStandardMaterial color="#e2e8f0" roughness={0.18} metalness={0.2} />
        </mesh>
        <mesh geometry={geos.tlTurnL} material={hazardMaterial} />
        <mesh geometry={geos.tlTurnR} material={hazardMaterial} />
      </group>

      {/* ===================== 4 SCULPTED ALLOY WHEELS ===================== */}
      <AlloyWheel position={[0.745, VEHICLE_DIMS.wheelRadius, VEHICLE_DIMS.frontAxleZ]} isLeft tireGeometry={geos.tire} />
      <AlloyWheel position={[-0.745, VEHICLE_DIMS.wheelRadius, VEHICLE_DIMS.frontAxleZ]} isLeft={false} tireGeometry={geos.tire} />
      <AlloyWheel position={[0.745, VEHICLE_DIMS.wheelRadius, VEHICLE_DIMS.rearAxleZ]} isLeft tireGeometry={geos.tire} />
      <AlloyWheel position={[-0.745, VEHICLE_DIMS.wheelRadius, VEHICLE_DIMS.rearAxleZ]} isLeft={false} tireGeometry={geos.tire} />
    </group>
  );
}
