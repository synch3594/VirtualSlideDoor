import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BODY_COLORS } from '../../simulation/types';
import { liveSim, useDoorStore } from '../../store/useDoorStore';
import { DOOR_METRICS } from '../../simulation/doorKinematics';

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

    // Top region code
    ctx.fillStyle = '#14532d';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('東京 300', 256, 82);

    // Hiragana + main number (generic Japanese license plate)
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('あ', 78, 198);
    ctx.font = 'bold 112px sans-serif';
    ctx.fillText('12-34', 292, 206);

    // Bolt caps
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

function AlloyWheel({ position, isLeft }: { position: [number, number, number]; isLeft: boolean }) {
  const dir = isLeft ? 1 : -1;
  return (
    <group position={position}>
      {/* Rubber Tire */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.315, 0.315, 0.21, 32]} />
        <meshStandardMaterial color="#15181e" roughness={0.86} metalness={0.05} />
      </mesh>
      {/* Tire rounded sidewall shoulder */}
      <mesh position={[dir * 0.092, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.255, 0.056, 12, 28]} />
        <meshStandardMaterial color="#181b22" roughness={0.84} />
      </mesh>
      {/* Dark inner barrel */}
      <mesh position={[dir * 0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.215, 0.215, 0.19, 24]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Brake rotor disc */}
      <mesh position={[dir * 0.04, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.155, 0.155, 0.02, 24]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.35} />
      </mesh>
      {/* Outer machined alloy rim ring */}
      <mesh position={[dir * 0.105, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.205, 0.016, 10, 28]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.18} />
      </mesh>
      {/* 5-twin-spoke machined alloy spokes */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i * Math.PI * 2) / 5;
        return (
          <group key={i} rotation={[angle, 0, 0]}>
            <mesh position={[dir * 0.104, 0.095, 0.018]} rotation={[0.14, 0, 0]}>
              <boxGeometry args={[0.014, 0.19, 0.022]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.18} />
            </mesh>
            <mesh position={[dir * 0.104, 0.095, -0.018]} rotation={[-0.14, 0, 0]}>
              <boxGeometry args={[0.014, 0.19, 0.022]} />
              <meshStandardMaterial color="#475569" metalness={0.82} roughness={0.28} />
            </mesh>
          </group>
        );
      })}
      {/* Center hub cap */}
      <mesh position={[dir * 0.108, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.02, 18]} />
        <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.25} />
      </mesh>
    </group>
  );
}

/**
 * Modern Minivan Body Shell:
 * - Sculpted aerodynamic nose with wide grille & horizontal LED DRLs
 * - Step-down front side window & floating two-tone roof
 * - Full left-side sliding doorway cutout with rubber weatherstrip, latch striker, & recessed center rail groove
 * - Live hazard blinkers (front, side mirrors, rear) & dusk/night headlights + vertical LED taillights
 */
