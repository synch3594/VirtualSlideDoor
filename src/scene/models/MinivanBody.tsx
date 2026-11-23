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
  createGeometricSpokeGeometry,
  createHeadlightSideWingGeometry,
  createMirrorCapGeometry,
  createParametricGrilleStudsGeometry,
  createRearGlassGeometry,
  createRearTailgateGeometry,
  createRoundedBoxGeometry,
  createSculptedRoofGeometry,
  createSculptedTireGeometry,
  createSharkFinGeometry,
  createWheelArchFlareGeometry,
  createWindshieldHeaderGeometry,
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

/**
 * Generates a crisp procedural honeycomb/diamond automotive grille mesh texture + bump map
 * so the dark grille opening has genuine modern depth and fine lattice texture!
 */
function createGrilleMeshTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  if (cCtx && bCtx) {
    // Deep recessed dark radiator backing
    cCtx.fillStyle = '#05080f';
    cCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#0a0a0a';
    bCtx.fillRect(0, 0, size, size);

    // Draw interlocking fine hexagonal/diamond mesh cells
    const cellW = 32;
    const cellH = 22;
    const drawLattice = (ctx: CanvasRenderingContext2D, stroke: string, lineWidth: number) => {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'miter';
      for (let row = -1; row <= Math.ceil(size / cellH) + 1; row++) {
        const y0 = row * cellH;
        const xOff = (row % 2) * (cellW / 2);
        for (let col = -1; col <= Math.ceil(size / cellW) + 1; col++) {
          const cx = col * cellW + xOff;
          const cy = y0;
          ctx.beginPath();
          ctx.moveTo(cx, cy - cellH * 0.56);
          ctx.lineTo(cx + cellW * 0.46, cy - cellH * 0.18);
          ctx.lineTo(cx + cellW * 0.46, cy + cellH * 0.18);
          ctx.lineTo(cx, cy + cellH * 0.56);
          ctx.lineTo(cx - cellW * 0.46, cy + cellH * 0.18);
          ctx.lineTo(cx - cellW * 0.46, cy - cellH * 0.18);
          ctx.closePath();
          ctx.stroke();
        }
      }
    };

    // Metallic dark gunmetal lattice with subtle upper highlight edge
    drawLattice(cCtx, '#1e2736', 4.8);
    drawLattice(cCtx, '#334155', 1.8);
    drawLattice(bCtx, '#d8d8d8', 4.5);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.4, 1.4);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3.4, 1.4);

  return { map, bumpMap };
}

