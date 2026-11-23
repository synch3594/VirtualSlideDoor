import * as THREE from 'three';

/**
 * Single source of truth for the minivan's parametric outer shell.
 * Every body panel, sliding door panel, window glass, pillar, lamp, molding, and seal
 * queries these exact functions so all seams align to 0.0mm precision with zero gaps,
 * zero protruding glass, and authentic automotive tumblehome & wrap-around curvature.
 *
 * Coordinate system:
 *  +Y = up (0 = ground)
 *  +Z = front (+2.33m front bumper), -Z = rear (-2.30m rear bumper)
 *  +X = left (passenger / sliding door side), -X = right (driver side)
 */

export const VEHICLE_DIMS = {
  /** Wheelbase and wheel positions */
  frontAxleZ: 1.44,
  rearAxleZ: -1.43,
  wheelRadius: 0.315,
  wheelArchRadius: 0.365,
  wheelArchCenterY: 0.33,

  /** Key vertical heights */
  sillBottomY: 0.21,
  doorBottomY: 0.34,
  beltlineY: 1.07,
  windowTopY: 1.745,
  roofEdgeY: 1.76,
  roofCrownHeight: 0.08, // total roof peak ~ 1.84m

  /** Key longitudinal Z stations */
  frontBumperZ: 2.33,
  rearBumperZ: -2.30,
  cowlZ: 1.44,
  windshieldTopZ: 0.88,
  bPillarCenterZ: 0.26,
  cPillarCenterZ: -0.88,

  /** Sliding doorway opening on left side (+X) */
  doorwayFrontZ: 0.22,
  doorwayRearZ: -0.84,
} as const;

const SIDE_PROFILE_PTS: ReadonlyArray<[number, number]> = [
  [0.19, 0.74], // underbody rocker tuck
  [0.26, 0.8], // lower rocker molding
  [0.34, 0.833], // door bottom edge
  [0.48, 0.856], // sculpted lower body fullness
  [0.66, 0.854], // mid-door panel
  [0.88, 0.848], // door handle belt zone
  [1.07, 0.836], // beltline shoulder
  [1.24, 0.809], // lower greenhouse tumblehome
  [1.48, 0.766], // mid greenhouse tumblehome
  [1.745, 0.712], // top of window / cant rail
  [1.79, 0.678], // roof rail blend
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function interpPiecewise(y: number, pts: ReadonlyArray<[number, number]>): number {
  if (y <= pts[0][0]) return pts[0][1];
  const last = pts.length - 1;
  if (y >= pts[last][0]) return pts[last][1];

  let i = 0;
  while (i < last - 1 && y > pts[i + 1][0]) i++;

  const [y0, x0] = pts[i];
  const [y1, x1] = pts[i + 1];
  const h = y1 - y0;
  const t = (y - y0) / h;

  const m0 =
    i === 0
      ? (x1 - x0) / h
      : 0.5 * ((x1 - x0) / h + (x0 - pts[i - 1][1]) / (y0 - pts[i - 1][0]));
  const m1 =
    i + 1 === last
      ? (x1 - x0) / h
      : 0.5 * ((pts[i + 2][1] - x1) / (pts[i + 2][0] - y1) + (x1 - x0) / h);

  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * x0 +
    (t3 - 2 * t2 + t) * h * m0 +
    (-2 * t3 + 3 * t2) * x1 +
    (t3 - t2) * h * m1
  );
}

/**
 * Smooth outer half-width X(y) along the constant-section cabin side (z in [-1.96, +1.18]).
 */
export function bodySideX(y: number): number {
  return interpPiecewise(y, SIDE_PROFILE_PTS);
}

/**
 * Subtle plan-view width taper at front fender (z > 1.18) and rear corner (z < -1.96).
 * Strictly 1.0 along the entire cabin & sliding-door travel zone [-1.96, +1.18]
 * so the sliding door maintains exact parallel clearance!
 */
export function planWidthScale(z: number): number {
  if (z > 1.18) {
    const t = clamp((z - 1.18) / (2.33 - 1.18), 0, 1);
    return 1 - 0.03 * t * t - 0.048 * Math.pow(t, 4);
  }
  if (z < -1.96) {
    const t = clamp((-1.96 - z) / (2.30 - 1.96), 0, 1);
    return 1 - 0.062 * t * t;
  }
  return 1.0;
}

