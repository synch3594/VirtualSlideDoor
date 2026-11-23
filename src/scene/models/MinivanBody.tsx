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
  createRearHeaderGeometry,
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
 * Generates a crisp procedural honeycomb/diamond automotive grille mesh texture + bump map.
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
    cCtx.fillStyle = '#05080f';
    cCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#0a0a0a';
    bCtx.fillRect(0, 0, size, size);

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

    drawLattice(cCtx, '#1e2736', 4.8);
    drawLattice(cCtx, '#334155', 1.8);
    drawLattice(bCtx, '#d8d8d8', 4.5);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.0, 1.4);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3.0, 1.4);

  return { map, bumpMap };
}

/**
 * Generates realistic tire tread-block + sidewall rib textures (`map` + `bumpMap`)
 * aligned directly to `createSculptedTireGeometry()`'s LatheGeometry UVs:
 *  - u ∈ [0, 1] wraps around the full tire circumference
 *  - v ∈ [0.18, 0.82] covers the 5 tread ribs & 4 circumferential channels
 *  - v < 0.18 and v > 0.82 cover the sculpted left & right rubber sidewalls
 */
function createTireTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const W = 1024;
  const H = 512;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = W;
  colorCanvas.height = H;
  const cCtx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const bCtx = bumpCanvas.getContext('2d');

  if (cCtx && bCtx) {
    // Base vulcanized dark rubber
    cCtx.fillStyle = '#181c23';
    cCtx.fillRect(0, 0, W, H);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, W, H);

    // Sidewall subtle concentric molded ribs & radial shoulder tread lugs
    const drawSidewall = (yStart: number, yEnd: number, isTop: boolean) => {
      cCtx.fillStyle = '#14171e';
      cCtx.fillRect(0, yStart, W, yEnd - yStart);
      bCtx.fillStyle = '#707070';
      bCtx.fillRect(0, yStart, W, yEnd - yStart);

      // Concentric sidewall molding rings
      for (const frac of [0.35, 0.58, 0.78]) {
        const yRing = yStart + (yEnd - yStart) * frac;
        cCtx.strokeStyle = '#1e242e';
        cCtx.lineWidth = 3;
        cCtx.beginPath();
        cCtx.moveTo(0, yRing);
        cCtx.lineTo(W, yRing);
        cCtx.stroke();

        bCtx.strokeStyle = '#a8a8a8';
        bCtx.lineWidth = 3;
        bCtx.beginPath();
        bCtx.moveTo(0, yRing);
        bCtx.lineTo(W, yRing);
        bCtx.stroke();
      }

      // Molded radial shoulder buttress lugs around circumference
      const numLugs = 42;
      const lugW = W / numLugs;
      for (let i = 0; i < numLugs; i++) {
        const x = i * lugW;
        const yLug = isTop ? yEnd - 24 : yStart + 4;
        cCtx.fillStyle = '#1f242e';
        cCtx.fillRect(x + 4, yLug, lugW * 0.56, 20);
        bCtx.fillStyle = '#cccccc';
        bCtx.fillRect(x + 4, yLug, lugW * 0.56, 20);
      }
    };

    drawSidewall(0, Math.round(H * 0.185), true);
    drawSidewall(Math.round(H * 0.815), H, false);

    // Tread crown: asymmetric angled tread blocks + fine sipes across the 5 ribs
    const yTread0 = Math.round(H * 0.185);
    const yTread1 = Math.round(H * 0.815);
    cCtx.fillStyle = '#1b2028';
    cCtx.fillRect(0, yTread0, W, yTread1 - yTread0);
    bCtx.fillStyle = '#d4d4d4';
    bCtx.fillRect(0, yTread0, W, yTread1 - yTread0);

    // Circumferential groove dark shadow strips matching LatheGeometry's 4 channels
    for (const gCenter of [0.31, 0.43, 0.57, 0.69]) {
      const gy = Math.round(H * gCenter);
      cCtx.fillStyle = '#0c0e13';
      cCtx.fillRect(0, gy - 8, W, 16);
      bCtx.fillStyle = '#141414';
      bCtx.fillRect(0, gy - 8, W, 16);
    }

    // Angled lateral tread block grooves & sipes around all 48 tread pitches
    const pitches = 44;
    const pitchW = W / pitches;
    for (let i = 0; i < pitches; i++) {
      const x = i * pitchW;
      // Outer left angled slots
      bCtx.strokeStyle = '#181818';
      cCtx.strokeStyle = '#0d1015';
      bCtx.lineWidth = 6.5;
      cCtx.lineWidth = 6.5;

      cCtx.beginPath();
      cCtx.moveTo(x, H * 0.18);
      cCtx.lineTo(x + pitchW * 0.45, H * 0.31);
      cCtx.stroke();
      bCtx.beginPath();
      bCtx.moveTo(x, H * 0.18);
      bCtx.lineTo(x + pitchW * 0.45, H * 0.31);
      bCtx.stroke();

      // Inner left angled sipes
      cCtx.beginPath();
      cCtx.moveTo(x + pitchW * 0.35, H * 0.31);
      cCtx.lineTo(x + pitchW * 0.72, H * 0.43);
      cCtx.stroke();
      bCtx.beginPath();
      bCtx.moveTo(x + pitchW * 0.35, H * 0.31);
      bCtx.lineTo(x + pitchW * 0.72, H * 0.43);
      bCtx.stroke();

      // Center rib diagonal sipes (half-pitch staggered)
      cCtx.lineWidth = 4.5;
      bCtx.lineWidth = 4.5;
      cCtx.beginPath();
      cCtx.moveTo(x + pitchW * 0.2, H * 0.44);
      cCtx.lineTo(x + pitchW * 0.6, H * 0.56);
      cCtx.stroke();
      bCtx.beginPath();
      bCtx.moveTo(x + pitchW * 0.2, H * 0.44);
      bCtx.lineTo(x + pitchW * 0.6, H * 0.56);
      bCtx.stroke();

      // Inner right & outer right mirrored angled slots
      cCtx.lineWidth = 6.5;
      bCtx.lineWidth = 6.5;
      cCtx.beginPath();
      cCtx.moveTo(x + pitchW * 0.65, H * 0.57);
      cCtx.lineTo(x + pitchW * 0.28, H * 0.69);
      cCtx.stroke();
      bCtx.beginPath();
      bCtx.moveTo(x + pitchW * 0.65, H * 0.57);
      bCtx.lineTo(x + pitchW * 0.28, H * 0.69);
      bCtx.stroke();

      cCtx.beginPath();
      cCtx.moveTo(x + pitchW * 0.45, H * 0.69);
      cCtx.lineTo(x, H * 0.82);
      cCtx.stroke();
      bCtx.beginPath();
      bCtx.moveTo(x + pitchW * 0.45, H * 0.69);
      bCtx.lineTo(x, H * 0.82);
      bCtx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function AlloyWheel({
  position,
  isLeft,
  tireGeometry,
  tireMaterial,
  spokeMachinedGeo,
  spokeAccentGeo,
}: {
  position: [number, number, number];
  isLeft: boolean;
  tireGeometry: THREE.BufferGeometry;
  tireMaterial: THREE.MeshStandardMaterial;
  spokeMachinedGeo: THREE.BufferGeometry;
  spokeAccentGeo: THREE.BufferGeometry;
}) {
  const dir = isLeft ? 1 : -1;
  return (
    <group position={position}>
      {/* Sculpted rubber tire with 3D tread channels + procedural tread-block bump map */}
      <mesh geometry={tireGeometry} material={tireMaterial} castShadow receiveShadow />
      {/* Open-ended gloss-black inner alloy rim barrel */}
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
            <mesh position={[dir * 0.102, 0, 0]} geometry={spokeMachinedGeo}>
              <meshStandardMaterial color="#eef2f6" metalness={0.95} roughness={0.13} />
            </mesh>
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
 * - Seamless unified roof + cant rails + windshield/rear headers (0mm gaps/steps)
 * - Clean front/rear wheel clearance (frontAxleZ = 1.50m, rearAxleZ = -1.44m)
 * - 3D tread-grooved tires + modern geometric diamond-cut alloy wheels
 * - Refined compact honeycomb+stud grille & bold wrap-around multi-projector LED headlights
 * - Richly detailed lower rear tailgate (emblem, plate pocket, red reflectors, aero diffuser fins, chrome finishers)
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
  const tireTex = useMemo(() => createTireTextures(), []);

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

  const tireMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: tireTex.map,
        bumpMap: tireTex.bumpMap,
        bumpScale: 0.022,
        roughness: 0.88,
        metalness: 0.04,
      }),
    [tireTex]
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

  const reflectorMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#b91c1c',
        emissive: '#7f1d1d',
        emissiveIntensity: 0.18,
        roughness: 0.22,
        metalness: 0.25,
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

    // Compact refined trapezoidal grille boundary u(v) for v in [0 (bottom), 1 (top)]
    const grilleHalfU = (v: number) => 0.42 + 0.11 * v;
    const pillarTopY = VEHICLE_DIMS.windowTopY + 0.003; // tucks flush beneath unified roof cant rail without overlapping

    return {
      // Major unified shells (seamless roof + cant rails + windshield/rear headers!)
      frontNose: createFrontNoseGeometry(),
      roof: createSculptedRoofGeometry(),
      windshield: createCurvedWindshieldGeometry(0.012, 0.05),
      windshieldHeader: createWindshieldHeaderGeometry(),
      rearWindowTopHeader: createRearHeaderGeometry(),
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

      // ===== REFINED COMPACT MESH GRILLE + LARGER MULTI-PROJECTOR WRAP-AROUND HEADLIGHTS =====
      grilleMeshBacking: createFlushFrontStripGeometry(
        (v) => -grilleHalfU(v),
        (v) => grilleHalfU(v),
        0.5,
        0.855,
        0.009,
        0.018,
        18,
        8
      ),
      grilleStuds: createParametricGrilleStudsGeometry(),
      grilleTopChrome: createFlushFrontStripGeometry(-0.53, 0.53, 0.854, 0.888, 0.015, 0.014, 18, 2),
      grilleBorderL: createFlushFrontStripGeometry(
        (v) => grilleHalfU(v) - 0.01,
        (v) => grilleHalfU(v) + 0.034,
        0.495,
        0.86,
        0.014,
        0.014,
        4,
        10
      ),
      grilleBorderR: createFlushFrontStripGeometry(
        (v) => -(grilleHalfU(v) + 0.034),
        (v) => -(grilleHalfU(v) - 0.01),
        0.495,
        0.86,
        0.014,
        0.014,
        4,
        10
      ),
      grilleBottomChrome: createFlushFrontStripGeometry(-0.44, 0.44, 0.484, 0.506, 0.014, 0.012, 14, 2),
      lowerIntakeMesh: createFlushFrontStripGeometry(-0.56, 0.56, 0.27, 0.4, 0.008, 0.016, 16, 4),
      fogBezelL: createFlushFrontStripGeometry(0.66, 0.9, 0.295, 0.455, 0.009, 0.014, 8, 5),
      fogBezelR: createFlushFrontStripGeometry(-0.9, -0.66, 0.295, 0.455, 0.009, 0.014, 8, 5),
      fogAccentL: createFlushFrontStripGeometry(0.68, 0.86, 0.435, 0.455, 0.014, 0.01, 6, 2),
      fogAccentR: createFlushFrontStripGeometry(-0.86, -0.68, 0.435, 0.455, 0.014, 0.01, 6, 2),

      // Larger, bolder wrap-around LED headlights (u = ±0.53 .. ±1.0, y = 0.745 .. 0.916)
      hlHousingL: createFlushFrontStripGeometry(0.53, 1.0, 0.745, 0.916, 0.009, 0.018, 14, 6),
      hlHousingR: createFlushFrontStripGeometry(-1.0, -0.53, 0.745, 0.916, 0.009, 0.018, 14, 6),
      hlSideWingL: createHeadlightSideWingGeometry(1, 0.745, 0.916, 1.84, 0.007),
      hlSideWingR: createHeadlightSideWingGeometry(-1, 0.745, 0.916, 1.84, 0.007),
      hlDrlTopL: createFlushFrontStripGeometry(0.55, 0.99, 0.886, 0.91, 0.015, 0.01, 12, 2),
      hlDrlTopR: createFlushFrontStripGeometry(-0.99, -0.55, 0.886, 0.91, 0.015, 0.01, 12, 2),
      hlDrlBotL: createFlushFrontStripGeometry(0.56, 0.84, 0.754, 0.774, 0.014, 0.01, 10, 2),
      hlDrlBotR: createFlushFrontStripGeometry(-0.84, -0.56, 0.754, 0.774, 0.014, 0.01, 10, 2),
      hlTurnL: createFlushFrontStripGeometry(0.84, 0.99, 0.785, 0.875, 0.015, 0.01, 6, 3),
      hlTurnR: createFlushFrontStripGeometry(-0.99, -0.84, 0.785, 0.875, 0.015, 0.01, 6, 3),

      // ===== RICHLY DECORATED LOWER REAR TAILGATE, BUMPER & TAILLIGHTS =====
      rearPlateBezel: createFlushRearStripGeometry(-0.32, 0.32, 0.74, 0.94, 0.006, 0.014, 12, 4),
      rearGarnishChrome: createFlushRearStripGeometry(-0.56, 0.56, 1.03, 1.07, 0.014, 0.012, 16, 2),
      rearReflectorBezelL: createFlushRearStripGeometry(0.57, 0.85, 0.405, 0.468, 0.007, 0.014, 8, 3),
      rearReflectorBezelR: createFlushRearStripGeometry(-0.85, -0.57, 0.405, 0.468, 0.007, 0.014, 8, 3),
      rearReflectorL: createFlushRearStripGeometry(0.59, 0.83, 0.418, 0.456, 0.012, 0.01, 8, 2),
      rearReflectorR: createFlushRearStripGeometry(-0.83, -0.59, 0.418, 0.456, 0.012, 0.01, 8, 2),
      rearLowerChromeBlade: createFlushRearStripGeometry(-0.78, 0.78, 0.316, 0.348, 0.014, 0.012, 20, 2),
      rearDiffuser: createFlushRearStripGeometry(-0.8, 0.8, 0.21, 0.325, 0.008, 0.02, 20, 4),
      rearExhaustRimL: createFlushRearStripGeometry(0.57, 0.75, 0.232, 0.296, 0.015, 0.014, 6, 3),
      rearExhaustRimR: createFlushRearStripGeometry(-0.75, -0.57, 0.232, 0.296, 0.015, 0.014, 6, 3),
      rearExhaustBoreL: createFlushRearStripGeometry(0.595, 0.725, 0.244, 0.284, 0.018, 0.01, 4, 2),
      rearExhaustBoreR: createFlushRearStripGeometry(-0.725, -0.595, 0.244, 0.284, 0.018, 0.01, 4, 2),

      tlHousingL: createFlushRearStripGeometry(0.815, 1.0, 1.155, 1.675, 0.008, 0.024, 6, 12),
      tlHousingR: createFlushRearStripGeometry(-1.0, -0.815, 1.155, 1.675, 0.008, 0.024, 6, 12),
      tlBladeL: createFlushRearStripGeometry(0.885, 0.965, 1.3, 1.64, 0.014, 0.012, 4, 10),
      tlBladeR: createFlushRearStripGeometry(-0.965, -0.885, 1.3, 1.64, 0.014, 0.012, 4, 10),
      tlReverseL: createFlushRearStripGeometry(0.885, 0.965, 1.24, 1.286, 0.014, 0.012, 4, 3),
      tlReverseR: createFlushRearStripGeometry(-0.965, -0.885, 1.24, 1.286, 0.014, 0.012, 4, 3),
      tlTurnL: createFlushRearStripGeometry(0.885, 0.965, 1.172, 1.228, 0.014, 0.012, 4, 4),
      tlTurnR: createFlushRearStripGeometry(-0.965, -0.885, 1.172, 1.228, 0.014, 0.012, 4, 4),
      tlSideWrapL: createCurvedSidePanel({
        side: 1,
        zMin: -2.18,
        zMax: -2.02,
        yMin: 1.155,
        yMax: 1.665,
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
        yMax: 1.665,
        zMinAtY: (y) => dPillarRearZ(y) - 0.004,
        zMaxAtY: (y) => dPillarRearZ(y) + 0.055,
        xOffset: 0.007,
        thickness: 0.016,
        rows: 10,
        cols: 3,
      }),

      // ===== LEFT SIDE (+X) PANELS — ZERO TIRE OVERLAP, ZERO CANT-RAIL SEAM =====
      leftFrontFender: createCurvedSidePanel({
        side: 1,
        zMin: 1.124,
        zMax: 2.165,
        yMin: VEHICLE_DIMS.sillBottomY,
        yMax: fenderTopY,
        zMaxAtY: (y) => frontCornerZ(y),
        wheelArch: frontArch,
        thickness: 0.042,
        characterCrease: true,
        rows: 16,
        cols: 32,
      }),
      leftFrontDoorLower: createCurvedSidePanel({
        side: 1,
        zMin: 0.222,
        zMax: 1.12,
        yMin: VEHICLE_DIMS.doorBottomY,
        yMax: frontBeltlineY,
        thickness: 0.042,
        characterCrease: true,
        rows: 14,
        cols: 16,
      }),
      leftFrontWindowGlass: createCurvedSidePanel({
        side: 1,
        zMin: 0.322,
        zMax: 1.4,
        yMin: frontBeltlineY,
        yMax: VEHICLE_DIMS.windowTopY,
        zMinAtY: () => 0.322,
        zMaxAtY: (y) => Math.max(0.35, aPillarZ(y) - 0.068),
        xOffset: -0.008,
        thickness: 0.012,
        rows: 14,
        cols: 14,
      }),
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
        zMin: -0.844,
        zMax: 1.12,
        yMin: 0.205,
        yMax: 0.342,
        thickness: 0.065,
        rows: 6,
        cols: 16,
      }),
      leftRockerAeroSkirt: createCurvedSidePanel({
        side: 1,
        zMin: -1.04,
        zMax: 1.1,
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
        zMax: 0.328,
        yMin: 1.145,
        yMax: pillarTopY,
        xOffset: 0.001,
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
        yMax: VEHICLE_DIMS.windowTopY,
        xOffset: -0.022,
        thickness: 0.042,
        rows: 10,
        cols: 2,
      }),

      sealFront: createCurvedSidePanel({
        side: 1,
        zMin: 0.206,
        zMax: 0.226,
        yMin: 0.34,
        yMax: 1.7,
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
        yMax: 1.7,
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
        yMin: 1.685,
        yMax: 1.705,
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
      leftCPillarUpper: createCurvedSidePanel({
        side: 1,
        zMin: -0.945,
        zMax: -0.844,
        yMin: 1.148,
        yMax: pillarTopY,
        xOffset: 0.001,
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
        yMax: pillarTopY,
        zMinAtY: (y) => dPillarRearZ(y) - 0.004,
        zMaxAtY: (y) => dPillarRearZ(y) + 0.218,
        xOffset: 0.001,
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
        zMin: 1.124,
        zMax: 2.165,
        yMin: VEHICLE_DIMS.sillBottomY,
        yMax: fenderTopY,
        zMaxAtY: (y) => frontCornerZ(y),
        wheelArch: frontArch,
        thickness: 0.042,
        characterCrease: true,
        rows: 16,
        cols: 32,
      }),
      rightCabinLowerBody: createCurvedSidePanel({
        side: -1,
        zMin: -0.844,
        zMax: 1.12,
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
        zMax: 1.4,
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
        yMax: pillarTopY,
        xOffset: 0.001,
        thickness: 0.044,
        rows: 12,
        cols: 3,
      }),
      rightCPillarUpper: createCurvedSidePanel({
        side: -1,
        zMin: -0.945,
        zMax: -0.844,
        yMin: 1.148,
        yMax: pillarTopY,
        xOffset: 0.001,
        thickness: 0.044,
        rows: 12,
        cols: 3,
      }),
      rightDPillarUpper: createCurvedSidePanel({
        side: -1,
        zMin: -2.18,
        zMax: -1.86,
        yMin: 1.148,
        yMax: pillarTopY,
        zMinAtY: (y) => dPillarRearZ(y) - 0.004,
        zMaxAtY: (y) => dPillarRearZ(y) + 0.218,
        xOffset: 0.001,
        thickness: 0.045,
        rows: 12,
        cols: 4,
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
        zMin: -1.04,
        zMax: 1.1,
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
  const frontPlatePos = useMemo(() => frontFasciaPoint(0, 0.435, 0.02), []);
  const rearPlatePos = useMemo(() => rearFasciaPoint(0, 0.84, 0.014), []);
  const rearEmblemPos = useMemo(() => rearFasciaPoint(0, 1.095, 0.015), []);

  return (
    <group>
      {/* ===================== UNDERBODY & CHASSIS ===================== */}
      <mesh position={[0, 0.22, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[1.14, 0.1, 3.96]} />
        <meshStandardMaterial color="#0d1118" roughness={0.92} />
      </mesh>
      <WheelWellHousing position={[0.66, 0.33, VEHICLE_DIMS.frontAxleZ]} side={1} />
      <WheelWellHousing position={[-0.66, 0.33, VEHICLE_DIMS.frontAxleZ]} side={-1} />
      <WheelWellHousing position={[0.66, 0.33, VEHICLE_DIMS.rearAxleZ]} side={1} />
      <WheelWellHousing position={[-0.66, 0.33, VEHICLE_DIMS.rearAxleZ]} side={-1} />

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

      {/* Modern Compact Honeycomb Mesh + Parametric 3D Stud Front Grille */}
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
        <cylinderGeometry args={[0.066, 0.07, 0.018, 28]} />
      </mesh>
      <mesh
        position={[frontEmblemPos.x, frontEmblemPos.y, frontEmblemPos.z + 0.006]}
        rotation={[Math.PI / 2, 0, 0]}
        material={glossBlackMaterial}
      >
        <cylinderGeometry args={[0.052, 0.052, 0.012, 24]} />
      </mesh>

      {/* Front Japanese License Plate */}
      <mesh position={frontPlatePos}>
        <planeGeometry args={[0.33, 0.165]} />
        <meshStandardMaterial map={plateTexture} roughness={0.35} />
      </mesh>

      {/* Larger Bold Wrap-Around Multi-Projector LED Headlights & Turn Signals (Left + Right) */}
      <mesh geometry={geos.hlHousingL} material={glossBlackMaterial} />
      <mesh geometry={geos.hlHousingR} material={glossBlackMaterial} />
      <mesh geometry={geos.hlSideWingL} material={glossBlackMaterial} />
      <mesh geometry={geos.hlSideWingR} material={glossBlackMaterial} />
      <mesh geometry={geos.hlDrlTopL} material={headlightMaterial} />
      <mesh geometry={geos.hlDrlTopR} material={headlightMaterial} />
      <mesh geometry={geos.hlDrlBotL} material={headlightMaterial} />
      <mesh geometry={geos.hlDrlBotR} material={headlightMaterial} />
      <mesh geometry={geos.hlTurnL} material={hazardMaterial} />
      <mesh geometry={geos.hlTurnR} material={hazardMaterial} />
      {/* Prominent Twin Recessed LED Projector Lenses per Headlight */}
      {[1, -1].map((side) =>
        [0.63, 0.755].map((uVal, pIdx) => {
          const pos = frontFasciaPoint(side * uVal, 0.835, 0.016);
          return (
            <group
              key={`proj-${side}-${pIdx}`}
              position={pos}
              rotation={[0, side * (0.18 + pIdx * 0.16), 0]}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]} material={chromeMaterial}>
                <torusGeometry args={[0.032, 0.0045, 10, 22]} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} material={headlightMaterial}>
                <cylinderGeometry args={[0.027, 0.029, 0.014, 20]} />
              </mesh>
            </group>
          );
        })
      )}

      {/* ===================== CURVED WINDSHIELD, SEAMLESS HEADER & A-PILLARS ===================== */}
      <mesh geometry={geos.windshield} material={clearGlassMaterial} />
      <mesh geometry={geos.windshieldHeader} material={roofMaterial} />
      <mesh geometry={geos.aPillarL} material={glossBlackMaterial} castShadow />
      <mesh geometry={geos.aPillarR} material={glossBlackMaterial} castShadow />

      {/* ===================== UNIFIED SEAMLESS ROOF + CANT RAILS & SHARK-FIN ===================== */}
      <mesh geometry={geos.roof} material={roofMaterial} castShadow receiveShadow />
      <mesh position={[0, 1.838, -1.62]} geometry={geos.sharkFin} material={roofMaterial} castShadow />
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
          position={[bodySideX(1.015) + 0.016, 1.015, 0.39]}
          geometry={geos.handleBar}
          material={chromeMaterial}
          castShadow
        />

        {/* Sculpted Aerodynamic Left Side Mirror — angled backward & tilted in sleek "ハの字" */}
        <group position={[bodySideX(1.145) - 0.01, 1.145, 1.07]}>
          <mesh position={[0.052, 0.022, -0.016]} rotation={[0, 0.24, 0.48]} material={glossBlackMaterial}>
            <boxGeometry args={[0.125, 0.036, 0.062]} />
          </mesh>
          <group position={[0.142, 0.056, -0.038]} rotation={[0.04, 0.34, 0.16]}>
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

        {/* Lower Side Sill & Aero Rocker Skirt */}
        <mesh geometry={geos.leftLowerSill} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.leftRockerAeroSkirt} material={matteRubberMaterial} />

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
        <mesh geometry={geos.rightBeltChrome} material={chromeMaterial} />
        <mesh geometry={geos.rightRockerAeroSkirt} material={matteRubberMaterial} />
        <mesh geometry={geos.flareFR} material={paintMaterial} />
        <mesh geometry={geos.flareRR} material={paintMaterial} />

        {/* Right Side Aerodynamic Mirror — symmetric swept-back "ハの字" */}
        <group position={[-(bodySideX(1.145) - 0.01), 1.145, 1.07]}>
          <mesh position={[-0.052, 0.022, -0.016]} rotation={[0, -0.24, -0.48]} material={glossBlackMaterial}>
            <boxGeometry args={[0.125, 0.036, 0.062]} />
          </mesh>
          <group position={[-0.142, 0.056, -0.038]} rotation={[0.04, -0.34, -0.16]}>
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

      {/* ===================== SCULPTED REAR TAILGATE, DECORATED BUMPER & TAILLIGHTS ===================== */}
      <group>
        <mesh geometry={geos.rearTailgate} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.rearGlass} material={privacyGlassMaterial} />
        <mesh geometry={geos.rearWindowTopHeader} material={roofMaterial} />

        {/* Upper Tailgate Chrome Garnish & Centered Rear Emblem */}
        <mesh geometry={geos.rearGarnishChrome} material={chromeMaterial} />
        <mesh position={rearEmblemPos} rotation={[Math.PI / 2, 0, 0]} material={chromeMaterial}>
          <cylinderGeometry args={[0.046, 0.05, 0.014, 24]} />
        </mesh>
        <mesh
          position={[rearEmblemPos.x, rearEmblemPos.y, rearEmblemPos.z - 0.005]}
          rotation={[Math.PI / 2, 0, 0]}
          material={glossBlackMaterial}
        >
          <cylinderGeometry args={[0.036, 0.036, 0.01, 20]} />
        </mesh>

        {/* Recessed License Plate Pocket Bezel + Japanese License Plate */}
        <mesh geometry={geos.rearPlateBezel} material={glossBlackMaterial} />
        <mesh position={rearPlatePos} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.33, 0.165]} />
          <meshStandardMaterial map={plateTexture} roughness={0.35} />
        </mesh>

        {/* Rear Wiper Blade resting neatly at base of rear glass */}
        <mesh position={[0.11, 1.195, -2.28]} rotation={[0, 0, -0.08]} material={matteRubberMaterial}>
          <boxGeometry args={[0.32, 0.018, 0.018]} />
        </mesh>

        {/* Lower Rear Bumper Decorations: Red Reflectors, Satin Chrome Blade, Diffuser Fins & Dual Chrome Finishers */}
        <mesh geometry={geos.rearReflectorBezelL} material={glossBlackMaterial} />
        <mesh geometry={geos.rearReflectorBezelR} material={glossBlackMaterial} />
        <mesh geometry={geos.rearReflectorL} material={reflectorMaterial} />
        <mesh geometry={geos.rearReflectorR} material={reflectorMaterial} />
        <mesh geometry={geos.rearLowerChromeBlade} material={satinChromeMaterial} />
        <mesh geometry={geos.rearDiffuser} material={matteRubberMaterial} />
        {[-0.36, -0.18, 0, 0.18, 0.36].map((xFin) => {
          const finPos = rearFasciaPoint(xFin / 0.8, 0.265, 0.018);
          return (
            <mesh key={`fin-${xFin}`} position={finPos} material={glossBlackMaterial}>
              <boxGeometry args={[0.016, 0.088, 0.03]} />
            </mesh>
          );
        })}
        <mesh geometry={geos.rearExhaustRimL} material={chromeMaterial} />
        <mesh geometry={geos.rearExhaustRimR} material={chromeMaterial} />
        <mesh geometry={geos.rearExhaustBoreL} material={glossBlackMaterial} />
        <mesh geometry={geos.rearExhaustBoreR} material={glossBlackMaterial} />

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

      {/* ===================== 4 MODERN GEOMETRIC ALLOY WHEELS + GROOVED TIRES ===================== */}
      <AlloyWheel
        position={[0.725, VEHICLE_DIMS.wheelRadius, VEHICLE_DIMS.frontAxleZ]}
        isLeft
        tireGeometry={geos.tire}
        tireMaterial={tireMaterial}
        spokeMachinedGeo={geos.spokeMachined}
        spokeAccentGeo={geos.spokeAccent}
      />
      <AlloyWheel
        position={[-0.725, VEHICLE_DIMS.wheelRadius, VEHICLE_DIMS.frontAxleZ]}
        isLeft={false}
        tireGeometry={geos.tire}
        tireMaterial={tireMaterial}
        spokeMachinedGeo={geos.spokeMachined}
        spokeAccentGeo={geos.spokeAccent}
      />
      <AlloyWheel
        position={[0.725, VEHICLE_DIMS.wheelRadius, VEHICLE_DIMS.rearAxleZ]}
        isLeft
        tireGeometry={geos.tire}
        tireMaterial={tireMaterial}
        spokeMachinedGeo={geos.spokeMachined}
        spokeAccentGeo={geos.spokeAccent}
      />
      <AlloyWheel
        position={[-0.725, VEHICLE_DIMS.wheelRadius, VEHICLE_DIMS.rearAxleZ]}
        isLeft={false}
        tireGeometry={geos.tire}
        tireMaterial={tireMaterial}
        spokeMachinedGeo={geos.spokeMachined}
        spokeAccentGeo={geos.spokeAccent}
      />
    </group>
  );
}
