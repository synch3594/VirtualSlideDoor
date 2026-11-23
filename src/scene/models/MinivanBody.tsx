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
  createModernWingGrilleGeometry,
  createRearGlassGeometry,
  createRearHeaderGeometry,
  createRearTailgateGeometry,
  createRoundedBoxGeometry,
  createSculptedRoofGeometry,
  createSculptedTireGeometry,
  createShapedFrontPatchGeometry,
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

    // Swept Front Grille-to-Headlight Datum Curves (seamless visual continuity)
    const smooth01 = (a: number, b: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const browTopY = (absU: number) => 0.902 + 0.022 * smooth01(0.42, 0.96, absU);
    const hlBotY = (absU: number) => 0.772 + 0.044 * smooth01(0.52, 0.99, absU);
    const grilleOuterU = (v: number) => 0.405 + 0.132 * Math.pow(v, 0.85);
    const hlInnerU = (v: number) => 0.514 + 0.042 * v;
    const wingGrille = createModernWingGrilleGeometry();
    const pillarTopY = VEHICLE_DIMS.windowTopY + 0.003; // tucks flush beneath unified roof cant rail without overlapping
    const cz = DOOR_METRICS.doorClosedCenterZ; // -0.31
    const rDoorFront = cz + 0.526; // +0.216
    const rDoorRear = cz - 0.526; // -0.836
    const beltY = VEHICLE_DIMS.beltlineY; // 1.15
    const winTopY = VEHICLE_DIMS.windowTopY; // 1.685

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

      // ===== SLEEK WING-LOUVER FRONT GRILLE + SWEPT MULTI-CRYSTAL LED HEADLIGHTS + PLATE PLINTH =====
      grilleMeshBacking: createFlushFrontStripGeometry(
        (v) => -(grilleOuterU(v) - 0.022),
        (v) => grilleOuterU(v) - 0.022,
        0.564,
        0.892,
        0.004,
        0.016,
        18,
        8
      ),
      grilleWingBars: wingGrille.wingBars,
      grilleSubFins: wingGrille.subFins,
      grilleTopChrome: createShapedFrontPatchGeometry({
        uMin: -0.556,
        uMax: 0.556,
        yMin: (u) => browTopY(Math.abs(u)) - 0.020,
        yMax: (u) => browTopY(Math.abs(u)),
        protrude: 0.019,
        thickness: 0.018,
        cols: 20,
        rows: 2,
      }),
      grilleBorderL: createFlushFrontStripGeometry(
        (v) => grilleOuterU(v) - 0.026,
        (v) => grilleOuterU(v),
        0.558,
        0.892,
        0.018,
        0.018,
        4,
        10
      ),
      grilleBorderR: createFlushFrontStripGeometry(
        (v) => -grilleOuterU(v),
        (v) => -(grilleOuterU(v) - 0.026),
        0.558,
        0.892,
        0.018,
        0.018,
        4,
        10
      ),
      grilleInnerFrameL: createFlushFrontStripGeometry(
        (v) => grilleOuterU(v) - 0.038,
        (v) => grilleOuterU(v) - 0.024,
        0.566,
        0.890,
        0.010,
        0.014,
        3,
        8
      ),
      grilleInnerFrameR: createFlushFrontStripGeometry(
        (v) => -(grilleOuterU(v) - 0.024),
        (v) => -(grilleOuterU(v) - 0.038),
        0.566,
        0.890,
        0.010,
        0.014,
        3,
        8
      ),
      grilleBottomChrome: createFlushFrontStripGeometry(-0.408, 0.408, 0.556, 0.574, 0.018, 0.018, 14, 2),

      // Dedicated Molded License Plate Plinth (clean painted bumper band between y=0.352 and y=0.556)
      frontPlatePlinth: createShapedFrontPatchGeometry({
        uMin: -0.215,
        uMax: 0.215,
        yMin: 0.358,
        yMax: 0.538,
        protrude: 0.026,
        thickness: 0.030,
        cols: 10,
        rows: 4,
      }),

      // Refined Lower Bumper Intake + Aero Fin + Chin Spoiler + Angled Side Air-Curtain Pockets
      lowerIntakeMesh: createFlushFrontStripGeometry(-0.51, 0.51, 0.252, 0.338, 0.004, 0.016, 16, 4),
      lowerIntakeTopLip: createFlushFrontStripGeometry(-0.53, 0.53, 0.334, 0.348, 0.016, 0.018, 16, 2),
      lowerLouver1: createFlushFrontStripGeometry(-0.49, 0.49, 0.288, 0.302, 0.016, 0.016, 16, 2),
      frontChinSpoiler: createFlushFrontStripGeometry(-0.94, 0.94, 0.208, 0.244, 0.024, 0.036, 24, 3),
      frontSplitterChrome: createFlushFrontStripGeometry(-0.54, 0.54, 0.230, 0.248, 0.028, 0.014, 16, 2),
      fogBezelL: createShapedFrontPatchGeometry({
        uMin: (v) => 0.61 + 0.06 * v,
        uMax: (v) => 0.87 + 0.05 * v,
        yMin: 0.275,
        yMax: 0.465,
        protrude: 0.004,
        thickness: 0.016,
        cols: 8,
        rows: 5,
      }),
      fogBezelR: createShapedFrontPatchGeometry({
        uMin: (v) => -(0.87 + 0.05 * v),
        uMax: (v) => -(0.61 + 0.06 * v),
        yMin: 0.275,
        yMax: 0.465,
        protrude: 0.004,
        thickness: 0.016,
        cols: 8,
        rows: 5,
      }),
      fogAccentL: createFlushFrontStripGeometry(0.65, 0.92, 0.445, 0.468, 0.021, 0.018, 8, 2),
      fogAccentR: createFlushFrontStripGeometry(-0.92, -0.65, 0.445, 0.468, 0.021, 0.018, 8, 2),
      fogAccentVertL: createShapedFrontPatchGeometry({
        uMin: (v) => 0.605 + 0.055 * v,
        uMax: (v) => 0.635 + 0.055 * v,
        yMin: 0.275,
        yMax: 0.468,
        protrude: 0.021,
        thickness: 0.018,
        cols: 3,
        rows: 6,
      }),
      fogAccentVertR: createShapedFrontPatchGeometry({
        uMin: (v) => -(0.635 + 0.055 * v),
        uMax: (v) => -(0.605 + 0.055 * v),
        yMin: 0.275,
        yMax: 0.468,
        protrude: 0.021,
        thickness: 0.018,
        cols: 3,
        rows: 6,
      }),
      fogLedBarL: createFlushFrontStripGeometry(0.67, 0.85, 0.352, 0.372, 0.014, 0.012, 8, 2),
      fogLedBarR: createFlushFrontStripGeometry(-0.85, -0.67, 0.352, 0.372, 0.014, 0.012, 8, 2),

      // Sharp Angular Swept Multi-Crystal LED Headlights flowing from grille brow
      hlHousingL: createShapedFrontPatchGeometry({
        uMin: hlInnerU,
        uMax: 1.0,
        yMin: (u) => hlBotY(Math.abs(u)),
        yMax: (u) => browTopY(Math.abs(u)),
        protrude: 0.006,
        thickness: 0.018,
        cols: 16,
        rows: 6,
      }),
      hlHousingR: createShapedFrontPatchGeometry({
        uMin: -1.0,
        uMax: (v) => -hlInnerU(v),
        yMin: (u) => hlBotY(Math.abs(u)),
        yMax: (u) => browTopY(Math.abs(u)),
        protrude: 0.006,
        thickness: 0.018,
        cols: 16,
        rows: 6,
      }),
      hlSideWingL: createHeadlightSideWingGeometry(1, 0.814, 0.924, 1.84, 0.006),
      hlSideWingR: createHeadlightSideWingGeometry(-1, 0.814, 0.924, 1.84, 0.006),
      hlDrlTopL: createShapedFrontPatchGeometry({
        uMin: 0.554,
        uMax: 0.994,
        yMin: (u) => browTopY(Math.abs(u)) - 0.018,
        yMax: (u) => browTopY(Math.abs(u)),
        protrude: 0.018,
        thickness: 0.012,
        cols: 14,
        rows: 2,
      }),
      hlDrlTopR: createShapedFrontPatchGeometry({
        uMin: -0.994,
        uMax: -0.554,
        yMin: (u) => browTopY(Math.abs(u)) - 0.018,
        yMax: (u) => browTopY(Math.abs(u)),
        protrude: 0.018,
        thickness: 0.012,
        cols: 14,
        rows: 2,
      }),
      hlDrlInnerL: createShapedFrontPatchGeometry({
        uMin: (v) => hlInnerU(v) + 0.002,
        uMax: (v) => hlInnerU(v) + 0.020,
        yMin: 0.774,
        yMax: 0.896,
        protrude: 0.018,
        thickness: 0.012,
        cols: 3,
        rows: 8,
      }),
      hlDrlInnerR: createShapedFrontPatchGeometry({
        uMin: (v) => -(hlInnerU(v) + 0.020),
        uMax: (v) => -(hlInnerU(v) + 0.002),
        yMin: 0.774,
        yMax: 0.896,
        protrude: 0.018,
        thickness: 0.012,
        cols: 3,
        rows: 8,
      }),
      hlDrlBotL: createShapedFrontPatchGeometry({
        uMin: 0.518,
        uMax: 0.835,
        yMin: (u) => hlBotY(Math.abs(u)),
        yMax: (u) => hlBotY(Math.abs(u)) + 0.016,
        protrude: 0.017,
        thickness: 0.012,
        cols: 12,
        rows: 2,
      }),
      hlDrlBotR: createShapedFrontPatchGeometry({
        uMin: -0.835,
        uMax: -0.518,
        yMin: (u) => hlBotY(Math.abs(u)),
        yMax: (u) => hlBotY(Math.abs(u)) + 0.016,
        protrude: 0.017,
        thickness: 0.012,
        cols: 12,
        rows: 2,
      }),
      hlCrystal1L: createShapedFrontPatchGeometry({
        uMin: 0.588,
        uMax: 0.650,
        yMin: 0.806,
        yMax: 0.870,
        protrude: (s, v) => 0.016 + 0.008 * Math.sin(s * Math.PI) * Math.sin(v * Math.PI),
        thickness: 0.014,
        cols: 4,
        rows: 4,
      }),
      hlCrystal2L: createShapedFrontPatchGeometry({
        uMin: 0.664,
        uMax: 0.726,
        yMin: 0.814,
        yMax: 0.876,
        protrude: (s, v) => 0.016 + 0.008 * Math.sin(s * Math.PI) * Math.sin(v * Math.PI),
        thickness: 0.014,
        cols: 4,
        rows: 4,
      }),
      hlCrystal3L: createShapedFrontPatchGeometry({
        uMin: 0.740,
        uMax: 0.802,
        yMin: 0.822,
        yMax: 0.882,
        protrude: (s, v) => 0.016 + 0.008 * Math.sin(s * Math.PI) * Math.sin(v * Math.PI),
        thickness: 0.014,
        cols: 4,
        rows: 4,
      }),
      hlCrystal1R: createShapedFrontPatchGeometry({
        uMin: -0.650,
        uMax: -0.588,
        yMin: 0.806,
        yMax: 0.870,
        protrude: (s, v) => 0.016 + 0.008 * Math.sin(s * Math.PI) * Math.sin(v * Math.PI),
        thickness: 0.014,
        cols: 4,
        rows: 4,
      }),
      hlCrystal2R: createShapedFrontPatchGeometry({
        uMin: -0.726,
        uMax: -0.664,
        yMin: 0.814,
        yMax: 0.876,
        protrude: (s, v) => 0.016 + 0.008 * Math.sin(s * Math.PI) * Math.sin(v * Math.PI),
        thickness: 0.014,
        cols: 4,
        rows: 4,
      }),
      hlCrystal3R: createShapedFrontPatchGeometry({
        uMin: -0.802,
        uMax: -0.740,
        yMin: 0.822,
        yMax: 0.882,
        protrude: (s, v) => 0.016 + 0.008 * Math.sin(s * Math.PI) * Math.sin(v * Math.PI),
        thickness: 0.014,
        cols: 4,
        rows: 4,
      }),
      hlCrystalTrayL: createShapedFrontPatchGeometry({
        uMin: 0.578,
        uMax: 0.812,
        yMin: (u) => 0.795 + 0.09 * (Math.abs(u) - 0.578),
        yMax: (u) => 0.804 + 0.09 * (Math.abs(u) - 0.578),
        protrude: 0.016,
        thickness: 0.012,
        cols: 10,
        rows: 2,
      }),
      hlCrystalTrayR: createShapedFrontPatchGeometry({
        uMin: -0.812,
        uMax: -0.578,
        yMin: (u) => 0.795 + 0.09 * (Math.abs(u) - 0.578),
        yMax: (u) => 0.804 + 0.09 * (Math.abs(u) - 0.578),
        protrude: 0.016,
        thickness: 0.012,
        cols: 10,
        rows: 2,
      }),
      hlTurnL: createShapedFrontPatchGeometry({
        uMin: 0.818,
        uMax: 0.985,
        yMin: (u) => hlBotY(Math.abs(u)) + 0.014,
        yMax: (u) => hlBotY(Math.abs(u)) + 0.036,
        protrude: 0.016,
        thickness: 0.012,
        cols: 8,
        rows: 2,
      }),
      hlTurnR: createShapedFrontPatchGeometry({
        uMin: -0.985,
        uMax: -0.818,
        yMin: (u) => hlBotY(Math.abs(u)) + 0.014,
        yMax: (u) => hlBotY(Math.abs(u)) + 0.036,
        protrude: 0.016,
        thickness: 0.012,
        cols: 8,
        rows: 2,
      }),

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
        yMax: winTopY + 0.005,
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
        yMax: winTopY + 0.005,
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
        yMin: winTopY - 0.007,
        yMax: winTopY + 0.007,
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

      // ===== RIGHT SIDE (-X, AUTHENTIC DRIVER-SIDE DOOR SEAMS, SLIDING DOOR & CENTER RAIL) =====
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
      rightFrontDoorLower: createCurvedSidePanel({
        side: -1,
        zMin: 0.222,
        zMax: 1.12,
        yMin: VEHICLE_DIMS.doorBottomY,
        yMax: frontBeltlineY,
        thickness: 0.042,
        characterCrease: true,
        rows: 14,
        cols: 16,
      }),
      rightSlidingDoorLower: createCurvedSidePanel({
        side: -1,
        zMin: rDoorRear,
        zMax: rDoorFront,
        yMin: VEHICLE_DIMS.doorBottomY,
        yMax: beltY + 0.002,
        thickness: 0.044,
        characterCrease: true,
        rows: 16,
        cols: 16,
        usePlanTaper: false,
      }),
      rightLowerSill: createCurvedSidePanel({
        side: -1,
        zMin: -0.844,
        zMax: 1.12,
        yMin: 0.205,
        yMax: 0.34,
        thickness: 0.065,
        rows: 6,
        cols: 16,
      }),
      // Recessed dark shut-line backing strips so every right-side door gap reads cleanly without light leaks
      rightSeamFenderDoor: createCurvedSidePanel({
        side: -1,
        zMin: 1.114,
        zMax: 1.13,
        yMin: 0.21,
        yMax: frontBeltlineY(1.122),
        xOffset: -0.016,
        thickness: 0.032,
        rows: 10,
        cols: 2,
      }),
      rightSeamBPillar: createCurvedSidePanel({
        side: -1,
        zMin: 0.206,
        zMax: 0.232,
        yMin: 0.34,
        yMax: winTopY,
        xOffset: -0.016,
        thickness: 0.036,
        rows: 16,
        cols: 2,
      }),
      rightSeamCPillar: createCurvedSidePanel({
        side: -1,
        zMin: -0.852,
        zMax: -0.826,
        yMin: 0.34,
        yMax: winTopY,
        xOffset: -0.016,
        thickness: 0.036,
        rows: 16,
        cols: 2,
      }),
      rightSeamSillHoriz: createCurvedSidePanel({
        side: -1,
        zMin: -0.844,
        zMax: 1.12,
        yMin: 0.334,
        yMax: 0.352,
        xOffset: -0.016,
        thickness: 0.032,
        rows: 2,
        cols: 18,
      }),
      // Right Rear Quarter Panel split along matching recessed center slide rail
      rightRearQuarterBelowRail: createCurvedSidePanel({
        side: -1,
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
      rightRearQuarterAboveRail: createCurvedSidePanel({
        side: -1,
        zMin: -2.18,
        zMax: -0.844,
        yMin: DOOR_METRICS.centerRailY + 0.021,
        yMax: 1.155,
        zMinAtY: (y) => rearCornerZ(y),
        thickness: 0.045,
        rows: 4,
        cols: 16,
      }),
      rightRearQuarterBehindRail: createCurvedSidePanel({
        side: -1,
        zMin: -2.18,
        zMax: -1.96,
        yMin: DOOR_METRICS.centerRailY - 0.023,
        yMax: DOOR_METRICS.centerRailY + 0.023,
        zMinAtY: (y) => rearCornerZ(y),
        thickness: 0.045,
        rows: 3,
        cols: 6,
      }),
      rightCenterRailBacking: createCurvedSidePanel({
        side: -1,
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
      rightFrontWindowGlass: createCurvedSidePanel({
        side: -1,
        zMin: 0.322,
        zMax: 1.4,
        yMin: frontBeltlineY,
        yMax: winTopY,
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
      rightSlidingWindowGlass: createCurvedSidePanel({
        side: -1,
        zMin: rDoorRear + 0.072,
        zMax: rDoorFront - 0.072,
        yMin: beltY + 0.004,
        yMax: winTopY - 0.016,
        xOffset: -0.008,
        thickness: 0.014,
        rows: 12,
        cols: 12,
        usePlanTaper: false,
      }),
      rightSlidingSashF: createCurvedSidePanel({
        side: -1,
        zMin: rDoorFront - 0.075,
        zMax: rDoorFront,
        yMin: beltY + 0.002,
        yMax: winTopY,
        xOffset: 0.001,
        thickness: 0.038,
        rows: 12,
        cols: 2,
        usePlanTaper: false,
      }),
      rightSlidingSashR: createCurvedSidePanel({
        side: -1,
        zMin: rDoorRear,
        zMax: rDoorRear + 0.075,
        yMin: beltY + 0.002,
        yMax: winTopY,
        xOffset: 0.001,
        thickness: 0.038,
        rows: 12,
        cols: 2,
        usePlanTaper: false,
      }),
      rightSlidingSashT: createCurvedSidePanel({
        side: -1,
        zMin: rDoorRear,
        zMax: rDoorFront,
        yMin: winTopY - 0.022,
        yMax: winTopY,
        xOffset: 0.001,
        thickness: 0.038,
        rows: 4,
        cols: 12,
        usePlanTaper: false,
      }),
      rightRearQuarterGlass: createCurvedSidePanel({
        side: -1,
        zMin: -2.02,
        zMax: -0.94,
        yMin: 1.154,
        yMax: winTopY,
        zMinAtY: (y) => dPillarRearZ(y) + 0.21,
        zMaxAtY: () => -0.94,
        xOffset: -0.008,
        thickness: 0.012,
        rows: 12,
        cols: 14,
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
      rightFrontBeltChrome: createCurvedSidePanel({
        side: -1,
        zMin: 0.224,
        zMax: 1.43,
        yMin: (z) => frontBeltlineY(z) - 0.01,
        yMax: (z) => frontBeltlineY(z) + 0.012,
        xOffset: 0.005,
        thickness: 0.01,
        rows: 3,
        cols: 18,
      }),
      rightSlidingBeltChrome: createCurvedSidePanel({
        side: -1,
        zMin: rDoorRear + 0.004,
        zMax: rDoorFront - 0.004,
        yMin: beltY - 0.006,
        yMax: beltY + 0.014,
        xOffset: 0.005,
        thickness: 0.01,
        rows: 2,
        cols: 12,
        usePlanTaper: false,
      }),
      rightRearBeltChrome: createCurvedSidePanel({
        side: -1,
        zMin: -1.96,
        zMax: -0.844,
        yMin: 1.144,
        yMax: 1.164,
        xOffset: 0.005,
        thickness: 0.01,
        rows: 2,
        cols: 16,
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

  const frontEmblemPos = useMemo(() => frontFasciaPoint(0, 0.80, 0.024), []);
  const frontPlatePos = useMemo(() => frontFasciaPoint(0, 0.448, 0.028), []);
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

      {/* Sleek Multi-Tier Wing-Louver Front Grille + Molded Bumper Relief */}
      <mesh geometry={geos.grilleMeshBacking} material={grilleMeshMaterial} />
      <mesh geometry={geos.grilleSubFins} material={glossBlackMaterial} />
      <mesh geometry={geos.grilleInnerFrameL} material={glossBlackMaterial} />
      <mesh geometry={geos.grilleInnerFrameR} material={glossBlackMaterial} />
      <mesh geometry={geos.grilleWingBars} material={satinChromeMaterial} />
      <mesh geometry={geos.grilleTopChrome} material={chromeMaterial} />
      <mesh geometry={geos.grilleBorderL} material={satinChromeMaterial} />
      <mesh geometry={geos.grilleBorderR} material={satinChromeMaterial} />
      <mesh geometry={geos.grilleBottomChrome} material={satinChromeMaterial} />
      <mesh geometry={geos.lowerIntakeMesh} material={grilleMeshMaterial} />
      <mesh geometry={geos.lowerIntakeTopLip} material={glossBlackMaterial} />
      <mesh geometry={geos.lowerLouver1} material={satinChromeMaterial} />
      <mesh geometry={geos.frontChinSpoiler} material={glossBlackMaterial} />
      <mesh geometry={geos.frontSplitterChrome} material={satinChromeMaterial} />
      <mesh geometry={geos.fogBezelL} material={glossBlackMaterial} />
      <mesh geometry={geos.fogBezelR} material={glossBlackMaterial} />
      <mesh geometry={geos.fogAccentL} material={chromeMaterial} />
      <mesh geometry={geos.fogAccentR} material={chromeMaterial} />
      <mesh geometry={geos.fogAccentVertL} material={chromeMaterial} />
      <mesh geometry={geos.fogAccentVertR} material={chromeMaterial} />
      <mesh geometry={geos.fogLedBarL} material={headlightMaterial} />
      <mesh geometry={geos.fogLedBarR} material={headlightMaterial} />

      {/* Center Front Chrome Emblem */}
      <mesh position={frontEmblemPos} rotation={[Math.PI / 2, 0, 0]} material={chromeMaterial}>
        <cylinderGeometry args={[0.062, 0.066, 0.018, 28]} />
      </mesh>
      <mesh
        position={[frontEmblemPos.x, frontEmblemPos.y, frontEmblemPos.z + 0.006]}
        rotation={[Math.PI / 2, 0, 0]}
        material={glossBlackMaterial}
      >
        <cylinderGeometry args={[0.048, 0.048, 0.012, 24]} />
      </mesh>

      {/* Dedicated Molded Bumper Plinth & Front Japanese License Plate (zero grille overlap) */}
      <mesh geometry={geos.frontPlatePlinth} material={glossBlackMaterial} />
      <group position={frontPlatePos}>
        <mesh material={glossBlackMaterial}>
          <boxGeometry args={[0.338, 0.173, 0.008]} />
        </mesh>
        <mesh position={[0, 0, 0.0046]}>
          <planeGeometry args={[0.33, 0.165]} />
          <meshStandardMaterial map={plateTexture} roughness={0.35} />
        </mesh>
      </group>

      {/* Sharp Angular Swept Multi-Crystal LED Headlights & Sequential Turn Signals */}
      <mesh geometry={geos.hlHousingL} material={glossBlackMaterial} />
      <mesh geometry={geos.hlHousingR} material={glossBlackMaterial} />
      <mesh geometry={geos.hlSideWingL} material={glossBlackMaterial} />
      <mesh geometry={geos.hlSideWingR} material={glossBlackMaterial} />
      <mesh geometry={geos.hlDrlTopL} material={headlightMaterial} />
      <mesh geometry={geos.hlDrlTopR} material={headlightMaterial} />
      <mesh geometry={geos.hlDrlInnerL} material={headlightMaterial} />
      <mesh geometry={geos.hlDrlInnerR} material={headlightMaterial} />
      <mesh geometry={geos.hlDrlBotL} material={headlightMaterial} />
      <mesh geometry={geos.hlDrlBotR} material={headlightMaterial} />
      <mesh geometry={geos.hlCrystalTrayL} material={chromeMaterial} />
      <mesh geometry={geos.hlCrystalTrayR} material={chromeMaterial} />
      <mesh geometry={geos.hlCrystal1L} material={headlightMaterial} />
      <mesh geometry={geos.hlCrystal2L} material={headlightMaterial} />
      <mesh geometry={geos.hlCrystal3L} material={headlightMaterial} />
      <mesh geometry={geos.hlCrystal1R} material={headlightMaterial} />
      <mesh geometry={geos.hlCrystal2R} material={headlightMaterial} />
      <mesh geometry={geos.hlCrystal3R} material={headlightMaterial} />
      <mesh geometry={geos.hlTurnL} material={hazardMaterial} />
      <mesh geometry={geos.hlTurnR} material={hazardMaterial} />

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

      {/* ===================== RIGHT SIDE (-X, AUTHENTIC DRIVER-SIDE DOORS & RAIL) ===================== */}
      <group>
        <mesh geometry={geos.rightFrontFender} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.rightFrontDoorLower} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.rightSlidingDoorLower} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.rightLowerSill} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.rightSeamFenderDoor} material={matteRubberMaterial} />
        <mesh geometry={geos.rightSeamBPillar} material={matteRubberMaterial} />
        <mesh geometry={geos.rightSeamCPillar} material={matteRubberMaterial} />
        <mesh geometry={geos.rightSeamSillHoriz} material={matteRubberMaterial} />
        <mesh geometry={geos.rightRearQuarterBelowRail} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.rightRearQuarterAboveRail} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.rightRearQuarterBehindRail} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={geos.rightCenterRailBacking}>
          <meshStandardMaterial color="#090d14" metalness={0.55} roughness={0.45} />
        </mesh>
        <mesh position={[-(bodySideX(DOOR_METRICS.centerRailY) - 0.025), DOOR_METRICS.centerRailY - 0.014, -1.4]}>
          <boxGeometry args={[0.022, 0.008, 1.12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.86} roughness={0.26} />
        </mesh>
        <mesh geometry={geos.rightFrontWindowGlass} material={clearGlassMaterial} />
        <mesh geometry={geos.rightQuarterDivider} material={glossBlackMaterial} />
        <mesh geometry={geos.rightSlidingWindowGlass} material={privacyGlassMaterial} />
        <mesh geometry={geos.rightSlidingSashF} material={glossBlackMaterial} />
        <mesh geometry={geos.rightSlidingSashR} material={glossBlackMaterial} />
        <mesh geometry={geos.rightSlidingSashT} material={glossBlackMaterial} />
        <mesh geometry={geos.rightRearQuarterGlass} material={privacyGlassMaterial} />
        <mesh geometry={geos.rightBPillarUpper} material={glossBlackMaterial} />
        <mesh geometry={geos.rightCPillarUpper} material={glossBlackMaterial} />
        <mesh geometry={geos.rightDPillarUpper} material={glossBlackMaterial} />
        <mesh geometry={geos.rightFrontBeltChrome} material={chromeMaterial} />
        <mesh geometry={geos.rightSlidingBeltChrome} material={chromeMaterial} />
        <mesh geometry={geos.rightRearBeltChrome} material={chromeMaterial} />
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

        {/* Right Side Front Driver Handle + Handle Recess */}
        <group position={[-(bodySideX(1.015) + 0.002), 1.015, 0.39]}>
          <mesh position={[0.004, 0, 0]}>
            <boxGeometry args={[0.012, 0.062, 0.2]} />
            <meshStandardMaterial color="#0f172a" roughness={0.5} />
          </mesh>
          <mesh position={[-0.014, 0, 0]} geometry={geos.handleBar} material={chromeMaterial} castShadow />
        </group>

        {/* Right Side Sliding Door Chrome Handle + One-Touch Switch + Recess */}
        <group position={[-(bodySideX(1.015) + 0.002), 1.015, DOOR_METRICS.doorClosedCenterZ + 0.34]}>
          <mesh position={[0.004, 0, 0]}>
            <boxGeometry args={[0.012, 0.062, 0.205]} />
            <meshStandardMaterial color="#0f172a" roughness={0.5} />
          </mesh>
          <mesh position={[-0.015, 0, 0]} geometry={geos.handleBar} material={chromeMaterial} castShadow />
          <mesh position={[-0.016, 0, 0.057]}>
            <boxGeometry args={[0.028, 0.018, 0.024]} />
            <meshStandardMaterial color="#111827" roughness={0.55} />
          </mesh>
        </group>
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