/** Outer X coordinate at any (y, z) on the body side */
export function bodyOuterX(y: number, z: number): number {
  return bodySideX(y) * planWidthScale(z);
}

/**
 * Exact shared front bumper corner Z(y) where the front fender seamlessly meets the front fascia.
 * Both left/right front fenders and the front nose loft terminate on this exact curve!
 */
const FRONT_CORNER_Z_PTS: ReadonlyArray<[number, number]> = [
  [0.21, 2.06], // sculpted lower chin tuck
  [0.32, 2.135], // lower bumper corner
  [0.58, 2.165], // mid bumper corner
  [0.82, 2.145], // headlight corner level
  [0.95, 2.09], // hood nose corner
];

export function frontCornerZ(y: number): number {
  return interpPiecewise(y, FRONT_CORNER_Z_PTS);
}

/**
 * Exact shared rear bumper corner Z(y) where the rear quarter seamlessly meets the rear tailgate.
 */
const REAR_CORNER_Z_PTS: ReadonlyArray<[number, number]> = [
  [0.21, -2.105], // rear lower diffuser corner
  [0.34, -2.165], // rear bumper corner
  [0.62, -2.18], // mid rear corner
  [0.92, -2.172], // upper tailgate corner
  [1.075, -2.16], // beltline corner
];

export function rearCornerZ(y: number): number {
  return interpPiecewise(y, REAR_CORNER_Z_PTS);
}

/**
 * Exact Z coordinate of the A-pillar / windshield side edge at height y in [1.04, 1.765].
 */
export function aPillarZ(y: number): number {
  const yBot = 1.07;
  const yTop = 1.765;
  const t = clamp((y - yBot) / (yTop - yBot), 0, 1);
  const zBot = 1.46;
  const zTop = 0.88;
  return zBot + (zTop - zBot) * t + 0.022 * Math.sin(t * Math.PI);
}

/**
 * Exact Z coordinate of the rear D-pillar / rear glass corner at height y in [1.07, 1.765].
 */
export function dPillarRearZ(y: number): number {
  const yBot = 1.07;
  const yTop = 1.765;
  const t = clamp((y - yBot) / (yTop - yBot), 0, 1);
  return -2.16 + 0.085 * t; // slight aerodynamic forward rake matching rearCornerZ(1.075) = -2.16!
}

/**
 * Front side window subtle modern minivan beltline curve.
 */
export function frontBeltlineY(z: number): number {
  if (z <= 0.72) return 1.07;
  if (z >= 1.44) return 1.075;
  const u = (z - 0.72) / (1.44 - 0.72);
  const dip = Math.sin(u * Math.PI) * 0.026;
  return 1.07 + 0.005 * u - dip;
}

/**
 * Shared outer hood/fender top edge height Y(z) from A-pillar base (z=1.44) to nose corner (z=2.09).
 */
export function hoodEdgeY(z: number): number {
  const t = clamp((z - 1.44) / (2.09 - 1.44), 0, 1);
  // Sleek aerodynamic minivan hood slope from 1.075m down to 0.935m at nose corner
  return 1.075 - 0.06 * t - 0.08 * t * t;
}

/**
 * Longitudinal roof edge height along Z (from windshield header z=0.88 to rear spoiler z=-2.26).
 */
export function roofEdgeYAtZ(z: number): number {
  if (z > 0.55) {
    const t = clamp((z - 0.55) / (0.88 - 0.55), 0, 1);
    return 1.768 - 0.018 * t * t;
  }
  if (z < -1.85) {
    const t = clamp((-1.85 - z) / (2.26 - 1.85), 0, 1);
    return 1.764 - 0.022 * t * t;
  }
  const u = (z + 0.65) / 1.2;
  return 1.768 + 0.004 * Math.max(0, 1 - u * u);
}

/**
 * Transverse roof crown arch for normalized lateral coordinate u in [-1, 1].
 */
export function roofCrownAtU(u: number, z: number): number {
  const base = roofEdgeYAtZ(z);
  const absU = clamp(Math.abs(u), 0, 1);
  const crown = VEHICLE_DIMS.roofCrownHeight * Math.pow(Math.cos(absU * (Math.PI / 2)), 0.88);
  const frontScale = z > 0.65 ? 1 - 0.25 * clamp((z - 0.65) / 0.25, 0, 1) : 1;
  const rearScale = z < -2.02 ? 1 - 0.35 * clamp((-2.02 - z) / 0.24, 0, 1) : 1;
  return base + crown * frontScale * rearScale;
}

