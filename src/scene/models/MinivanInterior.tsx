import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { liveSim, useDoorStore } from '../../store/useDoorStore';
import { createRoundedBoxGeometry } from './vehicleGeometry';

interface SeatGeos {
  cushion: THREE.BufferGeometry;
  insertCushion: THREE.BufferGeometry;
  bolster: THREE.BufferGeometry;
  backrest: THREE.BufferGeometry;
  insertBackrest: THREE.BufferGeometry;
  headrest: THREE.BufferGeometry;
  armrest: THREE.BufferGeometry;
  ottoman: THREE.BufferGeometry;
}

function createInfotainmentTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0b1324';
    ctx.fillRect(0, 0, 512, 256);

    // Left panel: stylized dark GPS map + glowing cyan navigation route
    ctx.fillStyle = '#132038';
    ctx.fillRect(10, 10, 310, 236);
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(10, 36 + i * 40);
      ctx.lineTo(320, 20 + i * 38);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(40 + i * 52, 10);
      ctx.lineTo(25 + i * 54, 246);
      ctx.stroke();
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(55, 225);
    ctx.lineTo(135, 155);
    ctx.lineTo(195, 130);
    ctx.lineTo(248, 52);
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(135, 155, 7, 0, Math.PI * 2);
    ctx.fill();

    // Right panel: media & climate tiles
    ctx.fillStyle = '#17253d';
    ctx.fillRect(334, 10, 168, 112);
    ctx.fillRect(334, 134, 168, 112);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(348, 28, 140, 10);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(348, 52, 98, 8);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('23.5°C', 354, 198);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGaugeClusterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, 512, 192);

    // Twin digital speedometer & tachometer rings
    for (const cx of [130, 382]) {
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx, 100, 62, Math.PI * 0.78, Math.PI * 2.22);
      ctx.stroke();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, 100, 50, Math.PI * 0.85, Math.PI * 1.65);
      ctx.stroke();
    }
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('P', 256, 86);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('0 km/h', 130, 110);
    ctx.fillText('READY', 382, 110);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function CaptainSeat({
  position,
  geos,
  hasOttoman = false,
}: {
  position: [number, number, number];
  geos: SeatGeos;
  hasOttoman?: boolean;
}) {
  return (
    <group position={position}>
      {/* Seat base metallic slide rails */}
      <mesh position={[0.14, 0.06, 0]}>
        <boxGeometry args={[0.04, 0.11, 0.44]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[-0.14, 0.06, 0]}>
        <boxGeometry args={[0.04, 0.11, 0.44]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Lower seat frame */}
      <mesh position={[0, 0.11, 0]}>
        <boxGeometry args={[0.38, 0.08, 0.4]} />
        <meshStandardMaterial color="#181e29" roughness={0.8} />
      </mesh>
      {/* Contoured dark charcoal lower seat base */}
      <mesh position={[0, 0.2, 0.02]} geometry={geos.cushion} castShadow receiveShadow>
        <meshStandardMaterial color="#252a34" roughness={0.86} />
      </mesh>
      {/* Contrasting stitched warm slate-taupe center cushion insert */}
      <mesh position={[0, 0.222, 0.03]} geometry={geos.insertCushion}>
        <meshStandardMaterial color="#464d5b" roughness={0.82} />
      </mesh>
      {/* Rounded side bolsters */}
      <mesh position={[0.215, 0.235, 0.02]} geometry={geos.bolster}>
        <meshStandardMaterial color="#1f242d" roughness={0.88} />
      </mesh>
      <mesh position={[-0.215, 0.235, 0.02]} geometry={geos.bolster}>
        <meshStandardMaterial color="#1f242d" roughness={0.88} />
      </mesh>
      {/* Contoured reclined backrest + contrasting center bolster insert */}
      <mesh position={[0, 0.54, -0.22]} rotation={[-0.18, 0, 0]} geometry={geos.backrest} castShadow receiveShadow>
        <meshStandardMaterial color="#252a34" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.54, -0.195]} rotation={[-0.18, 0, 0]} geometry={geos.insertBackrest}>
        <meshStandardMaterial color="#464d5b" roughness={0.82} />
      </mesh>
      {/* Contoured headrest */}
      <mesh position={[0, 0.935, -0.27]} rotation={[-0.1, 0, 0]} geometry={geos.headrest}>
        <meshStandardMaterial color="#232830" roughness={0.85} />
      </mesh>
      {/* Headrest chrome posts */}
      <mesh position={[0.06, 0.84, -0.26]}>
        <cylinderGeometry args={[0.008, 0.008, 0.1, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[-0.06, 0.84, -0.26]}>
        <cylinderGeometry args={[0.008, 0.008, 0.1, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Dual inner + outer folding armrests */}
      <mesh position={[-0.26, 0.43, 0.0]} rotation={[0.06, 0, 0]} geometry={geos.armrest}>
        <meshStandardMaterial color="#1f242d" roughness={0.85} />
      </mesh>
      <mesh position={[0.26, 0.43, 0.0]} rotation={[0.06, 0, 0]} geometry={geos.armrest}>
        <meshStandardMaterial color="#1f242d" roughness={0.85} />
      </mesh>
      {/* Extendable executive ottoman calf rest for 2nd-row captain seats */}
      {hasOttoman && (
        <mesh position={[0, 0.14, 0.275]} rotation={[0.42, 0, 0]} geometry={geos.ottoman}>
          <meshStandardMaterial color="#2e3440" roughness={0.85} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Rich Modern Minivan Cabin Interior:
 * - Properly bounded headliner staying strictly inside the curved roof shell
 * - Two-tone contoured captain seats with dual armrests & 2nd-row executive ottomans
 * - Rich cockpit dashboard with satin-silver trim, AC vents, digital gauge cluster,
 *   panoramic navigation/infotainment display, 3-spoke steering wheel & center console with shift lever & cup holders
 * - Ceiling flip-down rear monitor, sun visors, interior quarter-panel trim & 3rd-row 3-headrest bench
 */
export function MinivanInterior() {
  const domeLightRef = useRef<THREE.PointLight>(null);
  const welcomeLightRef = useRef<THREE.PointLight>(null);
  const domeMeshMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const stepLedMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bPillarBtnMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const obstacleRingMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const obstaclePlaced = useDoorStore((s) => s.obstaclePlaced);
  const timeOfDay = useDoorStore((s) => s.timeOfDay);
  const triggerDoorToggle = useDoorStore((s) => s.triggerDoorToggle);

  const infoTex = useMemo(() => createInfotainmentTexture(), []);
  const gaugeTex = useMemo(() => createGaugeClusterTexture(), []);

  const seatGeos = useMemo<SeatGeos>(
    () => ({
      cushion: createRoundedBoxGeometry(0.45, 0.13, 0.47, 0.036, 3),
      insertCushion: createRoundedBoxGeometry(0.28, 0.105, 0.42, 0.024, 3),
      bolster: createRoundedBoxGeometry(0.075, 0.1, 0.45, 0.025, 3),
      backrest: createRoundedBoxGeometry(0.44, 0.6, 0.125, 0.04, 3),
      insertBackrest: createRoundedBoxGeometry(0.27, 0.48, 0.095, 0.026, 3),
      headrest: createRoundedBoxGeometry(0.23, 0.18, 0.095, 0.032, 3),
      armrest: createRoundedBoxGeometry(0.068, 0.068, 0.33, 0.022, 3),
      ottoman: createRoundedBoxGeometry(0.36, 0.065, 0.22, 0.02, 2),
    }),
    []
  );

  const dashGeo = useMemo(() => createRoundedBoxGeometry(1.42, 0.26, 0.42, 0.05, 3), []);
  const consoleGeo = useMemo(() => createRoundedBoxGeometry(0.26, 0.24, 0.72, 0.03, 3), []);

  useFrame(({ clock }) => {
    const lit = liveSim.interiorLight;
    const nightBoost = timeOfDay === 'night' ? 1.55 : timeOfDay === 'sunset' ? 1.2 : 0.85;

    if (domeLightRef.current) {
      domeLightRef.current.intensity = lit * 3.4 * nightBoost;
    }
    if (welcomeLightRef.current) {
      welcomeLightRef.current.intensity = lit * 2.2 * nightBoost;
    }
    if (domeMeshMatRef.current) {
      domeMeshMatRef.current.emissiveIntensity = 0.25 + lit * 2.6;
    }
    if (stepLedMatRef.current) {
      stepLedMatRef.current.emissiveIntensity = lit * 2.4;
    }
    if (bPillarBtnMatRef.current) {
      const pulse = 0.85 + 0.25 * Math.sin(clock.getElapsedTime() * 3.2);
      bPillarBtnMatRef.current.emissiveIntensity = 1.1 * pulse;
    }
    if (obstacleRingMatRef.current) {
      if (liveSim.antiPinchFlashTimer > 0) {
        const blink = Math.sin(clock.getElapsedTime() * 22) > 0 ? 0.9 : 0.15;
        obstacleRingMatRef.current.opacity = blink;
      } else {
        obstacleRingMatRef.current.opacity = 0;
      }
    }
  });

  return (
    <group>
      {/* Cabin Floor, Carpet & Ribbed Floor Mats */}
      <mesh position={[0, 0.335, -0.25]} receiveShadow>
        <boxGeometry args={[1.48, 0.05, 3.22]} />
        <meshStandardMaterial color="#161a22" roughness={0.95} />
      </mesh>
      {/* Center aisle plush floor mat */}
      <mesh position={[0, 0.362, -0.36]} receiveShadow>
        <boxGeometry args={[0.38, 0.008, 1.52]} />
        <meshStandardMaterial color="#232834" roughness={0.92} />
      </mesh>
      {/* Lower recessed step-in floor well on left sliding doorway */}
      <mesh position={[0.67, 0.305, -0.31]} receiveShadow>
        <boxGeometry args={[0.24, 0.04, 1.04]} />
        <meshStandardMaterial color="#11151d" roughness={0.9} />
      </mesh>
      <mesh position={[0.725, 0.328, -0.31]}>
        <boxGeometry args={[0.07, 0.006, 0.78]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.78} roughness={0.32} />
      </mesh>
      <mesh position={[0.57, 0.345, -0.31]}>
        <boxGeometry args={[0.015, 0.015, 0.42]} />
        <meshStandardMaterial
          ref={stepLedMatRef}
          color="#fffbeb"
          emissive="#fde68a"
          emissiveIntensity={1.5}
        />
      </mesh>

      {/* Interior Headliner (bounded strictly inside roof cavity) */}
      <mesh position={[0, 1.722, -0.61]}>
        <boxGeometry args={[1.24, 0.025, 2.7]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.92} />
      </mesh>

      {/* Left & Right Overhead Sun Visors */}
      <mesh position={[0.36, 1.675, 0.76]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[0.36, 0.018, 0.14]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.85} />
      </mesh>
      <mesh position={[-0.36, 1.675, 0.76]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[0.36, 0.018, 0.14]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.85} />
      </mesh>

      {/* Interior Rearview Mirror & Overhead Map-Light Console */}
      <group position={[0, 1.62, 0.89]}>
        <mesh position={[0, 0.055, -0.02]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.09, 8]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.22, 0.055, 0.024]} />
          <meshStandardMaterial color="#111827" roughness={0.4} />
        </mesh>
      </group>
      <mesh position={[0, 1.706, 0.56]}>
        <boxGeometry args={[0.24, 0.022, 0.22]} />
        <meshStandardMaterial color="#475569" roughness={0.7} />
      </mesh>

      {/* 2nd-Row Ceiling Flip-Down Entertainment Monitor */}
      <group position={[0, 1.635, 0.08]} rotation={[-0.22, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.36, 0.21, 0.024]} />
          <meshStandardMaterial color="#1e293b" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0, -0.013]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.32, 0.175]} />
          <meshStandardMaterial map={infoTex} emissive="#0f172a" emissiveIntensity={0.45} roughness={0.2} />
        </mesh>
      </group>

      {/* Overhead LED Dome Lamp */}
      <mesh position={[0.04, 1.706, -0.3]}>
        <boxGeometry args={[0.22, 0.018, 0.14]} />
        <meshStandardMaterial
          ref={domeMeshMatRef}
          color="#fef9c3"
          emissive="#fef08a"
          emissiveIntensity={2.0}
        />
      </mesh>
      <pointLight
        ref={domeLightRef}
        position={[0.08, 1.6, -0.25]}
        color="#fff4d6"
        intensity={2.5}
        distance={3.6}
        decay={1.7}
      />

      {/* Ground Welcome Puddle Light outside the open doorway */}
      <pointLight
        ref={welcomeLightRef}
        position={[1.02, 0.42, -0.25]}
        color="#fef3c7"
        intensity={1.5}
        distance={2.6}
        decay={1.9}
      />

      {/* Interior Rear Quarter Side Trim Panels & Armrests (visible from open doorway!) */}
      {[1, -1].map((side) => (
        <group key={`qtrim-${side}`}>
          <mesh position={[side * 0.72, 0.78, -1.45]}>
            <boxGeometry args={[0.06, 0.52, 1.15]} />
            <meshStandardMaterial color="#1c212b" roughness={0.85} />
          </mesh>
          <mesh position={[side * 0.67, 0.76, -1.35]}>
            <boxGeometry args={[0.055, 0.055, 0.56]} />
            <meshStandardMaterial color="#2a3140" roughness={0.82} />
          </mesh>
        </group>
      ))}

      {/* 2nd-Row Contoured Executive Captain Seats (with Ottomans!) */}
      <CaptainSeat position={[0.37, 0.355, -0.46]} geos={seatGeos} hasOttoman />
      <CaptainSeat position={[-0.37, 0.355, -0.46]} geos={seatGeos} hasOttoman />

      {/* 3rd-Row Bench Seat with 3 Individual Headrests */}
      <group position={[0, 0.375, -1.36]}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[1.28, 0.15, 0.46]} />
          <meshStandardMaterial color="#252a34" roughness={0.88} />
        </mesh>
        <mesh position={[0, 0.54, -0.2]} rotation={[-0.16, 0, 0]}>
          <boxGeometry args={[1.26, 0.58, 0.13]} />
          <meshStandardMaterial color="#252a34" roughness={0.88} />
        </mesh>
        {[-0.4, 0, 0.4].map((hx) => (
          <mesh key={`h3-${hx}`} position={[hx, 0.91, -0.25]} rotation={[-0.1, 0, 0]} geometry={seatGeos.headrest}>
            <meshStandardMaterial color="#1f242d" roughness={0.85} />
          </mesh>
        ))}
      </group>

      {/* Front Row Seats */}
      <CaptainSeat position={[0.38, 0.355, 0.54]} geos={seatGeos} />
      <CaptainSeat position={[-0.38, 0.355, 0.54]} geos={seatGeos} />

      {/* Center Console Bridge between Front Seats (Shift Lever + Twin Cup Holders + Storage Armrest) */}
      <group position={[0, 0.48, 0.68]}>
        <mesh geometry={consoleGeo}>
          <meshStandardMaterial color="#1b202a" roughness={0.78} />
        </mesh>
        {/* Padded storage armrest lid */}
        <mesh position={[0, 0.14, -0.15]}>
          <boxGeometry args={[0.24, 0.055, 0.38]} />
          <meshStandardMaterial color="#2b313e" roughness={0.82} />
        </mesh>
        {/* Gloss-black shifter trim bezel & gear lever */}
        <mesh position={[0.04, 0.13, 0.24]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.14, 0.025, 0.18]} />
          <meshStandardMaterial color="#0b0f17" roughness={0.2} metalness={0.3} />
        </mesh>
        <mesh position={[0.04, 0.2, 0.24]} rotation={[0.15, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.012, 0.11, 10]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0.04, 0.255, 0.25]}>
          <boxGeometry args={[0.042, 0.036, 0.048]} />
          <meshStandardMaterial color="#111827" roughness={0.45} />
        </mesh>
        {/* Twin Chrome-Ringed Cup Holders */}
        {[0.06, -0.04].map((czOff, idx) => (
          <group key={`cup-${idx}`} position={[-0.04, 0.125, czOff + 0.04]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.036, 0.005, 8, 20]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, -0.008, 0]}>
              <cylinderGeometry args={[0.034, 0.034, 0.018, 16]} />
              <meshStandardMaterial color="#090d14" roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Rich Multi-Layer Cockpit Dashboard */}
      <mesh position={[0, 0.96, 1.18]} geometry={dashGeo}>
        <meshStandardMaterial color="#1b202a" roughness={0.74} />
      </mesh>
      {/* Full-width satin-silver horizontal dashboard accent blade */}
      <mesh position={[0, 0.99, 0.968]}>
        <boxGeometry args={[1.38, 0.022, 0.022]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* 4 Recessed AC Vent Grilles */}
      {[-0.6, -0.14, 0.14, 0.6].map((vx) => (
        <mesh key={`vent-${vx}`} position={[vx, 0.94, 0.965]}>
          <boxGeometry args={[0.12, 0.05, 0.02]} />
          <meshStandardMaterial color="#090d14" roughness={0.6} />
        </mesh>
      ))}
      {/* Panoramic Center Infotainment / Navigation Screen */}
      <group position={[0.02, 1.13, 1.03]} rotation={[-0.14, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.38, 0.17, 0.028]} />
          <meshStandardMaterial color="#0b0f17" roughness={0.25} />
        </mesh>
        <mesh position={[0, 0, -0.015]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.35, 0.145]} />
          <meshStandardMaterial map={infoTex} emissive="#1e293b" emissiveIntensity={0.45} roughness={0.18} />
        </mesh>
      </group>
      {/* Digital Gauge Cluster behind Steering Wheel (RHD: x = -0.36) */}
      <group position={[-0.36, 1.11, 1.04]} rotation={[-0.12, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.34, 0.13, 0.032]} />
          <meshStandardMaterial color="#090d16" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, -0.017]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.31, 0.105]} />
          <meshStandardMaterial map={gaugeTex} emissive="#0f172a" emissiveIntensity={0.55} roughness={0.18} />
        </mesh>
      </group>

      {/* Detailed 3-Spoke Right-Hand-Drive Steering Wheel */}
      <group position={[-0.36, 1.03, 0.93]} rotation={[0.35, 0, 0]}>
        {/* Outer leather rim */}
        <mesh>
          <torusGeometry args={[0.155, 0.019, 14, 28]} />
          <meshStandardMaterial color="#111827" roughness={0.55} />
        </mesh>
        {/* Center airbag hub */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.048, 0.052, 0.035, 18]} />
          <meshStandardMaterial color="#1e293b" roughness={0.55} />
        </mesh>
        {/* Chrome emblem ring */}
        <mesh position={[0, 0, -0.019]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.022, 0.003, 8, 16]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
        </mesh>
        {/* 3 Metallic-trimmed spokes */}
        <mesh position={[-0.085, 0, 0]}>
          <boxGeometry args={[0.11, 0.024, 0.018]} />
          <meshStandardMaterial color="#64748b" metalness={0.75} roughness={0.3} />
        </mesh>
        <mesh position={[0.085, 0, 0]}>
          <boxGeometry args={[0.11, 0.024, 0.018]} />
          <meshStandardMaterial color="#64748b" metalness={0.75} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.085, 0]}>
          <boxGeometry args={[0.028, 0.11, 0.018]} />
          <meshStandardMaterial color="#64748b" metalness={0.75} roughness={0.3} />
        </mesh>
        {/* Steering column stalk */}
        <mesh position={[0, 0, 0.085]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.032, 0.036, 0.14, 12]} />
          <meshStandardMaterial color="#181c24" roughness={0.8} />
        </mesh>
      </group>

      {/* Left B-Pillar Interior Trim: Child Assist Grip & Interactive Power Slide Button */}
      <group position={[0.745, 0, 0.26]}>
        <mesh position={[-0.032, 0.92, -0.02]}>
          <cylinderGeometry args={[0.015, 0.015, 0.46, 12]} />
          <meshStandardMaterial color="#334155" roughness={0.55} />
        </mesh>
        <mesh position={[-0.008, 1.14, -0.02]}>
          <boxGeometry args={[0.048, 0.03, 0.03]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} />
        </mesh>
        <mesh position={[-0.008, 0.7, -0.02]}>
          <boxGeometry args={[0.048, 0.03, 0.03]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} />
        </mesh>

        {/* Interactive B-Pillar Power Slide Door Button */}
        <group
          position={[-0.026, 1.02, -0.065]}
          onClick={(e) => {
            e.stopPropagation();
            triggerDoorToggle('b_pillar_button');
          }}
        >
          <mesh>
            <boxGeometry args={[0.03, 0.075, 0.055]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} />
          </mesh>
          <mesh position={[-0.014, 0, 0]}>
            <boxGeometry args={[0.012, 0.048, 0.036]} />
            <meshStandardMaterial
              ref={bPillarBtnMatRef}
              color="#38bdf8"
              emissive="#0ea5e9"
              emissiveIntensity={1.1}
              roughness={0.3}
            />
          </mesh>
          <mesh visible={false}>
            <boxGeometry args={[0.14, 0.18, 0.16]} />
            <meshBasicMaterial />
          </mesh>
        </group>
      </group>

      {/* Optional Cute Plush Teddy Bear Obstacle for Anti-Pinch Testing */}
      {obstaclePlaced && (
        <group position={[0.72, 0.34, 0.02]} rotation={[0, 0.5, 0]}>
          <mesh position={[0, 0.1, 0]} castShadow>
            <sphereGeometry args={[0.095, 16, 16]} />
            <meshStandardMaterial color="#b45309" roughness={0.95} />
          </mesh>
          <mesh position={[0.055, 0.095, 0.04]}>
            <sphereGeometry args={[0.052, 12, 12]} />
            <meshStandardMaterial color="#fde68a" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.23, 0]} castShadow>
            <sphereGeometry args={[0.078, 16, 16]} />
            <meshStandardMaterial color="#b45309" roughness={0.95} />
          </mesh>
          <mesh position={[-0.055, 0.295, -0.02]}>
            <sphereGeometry args={[0.028, 12, 12]} />
            <meshStandardMaterial color="#92400e" roughness={0.95} />
          </mesh>
          <mesh position={[0.055, 0.295, 0.02]}>
            <sphereGeometry args={[0.028, 12, 12]} />
            <meshStandardMaterial color="#92400e" roughness={0.95} />
          </mesh>
          <mesh position={[0.06, 0.215, 0.04]}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.9} />
          </mesh>
          <mesh position={[0.082, 0.222, 0.054]}>
            <sphereGeometry args={[0.01, 8, 8]} />
            <meshStandardMaterial color="#111827" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.16, 0]} rotation={[0, Math.PI / 2, 0]}>
            <ringGeometry args={[0.14, 0.18, 24]} />
            <meshBasicMaterial
              ref={obstacleRingMatRef}
              color="#ef4444"
              transparent
              opacity={0}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
