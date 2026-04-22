import QRCode from "qrcode";

export type ModuleStyle =
  | "square"
  | "rounded"
  | "dots"
  | "classy"
  | "diamond"
  | "star";

export const MODULE_STYLE_OPTIONS: { value: ModuleStyle; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "dots", label: "Dots" },
  { value: "classy", label: "Classy" },
  { value: "diamond", label: "Diamond" },
  { value: "star", label: "Star" },
];

export type EyeStyle = "square" | "rounded" | "circle" | "leaf";

export const EYE_STYLE_OPTIONS: { value: EyeStyle; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "circle", label: "Circle" },
  { value: "leaf", label: "Leaf" },
];

export type ECLevel = "L" | "M" | "Q" | "H";

export type QRMatrix = {
  size: number; // module count per side
  data: boolean[]; // length size*size
};

export async function getQRMatrix(
  text: string,
  ec: ECLevel,
): Promise<QRMatrix> {
  const qr = QRCode.create(text, { errorCorrectionLevel: ec });
  const size = qr.modules.size;
  const raw = qr.modules.data as Uint8Array;
  const data = new Array<boolean>(size * size);
  for (let i = 0; i < raw.length; i++) data[i] = raw[i] === 1;
  return { size, data };
}

const isOn = (m: QRMatrix, x: number, y: number): boolean => {
  if (x < 0 || y < 0 || x >= m.size || y >= m.size) return false;
  return m.data[y * m.size + x];
};

// The 7×7 finder patterns sit at three corners. Identify which modules are
// part of those patterns so we can render them with a distinct eye style.
const isInEye = (m: QRMatrix, x: number, y: number): boolean => {
  const s = m.size;
  // top-left
  if (x < 7 && y < 7) return true;
  // top-right
  if (x >= s - 7 && y < 7) return true;
  // bottom-left
  if (x < 7 && y >= s - 7) return true;
  return false;
};

// =====================================================================
// Canvas renderer
// =====================================================================

export type RenderOptions = {
  matrix: QRMatrix;
  pixelSize: number; // overall image size in px
  margin: number; // in module units
  moduleStyle: ModuleStyle;
  eyeStyle: EyeStyle;
};

type PathBackend = {
  rect: (x: number, y: number, w: number, h: number) => void;
  roundRect: (x: number, y: number, w: number, h: number, r: number) => void;
  circle: (cx: number, cy: number, r: number) => void;
  polygon: (points: [number, number][]) => void;
  // For eye OUTER ring (square with hole) we need a composite stroke.
  ringRoundRect: (
    x: number,
    y: number,
    w: number,
    h: number,
    rOuter: number,
    rInner: number,
    thickness: number,
  ) => void;
  ringCircle: (cx: number, cy: number, rOuter: number, thickness: number) => void;
};

const drawModule = (
  backend: PathBackend,
  style: ModuleStyle,
  m: QRMatrix,
  x: number,
  y: number,
  px: number,
  py: number,
  s: number,
) => {
  switch (style) {
    case "square":
      backend.rect(px, py, s, s);
      return;
    case "rounded": {
      // Isolated cells become circles; cells with neighbours stay square so
      // adjacent modules connect cleanly.
      const top = isOn(m, x, y - 1);
      const bottom = isOn(m, x, y + 1);
      const left = isOn(m, x - 1, y);
      const right = isOn(m, x + 1, y);
      const allOpen = !top && !bottom && !left && !right;
      if (allOpen) {
        backend.circle(px + s / 2, py + s / 2, s / 2);
      } else {
        // Soften with a roundRect when cell has only ONE neighbour.
        const neighbours = [top, bottom, left, right].filter(Boolean).length;
        if (neighbours === 1) {
          backend.roundRect(px, py, s, s, s * 0.35);
        } else {
          backend.rect(px, py, s, s);
        }
      }
      return;
    }
    case "dots":
      backend.circle(px + s / 2, py + s / 2, s * 0.45);
      return;
    case "classy": {
      // Rounded rect with moderate radius — uniform regardless of neighbors.
      backend.roundRect(px, py, s, s, s * 0.3);
      return;
    }
    case "diamond": {
      const cx = px + s / 2;
      const cy = py + s / 2;
      backend.polygon([
        [cx, py],
        [px + s, cy],
        [cx, py + s],
        [px, cy],
      ]);
      return;
    }
    case "star": {
      const cx = px + s / 2;
      const cy = py + s / 2;
      const outer = s * 0.55;
      const inner = s * 0.24;
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      backend.polygon(pts);
      return;
    }
  }
};