/**
 * Front windshield horizontal bow (curvature in Z as a function of lateral u in [-1, 1]).
 */
export function windshieldBowZ(u: number, y: number): number {
  const t = clamp((y - 1.07) / (1.765 - 1.07), 0, 1);
  const bowAmp = 0.068 - 0.016 * t;
  return aPillarZ(y) + bowAmp * (1 - u * u);
}

/**
 * Front fascia surface point (x, y, z) for u in [-1, 1] and height y in [0.21, 0.935].
 * Shared by front bumper loft, grille, chrome louvers, and flush wrap-around headlights!
 */
export function frontFasciaPoint(u: number, y: number, zProtrude = 0): THREE.Vector3 {
  const absU = clamp(Math.abs(u), 0, 1);
  const cornerZ = frontCornerZ(y);
  // How far center protrudes forward relative to cornerZ (creates smooth wrap-around nose!)
  const bowAtY =
    y < 0.32
      ? 0.175
      : y < 0.72
        ? 0.165
        : 0.165 - 0.03 * smoothstep(0.72, 0.95, y);
  const wrapProfile = 1 - Math.pow(absU, 2.45);
  const z = cornerZ + bowAtY * wrapProfile + zProtrude;
  const halfW = bodyOuterX(Math.min(y, 1.07), cornerZ);
  return new THREE.Vector3(u * halfW, y, z);
}

/**
 * Rear hatch/tailgate surface point (x, y, z) for u in [-1, 1] and height y in [0.21, 1.75].
 * Shared by tailgate loft, rear glass, license garnish, and flush wrap-around taillights!
 */
export function rearFasciaPoint(u: number, y: number, zProtrude = 0): THREE.Vector3 {
  const absU = clamp(Math.abs(u), 0, 1);
  const cornerZ = y <= 1.075 ? rearCornerZ(y) : dPillarRearZ(y);
  const bowAmp = y <= 1.075 ? 0.125 : 0.125 - 0.03 * smoothstep(1.075, 1.75, y);
  const wrapProfile = 1 - Math.pow(absU, 2.45);
  const z = cornerZ - bowAmp * wrapProfile - zProtrude;
  const halfW = bodyOuterX(y, cornerZ);
  return new THREE.Vector3(u * halfW, y, z);
}

/**
 * Helper: builds an indexed BufferGeometry from a regular (rows x cols) 3D grid of points,
 * optionally with an inner thickness shell and perimeter edge walls.
 */
