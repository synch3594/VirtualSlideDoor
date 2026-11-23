import * as THREE from 'three';

/**
 * Single source of truth for the minivan's parametric outer shell.
 * Realistic modern Japanese minivan proportions (~2/3 sculpted body & frame, ~1/3 greenhouse glass).
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

  /** Key vertical heights — authentic ~2:1 body-to-glass ratio */
  sillBottomY: 0.21,
  doorBottomY: 0.34,
  beltlineY: 1.15,
  windowTopY: 1.685,
  roofEdgeY: 1.755,
  roofCrownHeight: 0.085, // total roof peak ~ 1.84m

  /** Key longitudinal Z stations */
  frontBumperZ: 2.33,
  rearBumperZ: -2.30,
  cowlZ: 1.44,
  windshieldTopZ: 0.86,
  bPillarCenterZ: 0.26,
  cPillarCenterZ: -0.89,

  /** Sliding doorway opening on left side (+X) */
  doorwayFrontZ: 0.22,
  doorwayRearZ: -0.84,
} as const;

const SIDE_PROFILE_PTS: ReadonlyArray<[number, number]> = [
  [0.19, 0.742], // underbody rocker tuck
  [0.26, 0.802], // lower rocker molding
  [0.34, 0.834], // door bottom edge
  [0.50, 0.858], // sculpted lower body fullness
  [0.72, 0.856], // mid-door panel
  [0.95, 0.849], // upper door / handle zone
  [1.15, 0.836], // raised authentic beltline shoulder
  [1.32, 0.806], // lower greenhouse tumblehome
  [1.52, 0.766], // mid greenhouse tumblehome
  [1.69, 0.726], // top of window / thick roof cant rail base
  [1.76, 0.702], // roof rail shoulder
  [1.795, 0.674], // roof crown blend
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
 * Strictly 1.0 along the entire cabin & sliding-door travel zone [-1.96, +1.18].
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
 */
const FRONT_CORNER_Z_PTS: ReadonlyArray<[number, number]> = [
  [0.21, 2.06], // sculpted lower chin tuck
  [0.33, 2.135], // lower bumper corner
  [0.60, 2.165], // mid bumper corner
  [0.85, 2.145], // headlight corner level
  [0.98, 2.09], // hood nose corner
];

export function frontCornerZ(y: number): number {
  return interpPiecewise(y, FRONT_CORNER_Z_PTS);
}

/**
 * Exact shared rear bumper corner Z(y) where the rear quarter seamlessly meets the rear tailgate.
 */
const REAR_CORNER_Z_PTS: ReadonlyArray<[number, number]> = [
  [0.21, -2.105],
  [0.35, -2.165],
  [0.65, -2.18],
  [0.98, -2.172],
  [1.155, -2.16],
];

export function rearCornerZ(y: number): number {
  return interpPiecewise(y, REAR_CORNER_Z_PTS);
}

/**
 * Exact Z coordinate of the A-pillar / windshield side edge at height y in [1.14, 1.76].
 */
export function aPillarZ(y: number): number {
  const yBot = 1.15;
  const yTop = 1.76;
  const t = clamp((y - yBot) / (yTop - yBot), 0, 1);
  const zBot = 1.46;
  const zTop = 0.86;
  return zBot + (zTop - zBot) * t + 0.024 * Math.sin(t * Math.PI);
}

/**
 * Exact Z coordinate of the rear D-pillar / rear glass corner at height y in [1.15, 1.76].
 */
export function dPillarRearZ(y: number): number {
  const yBot = 1.15;
  const yTop = 1.76;
  const t = clamp((y - yBot) / (yTop - yBot), 0, 1);
  return -2.16 + 0.085 * t;
}

/**
 * Front side window modern minivan beltline curve (higher ~1.15m waist, gentle ergonomic front dip).
 */
export function frontBeltlineY(z: number): number {
  if (z <= 0.72) return 1.15;
  if (z >= 1.44) return 1.155;
  const u = (z - 0.72) / (1.44 - 0.72);
  const dip = Math.sin(u * Math.PI) * 0.028;
  return 1.15 + 0.005 * u - dip;
}

/**
 * Shared outer hood/fender top edge height Y(z) from A-pillar base (z=1.44) to nose corner (z=2.09).
 */
export function hoodEdgeY(z: number): number {
  const t = clamp((z - 1.44) / (2.09 - 1.44), 0, 1);
  // Sleek sculpted minivan hood sloping from 1.155m at cowl down to 0.975m at nose corner
  return 1.155 - 0.075 * t - 0.105 * t * t;
}

/**
 * Longitudinal roof edge height along Z (from windshield header z=0.86 to rear spoiler z=-2.25).
 */
export function roofEdgeYAtZ(z: number): number {
  if (z > 0.52) {
    const t = clamp((z - 0.52) / (0.86 - 0.52), 0, 1);
    return 1.764 - 0.02 * t * t;
  }
  if (z < -1.85) {
    const t = clamp((-1.85 - z) / (2.25 - 1.85), 0, 1);
    return 1.76 - 0.022 * t * t;
  }
  const u = (z + 0.65) / 1.2;
  return 1.764 + 0.004 * Math.max(0, 1 - u * u);
}

/**
 * Transverse roof crown arch for normalized lateral coordinate u in [-1, 1].
 */
export function roofCrownAtU(u: number, z: number): number {
  const base = roofEdgeYAtZ(z);
  const absU = clamp(Math.abs(u), 0, 1);
  const crown = VEHICLE_DIMS.roofCrownHeight * Math.pow(Math.cos(absU * (Math.PI / 2)), 0.88);
  const frontScale = z > 0.62 ? 1 - 0.25 * clamp((z - 0.62) / 0.26, 0, 1) : 1;
  const rearScale = z < -2.02 ? 1 - 0.35 * clamp((-2.02 - z) / 0.23, 0, 1) : 1;
  return base + crown * frontScale * rearScale;
}

/**
 * Front windshield horizontal bow (curvature in Z as a function of lateral u in [-1, 1]).
 */
export function windshieldBowZ(u: number, y: number): number {
  const t = clamp((y - 1.15) / (1.76 - 1.15), 0, 1);
  const bowAmp = 0.068 - 0.016 * t;
  return aPillarZ(y) + bowAmp * (1 - u * u);
}

/**
 * Front fascia surface point (x, y, z) for u in [-1, 1] and height y in [0.21, 0.98].
 */
export function frontFasciaPoint(u: number, y: number, zProtrude = 0): THREE.Vector3 {
  const absU = clamp(Math.abs(u), 0, 1);
  const cornerZ = frontCornerZ(y);
  const bowAtY =
    y < 0.33
      ? 0.175
      : y < 0.74
        ? 0.165
        : 0.165 - 0.03 * smoothstep(0.74, 0.98, y);
  const wrapProfile = 1 - Math.pow(absU, 2.45);
  const z = cornerZ + bowAtY * wrapProfile + zProtrude;
  const halfW = bodyOuterX(Math.min(y, 1.15), cornerZ);
  return new THREE.Vector3(u * halfW, y, z);
}

/**
 * Rear hatch/tailgate surface point (x, y, z) for u in [-1, 1] and height y in [0.21, 1.75].
 */
export function rearFasciaPoint(u: number, y: number, zProtrude = 0): THREE.Vector3 {
  const absU = clamp(Math.abs(u), 0, 1);
  const cornerZ = y <= 1.155 ? rearCornerZ(y) : dPillarRearZ(y);
  const bowAmp = y <= 1.155 ? 0.125 : 0.125 - 0.03 * smoothstep(1.155, 1.75, y);
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
        let creaseMask = 1.0;
        if (wheelArch) {
          const dArch = Math.abs(z - wheelArch.centerZ) - wheelArch.radius;
          creaseMask = smoothstep(0.0, 0.18, dArch);
        }
        const lowerRidge = Math.exp(-Math.pow((y - 0.48) / 0.048, 2)) * 0.0085 * creaseMask;
        const upperCrease = Math.exp(-Math.pow((y - 1.02) / 0.038, 2)) * 0.0045;
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
 * Builds the smoothly curved, arched 3D Roof Shell from the windshield header (z=0.86)
 * to the integrated rear roof spoiler (z=-2.25).
 */
export function createSculptedRoofGeometry(): THREE.BufferGeometry {
  const zStations = [
    -2.25, -2.19, -2.1, -1.94, -1.65, -1.25, -0.75, -0.25, 0.25, 0.56, 0.72, 0.82, 0.86,
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
        const frontBlend = smoothstep(0.45, 0.86, zBase);
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
      const edgeTaper = r === 0 || r === zStations.length - 1 ? 0.022 : 0.044;
      return new THREE.Vector3(0, -edgeTaper, 0);
    },
  });
}

