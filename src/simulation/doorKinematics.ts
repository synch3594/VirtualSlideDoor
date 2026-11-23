import type { DoorPose } from './types';

/**
 * Physical dimensions (meters) for our minivan sliding door.
 * Coordinate system:
 *  +Y = up (0 = ground)
 *  +Z = front of vehicle, -Z = rear of vehicle
 *  +X = left (passenger / sidewalk) side of vehicle
 */
export const DOOR_METRICS = {
  /** Sliding door closed center Z (spans z = +0.22 front to z = -0.84 rear) */
  doorClosedCenterZ: -0.31,
  doorWidth: 1.06,
  /** Body outer skin X coordinate on the left side */
  bodyLeftX: 0.85,
  /** Full outward pop-out distance (meters) */
  maxPopoutX: 0.118,
  /** Half-latch outward gap right before Easy Closer pulls door flush */
  halfLatchX: 0.019,
  /** Full rearward slide travel (meters) */
  maxSlideZ: -0.86,
  /** Progress threshold for Easy Closer / half-latch zone */
  easyCloserProgress: 0.045,
  /** Progress threshold where pop-out finishes and pure parallel slide begins */
  popoutEndProgress: 0.185,
  /** Center rail height (just below rear quarter glass) */
  centerRailY: 1.025,
  /** Rear hinge mount local Z on the sliding door (near rear edge) */
  doorRearArmLocalZ: -0.495,
} as const;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Computes exact 3D kinematics of the sliding door for progress p in [0, 1].
 * - p = 0.000 : Fully closed & flush against weatherstrip
 * - p = 0.045 : Half-latch position (Easy Closer engagement threshold)
 * - p = 0.185 : Pop-out complete; door is parallel to body at +11.8cm
 * - p = 1.000 : Fully open against rear stopper
 */
export function computeDoorPose(progress: number, elasticBounce = 0): DoorPose {
  const p = clamp(progress, 0, 1);
  const {
    easyCloserProgress,
    popoutEndProgress,
    halfLatchX,
    maxPopoutX,
    maxSlideZ,
    doorClosedCenterZ,
    doorRearArmLocalZ,
    bodyLeftX,
  } = DOOR_METRICS;

  let xOffset = 0;
  let zOffset = 0;
  let yaw = 0;

  const easyCloserZ = -0.012;
  const popoutEndZ = -0.155;

  if (p <= easyCloserProgress) {
    // Phase 1: Easy Closer compression zone (0 -> half-latch)
    // Door pulls nearly straight inward into the rubber seal; negative yaw = rear edge (-Z) leads outward (+X)
    const u = smoothstep(0, easyCloserProgress, p);
    xOffset = halfLatchX * u;
    zOffset = easyCloserZ * u;
    yaw = -0.015 * u;
  } else if (p <= popoutEndProgress) {
    // Phase 2: Curved rail pop-out / pull-in zone
    const u = (p - easyCloserProgress) / (popoutEndProgress - easyCloserProgress);
    const easeOut = smoothstep(0, 1, u);
    xOffset = halfLatchX + (maxPopoutX - halfLatchX) * easeOut;

    // Smooth blend into rearward translation
    const zEase = u * u * (2.2 - 1.2 * u);
    zOffset = easyCloserZ + (popoutEndZ - easyCloserZ) * clamp(zEase, 0, 1);

    // Real minivan door rear edge swings outward first during pop-out (negative Y rotation)
    const yawBell = Math.sin(u * Math.PI);
    yaw = -(0.015 * (1 - easeOut) + 0.044 * yawBell);
  } else {
    // Phase 3: Parallel slide along the center guide rail
    const u = (p - popoutEndProgress) / (1 - popoutEndProgress);
    xOffset = maxPopoutX;
    zOffset = popoutEndZ + (maxSlideZ - popoutEndZ) * u;
    yaw = 0;
  }

  // Apply subtle elastic stopper bounce along the active travel direction
  if (Math.abs(elasticBounce) > 0.00001) {
    if (p > 0.5) {
      zOffset += elasticBounce * 0.014;
    } else {
      xOffset = Math.max(0, xOffset + elasticBounce * 0.004);
    }
  }

  // Compute the roller carrier's exact position inside the body's curved center rail
  const doorRearWorldZ = doorClosedCenterZ + zOffset + doorRearArmLocalZ;
  const railCurveT = smoothstep(0, popoutEndProgress, p);
  const centerRollerZ = doorRearWorldZ - 0.04;
  // Front end of center rail curves inward into the C-pillar pocket; rear straight section sits near body skin
  const centerRollerX = bodyLeftX - 0.055 + 0.032 * railCurveT;

  return {
    xOffset,
    zOffset,
    yaw,
    centerRollerZ,
    centerRollerX,
  };
}