export function createGridSurfaceGeometry(
  grid: THREE.Vector3[][],
  options?: {
    flipWinding?: boolean;
    thicknessVec?: (p: THREE.Vector3, r: number, c: number) => THREE.Vector3;
  }
): THREE.BufferGeometry {
  const rows = grid.length;
  const cols = grid[0].length;
  const flip = options?.flipWinding ?? false;
  const hasThickness = Boolean(options?.thicknessVec);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rows; r++) {
    const v = r / Math.max(1, rows - 1);
    for (let c = 0; c < cols; c++) {
      const u = c / Math.max(1, cols - 1);
      const p = grid[r][c];
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);
    }
  }

  const pushTri = (a: number, b: number, c: number, invert = false) => {
    if (flip !== invert) {
      indices.push(a, c, b);
    } else {
      indices.push(a, b, c);
    }
  };

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = r * cols + (c + 1);
      const d = (r + 1) * cols + c;
      const e = (r + 1) * cols + (c + 1);
      pushTri(a, b, e);
      pushTri(a, e, d);
    }
  }

  if (hasThickness && options?.thicknessVec) {
    const baseOffset = rows * cols;
    for (let r = 0; r < rows; r++) {
      const v = r / Math.max(1, rows - 1);
      for (let c = 0; c < cols; c++) {
        const u = c / Math.max(1, cols - 1);
        const p = grid[r][c];
        const inner = p.clone().add(options.thicknessVec(p, r, c));
        positions.push(inner.x, inner.y, inner.z);
        uvs.push(u, v);
      }
    }

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = baseOffset + r * cols + c;
        const b = baseOffset + r * cols + (c + 1);
        const d = baseOffset + (r + 1) * cols + c;
        const e = baseOffset + (r + 1) * cols + (c + 1);
        pushTri(a, b, e, true);
        pushTri(a, e, d, true);
      }
    }

    // Perimeter border walls
    for (let c = 0; c < cols - 1; c++) {
      pushTri(c, baseOffset + c, baseOffset + c + 1);
      pushTri(c, baseOffset + c + 1, c + 1);
    }
    for (let c = 0; c < cols - 1; c++) {
      const top = (rows - 1) * cols;
      pushTri(top + c, top + c + 1, baseOffset + top + c + 1);
      pushTri(top + c, baseOffset + top + c + 1, baseOffset + top + c);
    }
    for (let r = 0; r < rows - 1; r++) {
      pushTri(r * cols, (r + 1) * cols, baseOffset + (r + 1) * cols);
      pushTri(r * cols, baseOffset + (r + 1) * cols, baseOffset + r * cols);
    }
    for (let r = 0; r < rows - 1; r++) {
      const rc = cols - 1;
      pushTri(r * cols + rc, baseOffset + r * cols + rc, baseOffset + (r + 1) * cols + rc);
      pushTri(r * cols + rc, baseOffset + (r + 1) * cols + rc, (r + 1) * cols + rc);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export interface CurvedSidePanelOptions {
  side: 1 | -1;
  zMin: number;
  zMax: number;
  yMin: number | ((z: number) => number);
  yMax: number | ((z: number) => number);
  zMinAtY?: (y: number) => number;
  zMaxAtY?: (y: number) => number;
  wheelArch?: {
    centerZ: number;
    centerY: number;
    radius: number;
  };
  xOffset?: number;
  thickness?: number;
  characterCrease?: boolean;
  zShift?: number;
  rows?: number;
  cols?: number;
  usePlanTaper?: boolean;
}

/**
 * Builds a curved side body panel, door skin, glass pane, pillar, or trim strip
 * conforming strictly to `bodySideX(y)` and `planWidthScale(z)`.
 */
export function createCurvedSidePanel(opts: CurvedSidePanelOptions): THREE.BufferGeometry {
  const {
    side,
    zMin,
    zMax,
    yMin,
    yMax,
    zMinAtY,
    zMaxAtY,
    wheelArch,
    xOffset = 0,
    thickness = 0,
    characterCrease = false,
    zShift = 0,
    rows = 14,
    cols = 20,
    usePlanTaper = true,
  } = opts;

  const evalYMin = (z: number) => (typeof yMin === 'function' ? yMin(z) : yMin);
  const evalYMax = (z: number) => (typeof yMax === 'function' ? yMax(z) : yMax);

  const zSamples: number[] = [];
  if (wheelArch) {
    const aStart = Math.max(zMin, wheelArch.centerZ - wheelArch.radius);
    const aEnd = Math.min(zMax, wheelArch.centerZ + wheelArch.radius);
    const leftCols = Math.max(4, Math.round(cols * 0.25));
    const archCols = Math.max(20, Math.round(cols * 0.55));
    const rightCols = Math.max(4, Math.round(cols * 0.25));

    if (aStart > zMin + 0.001) {
      for (let i = 0; i < leftCols; i++) {
        zSamples.push(zMin + (aStart - zMin) * (i / leftCols));
      }
    }
    for (let i = 0; i <= archCols; i++) {
      const theta = Math.PI - (i / archCols) * Math.PI;
      const z = clamp(wheelArch.centerZ + Math.cos(theta) * wheelArch.radius, zMin, zMax);
      zSamples.push(z);
    }
    if (zMax > aEnd + 0.001) {
      for (let i = 1; i <= rightCols; i++) {
        zSamples.push(aEnd + (zMax - aEnd) * (i / rightCols));
      }
    }
  } else {
    for (let c = 0; c <= cols; c++) {
      zSamples.push(zMin + (zMax - zMin) * (c / cols));
    }
  }

  const grid: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const rowPts: THREE.Vector3[] = [];
    for (let c = 0; c < zSamples.length; c++) {
      const u = c / Math.max(1, zSamples.length - 1);
      const rawZ = zSamples[c];
      let botY = evalYMin(rawZ);
      let topY = evalYMax(rawZ);

      if (wheelArch) {
        const dz = rawZ - wheelArch.centerZ;
        if (Math.abs(dz) < wheelArch.radius) {
          const archY =
            wheelArch.centerY + Math.sqrt(Math.max(0, wheelArch.radius * wheelArch.radius - dz * dz));
          botY = Math.max(botY, archY);
        }
      }

      let y = botY + (topY - botY) * v;
      let z = rawZ;

      if (zMinAtY || zMaxAtY) {
        const z0 = zMinAtY ? zMinAtY(y) : zMin;
        const z1 = zMaxAtY ? zMaxAtY(y) : zMax;
        if (wheelArch) {
          // Only clamp the outer ends to the curved corner boundary without distorting the circular wheel arch!
          z = clamp(rawZ, z0, z1);
        } else {
          z = z0 + (z1 - z0) * u;
          if (typeof yMin === 'function' || typeof yMax === 'function') {
            botY = evalYMin(z);
            topY = evalYMax(z);
            y = botY + (topY - botY) * v;
          }
        }
      }

      let xMag = usePlanTaper ? bodyOuterX(y, z) : bodySideX(y);
      if (characterCrease) {
        // Smoothly fade lower crease before wheel arches so fender surfaces stay silky smooth!
        let creaseMask = 1.0;
        if (wheelArch) {
          const dArch = Math.abs(z - wheelArch.centerZ) - wheelArch.radius;
          creaseMask = smoothstep(0.0, 0.18, dArch);
        }
        const lowerRidge = Math.exp(-Math.pow((y - 0.47) / 0.048, 2)) * 0.008 * creaseMask;
        const upperCrease = Math.exp(-Math.pow((y - 0.96) / 0.036, 2)) * 0.004;
        xMag += lowerRidge + upperCrease;
      }

      const x = side * (xMag + xOffset);
      rowPts.push(new THREE.Vector3(x, y, z - zShift));
    }
    grid.push(rowPts);
  }

  return createGridSurfaceGeometry(grid, {
    flipWinding: side === 1,
    thicknessVec: thickness > 0 ? () => new THREE.Vector3(-side * thickness, 0, 0) : undefined,
  });
}