const drawEye = (
  backend: PathBackend,
  style: EyeStyle,
  px: number,
  py: number,
  moduleSize: number,
) => {
  const size = moduleSize * 7;
  const innerOffset = moduleSize * 2;
  const innerSize = moduleSize * 3;
  const ringThickness = moduleSize;

  switch (style) {
    case "square": {
      backend.ringRoundRect(px, py, size, size, 0, 0, ringThickness);
      backend.rect(px + innerOffset, py + innerOffset, innerSize, innerSize);
      return;
    }
    case "rounded": {
      const rOuter = size * 0.28;
      const rInner = (innerSize) * 0.3;
      backend.ringRoundRect(px, py, size, size, rOuter, rOuter * 0.6, ringThickness);
      backend.roundRect(
        px + innerOffset,
        py + innerOffset,
        innerSize,
        innerSize,
        rInner,
      );
      return;
    }
    case "circle": {
      backend.ringCircle(px + size / 2, py + size / 2, size / 2, ringThickness);
      backend.circle(px + size / 2, py + size / 2, innerSize / 2);
      return;
    }
    case "leaf": {
      // Outer: rounded with two opposite sharp corners
      const r = size * 0.4;
      backend.ringRoundRect(px, py, size, size, r, r * 0.6, ringThickness);
      // Inner: leaf — rounded with two opposite sharp corners
      const ir = innerSize * 0.45;
      backend.roundRect(
        px + innerOffset,
        py + innerOffset,
        innerSize,
        innerSize,
        ir,
      );
      return;
    }
  }
};

// ---------------------------------------------------------------------
// Canvas backend
// ---------------------------------------------------------------------

const makeCanvasBackend = (ctx: CanvasRenderingContext2D): PathBackend => ({
  rect: (x, y, w, h) => {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
  },
  roundRect: (x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    ctx.fill();
  },
  circle: (cx, cy, r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  },
  polygon: (pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
  },
  ringRoundRect: (x, y, w, h, rOuter, rInner, thickness) => {
    // Outer rounded path, then inner rounded path with reverse winding to
    // create a hole using the even-odd fill rule.
    ctx.beginPath();
    const ro = Math.min(rOuter, w / 2, h / 2);
    ctx.moveTo(x + ro, y);
    ctx.arcTo(x + w, y, x + w, y + h, ro);
    ctx.arcTo(x + w, y + h, x, y + h, ro);
    ctx.arcTo(x, y + h, x, y, ro);
    ctx.arcTo(x, y, x + w, y, ro);
    ctx.closePath();

    const ix = x + thickness;
    const iy = y + thickness;
    const iw = w - thickness * 2;
    const ih = h - thickness * 2;
    const ri = Math.min(rInner, iw / 2, ih / 2);
    // reverse direction for hole
    ctx.moveTo(ix + iw - ri, iy);
    ctx.arcTo(ix, iy, ix, iy + ih, ri);
    ctx.arcTo(ix, iy + ih, ix + iw, iy + ih, ri);
    ctx.arcTo(ix + iw, iy + ih, ix + iw, iy, ri);
    ctx.arcTo(ix + iw, iy, ix, iy, ri);
    ctx.closePath();
    ctx.fill("evenodd");
  },
  ringCircle: (cx, cy, rOuter, thickness) => {
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.arc(cx, cy, rOuter - thickness, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
  },
});

export function renderQRToCanvas(opts: RenderOptions): HTMLCanvasElement {
  const { matrix, pixelSize, margin, moduleStyle, eyeStyle } = opts;
  const canvas = document.createElement("canvas");
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";

  const total = matrix.size + margin * 2;
  const moduleSize = pixelSize / total;
  const offset = margin * moduleSize;
  const backend = makeCanvasBackend(ctx);

  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (isInEye(matrix, x, y)) continue; // drawn separately
      if (!isOn(matrix, x, y)) continue;
      drawModule(
        backend,
        moduleStyle,
        matrix,
        x,
        y,
        offset + x * moduleSize,
        offset + y * moduleSize,
        moduleSize,
      );
    }
  }

  // Eyes (3 corners)
  const eyePositions: [number, number][] = [
    [0, 0],
    [matrix.size - 7, 0],
    [0, matrix.size - 7],
  ];
  for (const [ex, ey] of eyePositions) {
    drawEye(backend, eyeStyle, offset + ex * moduleSize, offset + ey * moduleSize, moduleSize);
  }

  return canvas;
}

