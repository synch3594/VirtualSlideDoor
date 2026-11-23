import { useMemo } from 'react';
import * as THREE from 'three';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { useDoorStore } from '../store/useDoorStore';

export function EnvironmentRig() {
  const timeOfDay = useDoorStore((s) => s.timeOfDay);

  const groundTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Subtle asphalt / driveway paving grain
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 18000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const v = 42 + Math.floor(Math.random() * 28);
        ctx.fillStyle = `rgb(${v},${v + 5},${v + 12})`;
        ctx.fillRect(x, y, 2, 2);
      }
      // Subtle concrete expansion joint lines
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 256);
      ctx.lineTo(512, 256);
      ctx.moveTo(256, 0);
      ctx.lineTo(256, 512);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 14);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const palette = useMemo(() => {
    if (timeOfDay === 'night') {
      return {
        bg: '#080e1c',
        fog: '#080e1c',
        sunColor: '#93c5fd',
        sunIntensity: 0.55,
        sunPos: [5, 8, 4] as [number, number, number],
        hemiSky: '#1e3a8a',
        hemiGround: '#090d16',
        hemiIntensity: 0.45,
        envIntensity: 0.38,
        groundColor: '#1e293b',
        stripeColor: '#64748b',
      };
    }
    if (timeOfDay === 'sunset') {
      return {
        bg: '#2c1e34',
        fog: '#45273b',
        sunColor: '#ff9b54',
        sunIntensity: 2.35,
        sunPos: [8, 3.2, 5] as [number, number, number],
        hemiSky: '#fb923c',
        hemiGround: '#1e1b2e',
        hemiIntensity: 0.72,
        envIntensity: 0.75,
        groundColor: '#475569',
        stripeColor: '#cbd5e1',
      };
    }
    // Crisp bright daytime
    return {
      bg: '#cbdcf0',
      fog: '#d7e5f5',
      sunColor: '#fff9ed',
      sunIntensity: 2.6,
      sunPos: [7, 10, 6] as [number, number, number],
      hemiSky: '#bae6fd',
      hemiGround: '#64748b',
      hemiIntensity: 0.95,
      envIntensity: 1.05,
      groundColor: '#64748b',
      stripeColor: '#f8fafc',
    };
  }, [timeOfDay]);

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.fog, 14, 34]} />

      <hemisphereLight args={[palette.hemiSky, palette.hemiGround, palette.hemiIntensity]} />

      <directionalLight
        position={palette.sunPos}
        intensity={palette.sunIntensity}
        color={palette.sunColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={24}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
        shadow-bias={-0.0004}
      />

      {/* Subtle rim fill from rear-left so door crease & rail catch crisp highlights */}
      <directionalLight
        position={[-4, 5, -6]}
        intensity={timeOfDay === 'night' ? 0.35 : 0.65}
        color={timeOfDay === 'sunset' ? '#c084fc' : '#e0f2fe'}
      />

      {/* Warm overhead streetlamp glow at night */}
      {timeOfDay === 'night' && (
        <pointLight
          position={[3.6, 5.2, 1.5]}
          intensity={14}
          distance={16}
          decay={1.8}
          color="#fde68a"
        />
      )}

      {/* Procedural studio/outdoor environment map for crisp automotive clearcoat reflections */}
      <Environment resolution={256} frames={1} environmentIntensity={palette.envIntensity}>
        {/* Sky dome strip */}
        <Lightformer
          form="rect"
          intensity={timeOfDay === 'night' ? 0.6 : 2.2}
          color={timeOfDay === 'sunset' ? '#fdba74' : '#e0f2fe'}
          position={[0, 8, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[24, 24, 1]}
        />
        {/* Crisp horizontal highlight bar along the side of the minivan (gives authentic car paint gleam!) */}
        <Lightformer
          form="rect"
          intensity={timeOfDay === 'night' ? 1.8 : 3.2}
          color={timeOfDay === 'sunset' ? '#fed7aa' : '#ffffff'}
          position={[8, 2.8, 1]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[14, 1.4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={timeOfDay === 'night' ? 0.8 : 1.6}
          color="#cbd5e1"
          position={[-8, 3.2, -1]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[14, 2, 1]}
        />
        {/* Warm horizon glow */}
        <Lightformer
          form="ring"
          intensity={timeOfDay === 'sunset' ? 4.5 : 1.4}
          color={timeOfDay === 'sunset' ? '#fb923c' : '#fef3c7'}
          position={[6, 1.8, 8]}
          scale={5}
        />
      </Environment>

      {/* Driveway / Parking Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[52, 52]} />
        <meshStandardMaterial
          map={groundTexture}
          color={palette.groundColor}
          roughness={0.88}
          metalness={0.05}
        />
      </mesh>

      {/* Parking Bay Lines (Japanese home/storefront parking vibe!) */}
      <group position={[0, 0.004, 0]}>
        {/* Left & Right white parking bay lines */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.28, 0, 0]}>
          <planeGeometry args={[0.11, 5.4]} />
          <meshStandardMaterial color={palette.stripeColor} roughness={0.7} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.28, 0, 0]}>
          <planeGeometry args={[0.11, 5.4]} />
          <meshStandardMaterial color={palette.stripeColor} roughness={0.7} />
        </mesh>
        {/* Rear wheel stop blocks (車止めブロック) */}
        <mesh position={[0.62, 0.055, -2.02]} castShadow receiveShadow>
          <boxGeometry args={[0.56, 0.11, 0.16]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.9} />
        </mesh>
        <mesh position={[-0.62, 0.055, -2.02]} castShadow receiveShadow>
          <boxGeometry args={[0.56, 0.11, 0.16]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.9} />
        </mesh>
        {/* Subtle curb / sidewalk on the passenger side */}
        <mesh position={[2.85, 0.06, 0]} receiveShadow>
          <boxGeometry args={[2.1, 0.12, 16]} />
          <meshStandardMaterial
            color={timeOfDay === 'night' ? '#334155' : '#94a3b8'}
            roughness={0.85}
          />
        </mesh>
      </group>

      {/* Grounded ambient occlusion shadow beneath the Serena */}
      <ContactShadows
        position={[0, 0.008, 0]}
        opacity={timeOfDay === 'night' ? 0.8 : 0.58}
        scale={9}
        blur={1.8}
        far={2.6}
        resolution={256}
        color="#020617"
      />
    </>
  );
}