export function MinivanBody() {
  const bodyColorId = useDoorStore((s) => s.bodyColorId);
  const timeOfDay = useDoorStore((s) => s.timeOfDay);

  const colorSpec = useMemo(
    () => BODY_COLORS.find((c) => c.id === bodyColorId) ?? BODY_COLORS[0],
    [bodyColorId]
  );

  const plateTexture = useMemo(() => createLicensePlateTexture(), []);

  // Shared materials for performance and cohesive finish
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
        roughness: 0.14,
        clearcoat: 0.9,
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
        color: '#0b1320',
        metalness: 0.12,
        roughness: 0.06,
        transmission: 0.42,
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
        color: '#1e293b',
        metalness: 0.1,
        roughness: 0.05,
        opacity: 0.56,
        transparent: true,
        clearcoat: 1.0,
      }),
    []
  );

  const hazardMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#78350f',
        emissive: '#ff9500',
        emissiveIntensity: 0.05,
        roughness: 0.25,
      }),
    []
  );

  const headlightMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f8fafc',
        emissive: '#e0f2fe',
        emissiveIntensity: 0.5,
        roughness: 0.15,
      }),
    []
  );

  const taillightMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#7f1d1d',
        emissive: '#ef4444',
        emissiveIntensity: 0.35,
        roughness: 0.2,
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

  // Sculpted Front Hood & Windshield profile extruded across vehicle width
  const hoodGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    // Shape in (z, y) coordinates! We will rotate it so shape X -> world Z, shape Y -> world Y
    shape.moveTo(1.25, 0.32);
    shape.lineTo(2.26, 0.32); // bottom front bumper
    shape.quadraticCurveTo(2.35, 0.35, 2.34, 0.56); // lower chin
    shape.lineTo(2.30, 0.96); // upright minivan nose grille
    shape.quadraticCurveTo(2.24, 1.12, 1.98, 1.16); // rounded hood front
    shape.lineTo(1.38, 1.24); // sloped hood to windshield base
    shape.lineTo(1.25, 1.24);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 1.62,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.035,
      bevelSegments: 4,
    });
    // Center along extrusion Z, then rotate -90 deg around Y so shape-X maps to +Z!
    geo.translate(0, 0, -0.81);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Sculpted Roof Cap (sleek subtle crown + rear spoiler overhang)
  const roofGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-2.22, 1.77);
    shape.lineTo(0.92, 1.77);
    shape.quadraticCurveTo(0.84, 1.855, 0.65, 1.865);
    shape.lineTo(-1.92, 1.865);
    shape.quadraticCurveTo(-2.18, 1.86, -2.28, 1.78); // sleek rear roof spoiler lip
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 1.56,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.035,
      bevelSegments: 4,
    });
    geo.translate(0, 0, -0.78);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <group>
      {/* ===================== UNDERBODY & CHASSIS ===================== */}
      <mesh position={[0, 0.25, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[1.56, 0.14, 4.32]} />
        <meshStandardMaterial color="#0f131a" roughness={0.9} />
      </mesh>

      {/* ===================== SCULPTED FRONT NOSE & HOOD ===================== */}
      <mesh geometry={hoodGeometry} material={paintMaterial} castShadow receiveShadow />

      {/* Wide Dark Grille + Horizontal Chrome Bars */}
      <group position={[0, 0.78, 2.33]}>
        {/* Main dark grille housing */}
        <mesh material={glossBlackMaterial}>
          <boxGeometry args={[1.38, 0.52, 0.06]} />
        </mesh>
        {/* Horizontal metallic chrome accent bars */}
        {[-0.14, -0.05, 0.04, 0.13].map((yOff) => (
          <mesh key={yOff} position={[0, yOff, 0.032]} material={chromeMaterial}>
            <boxGeometry args={[1.02 + (yOff + 0.15) * 0.9, 0.022, 0.014]} />
          </mesh>
        ))}
        {/* Outer angled chrome side borders */}
        <mesh position={[0.62, 0, 0.03]} rotation={[0, 0, -0.24]} material={chromeMaterial}>
          <boxGeometry args={[0.03, 0.48, 0.02]} />
        </mesh>
        <mesh position={[-0.62, 0, 0.03]} rotation={[0, 0, 0.24]} material={chromeMaterial}>
          <boxGeometry args={[0.03, 0.48, 0.02]} />
        </mesh>
        {/* Front Emblem Badge */}
        <mesh position={[0, 0.08, 0.038]} rotation={[Math.PI / 2, 0, 0]} material={chromeMaterial}>
          <cylinderGeometry args={[0.068, 0.068, 0.015, 24]} />
        </mesh>
        {/* Lower Bumper Air Intake */}
        <mesh position={[0, -0.35, -0.01]} material={glossBlackMaterial}>
          <boxGeometry args={[1.28, 0.14, 0.06]} />
        </mesh>
        {/* Front License Plate */}
        <mesh position={[0, -0.22, 0.042]}>
          <planeGeometry args={[0.33, 0.165]} />
          <meshStandardMaterial map={plateTexture} roughness={0.35} />
        </mesh>
      </group>

      {/* Stacked Horizontal LED Headlights & Turn Signals (Left + Right) */}
      {[1, -1].map((side) => (
        <group key={side} position={[side * 0.67, 0.97, 2.27]}>
          {/* Dark headlight housing */}
          <mesh material={glossBlackMaterial}>
            <boxGeometry args={[0.32, 0.19, 0.12]} />
          </mesh>
          {/* 3-tier horizontal LED DRL & headlight blades */}
          {[0.055, 0, -0.055].map((yBlade) => (
            <mesh key={yBlade} position={[side * 0.01, yBlade, 0.062]} material={headlightMaterial}>
              <boxGeometry args={[0.26, 0.026, 0.018]} />
            </mesh>
          ))}
          {/* Front Amber Turn Signal / Hazard Strip */}
          <mesh position={[side * 0.12, 0.085, 0.04]} material={hazardMaterial}>
            <boxGeometry args={[0.14, 0.028, 0.05]} />
          </mesh>
        </group>
      ))}

      {/* Front Windshield + Black A-Pillars */}
      <mesh position={[0, 1.5, 1.14]} rotation={[-0.64, 0, 0]} material={clearGlassMaterial}>
        <boxGeometry args={[1.54, 0.72, 0.025]} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh
          key={`apillar-${side}`}
          position={[side * 0.79, 1.5, 1.14]}
          rotation={[-0.64, 0, side * 0.05]}
          material={glossBlackMaterial}
        >
          <boxGeometry args={[0.075, 0.74, 0.075]} />
        </mesh>
      ))}

      {/* ===================== ROOF & SHARK-FIN ANTENNA ===================== */}
      <mesh geometry={roofGeometry} material={roofMaterial} castShadow receiveShadow />
      {/* Roof Shark-Fin Antenna */}
      <mesh position={[0, 1.9, -1.65]} material={roofMaterial} castShadow>
        <boxGeometry args={[0.05, 0.07, 0.18]} />
      </mesh>

      {/* ===================== LEFT SIDE (+X = +0.85) WITH REAL SLIDING DOORWAY CUTOUT ===================== */}
      <group>
        {/* Front Left Fender (around front wheel arch z = +1.44) */}
        <mesh position={[0.82, 0.88, 1.66]} material={paintMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.42, 0.96]} />
        </mesh>
        <mesh position={[0.82, 0.56, 2.02]} material={paintMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.42, 0.34]} />
        </mesh>
        {/* Front wheel arch dark liner */}
        <mesh position={[0.78, 0.36, 1.44]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.355, 0.04, 10, 24, Math.PI]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>

        {/* Left Front Passenger Door (z = +0.26 to +1.18) */}
        <mesh position={[0.82, 0.71, 0.72]} material={paintMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.74, 0.92]} />
        </mesh>
        {/* Lower Side Sculpted Character Line (Front Door) */}
        <mesh position={[0.855, 0.48, 0.72]} material={paintMaterial}>
          <boxGeometry args={[0.018, 0.09, 0.88]} />
        </mesh>
        {/* Front Side Window with step-down front quarter glass */}
        <mesh position={[0.815, 1.42, 0.7]} material={clearGlassMaterial}>
          <boxGeometry args={[0.025, 0.68, 0.86]} />
        </mesh>
        {/* Front quarter triangular glass extension */}
        <mesh position={[0.81, 1.24, 1.22]} material={clearGlassMaterial}>
          <boxGeometry args={[0.025, 0.34, 0.24]} />
        </mesh>
        {/* Chrome Beltline Molding (Front Door) */}
        <mesh position={[0.852, 1.082, 0.72]} material={chromeMaterial}>
          <boxGeometry args={[0.012, 0.02, 0.9]} />
        </mesh>
        {/* Front Door Outer Chrome Handle (sits right beside sliding door handle!) */}
        <mesh position={[0.868, 0.96, 0.42]} material={chromeMaterial} castShadow>
          <boxGeometry args={[0.032, 0.036, 0.16]} />
        </mesh>
        {/* Left Side Mirror with integrated amber turn signal */}
        <group position={[0.96, 1.15, 1.04]}>
          <mesh material={roofMaterial} castShadow>
            <boxGeometry args={[0.2, 0.12, 0.14]} />
          </mesh>
          <mesh position={[-0.08, -0.03, 0]} material={glossBlackMaterial}>
            <boxGeometry args={[0.1, 0.05, 0.08]} />
          </mesh>
          {/* Mirror Turn Signal Repeater */}
          <mesh position={[0.02, 0, 0.072]} material={hazardMaterial}>
            <boxGeometry args={[0.14, 0.02, 0.01]} />
          </mesh>
        </group>

        {/* Left B-Pillar (between front door & sliding doorway: z = +0.22..+0.30) */}
        <mesh position={[0.82, 1.43, 0.26]} material={glossBlackMaterial} castShadow>
          <boxGeometry args={[0.062, 0.71, 0.085]} />
        </mesh>
        {/* Lower B-pillar structural jamb inside doorway */}
        <mesh position={[0.78, 0.71, 0.25]} material={paintMaterial}>
          <boxGeometry args={[0.08, 0.74, 0.065]} />
        </mesh>
        {/* Metallic B-Pillar Door Latch Striker */}
        <mesh position={[0.77, 0.76, 0.215]} material={chromeMaterial}>
          <boxGeometry args={[0.03, 0.06, 0.02]} />
        </mesh>

        {/* Left Lower Side Sill below Sliding Doorway (y = 0.20..0.34, z = -1.08..+1.16) */}
        <mesh position={[0.82, 0.27, 0.02]} material={paintMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.07, 0.14, 2.24]} />
        </mesh>
        {/* Matte black lower rocker aero molding */}
        <mesh position={[0.84, 0.2, 0.02]} material={matteRubberMaterial}>
          <boxGeometry args={[0.05, 0.04, 2.22]} />
        </mesh>

        {/* Upper Roof Side Cant Rail above Sliding Doorway (y = 1.76..1.82) */}
        <mesh position={[0.81, 1.78, -0.31]} material={roofMaterial}>
          <boxGeometry args={[0.07, 0.065, 1.24]} />
        </mesh>

        {/* ===== RUBBER WEATHERSTRIP GASKET AROUND OPEN SLIDING DOORWAY ===== */}
        {/* Front vertical seal (B-pillar) */}
        <mesh position={[0.795, 1.06, 0.218]} material={matteRubberMaterial}>
          <boxGeometry args={[0.028, 1.43, 0.022]} />
        </mesh>
        {/* Rear vertical seal (C-pillar) */}
        <mesh position={[0.795, 1.06, -0.842]} material={matteRubberMaterial}>
          <boxGeometry args={[0.028, 1.43, 0.022]} />
        </mesh>
        {/* Top horizontal seal */}
        <mesh position={[0.795, 1.768, -0.31]} material={matteRubberMaterial}>
          <boxGeometry args={[0.028, 0.022, 1.08]} />
        </mesh>
        {/* Bottom horizontal seal + visible lower guide track slot */}
        <mesh position={[0.795, 0.342, -0.31]} material={matteRubberMaterial}>
          <boxGeometry args={[0.028, 0.022, 1.08]} />
        </mesh>
        {/* Recessed Lower Curved Track Channel in Doorstep */}
        <mesh position={[0.75, 0.318, -0.31]}>
          <boxGeometry args={[0.036, 0.018, 1.04]} />
          <meshStandardMaterial color="#090c12" metalness={0.5} roughness={0.6} />
        </mesh>

        {/* ===== LEFT REAR QUARTER PANEL (z = -0.84 to -2.30) + CENTER SLIDE RAIL ===== */}
        {/* C-Pillar Blackout Trim */}
        <mesh position={[0.82, 1.43, -0.87]} material={glossBlackMaterial}>
          <boxGeometry args={[0.055, 0.71, 0.07]} />
        </mesh>
        {/* Rear Quarter Panel BELOW Center Rail (y = 0.62..1.005, z = -0.84..-2.28) */}
        <mesh position={[0.82, 0.81, -1.56]} material={paintMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.38, 1.44]} />
        </mesh>
        {/* Rear Quarter Lower Front of Wheel Arch (z = -0.84..-1.12) */}
        <mesh position={[0.82, 0.48, -0.98]} material={paintMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.3, 0.28]} />
        </mesh>
        {/* Rear Quarter Lower Behind Wheel Arch (z = -1.75..-2.28) */}
        <mesh position={[0.82, 0.48, -2.01]} material={paintMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.34, 0.54]} />
        </mesh>
        {/* Rear wheel arch dark liner */}
        <mesh position={[0.78, 0.36, -1.43]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.355, 0.04, 10, 24, Math.PI]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>

        {/* *** ICONIC RECESSED CENTER SLIDE RAIL CHANNEL (y = 1.025, z = -0.84..-1.96) *** */}
        {/* Deep dark anodized aluminum rail channel interior */}
        <mesh position={[0.805, DOOR_METRICS.centerRailY, -1.42]}>
          <boxGeometry args={[0.045, 0.042, 1.18]} />
          <meshStandardMaterial color="#090d14" metalness={0.6} roughness={0.45} />
        </mesh>
        {/* Brushed stainless metallic inner slide track */}
        <mesh position={[0.824, DOOR_METRICS.centerRailY - 0.015, -1.42]}>
          <boxGeometry args={[0.025, 0.008, 1.16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.28} />
        </mesh>
        {/* Painted strip directly above rail channel up to window beltline */}
        <mesh position={[0.82, 1.064, -1.56]} material={paintMaterial}>
          <boxGeometry args={[0.06, 0.036, 1.44]} />
        </mesh>
        {/* Painted cover behind the end of the center rail */}
        <mesh position={[0.82, DOOR_METRICS.centerRailY, -2.14]} material={paintMaterial}>
          <boxGeometry args={[0.06, 0.055, 0.28]} />
        </mesh>

        {/* Rear Quarter Privacy Glass + Floating Roof Black D-Pillar */}
        <mesh position={[0.818, 1.425, -1.52]} material={privacyGlassMaterial}>
          <boxGeometry args={[0.025, 0.68, 1.24]} />
        </mesh>
        {/* Chrome Beltline Molding along Rear Quarter Glass */}
        <mesh position={[0.852, 1.084, -1.5]} material={chromeMaterial}>
          <boxGeometry args={[0.012, 0.018, 1.26]} />
        </mesh>
        {/* Blacked-out D-pillar creating a floating roof look */}
        <mesh position={[0.82, 1.43, -2.18]} material={glossBlackMaterial}>
          <boxGeometry args={[0.055, 0.71, 0.16]} />
        </mesh>
      </group>

      {/* ===================== RIGHT SIDE (-X = -0.85, ENCLOSED FULL BODY) ===================== */}
      <group>
        {/* Right Lower Body Wall */}
        <mesh position={[-0.82, 0.85, -0.14]} material={paintMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.46, 4.18]} />
        </mesh>
        <mesh position={[-0.82, 0.48, 0.0]} material={paintMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.34, 2.22]} />
        </mesh>
        <mesh position={[-0.82, 0.48, 2.02]} material={paintMaterial}>
          <boxGeometry args={[0.06, 0.38, 0.34]} />
        </mesh>
        <mesh position={[-0.82, 0.48, -2.01]} material={paintMaterial}>
          <boxGeometry args={[0.06, 0.36, 0.54]} />
        </mesh>
        {/* Right Side Greenhouse Windows & Pillars */}
        <mesh position={[-0.818, 1.425, -0.45]} material={privacyGlassMaterial}>
          <boxGeometry args={[0.025, 0.68, 3.28]} />
        </mesh>
        <mesh position={[-0.82, 1.43, 0.26]} material={glossBlackMaterial}>
          <boxGeometry args={[0.055, 0.71, 0.08]} />
        </mesh>
        <mesh position={[-0.82, 1.43, -0.87]} material={glossBlackMaterial}>
          <boxGeometry args={[0.055, 0.71, 0.07]} />
        </mesh>
        <mesh position={[-0.82, 1.43, -2.18]} material={glossBlackMaterial}>
          <boxGeometry args={[0.055, 0.71, 0.16]} />
        </mesh>
        {/* Right Side Mirror */}
        <mesh position={[-0.96, 1.15, 1.04]} material={roofMaterial} castShadow>
          <boxGeometry args={[0.2, 0.12, 0.14]} />
        </mesh>
        {/* Right Side Chrome Handles */}
        <mesh position={[-0.868, 0.96, 0.42]} material={chromeMaterial}>
          <boxGeometry args={[0.032, 0.036, 0.16]} />
        </mesh>
        <mesh position={[-0.868, 0.96, 0.04]} material={chromeMaterial}>
          <boxGeometry args={[0.032, 0.036, 0.16]} />
        </mesh>
      </group>

      {/* ===================== REAR HATCH & VERTICAL LED TAILLIGHTS ===================== */}
      <group position={[0, 0, -2.29]}>
        {/* Lower Rear Tailgate & Bumper */}
        <mesh position={[0, 0.71, 0]} material={paintMaterial} castShadow receiveShadow>
          <boxGeometry args={[1.66, 0.76, 0.09]} />
        </mesh>
        {/* Rear Bumper lower dark diffuser */}
        <mesh position={[0, 0.29, -0.02]} material={matteRubberMaterial}>
          <boxGeometry args={[1.62, 0.14, 0.1]} />
        </mesh>
        {/* Rear Privacy Glass */}
        <mesh position={[0, 1.43, 0.01]} material={privacyGlassMaterial}>
          <boxGeometry args={[1.42, 0.68, 0.04]} />
        </mesh>
        {/* Chrome License Plate Garnish Bar */}
        <mesh position={[0, 0.98, -0.05]} material={chromeMaterial}>
          <boxGeometry args={[0.92, 0.045, 0.025]} />
        </mesh>
        {/* Rear License Plate */}
        <mesh position={[0, 0.78, -0.052]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.33, 0.165]} />
          <meshStandardMaterial map={plateTexture} roughness={0.35} />
        </mesh>

        {/* Vertical Slim LED Taillights (Left + Right) */}
        {[1, -1].map((side) => (
          <group key={`tail-${side}`} position={[side * 0.78, 1.24, -0.02]}>
            <mesh material={glossBlackMaterial}>
              <boxGeometry args={[0.11, 0.56, 0.08]} />
            </mesh>
            {/* Red vertical LED blade */}
            <mesh position={[side * 0.01, 0.05, -0.038]} material={taillightMaterial}>
              <boxGeometry args={[0.055, 0.4, 0.018]} />
            </mesh>
            {/* Rear Amber Turn Signal / Hazard indicator */}
            <mesh position={[side * 0.01, -0.2, -0.038]} material={hazardMaterial}>
              <boxGeometry args={[0.055, 0.085, 0.018]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ===================== 4 DETAILED ALLOY WHEELS ===================== */}
      <AlloyWheel position={[0.75, 0.315, 1.44]} isLeft />
      <AlloyWheel position={[-0.75, 0.315, 1.44]} isLeft={false} />
      <AlloyWheel position={[0.75, 0.315, -1.43]} isLeft />
      <AlloyWheel position={[-0.75, 0.315, -1.43]} isLeft={false} />
    </group>
  );
}