// ---------------------------------------------------------------------
// SVG backend — collects path data
// ---------------------------------------------------------------------

const makeSvgBackend = (paths: string[]): PathBackend => ({
  rect: (x, y, w, h) => {
    paths.push(`M${x} ${y}h${w}v${h}h${-w}z`);
  },
  roundRect: (x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    paths.push(
      `M${x + radius} ${y}h${w - 2 * radius}a${radius} ${radius} 0 0 1 ${radius} ${radius}v${h - 2 * radius}a${radius} ${radius} 0 0 1 ${-radius} ${radius}h${-(w - 2 * radius)}a${radius} ${radius} 0 0 1 ${-radius} ${-radius}v${-(h - 2 * radius)}a${radius} ${radius} 0 0 1 ${radius} ${-radius}z`,
    );
  },
  circle: (cx, cy, r) => {
    paths.push(
      `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0z`,
    );
  },
  polygon: (pts) => {
    if (pts.length === 0) return;
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += `L${pts[i][0]} ${pts[i][1]}`;
    d += "z";
    paths.push(d);
  },
  ringRoundRect: (x, y, w, h, rOuter, rInner, thickness) => {
    const ro = Math.min(rOuter, w / 2, h / 2);
    const outer = `M${x + ro} ${y}h${w - 2 * ro}a${ro} ${ro} 0 0 1 ${ro} ${ro}v${h - 2 * ro}a${ro} ${ro} 0 0 1 ${-ro} ${ro}h${-(w - 2 * ro)}a${ro} ${ro} 0 0 1 ${-ro} ${-ro}v${-(h - 2 * ro)}a${ro} ${ro} 0 0 1 ${ro} ${-ro}z`;
    const ix = x + thickness;
    const iy = y + thickness;
    const iw = w - thickness * 2;
    const ih = h - thickness * 2;
    const ri = Math.min(rInner, iw / 2, ih / 2);
    // Inner path drawn reversed so even-odd creates a hole
    const inner = `M${ix + iw - ri} ${iy}a${ri} ${ri} 0 0 0 ${ri} ${ri}v${ih - 2 * ri}a${ri} ${ri} 0 0 0 ${-ri} ${ri}h${-(iw - 2 * ri)}a${ri} ${ri} 0 0 0 ${-ri} ${-ri}v${-(ih - 2 * ri)}a${ri} ${ri} 0 0 0 ${ri} ${-ri}z`;
    paths.push(outer + inner);
  },
  ringCircle: (cx, cy, rOuter, thickness) => {
    const ri = rOuter - thickness;
    paths.push(
      `M${cx - rOuter} ${cy}a${rOuter} ${rOuter} 0 1 0 ${rOuter * 2} 0a${rOuter} ${rOuter} 0 1 0 ${-rOuter * 2} 0z` +
        `M${cx - ri} ${cy}a${ri} ${ri} 0 1 1 ${ri * 2} 0a${ri} ${ri} 0 1 1 ${-ri * 2} 0z`,
    );
  },
});

export type SvgRenderResult = {
  pathD: string;
  size: number; // viewBox side
};

export function renderQRToSvgPath(opts: RenderOptions): SvgRenderResult {
  const { matrix, margin, moduleStyle, eyeStyle } = opts;
  // Use a fixed module size of 1 for clean integer-ish coords
  const moduleSize = 1;
  const total = matrix.size + margin * 2;
  const offset = margin * moduleSize;
  const paths: string[] = [];
  const backend = makeSvgBackend(paths);

  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (isInEye(matrix, x, y)) continue;
      if (!isOn(matrix, x, y)) continue;
      drawModule(
        backend,
        moduleStyle,
        matrix,
        x,
        y,
        offset + x * moduleSize,
        offset + y * moduleSize,
        moduleSize,
      );
    }
  }

  const eyePositions: [number, number][] = [
    [0, 0],
    [matrix.size - 7, 0],
    [0, matrix.size - 7],
  ];
  for (const [ex, ey] of eyePositions) {
    drawEye(backend, eyeStyle, offset + ex * moduleSize, offset + ey * moduleSize, moduleSize);
  }

  return { pathD: paths.join(""), size: total };
}