/**
 * Builds the curved front windshield glass with realistic frame margins (wider A-pillars & roof brow!).
 */
export function createCurvedWindshieldGeometry(inset = 0.014, marginX = 0.052): THREE.BufferGeometry {
  const rows = 14;
  const cols = 20;
  const yBot = 1.155;
  const yTop = 1.715;

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
 * Builds the solid curved upper windshield header / roof brow seamlessly bridging
 * the top of the windshield (y=1.71) up into the arched roof edge (y=1.76).
 */
export function createWindshieldHeaderGeometry(): THREE.BufferGeometry {
  const rows = 5;
  const cols = 20;
  const yBot = 1.705;
  const yTop = 1.762;

  const grid: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const y = yBot + (yTop - yBot) * v;
    const zEdge = aPillarZ(y);
    const halfW = bodyOuterX(y, zEdge) + 0.002;

    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const u = -1 + (2 * c) / cols;
      const x = u * halfW;
      const z = windshieldBowZ(u, y) + 0.002;
      row.push(new THREE.Vector3(x, y, z));
    }
    grid.push(row);
  }

  return createGridSurfaceGeometry(grid, {
    flipWinding: false,
    thicknessVec: () => new THREE.Vector3(0, -0.015, -0.03),
  });
}

/**
 * Builds a substantial, realistic sculpted A-pillar wrapping from windshield to side window.
 */