/**
 * Builds the smoothly curved, arched 3D Roof Shell from the curved windshield header (z=0.88)
 * to the integrated rear roof spoiler (z=-2.26), with zero overhang artifacts.
 */
export function createSculptedRoofGeometry(): THREE.BufferGeometry {
  const zStations = [
    -2.25, -2.19, -2.1, -1.94, -1.65, -1.25, -0.75, -0.25, 0.25, 0.58, 0.74, 0.84, 0.88,
  ];
  const uCols = 22;

  const grid: THREE.Vector3[][] = [];
  for (let r = 0; r < zStations.length; r++) {
    const zBase = zStations[r];
    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= uCols; c++) {
      const u = -1 + (2 * c) / uCols;

      let z = zBase;
      if (zBase > 0.45) {
        const frontBlend = smoothstep(0.45, 0.88, zBase);
        z += frontBlend * 0.052 * (1 - u * u);
      } else if (zBase < -1.88) {
        const rearBlend = smoothstep(-1.88, -2.25, zBase);
        z -= rearBlend * 0.055 * (1 - u * u);
      }

      const edgeY = roofEdgeYAtZ(zBase);
      const halfW = bodyOuterX(edgeY, zBase) + 0.002;
      const x = u * halfW;
      const y = roofCrownAtU(u, zBase);

      row.push(new THREE.Vector3(x, y, z));
    }
    grid.push(row);
  }

  return createGridSurfaceGeometry(grid, {
    flipWinding: true,
    thicknessVec: (_p, r) => {
      const edgeTaper = r === 0 || r === zStations.length - 1 ? 0.018 : 0.036;
      return new THREE.Vector3(0, -edgeTaper, 0);
    },
  });
}

/**
 * Builds the curved front windshield glass with authentic tumblehome width taper AND horizontal bow.
 */