function AlloyWheel({
  position,
  isLeft,
  tireGeometry,
  spokeMachinedGeo,
  spokeAccentGeo,
}: {
  position: [number, number, number];
  isLeft: boolean;
  tireGeometry: THREE.BufferGeometry;
  spokeMachinedGeo: THREE.BufferGeometry;
  spokeAccentGeo: THREE.BufferGeometry;
}) {
  const dir = isLeft ? 1 : -1;
  return (
    <group position={position}>
      {/* Sculpted rounded-profile rubber tire */}
      <mesh geometry={tireGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#15181e" roughness={0.86} metalness={0.04} />
      </mesh>
      {/* Open-ended gloss-black inner alloy rim barrel so geometric spokes & brake disc show clearly! */}
      <mesh position={[dir * 0.005, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.208, 0.208, 0.19, 32, 1, true]} />
        <meshStandardMaterial color="#0b101b" metalness={0.55} roughness={0.38} side={THREE.DoubleSide} />
      </mesh>
      {/* Deep inner dark wheel backing well behind brake rotor */}
      <mesh position={[-dir * 0.03, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.202, 0.202, 0.02, 28]} />
        <meshStandardMaterial color="#090d16" metalness={0.4} roughness={0.65} />
      </mesh>
      {/* Ventilated steel brake rotor disc */}
      <mesh position={[dir * 0.035, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.155, 0.155, 0.018, 28]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.86} roughness={0.34} />
      </mesh>
      {/* Brake caliper */}
      <mesh position={[dir * 0.044, 0.04, -0.115]}>
        <boxGeometry args={[0.042, 0.088, 0.062]} />
        <meshStandardMaterial color="#475569" metalness={0.65} roughness={0.4} />
      </mesh>
      {/* Machined outer alloy rim lip */}
      <mesh position={[dir * 0.102, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.205, 0.014, 12, 36]} />
        <meshStandardMaterial color="#e8eef5" metalness={0.94} roughness={0.14} />
      </mesh>
      {/* Secondary inner stepped geometric ring */}
      <mesh position={[dir * 0.094, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.125, 0.006, 8, 30]} />
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.22} />
      </mesh>
      {/* Modern 5-fold Geometric Diamond-Cut Y-Blade & Aero-Facet Pattern */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i * Math.PI * 2) / 5;
        return (
          <group key={i} rotation={[angle, 0, 0]}>
            {/* Bright CNC diamond-cut angular Y-spoke */}
            <mesh position={[dir * 0.102, 0, 0]} geometry={spokeMachinedGeo}>
              <meshStandardMaterial color="#eef2f6" metalness={0.95} roughness={0.13} />
            </mesh>
            {/* Dark gunmetal recessed geometric aero-blade between Y-spokes */}
            <mesh position={[dir * 0.092, 0, 0]} geometry={spokeAccentGeo}>
              <meshStandardMaterial color="#2c3a4f" metalness={0.82} roughness={0.24} />
            </mesh>
          </group>
        );
      })}
      {/* Sculpted geometric center hub dish + metallic ring + 5 chrome lug nuts */}
      <mesh position={[dir * 0.103, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.056, 0.064, 0.02, 10]} />
        <meshStandardMaterial color="#111827" metalness={0.78} roughness={0.22} />
      </mesh>
      <mesh position={[dir * 0.112, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.032, 0.0045, 8, 24]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.12} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i * Math.PI * 2) / 5 + Math.PI / 5;
        return (
          <mesh
            key={`lug-${i}`}
            position={[dir * 0.11, Math.cos(a) * 0.048, Math.sin(a) * 0.048]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.0065, 0.0065, 0.012, 6]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.14} />
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
 * - Authentic ~2/3 body & frame to ~1/3 glass proportions (raised beltline, substantial pillars & roof cant rail)
 * - Swept-back, dihedral-angled ("ハの字") aerodynamic side mirrors
 * - Modern complex parametric front grille with fine honeycomb mesh + 3D faceted satin-chrome block matrix
 * - Modern geometric diamond-cut multi-spoke alloy wheels
 * - Left-side sliding doorway cutout with curved weatherstrip, 6mm shut line, & recessed center slide rail
 */