export function createAPillarGeometry(side: 1 | -1): THREE.BufferGeometry {
  const rows = 16;
  const cols = 7;
  const yBot = 1.15;
  const yTop = 1.765;

  const grid: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const y = yBot + (yTop - yBot) * v;
    const zEdge = aPillarZ(y);
    const outerX = bodyOuterX(y, zEdge) + 0.003;
    // More substantial real-car A-pillar width (9.2cm at base tapering to 7.6cm at roof)
    const pillarW = 0.092 - 0.016 * v;

    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const s = c / cols;
      const angle = s * (Math.PI * 0.56);
      const x = side * (outerX - pillarW * (1 - Math.sin(angle)) * 0.72);
      const z = zEdge + 0.018 * Math.cos(angle) - pillarW * s * 0.68;
      row.push(new THREE.Vector3(x, y, z));
    }
    grid.push(row);
  }

  return createGridSurfaceGeometry(grid, {
    flipWinding: side === -1,
    thicknessVec: () => new THREE.Vector3(-side * 0.044, 0, -0.038),
  });
}

/**
 * Builds the smoothly sculpted Front Hood + Wrap-Around Nose Fascia + Front Bumper.
 */
export function createFrontNoseGeometry(): THREE.BufferGeometry {
  const cols = 28;
  const grid: THREE.Vector3[][] = [];

  const hoodZStations = [1.44, 1.62, 1.82, 1.98, 2.09];
  for (let r = 0; r < hoodZStations.length; r++) {
    const zEdge = hoodZStations[r];
    const t = clamp((zEdge - 1.44) / (2.09 - 1.44), 0, 1);
    const yEdge = hoodEdgeY(zEdge);
    const halfW = bodyOuterX(yEdge, zEdge);
    const bowZ = 0.025 + 0.115 * Math.pow(t, 1.5);
    const crown = 0.028 + 0.02 * Math.sin(t * Math.PI * 0.85);

    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const u = -1 + (2 * c) / cols;
      const absU = Math.abs(u);
      const wrap = 1 - Math.pow(absU, 2.45);
      const z = zEdge + bowZ * wrap;
      const ridge = Math.exp(-Math.pow((absU - 0.6) / 0.14, 2)) * 0.009 * (1 - 0.3 * t);
      const y = yEdge + crown * (1 - u * u) + ridge;
      row.push(new THREE.Vector3(u * halfW, y, z));
    }
    grid.push(row);
  }

  const fasciaYs = [0.935, 0.855, 0.74, 0.59, 0.44, 0.32, 0.25, 0.21];
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
 * Builds a sleek, flush front fascia element strictly conforming to the curved front nose,
 * supporting trapezoidal/tapered u-bounds via optional functions `uStartFn(v)` / `uEndFn(v)`!
 */