export function createCurvedWindshieldGeometry(inset = 0.014, marginX = 0.028): THREE.BufferGeometry {
  const rows = 14;
  const cols = 20;
  const yBot = 1.075;
  const yTop = 1.755;

  const grid: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const y = yBot + (yTop - yBot) * v;
    const zEdge = aPillarZ(y);
    const halfW = Math.max(0.4, bodyOuterX(y, zEdge) - marginX);

    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const u = -1 + (2 * c) / cols;
      const x = u * halfW;
      const z = windshieldBowZ(u, y) - inset;
      row.push(new THREE.Vector3(x, y, z));
    }
    grid.push(row);
  }

  return createGridSurfaceGeometry(grid, {
    flipWinding: false,
    thicknessVec: () => new THREE.Vector3(0, -0.008, -0.012),
  });
}

/**
 * Builds a sculpted A-pillar smoothly wrapping from the front windshield edge to the side window.
 */
export function createAPillarGeometry(side: 1 | -1): THREE.BufferGeometry {
  const rows = 16;
  const cols = 6;
  const yBot = 1.072;
  const yTop = 1.768;

  const grid: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const y = yBot + (yTop - yBot) * v;
    const zEdge = aPillarZ(y);
    const outerX = bodyOuterX(y, zEdge) + 0.003;
    const pillarW = 0.068 - 0.01 * v;

    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const s = c / cols;
      const angle = s * (Math.PI * 0.55);
      const x = side * (outerX - pillarW * (1 - Math.sin(angle)) * 0.65);
      const z = zEdge + 0.016 * Math.cos(angle) - pillarW * s * 0.62;
      row.push(new THREE.Vector3(x, y, z));
    }
    grid.push(row);
  }

  return createGridSurfaceGeometry(grid, {
    flipWinding: side === -1,
    thicknessVec: () => new THREE.Vector3(-side * 0.038, 0, -0.032),
  });
}

/**
 * Builds the smoothly sculpted Front Hood + Wrap-Around Nose Fascia + Front Bumper.
 * Outer boundary |u| = 1 matches `frontCornerZ(y)` and `hoodEdgeY(z)` identically so
 * the nose wraps seamlessly into the left & right front fenders with ZERO flange or gap!
 */
export function createFrontNoseGeometry(): THREE.BufferGeometry {
  const cols = 28;
  const grid: THREE.Vector3[][] = [];

  // Part 1: Arched sloped hood from cowl (z = 1.44) forward to rounded hood nose corner (z = 2.09)
  const hoodZStations = [1.44, 1.62, 1.82, 1.98, 2.09];
  for (let r = 0; r < hoodZStations.length; r++) {
    const zEdge = hoodZStations[r];
    const t = clamp((zEdge - 1.44) / (2.09 - 1.44), 0, 1);
    const yEdge = hoodEdgeY(zEdge);
    const halfW = bodyOuterX(yEdge, zEdge);
    // Hood nose bows forward gracefully toward the grille brow
    const bowZ = 0.025 + 0.115 * Math.pow(t, 1.5);
    const crown = 0.026 + 0.018 * Math.sin(t * Math.PI * 0.85);

    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const u = -1 + (2 * c) / cols;
      const absU = Math.abs(u);
      const wrap = 1 - Math.pow(absU, 2.45);
      const z = zEdge + bowZ * wrap;
      const ridge = Math.exp(-Math.pow((absU - 0.6) / 0.14, 2)) * 0.008 * (1 - 0.3 * t);
      const y = yEdge + crown * (1 - u * u) + ridge;
      row.push(new THREE.Vector3(u * halfW, y, z));
    }
    grid.push(row);
  }

  // Part 2: Curved front fascia & bumper using exact shared frontFasciaPoint(u, y)!
  const fasciaYs = [0.90, 0.82, 0.70, 0.56, 0.42, 0.31, 0.245, 0.21];
  for (let r = 0; r < fasciaYs.length; r++) {
    const y = fasciaYs[r];
    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const u = -1 + (2 * c) / cols;
      row.push(frontFasciaPoint(u, y, 0));
    }
    grid.push(row);
  }

  return createGridSurfaceGeometry(grid, {
    flipWinding: true,
    thicknessVec: (_p, r) => {
      if (r < hoodZStations.length) return new THREE.Vector3(0, -0.04, -0.02);
      return new THREE.Vector3(0, 0, -0.055);
    },
  });
}

/**
 * Builds a sleek, flush wrap-around headlight element strictly conforming to the curved front nose corner!
 */