export function MinivanBody() {
  const bodyColorId = useDoorStore((s) => s.bodyColorId);
  const timeOfDay = useDoorStore((s) => s.timeOfDay);

  const colorSpec = useMemo(
    () => BODY_COLORS.find((c) => c.id === bodyColorId) ?? BODY_COLORS[0],
    [bodyColorId]
  );

  const plateTexture = useMemo(() => createLicensePlateTexture(), []);
  const grilleMeshTex = useMemo(() => createGrilleMeshTextures(), []);

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

  const satinChromeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#cbd5e1',
        metalness: 0.9,
        roughness: 0.22,
      }),
    []
  );

  const grilleMeshMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: grilleMeshTex.map,
        bumpMap: grilleMeshTex.bumpMap,
        bumpScale: 0.015,
        metalness: 0.45,
        roughness: 0.42,
      }),
    [grilleMeshTex]
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
        opacity: 0.88,
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
        opacity: 0.54,
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

    // Tapered modern trapezoidal grille boundary u(v) for v in [0 (bottom), 1 (top)]
    const grilleHalfU = (v: number) => 0.54 + 0.14 * v;

    return {
      // Major lofted shells
      frontNose: createFrontNoseGeometry(),
      roof: createSculptedRoofGeometry(),
      windshield: createCurvedWindshieldGeometry(0.012, 0.052),
      windshieldHeader: createWindshieldHeaderGeometry(),
      aPillarL: createAPillarGeometry(1),
      aPillarR: createAPillarGeometry(-1),
      rearTailgate: createRearTailgateGeometry(),
      rearGlass: createRearGlassGeometry(),
      tire: createSculptedTireGeometry(),
      spokeMachined: createGeometricSpokeGeometry('machined'),
      spokeAccent: createGeometricSpokeGeometry('accent'),
      mirrorCap: createMirrorCapGeometry(),
      sharkFin: createSharkFinGeometry(),
      handleBar: createRoundedBoxGeometry(0.026, 0.032, 0.165, 0.008, 3),

      // ===== MODERN COMPLEX PARAMETRIC MESH FRONT GRILLE & WRAP-AROUND LED HEADLIGHTS =====
      // Trapezoidal honeycomb mesh grille core
      grilleMeshBacking: createFlushFrontStripGeometry(
        (v) => -grilleHalfU(v),
        (v) => grilleHalfU(v),
        0.47,
        0.885,
        0.009,
        0.018,
        20,
        8
      ),
      // 3D dimensional parametric staggered jewel-block chrome matrix floating on mesh!
      grilleStuds: createParametricGrilleStudsGeometry(),
      // Swept upper chrome brow garnish uniting the two headlights
      grilleTopChrome: createFlushFrontStripGeometry(-0.78, 0.78, 0.882, 0.916, 0.015, 0.014, 22, 2),
      // Left & right angled chrome side-surround blades framing the trapezoidal grille
      grilleBorderL: createFlushFrontStripGeometry(
        (v) => grilleHalfU(v) - 0.012,
        (v) => grilleHalfU(v) + 0.036,
        0.465,
        0.89,
        0.014,
        0.014,
        4,
        10
      ),
      grilleBorderR: createFlushFrontStripGeometry(
        (v) => -(grilleHalfU(v) + 0.036),
        (v) => -(grilleHalfU(v) - 0.012),
        0.465,
        0.89,
        0.014,
        0.014,
        4,
        10
      ),
      // Lower chrome grille chin lip
      grilleBottomChrome: createFlushFrontStripGeometry(-0.56, 0.56, 0.455, 0.478, 0.014, 0.012, 16, 2),
      // Lower bumper mesh air dam
      lowerIntakeMesh: createFlushFrontStripGeometry(-0.56, 0.56, 0.27, 0.40, 0.008, 0.016, 16, 4),
      // Sculpted vertical side air-curtain intakes + chrome L-blades
      fogBezelL: createFlushFrontStripGeometry(0.66, 0.90, 0.295, 0.455, 0.009, 0.014, 8, 5),
      fogBezelR: createFlushFrontStripGeometry(-0.90, -0.66, 0.295, 0.455, 0.009, 0.014, 8, 5),
      fogAccentL: createFlushFrontStripGeometry(0.68, 0.86, 0.435, 0.455, 0.014, 0.01, 6, 2),
      fogAccentR: createFlushFrontStripGeometry(-0.86, -0.68, 0.435, 0.455, 0.014, 0.01, 6, 2),

      // Flush wrap-around front headlights (front fascia face + fender side wrap!)
      hlHousingL: createFlushFrontStripGeometry(0.66, 1.0, 0.80, 0.92, 0.009, 0.016, 12, 5),
      hlHousingR: createFlushFrontStripGeometry(-1.0, -0.66, 0.80, 0.92, 0.009, 0.016, 12, 5),
      hlSideWingL: createHeadlightSideWingGeometry(1, 0.80, 0.92, 1.92, 0.007),
      hlSideWingR: createHeadlightSideWingGeometry(-1, 0.80, 0.92, 1.92, 0.007),
      hlDrlTopL: createFlushFrontStripGeometry(0.67, 0.99, 0.888, 0.91, 0.015, 0.01, 10, 2),
      hlDrlTopR: createFlushFrontStripGeometry(-0.99, -0.67, 0.888, 0.91, 0.015, 0.01, 10, 2),
      hlDrlBotL: createFlushFrontStripGeometry(0.69, 0.96, 0.812, 0.83, 0.014, 0.01, 10, 2),
      hlDrlBotR: createFlushFrontStripGeometry(-0.96, -0.69, 0.812, 0.83, 0.014, 0.01, 10, 2),
      hlLampCoreL: createFlushFrontStripGeometry(0.70, 0.87, 0.84, 0.878, 0.013, 0.01, 8, 2),
      hlLampCoreR: createFlushFrontStripGeometry(-0.87, -0.70, 0.84, 0.878, 0.013, 0.01, 8, 2),
      hlTurnL: createFlushFrontStripGeometry(0.88, 0.99, 0.842, 0.878, 0.015, 0.01, 6, 2),
      hlTurnR: createFlushFrontStripGeometry(-0.99, -0.88, 0.842, 0.878, 0.015, 0.01, 6, 2),

      // ===== FLUSH CURVED REAR FASCIA, THICKER FRAME & VERTICAL LED TAILLIGHTS =====
      rearDiffuser: createFlushRearStripGeometry(-0.78, 0.78, 0.215, 0.305, 0.007, 0.018, 18, 3),
      rearGarnishChrome: createFlushRearStripGeometry(-0.56, 0.56, 1.035, 1.072, 0.013, 0.012, 16, 2),
      // Solid rear window upper spoiler-header frame (y = 1.675..1.755) so rear glass has realistic frame!
      rearWindowTopHeader: createFlushRearStripGeometry(-1.0, 1.0, 1.675, 1.755, 0.006, 0.025, 18, 4),
      // Wider sculpted vertical LED taillights framing the rear glass
      tlHousingL: createFlushRearStripGeometry(0.815, 1.0, 1.155, 1.685, 0.008, 0.024, 6, 12),
      tlHousingR: createFlushRearStripGeometry(-1.0, -0.815, 1.155, 1.685, 0.008, 0.024, 6, 12),
      tlBladeL: createFlushRearStripGeometry(0.885, 0.965, 1.30, 1.645, 0.014, 0.012, 4, 10),
      tlBladeR: createFlushRearStripGeometry(-0.965, -0.885, 1.30, 1.645, 0.014, 0.012, 4, 10),
      tlReverseL: createFlushRearStripGeometry(0.885, 0.965, 1.24, 1.286, 0.014, 0.012, 4, 3),
      tlReverseR: createFlushRearStripGeometry(-0.965, -0.885, 1.24, 1.286, 0.014, 0.012, 4, 3),
      tlTurnL: createFlushRearStripGeometry(0.885, 0.965, 1.172, 1.228, 0.014, 0.012, 4, 4),
      tlTurnR: createFlushRearStripGeometry(-0.965, -0.885, 1.172, 1.228, 0.014, 0.012, 4, 4),
      tlSideWrapL: createCurvedSidePanel({
        side: 1,
        zMin: -2.18,
        zMax: -2.02,
        yMin: 1.155,
        yMax: 1.67,
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
        yMin: 1.155,
        yMax: 1.67,
        zMinAtY: (y) => dPillarRearZ(y) - 0.004,
        zMaxAtY: (y) => dPillarRearZ(y) + 0.055,
        xOffset: 0.007,
        thickness: 0.016,
        rows: 10,
        cols: 3,
      }),

      // ===== LEFT SIDE (+X) PANELS WITH HIGHER BELTLINE & SUBSTANTIAL FRAMES =====
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
      // Front side glass sized to realistic height (beltline ~1.15 -> 1.685) & tucked inside wider A/B pillars!
      leftFrontWindowGlass: createCurvedSidePanel({
        side: 1,
        zMin: 0.322,
        zMax: 1.40,
        yMin: frontBeltlineY,
        yMax: VEHICLE_DIMS.windowTopY,
        zMinAtY: () => 0.322,
        zMaxAtY: (y) => Math.max(0.35, aPillarZ(y) - 0.068),
        xOffset: -0.008,
        thickness: 0.012,
        rows: 14,
        cols: 14,
      }),
      // Vertical black mullion separating triangular front quarter window & front door glass
      leftQuarterDivider: createCurvedSidePanel({
        side: 1,
        zMin: 1.076,
        zMax: 1.108,
        yMin: frontBeltlineY(1.09),
        yMax: 1.49,
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
        yMax: (z) => frontBeltlineY(z) + 0.012,
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
      // Wider, realistic B-pillar blackout frame (10.6cm)
      leftBPillarUpper: createCurvedSidePanel({
        side: 1,
        zMin: 0.222,
        zMax: 0.328,
        yMin: 1.145,
        yMax: 1.756,
        xOffset: 0.002,
        thickness: 0.044,
        rows: 12,
        cols: 3,
      }),
      leftBPillarLowerJamb: createCurvedSidePanel({
        side: 1,
        zMin: 0.205,
        zMax: 0.255,
        yMin: 0.335,
        yMax: 1.152,
        xOffset: -0.024,
        thickness: 0.068,
        rows: 10,
        cols: 2,
      }),
      leftBPillarUpperBacking: createCurvedSidePanel({
        side: 1,
        zMin: 0.202,
        zMax: 0.255,
        yMin: 1.148,
        yMax: 1.745,
        xOffset: -0.022,
        thickness: 0.042,
        rows: 10,
        cols: 2,
      }),
      // Substantial 8cm painted/two-tone upper roof cant rail framing the top of all side windows!
      leftRoofCantRail: createCurvedSidePanel({
        side: 1,
        zMin: -2.14,
        zMax: 0.87,
        yMin: VEHICLE_DIMS.windowTopY,
        yMax: 1.766,
        xOffset: 0.002,
        thickness: 0.052,
        rows: 5,
        cols: 24,
      }),

      // Curved weatherstrip seals around the open sliding doorway
      sealFront: createCurvedSidePanel({
        side: 1,
        zMin: 0.206,
        zMax: 0.226,
        yMin: 0.34,
        yMax: 1.72,
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
        yMax: 1.72,
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
        yMin: 1.705,
        yMax: 1.725,
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
        yMax: 1.155,
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
      // Wider C-pillar (10.1cm) & wider D-pillar (21cm) for solid modern minivan greenhouse balance
      leftCPillarUpper: createCurvedSidePanel({
        side: 1,
        zMin: -0.945,
        zMax: -0.844,
        yMin: 1.148,
        yMax: 1.756,
        xOffset: 0.002,
        thickness: 0.044,
        rows: 12,
        cols: 3,
      }),
      leftRearQuarterGlass: createCurvedSidePanel({
        side: 1,
        zMin: -2.02,
        zMax: -0.94,
        yMin: 1.154,
        yMax: VEHICLE_DIMS.windowTopY,
        zMinAtY: (y) => dPillarRearZ(y) + 0.21,
        zMaxAtY: () => -0.94,
        xOffset: -0.008,
        thickness: 0.012,
        rows: 12,
        cols: 14,
      }),
      leftDPillarUpper: createCurvedSidePanel({
        side: 1,
        zMin: -2.18,
        zMax: -1.86,
        yMin: 1.148,
        yMax: 1.756,
        zMinAtY: (y) => dPillarRearZ(y) - 0.004,
        zMaxAtY: (y) => dPillarRearZ(y) + 0.218,
        xOffset: 0.002,
        thickness: 0.045,
        rows: 12,
        cols: 4,
      }),
      leftRearBeltChrome: createCurvedSidePanel({
        side: 1,
        zMin: -1.96,
        zMax: -0.844,
        yMin: 1.144,
        yMax: 1.164,
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
        yMax: 1.155,
        zMinAtY: (y) => rearCornerZ(y),
        wheelArch: rearArch,
        thickness: 0.045,
        characterCrease: true,
        rows: 16,
        cols: 30,
      }),
      rightFrontWindowGlass: createCurvedSidePanel({
        side: -1,
        zMin: 0.322,
        zMax: 1.40,
        yMin: frontBeltlineY,
        yMax: VEHICLE_DIMS.windowTopY,
        zMinAtY: () => 0.322,
        zMaxAtY: (y) => Math.max(0.35, aPillarZ(y) - 0.068),
        xOffset: -0.008,
        thickness: 0.012,
        rows: 14,
        cols: 14,
      }),
      rightQuarterDivider: createCurvedSidePanel({
        side: -1,
        zMin: 1.076,
        zMax: 1.108,
        yMin: frontBeltlineY(1.09),
        yMax: 1.49,
        xOffset: 0.001,
        thickness: 0.024,
        rows: 10,
        cols: 2,
      }),
      rightRearSideGlass: createCurvedSidePanel({
        side: -1,
        zMin: -2.02,
        zMax: 0.225,
        yMin: 1.154,
        yMax: VEHICLE_DIMS.windowTopY,
        zMinAtY: (y) => dPillarRearZ(y) + 0.21,
        zMaxAtY: () => 0.225,
        xOffset: -0.008,
        thickness: 0.012,
        rows: 12,
        cols: 22,
      }),
      rightBPillarUpper: createCurvedSidePanel({
        side: -1,
        zMin: 0.222,
        zMax: 0.328,
        yMin: 1.145,
        yMax: 1.756,
        xOffset: 0.002,
        thickness: 0.044,
        rows: 12,
        cols: 3,
      }),
      rightCPillarUpper: createCurvedSidePanel({
        side: -1,
        zMin: -0.945,
        zMax: -0.844,
        yMin: 1.148,
        yMax: 1.756,
        xOffset: 0.002,
        thickness: 0.044,
        rows: 12,
        cols: 3,
      }),
      rightDPillarUpper: createCurvedSidePanel({
        side: -1,
        zMin: -2.18,
        zMax: -1.86,
        yMin: 1.148,
        yMax: 1.756,
        zMinAtY: (y) => dPillarRearZ(y) - 0.004,
        zMaxAtY: (y) => dPillarRearZ(y) + 0.218,
        xOffset: 0.002,
        thickness: 0.045,
        rows: 12,
        cols: 4,
      }),
      rightRoofCantRail: createCurvedSidePanel({
        side: -1,
        zMin: -2.14,
        zMax: 0.87,
        yMin: VEHICLE_DIMS.windowTopY,
        yMax: 1.766,
        xOffset: 0.002,
        thickness: 0.052,
        rows: 5,
        cols: 24,
      }),
      rightBeltChrome: createCurvedSidePanel({
        side: -1,
        zMin: -1.96,
        zMax: 1.43,
        yMin: (z) => frontBeltlineY(z) - 0.01,
        yMax: (z) => frontBeltlineY(z) + 0.012,
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

  const frontEmblemPos = useMemo(() => frontFasciaPoint(0, 0.745, 0.022), []);
  const frontPlatePos = useMemo(() => frontFasciaPoint(0, 0.455, 0.02), []);
  const rearPlatePos = useMemo(() => rearFasciaPoint(0, 0.84, 0.014), []);

  return (
    <group>
      {/* ===================== UNDERBODY & CHASSIS ===================== */}
      <mesh position={[0, 0.22, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[1.38, 0.1, 4.02]} />
        <meshStandardMaterial color="#0d1118" roughness={0.92} />
      </mesh>
      <WheelWellHousing position={[0.68, 0.33, VEHICLE_DIMS.frontAxleZ]} side={1} />
      <WheelWellHousing position={[-0.68, 0.33, VEHICLE_DIMS.frontAxleZ]} side={-1} />
      <WheelWellHousing position={[0.68, 0.33, VEHICLE_DIMS.rearAxleZ]} side={1} />
      <WheelWellHousing position={[-0.68, 0.33, VEHICLE_DIMS.rearAxleZ]} side={-1} />

      {/* ===================== SCULPTED FRONT NOSE, HOOD & BUMPER ===================== */}
      <mesh geometry={geos.frontNose} material={paintMaterial} castShadow receiveShadow />

      {/* Black Windshield Cowl Vent Panel & Dual Wiper Blades */}
      <mesh position={[0, 1.168, 1.448]} rotation={[-0.22, 0, 0]} material={matteRubberMaterial}>
        <boxGeometry args={[1.5, 0.032, 0.12]} />
      </mesh>
      <mesh position={[0.25, 1.205, 1.472]} rotation={[0.06, -0.14, 0.08]} material={matteRubberMaterial}>
        <boxGeometry args={[0.52, 0.014, 0.016]} />
      </mesh>
      <mesh position={[-0.31, 1.205, 1.468]} rotation={[0.06, 0.16, -0.06]} material={matteRubberMaterial}>
        <boxGeometry args={[0.5, 0.014, 0.016]} />
      </mesh>

      {/* Modern Complex Honeycomb Mesh + Parametric 3D Stud Front Grille */}
      <mesh geometry={geos.grilleMeshBacking} material={grilleMeshMaterial} />
      <mesh geometry={geos.grilleStuds} material={satinChromeMaterial} />
      <mesh geometry={geos.grilleTopChrome} material={chromeMaterial} />
      <mesh geometry={geos.grilleBorderL} material={satinChromeMaterial} />
      <mesh geometry={geos.grilleBorderR} material={satinChromeMaterial} />
      <mesh geometry={geos.grilleBottomChrome} material={satinChromeMaterial} />
      <mesh geometry={geos.lowerIntakeMesh} material={grilleMeshMaterial} />
      <mesh geometry={geos.fogBezelL} material={glossBlackMaterial} />
      <mesh geometry={geos.fogBezelR} material={glossBlackMaterial} />
      <mesh geometry={geos.fogAccentL} material={chromeMaterial} />
      <mesh geometry={geos.fogAccentR} material={chromeMaterial} />

      {/* Center Front Chrome Emblem */}
      <mesh position={frontEmblemPos} rotation={[Math.PI / 2, 0, 0]} material={chromeMaterial}>
        <cylinderGeometry args={[0.068, 0.072, 0.018, 28]} />
      </mesh>
      <mesh
        position={[frontEmblemPos.x, frontEmblemPos.y, frontEmblemPos.z + 0.006]}
        rotation={[Math.PI / 2, 0, 0]}
        material={glossBlackMaterial}
      >
        <cylinderGeometry args={[0.054, 0.054, 0.012, 24]} />
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

      {/* ===================== CURVED WINDSHIELD, HEADER BROW & SUBSTANTIAL A-PILLARS ===================== */}
      <mesh geometry={geos.windshield} material={clearGlassMaterial} />
      <mesh geometry={geos.windshieldHeader} material={roofMaterial} />
      <mesh geometry={geos.aPillarL} material={glossBlackMaterial} castShadow />
      <mesh geometry={geos.aPillarR} material={glossBlackMaterial} castShadow />

      {/* ===================== SMOOTHLY ARCHED ROOF & SHARK-FIN ANTENNA ===================== */}
      <mesh geometry={geos.roof} material={roofMaterial} castShadow receiveShadow />
      <mesh position={[0, 1.838, -1.62]} geometry={geos.sharkFin} material={roofMaterial} castShadow />
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

        {/* Front Door Outer Chrome Handle (raised to match new 1.15m beltline) */}
        <mesh
          position={[bodySideX(1.015) + 0.016, 1.015, 0.39]}
          geometry={geos.handleBar}
          material={chromeMaterial}
          castShadow
        />

        {/* Sculpted Aerodynamic Left Side Mirror — angled backward & tilted in sleek "ハの字"! */}
        <group position={[bodySideX(1.145) + 0.006, 1.145, 1.07]}>
          {/* Swept-back upward-angled door stalk */}
          <mesh position={[0.044, 0.022, -0.016]} rotation={[0, 0.24, 0.48]} material={glossBlackMaterial}>
            <boxGeometry args={[0.115, 0.036, 0.062]} />
          </mesh>
          {/* Mirror cap swept rearward (+ry) with sleek subtle upward/outward dihedral (+rz) */}
          <group position={[0.126, 0.056, -0.038]} rotation={[0.04, 0.34, 0.16]}>
            <mesh geometry={geos.mirrorCap} material={roofMaterial} castShadow />
            <mesh position={[0, 0, -0.062]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[0.145, 0.082]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.08} />
            </mesh>
            <mesh position={[0.02, 0.002, 0.06]} material={hazardMaterial}>
              <boxGeometry args={[0.125, 0.016, 0.012]} />
            </mesh>
          </group>
        </group>

        {/* B-Pillar, Lower Jamb & Door Latch Striker */}
        <mesh geometry={geos.leftBPillarUpper} material={glossBlackMaterial} castShadow />
        <mesh geometry={geos.leftBPillarUpperBacking} material={glossBlackMaterial} />
        <mesh geometry={geos.leftBPillarLowerJamb} material={paintMaterial} />
        <mesh position={[bodySideX(0.78) - 0.075, 0.78, 0.214]} material={chromeMaterial}>
          <boxGeometry args={[0.03, 0.06, 0.018]} />
        </mesh>

        {/* Lower Side Sill, Aero Rocker Skirt & Substantial Roof Cant Rail */}
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

        {/* Right Side Aerodynamic Mirror — symmetric swept-back "ハの字"! */}
        <group position={[-(bodySideX(1.145) + 0.006), 1.145, 1.07]}>
          <mesh position={[-0.044, 0.022, -0.016]} rotation={[0, -0.24, -0.48]} material={glossBlackMaterial}>
            <boxGeometry args={[0.115, 0.036, 0.062]} />
          </mesh>
          <group position={[-0.126, 0.056, -0.038]} rotation={[0.04, -0.34, -0.16]}>
            <mesh geometry={geos.mirrorCap} material={roofMaterial} scale={[-1, 1, 1]} castShadow />
            <mesh position={[0, 0, -0.062]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[0.145, 0.082]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.08} />
            </mesh>
            <mesh position={[-0.02, 0.002, 0.06]} material={hazardMaterial}>
              <boxGeometry args={[0.125, 0.016, 0.012]} />
            </mesh>
          </group>
        </group>

        {/* Right Side Chrome Handles */}
        <mesh
          position={[-(bodySideX(1.015) + 0.016), 1.015, 0.39]}
          geometry={geos.handleBar}
          material={chromeMaterial}
        />
        <mesh
          position={[-(bodySideX(1.015) + 0.016), 1.015, 0.04]}
          geometry={geos.handleBar}
          material={chromeMaterial}
        />
      </group>

      {/* ===================== SCULPTED REAR TAILGATE, GLASS & FLUSH VERTICAL LED TAILLIGHTS ===================== */}
      <group>
        <mesh geometry={geos.rearTailgate} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.rearGlass} material={privacyGlassMaterial} />
        <mesh geometry={geos.rearWindowTopHeader} material={roofMaterial} />
        <mesh geometry={geos.rearDiffuser} material={matteRubberMaterial} />
        <mesh geometry={geos.rearGarnishChrome} material={chromeMaterial} />

        {/* Rear Japanese License Plate */}
        <mesh position={rearPlatePos} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.33, 0.165]} />
          <meshStandardMaterial map={plateTexture} roughness={0.35} />
        </mesh>

        {/* Rear Wiper Blade resting neatly at base of rear glass */}
        <mesh position={[0.11, 1.195, -2.28]} rotation={[0, 0, -0.08]} material={matteRubberMaterial}>
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

      {/* ===================== 4 MODERN GEOMETRIC ALLOY WHEELS ===================== */}
      <AlloyWheel
        position={[0.745, VEHICLE_DIMS.wheelRadius, VEHICLE_DIMS.frontAxleZ]}
        isLeft
        tireGeometry={geos.tire}
        spokeMachinedGeo={geos.spokeMachined}
        spokeAccentGeo={geos.spokeAccent}
      />
      <AlloyWheel
        position={[-0.745, VEHICLE_DIMS.wheelRadius, VEHICLE_DIMS.frontAxleZ]}
        isLeft={false}
        tireGeometry={geos.tire}
        spokeMachinedGeo={geos.spokeMachined}
        spokeAccentGeo={geos.spokeAccent}
      />
      <AlloyWheel
        position={[0.745, VEHICLE_DIMS.wheelRadius, VEHICLE_DIMS.rearAxleZ]}
        isLeft
        tireGeometry={geos.tire}
        spokeMachinedGeo={geos.spokeMachined}
        spokeAccentGeo={geos.spokeAccent}
      />
      <AlloyWheel
        position={[-0.745, VEHICLE_DIMS.wheelRadius, VEHICLE_DIMS.rearAxleZ]}
        isLeft={false}
        tireGeometry={geos.tire}
        spokeMachinedGeo={geos.spokeMachined}
        spokeAccentGeo={geos.spokeAccent}
      />
    </group>
  );
}
