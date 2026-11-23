import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { liveSim, useDoorStore } from '../../store/useDoorStore';
import { createRoundedBoxGeometry } from './vehicleGeometry';

interface SeatGeos {
  cushion: THREE.BufferGeometry;
  bolster: THREE.BufferGeometry;
  backrest: THREE.BufferGeometry;
  headrest: THREE.BufferGeometry;
  armrest: THREE.BufferGeometry;
}

function CaptainSeat({
  position,
  geos,
}: {
  position: [number, number, number];
  geos: SeatGeos;
}) {
  return (
    <group position={position}>
      {/* Seat base slide rail */}
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[0.4, 0.14, 0.42]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>
      {/* Contoured plush lower seat cushion */}
      <mesh position={[0, 0.2, 0.02]} geometry={geos.cushion} castShadow receiveShadow>
        <meshStandardMaterial color="#2b303a" roughness={0.86} />
      </mesh>
      {/* Rounded side bolsters */}
      <mesh position={[0.215, 0.23, 0.02]} geometry={geos.bolster}>
        <meshStandardMaterial color="#232830" roughness={0.88} />
      </mesh>
      <mesh position={[-0.215, 0.23, 0.02]} geometry={geos.bolster}>
        <meshStandardMaterial color="#232830" roughness={0.88} />
      </mesh>
      {/* Contoured reclined backrest */}
      <mesh position={[0, 0.54, -0.22]} rotation={[-0.18, 0, 0]} geometry={geos.backrest} castShadow receiveShadow>
        <meshStandardMaterial color="#2b303a" roughness={0.86} />
      </mesh>
      {/* Contoured headrest */}
      <mesh position={[0, 0.935, -0.27]} rotation={[-0.1, 0, 0]} geometry={geos.headrest}>
        <meshStandardMaterial color="#232830" roughness={0.85} />
      </mesh>
      {/* Headrest metal posts */}
      <mesh position={[0.06, 0.84, -0.26]}>
        <cylinderGeometry args={[0.008, 0.008, 0.1, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[-0.06, 0.84, -0.26]}>
        <cylinderGeometry args={[0.008, 0.008, 0.1, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Contoured inner armrest */}
      <mesh position={[-0.265, 0.43, 0.0]} rotation={[0.06, 0, 0]} geometry={geos.armrest}>
        <meshStandardMaterial color="#1f242d" roughness={0.85} />
      </mesh>
    </group>
  );
}

/**
 * Detailed minivan cabin interior:
 * - Properly bounded headliner staying strictly inside the curved roof shell (never poking through windshield!)
 * - Contoured 2nd-row captain seats, 3rd-row bench, front seats/sculpted dash & interior mirror
 * - B-pillar grab handle + interactive power slide button, theater-dimming LED dome & step lights
 * - Optional stuffed-bear obstacle for anti-pinch testing
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

  const seatGeos = useMemo<SeatGeos>(
    () => ({
      cushion: createRoundedBoxGeometry(0.46, 0.14, 0.48, 0.036, 3),
      bolster: createRoundedBoxGeometry(0.075, 0.1, 0.46, 0.025, 3),
      backrest: createRoundedBoxGeometry(0.45, 0.61, 0.13, 0.04, 3),
      headrest: createRoundedBoxGeometry(0.24, 0.185, 0.1, 0.032, 3),
      armrest: createRoundedBoxGeometry(0.072, 0.072, 0.34, 0.022, 3),
    }),
    []
  );

  const dashGeo = useMemo(() => createRoundedBoxGeometry(1.44, 0.25, 0.42, 0.05, 3), []);

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
      {/* Cabin Floor & Carpet (fits strictly inside curved sills) */}
      <mesh position={[0, 0.335, -0.25]} receiveShadow>
        <boxGeometry args={[1.5, 0.05, 3.22]} />
        <meshStandardMaterial color="#181c24" roughness={0.95} />
      </mesh>
      {/* Lower recessed step-in floor well on left sliding doorway */}
      <mesh position={[0.67, 0.305, -0.31]} receiveShadow>
        <boxGeometry args={[0.24, 0.04, 1.04]} />
        <meshStandardMaterial color="#11151d" roughness={0.9} />
      </mesh>
      {/* Brushed silver step scuff plate */}
      <mesh position={[0.725, 0.328, -0.31]}>
        <boxGeometry args={[0.07, 0.006, 0.78]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.78} roughness={0.32} />
      </mesh>
      {/* Step courtesy LED strip */}
      <mesh position={[0.57, 0.345, -0.31]}>
        <boxGeometry args={[0.015, 0.015, 0.42]} />
        <meshStandardMaterial
          ref={stepLedMatRef}
          color="#fffbeb"
          emissive="#fde68a"
          emissiveIntensity={1.5}
        />
      </mesh>

      {/* Interior Headliner (bounded strictly inside roof cavity: z = -1.96 to +0.76, width = 1.28!) */}
      <mesh position={[0, 1.745, -0.6]}>
        <boxGeometry args={[1.28, 0.025, 2.72]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.92} />
      </mesh>

      {/* Interior Rearview Mirror mounted inside top of windshield */}
      <group position={[0, 1.63, 0.93]}>
        <mesh position={[0, 0.055, -0.02]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.09, 8]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.22, 0.055, 0.024]} />
          <meshStandardMaterial color="#111827" roughness={0.4} />
        </mesh>
      </group>

      {/* Overhead LED Dome Lamp */}
      <mesh position={[0.04, 1.725, -0.25]}>
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

      {/* 2nd-Row Contoured Captain Seats (Left & Right) */}
      <CaptainSeat position={[0.36, 0.355, -0.46]} geos={seatGeos} />
      <CaptainSeat position={[-0.36, 0.355, -0.46]} geos={seatGeos} />

      {/* 3rd-Row Bench Seat */}
      <group position={[0, 0.375, -1.32]}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[1.28, 0.15, 0.46]} />
          <meshStandardMaterial color="#272c36" roughness={0.88} />
        </mesh>
        <mesh position={[0, 0.54, -0.2]} rotation={[-0.16, 0, 0]}>
          <boxGeometry args={[1.26, 0.58, 0.13]} />
          <meshStandardMaterial color="#272c36" roughness={0.88} />
        </mesh>
      </group>

      {/* Front Row Seats + Sculpted Dashboard */}
      <CaptainSeat position={[0.36, 0.355, 0.54]} geos={seatGeos} />
      <CaptainSeat position={[-0.36, 0.355, 0.54]} geos={seatGeos} />

      {/* Contoured Dashboard fitting cleanly beneath curved windshield cowl */}
      <mesh position={[0, 0.92, 1.18]} geometry={dashGeo}>
        <meshStandardMaterial color="#1b202a" roughness={0.74} />
      </mesh>
      {/* Wide digital meter & infotainment screen */}
      <mesh position={[-0.1, 1.07, 1.06]} rotation={[-0.14, 0, 0]}>
        <boxGeometry args={[0.72, 0.14, 0.036]} />
        <meshStandardMaterial color="#0f172a" emissive="#1e3a8a" emissiveIntensity={0.45} roughness={0.2} />
      </mesh>
      {/* Right-hand-drive Steering Wheel */}
      <mesh position={[-0.36, 1.0, 0.94]} rotation={[0.35, 0, 0]}>
        <torusGeometry args={[0.155, 0.019, 12, 26]} />
        <meshStandardMaterial color="#111827" roughness={0.55} />
      </mesh>

      {/* Left B-Pillar Interior Trim: Child Assist Grip & Interactive Power Slide Button! */}
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