export function createFlushFrontStripGeometry(
  uStart: number,
  uEnd: number,
  yMin: number,
  yMax: number,
  protrude = 0.009,
  thickness = 0.016,
  cols = 10,
  rows = 5
): THREE.BufferGeometry {
  const grid: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const y = yMin + (yMax - yMin) * v;
    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const s = c / cols;
      const u = uStart + (uEnd - uStart) * s;
      row.push(frontFasciaPoint(u, y, protrude));
    }
    grid.push(row);
  }
  // c increases u (+X if uStart < uEnd), r increases y (+Y) -> (+X)x(+Y) = +Z (forward)!
  return createGridSurfaceGeometry(grid, {
    flipWinding: uEnd < uStart,
    thicknessVec: () => new THREE.Vector3(0, 0, -thickness),
  });
}

/**
 * Builds the wrap-around side wing of a headlight seamlessly extending back along the front fender!
 */
export function createHeadlightSideWingGeometry(
  side: 1 | -1,
  yMin: number,
  yMax: number,
  zRear: number,
  protrude = 0.008
): THREE.BufferGeometry {
  return createCurvedSidePanel({
    side,
    zMin: zRear,
    zMax: 2.16,
    yMin: (z) => {
      // Sleek upswept lower edge toward the fender
      const t = clamp((2.14 - z) / (2.14 - zRear), 0, 1);
      return yMin + 0.055 * t;
    },
    yMax: (z) => Math.min(yMax, hoodEdgeY(z) - 0.008),
    zMinAtY: () => zRear,
    zMaxAtY: (y) => frontCornerZ(y) + 0.004,
    xOffset: protrude,
    thickness: 0.018,
    rows: 6,
    cols: 8,
  });
}

/**
 * Builds the smoothly curved lower Rear Tailgate & Rear Bumper meeting rearCornerZ(y) identically!
 */
export function createRearTailgateGeometry(): THREE.BufferGeometry {
  const yStations = [0.21, 0.26, 0.35, 0.48, 0.64, 0.82, 0.96, 1.075];
  const cols = 26;
  const grid: THREE.Vector3[][] = [];

  for (let r = 0; r < yStations.length; r++) {
    const y = yStations[r];
    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const u = -1 + (2 * c) / cols;
      // Subtle sculpted bumper shelf protrusion around y = 0.30..0.46
      const bumperShelf = Math.exp(-Math.pow((y - 0.37) / 0.11, 2)) * 0.018 * (1 - u * u);
      row.push(rearFasciaPoint(u, y, bumperShelf));
    }
    grid.push(row);
  }

  return createGridSurfaceGeometry(grid, {
    flipWinding: true,
    thicknessVec: () => new THREE.Vector3(0, 0, 0.055),
  });
}

/**
 * Builds the curved Rear Hatch Privacy Glass strictly conforming to rearFasciaPoint(u, y).
 */
export function createRearGlassGeometry(): THREE.BufferGeometry {
  const rows = 12;
  const cols = 20;
  const yBot = 1.075;
  const yTop = 1.74;

  const grid: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const y = yBot + (yTop - yBot) * v;
    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const u = -0.89 + (1.78 * c) / cols; // tucks cleanly between left/right rear taillight pillars!
      row.push(rearFasciaPoint(u, y, -0.01));
    }
    grid.push(row);
  }

  return createGridSurfaceGeometry(grid, {
    flipWinding: true,
    thicknessVec: () => new THREE.Vector3(0, 0, 0.016),
  });
}

/**
 * Builds a flush curved vertical rear taillight strip conforming strictly to rearFasciaPoint(u, y).
 */
export function createFlushRearStripGeometry(
  uStart: number,
  uEnd: number,
  yMin: number,
  yMax: number,
  protrude = 0.008,
  thickness = 0.018,
  cols = 6,
  rows = 12
): THREE.BufferGeometry {
  const grid: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const y = yMin + (yMax - yMin) * v;
    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const s = c / cols;
      const u = uStart + (uEnd - uStart) * s;
      row.push(rearFasciaPoint(u, y, protrude));
    }
    grid.push(row);
  }
  return createGridSurfaceGeometry(grid, {
    flipWinding: uStart < uEnd,
    thicknessVec: () => new THREE.Vector3(0, 0, thickness),
  });
}

/**
 * Builds a sleek rounded rubber tire using LatheGeometry oriented along the X axle.
 */