export function createFlushFrontStripGeometry(
  uStart: number | ((v: number) => number),
  uEnd: number | ((v: number) => number),
  yMin: number,
  yMax: number,
  protrude = 0.009,
  thickness = 0.016,
  cols = 10,
  rows = 5
): THREE.BufferGeometry {
  const evalU0 = (v: number) => (typeof uStart === 'function' ? uStart(v) : uStart);
  const evalU1 = (v: number) => (typeof uEnd === 'function' ? uEnd(v) : uEnd);

  const grid: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const y = yMin + (yMax - yMin) * v;
    const u0 = evalU0(v);
    const u1 = evalU1(v);
    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const s = c / cols;
      const u = u0 + (u1 - u0) * s;
      row.push(frontFasciaPoint(u, y, protrude));
    }
    grid.push(row);
  }
  const flip = evalU1(0.5) < evalU0(0.5);
  return createGridSurfaceGeometry(grid, {
    flipWinding: flip,
    thicknessVec: () => new THREE.Vector3(0, 0, -thickness),
  });
}

/**
 * Builds a 3D parametric modern minivan grille matrix of staggered diamond-cut metallic studs/blocks
 * floating over the curved front grille mesh (inspired by modern Alphard / Noah / Serena!).
 */
export function createParametricGrilleStudsGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let vertOffset = 0;

  const yMin = 0.505;
  const yMax = 0.865;
  const numRows = 6;

  for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
    const vCenter = (rowIdx + 0.5) / numRows;
    const yCenter = yMin + (yMax - yMin) * vCenter;
    // Trapezoidal grille width: wider near headlights at top, slightly narrower near lower bumper
    const maxU = 0.51 + 0.14 * vCenter;
    const colsInRow = rowIdx % 2 === 0 ? 11 : 10;
    const halfH = 0.016;

    for (let colIdx = 0; colIdx < colsInRow; colIdx++) {
      const t = (colIdx + 0.5) / colsInRow; // 0..1
      const uCenter = -maxU + 2 * maxU * t;

      // Leave a clean symmetric circular bay for the center chrome emblem
      const emblemDist = Math.hypot(uCenter / 0.145, (yCenter - 0.745) / 0.082);
      if (emblemDist < 1.0) continue;

      const halfU = (maxU / colsInRow) * 0.62;
      const protrudeBase = 0.011;
      const protrudeTip = 0.022;

      // 4 back-base corners + 4 smaller bevelled front-face corners = crisp 3D faceted jewel block!
      const bBL = frontFasciaPoint(uCenter - halfU, yCenter - halfH, protrudeBase);
      const bBR = frontFasciaPoint(uCenter + halfU, yCenter - halfH, protrudeBase);
      const bTR = frontFasciaPoint(uCenter + halfU, yCenter + halfH, protrudeBase);
      const bTL = frontFasciaPoint(uCenter - halfU, yCenter + halfH, protrudeBase);

      // Slight chevron tilt outward for dynamic modern styling
      const slant = Math.sign(uCenter) * 0.005;
      const fBL = frontFasciaPoint(uCenter - halfU * 0.68, yCenter - halfH * 0.62 + slant, protrudeTip);
      const fBR = frontFasciaPoint(uCenter + halfU * 0.68, yCenter - halfH * 0.62 - slant, protrudeTip);
      const fTR = frontFasciaPoint(uCenter + halfU * 0.68, yCenter + halfH * 0.62 - slant, protrudeTip);
      const fTL = frontFasciaPoint(uCenter - halfU * 0.68, yCenter + halfH * 0.62 + slant, protrudeTip);

      const verts = [bBL, bBR, bTR, bTL, fBL, fBR, fTR, fTL];
      for (const p of verts) positions.push(p.x, p.y, p.z);

      const o = vertOffset;
      // Front face (4,5,6,7)
      indices.push(o + 4, o + 5, o + 6, o + 4, o + 6, o + 7);
      // Bottom bevel (0,1,5,4)
      indices.push(o + 0, o + 1, o + 5, o + 0, o + 5, o + 4);
      // Top bevel (7,6,2,3)
      indices.push(o + 7, o + 6, o + 2, o + 7, o + 2, o + 3);
      // Left bevel (0,4,7,3)
      indices.push(o + 0, o + 4, o + 7, o + 0, o + 7, o + 3);
      // Right bevel (5,1,2,6)
      indices.push(o + 5, o + 1, o + 2, o + 5, o + 2, o + 6);

      vertOffset += 8;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  // Use non-indexed for crisp faceted jewel-block specular highlights!
  const faceted = geo.toNonIndexed();
  faceted.computeVertexNormals();
  geo.dispose();
  return faceted;
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
 * Builds the smoothly curved lower Rear Tailgate & Rear Bumper (raised beltline y = 1.155!).
 */
export function createRearTailgateGeometry(): THREE.BufferGeometry {
  const yStations = [0.21, 0.26, 0.36, 0.50, 0.68, 0.88, 1.04, 1.155];
  const cols = 26;
  const grid: THREE.Vector3[][] = [];

  for (let r = 0; r < yStations.length; r++) {
    const y = yStations[r];
    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const u = -1 + (2 * c) / cols;
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
 * Builds the curved Rear Hatch Privacy Glass with realistic smaller proportion & thicker framing.
 */
export function createRearGlassGeometry(): THREE.BufferGeometry {
  const rows = 12;
  const cols = 20;
  const yBot = 1.17;
  const yTop = 1.68;

  const grid: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const y = yBot + (yTop - yBot) * v;
    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) {
      const u = -0.82 + (1.64 * c) / cols; // wider D-pillar & taillight frame on left & right!
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
 * Builds a flush curved rear tailgate/taillight/frame strip conforming strictly to rearFasciaPoint(u, y).
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
  rimR = 0.208,
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
 * Builds a modern geometric diamond-cut alloy wheel spoke blade (extruded angular Y-boomerang facet).
 * Oriented in the Y-Z wheel plane (extruded along X) so 5 radial instances form an intricate geometric web!
 */
export function createGeometricSpokeGeometry(variant: 'machined' | 'accent'): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  if (variant === 'machined') {
    // Crisp asymmetrical diamond-cut Y-blade with geometric kink (modern EV / luxury minivan alloy look)
    shape.moveTo(-0.016, 0.044);
    shape.lineTo(0.014, 0.044);
    shape.lineTo(0.022, 0.118);
    shape.lineTo(0.068, 0.194);
    shape.lineTo(0.045, 0.201);
    shape.lineTo(0.006, 0.138);
    shape.lineTo(-0.038, 0.201);
    shape.lineTo(-0.056, 0.193);
    shape.lineTo(-0.016, 0.122);
    shape.closePath();
  } else {
    // Secondary recessed geometric triangular aero fin between main Y-spokes
    shape.moveTo(0.022, 0.062);
    shape.lineTo(0.048, 0.088);
    shape.lineTo(0.095, 0.174);
    shape.lineTo(0.072, 0.184);
    shape.lineTo(0.028, 0.115);
    shape.closePath();
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.0025,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -0.006);
  // Rotate so shape (X, Y) lies in wheel's (Z, Y) plane and depth lies along wheel axle X!
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a sleek aerodynamic side mirror housing.
 */
export function createMirrorCapGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.082, -0.04);
  shape.quadraticCurveTo(0.058, -0.052, 0.098, -0.01);
  shape.quadraticCurveTo(0.106, 0.036, 0.046, 0.054);
  shape.quadraticCurveTo(-0.045, 0.06, -0.088, 0.024);
  shape.quadraticCurveTo(-0.102, -0.014, -0.082, -0.04);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.052,
    bevelEnabled: true,
    bevelThickness: 0.034,
    bevelSize: 0.022,
    bevelSegments: 5,
  });
  geo.translate(0, 0, -0.026);
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