export function createSculptedTireGeometry(
  outerR = 0.315,
  rimR = 0.205,
  width = 0.215
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rimR, -hw * 0.84),
    new THREE.Vector2(rimR + 0.035, -hw * 0.96),
    new THREE.Vector2(outerR - 0.038, -hw),
    new THREE.Vector2(outerR - 0.012, -hw * 0.91),
    new THREE.Vector2(outerR, -hw * 0.74),
    new THREE.Vector2(outerR + 0.004, 0),
    new THREE.Vector2(outerR, hw * 0.74),
    new THREE.Vector2(outerR - 0.012, hw * 0.91),
    new THREE.Vector2(outerR - 0.038, hw),
    new THREE.Vector2(rimR + 0.035, hw * 0.96),
    new THREE.Vector2(rimR, hw * 0.84),
  ];
  const geo = new THREE.LatheGeometry(pts, 36);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a sleek aerodynamic side mirror housing.
 */
export function createMirrorCapGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.08, -0.042);
  shape.quadraticCurveTo(0.06, -0.055, 0.095, -0.012);
  shape.quadraticCurveTo(0.105, 0.038, 0.045, 0.055);
  shape.quadraticCurveTo(-0.045, 0.062, -0.088, 0.025);
  shape.quadraticCurveTo(-0.1, -0.015, -0.08, -0.042);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.036,
    bevelSize: 0.024,
    bevelSegments: 5,
  });
  geo.translate(0, 0, -0.0275);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a sleek swept aerodynamic shark-fin roof antenna.
 */
export function createSharkFinGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.095, 0);
  shape.lineTo(0.095, 0);
  shape.quadraticCurveTo(0.02, 0.048, -0.072, 0.068);
  shape.quadraticCurveTo(-0.092, 0.068, -0.098, 0.045);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.008,
    bevelSegments: 3,
  });
  geo.translate(0, 0, -0.009);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a curved wheel-arch flare molding conforming cleanly to bodyOuterX(y, z).
 */
export function createWheelArchFlareGeometry(
  side: 1 | -1,
  centerZ: number,
  centerY = VEHICLE_DIMS.wheelArchCenterY,
  radius = VEHICLE_DIMS.wheelArchRadius
): THREE.BufferGeometry {
  const segs = 24;
  const rows = 4;
  const flareWidth = 0.022;
  const grid: THREE.Vector3[][] = [];

  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const rad = radius + v * flareWidth;
    const archBulge = Math.sin(v * Math.PI) * 0.014;
    const row: THREE.Vector3[] = [];

    for (let c = 0; c <= segs; c++) {
      const theta = Math.PI - (c / segs) * Math.PI;
      const z = centerZ + Math.cos(theta) * rad;
      const y = Math.max(VEHICLE_DIMS.sillBottomY, centerY + Math.sin(theta) * rad);
      const x = side * (bodyOuterX(y, z) + archBulge + 0.002);
      row.push(new THREE.Vector3(x, y, z));
    }
    grid.push(row);
  }

  return createGridSurfaceGeometry(grid, {
    flipWinding: side === 1,
    thicknessVec: () => new THREE.Vector3(-side * 0.032, 0, 0),
  });
}

/**
 * Builds a contoured rounded cushion/box geometry for handles, seats & dashboard details.
 */
export function createRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius = 0.035,
  segments = 3
): THREE.BufferGeometry {
  const r = Math.min(radius, width * 0.45, height * 0.45, depth * 0.45);
  const w = width - r * 2;
  const h = height - r * 2;
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;

  shape.moveTo(-hw, -hh - r);
  shape.lineTo(hw, -hh - r);
  shape.quadraticCurveTo(hw + r, -hh - r, hw + r, -hh);
  shape.lineTo(hw + r, hh);
  shape.quadraticCurveTo(hw + r, hh + r, hw, hh + r);
  shape.lineTo(-hw, hh + r);
  shape.quadraticCurveTo(-hw - r, hh + r, -hw - r, hh);
  shape.lineTo(-hw - r, -hh);
  shape.quadraticCurveTo(-hw - r, -hh - r, -hw, -hh - r);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.005, depth - r * 2),
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r,
    bevelSegments: segments,
  });
  geo.translate(0, 0, -(depth - r * 2) / 2);
  geo.computeVertexNormals();
  return geo;
}
