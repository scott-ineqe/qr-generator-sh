import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import QRCode from "qrcode";
import {
  QrCode,
  Sparkles,
  Download,
  Palette,
  Settings2,
  Link as LinkIcon,
  ChevronDown,
  Image as ImageIcon,
  Upload,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GradientField,
  type GradientValue,
  defaultGradient,
  gradientPreviewCss,
  paintGradient,
} from "@/components/GradientField";

export const Route = createFileRoute("/")({
  component: QRBuilder,
});

type ECLevel = "L" | "M" | "Q" | "H";

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function QRBuilder() {
  const [url, setUrl] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [fg, setFg] = useState<GradientValue>(defaultGradient("#1a1033"));
  const [bg, setBg] = useState<GradientValue>(defaultGradient("#ffffff"));
  const [bgTransparent, setBgTransparent] = useState(false);
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(2);
  const [ecLevel, setEcLevel] = useState<ECLevel>("M");
  const [dataUrl, setDataUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string>("");
  const [logoScale, setLogoScale] = useState(20); // % of QR size
  const [logoPadding, setLogoPadding] = useState(true);
  const [logoRounded, setLogoRounded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<string>("");

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const handleLogoUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image is too large (max 4MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  // Auto-boost error correction when a logo is present so the QR remains scannable
  const effectiveEc: ECLevel = logoDataUrl
    ? ecLevel === "L" || ecLevel === "M"
      ? "H"
      : ecLevel
    : ecLevel;

  const drawLogoOnCanvas = useCallback(
    async (ctx: CanvasRenderingContext2D, targetSize: number) => {
      if (!logoDataUrl) return;
      const img = await loadImage(logoDataUrl);
      const logoSize = Math.round((targetSize * logoScale) / 100);
      const cx = (targetSize - logoSize) / 2;
      const cy = (targetSize - logoSize) / 2;
      const padPx = Math.round(logoSize * 0.12);
      const padSize = logoSize + padPx * 2;
      const padX = cx - padPx;
      const padY = cy - padPx;

      if (logoPadding) {
        ctx.save();
        ctx.fillStyle = "#ffffff";
        const r = logoRounded ? padSize * 0.18 : 0;
        roundedRectPath(ctx, padX, padY, padSize, padSize, r);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      if (logoRounded) {
        const r = logoSize * 0.16;
        roundedRectPath(ctx, cx, cy, logoSize, logoSize, r);
        ctx.clip();
      }
      ctx.drawImage(img, cx, cy, logoSize, logoSize);
      ctx.restore();
    },
    [logoDataUrl, logoScale, logoPadding, logoRounded],
  );

  const renderToCanvas = useCallback(
    async (targetSize: number): Promise<HTMLCanvasElement> => {
      // Render QR as black-on-transparent mask, then composite gradients.
      const maskCanvas = document.createElement("canvas");
      await QRCode.toCanvas(maskCanvas, url, {
        errorCorrectionLevel: effectiveEc,
        margin,
        width: targetSize,
        color: { dark: "#000000ff", light: "#00000000" },
      });

      const out = document.createElement("canvas");
      out.width = targetSize;
      out.height = targetSize;
      const ctx = out.getContext("2d")!;

      // Background (skip when transparent)
      if (!bgTransparent) {
        paintGradient(ctx, bg, targetSize);
      }

      // Foreground gradient masked by QR modules
      const fgCanvas = document.createElement("canvas");
      fgCanvas.width = targetSize;
      fgCanvas.height = targetSize;
      const fgCtx = fgCanvas.getContext("2d")!;
      paintGradient(fgCtx, fg, targetSize);
      fgCtx.globalCompositeOperation = "destination-in";
      fgCtx.drawImage(maskCanvas, 0, 0, targetSize, targetSize);

      ctx.drawImage(fgCanvas, 0, 0);

      // Logo on top
      await drawLogoOnCanvas(ctx, targetSize);

      return out;
    },
    [url, effectiveEc, margin, fg, bg, bgTransparent, drawLogoOnCanvas],
  );

  const buildSvg = useCallback(async (): Promise<string> => {
    // Build an SVG with gradient defs and use the QR path geometry.
    const baseSvg = await QRCode.toString(url, {
      errorCorrectionLevel: effectiveEc,
      margin,
      type: "svg",
      color: { dark: "#000000", light: "#ffffff" },
    });

    const viewBoxMatch = baseSvg.match(/viewBox="([^"]+)"/);
    const pathMatch = baseSvg.match(/<path[^>]*d="([^"]+)"[^>]*\/>/g);
    const viewBox = viewBoxMatch?.[1] ?? `0 0 ${size} ${size}`;
    const [, , vbW, vbH] = viewBox.split(" ").map(Number);

    // The qrcode lib outputs two paths: bg rect path + modules path.
    // The last path is the modules.
    const modulePath =
      pathMatch && pathMatch.length > 0
        ? pathMatch[pathMatch.length - 1].match(/d="([^"]+)"/)?.[1]
        : "";

    const gradDef = (id: string, g: GradientValue): string => {
      if (g.type === "solid" || g.stops.length < 2) {
        return "";
      }
      const stops = g.stops
        .map(
          (s, i) =>
            `<stop offset="${(i / (g.stops.length - 1)) * 100}%" stop-color="${s.color}"/>`,
        )
        .join("");
      if (g.type === "linear") {
        const rad = (g.angle * Math.PI) / 180;
        const x1 = 50 - Math.cos(rad) * 50;
        const y1 = 50 - Math.sin(rad) * 50;
        const x2 = 50 + Math.cos(rad) * 50;
        const y2 = 50 + Math.sin(rad) * 50;
        return `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`;
      }
      // SVG has no conic gradient — fall back to radial for both
      return `<radialGradient id="${id}" cx="50%" cy="50%" r="70%">${stops}</radialGradient>`;
    };

    const fgFill =
      fg.type === "solid" || fg.stops.length < 2
        ? fg.stops[0]?.color ?? "#000"
        : "url(#fgGrad)";
    const bgFill =
      bg.type === "solid" || bg.stops.length < 2
        ? bg.stops[0]?.color ?? "#fff"
        : "url(#bgGrad)";

    // Optional centered logo
    let logoSvg = "";
    let logoClipDef = "";
    if (logoDataUrl) {
      const logoSize = (vbW * logoScale) / 100;
      const cx = (vbW - logoSize) / 2;
      const cy = (vbH - logoSize) / 2;
      const padPx = logoSize * 0.12;
      const padSize = logoSize + padPx * 2;
      const padX = cx - padPx;
      const padY = cy - padPx;
      const padR = logoRounded ? padSize * 0.18 : 0;
      const logoR = logoRounded ? logoSize * 0.16 : 0;
      const padRect = logoPadding
        ? `<rect x="${padX}" y="${padY}" width="${padSize}" height="${padSize}" rx="${padR}" ry="${padR}" fill="#ffffff"/>`
        : "";
      if (logoRounded) {
        logoClipDef = `<clipPath id="logoClip"><rect x="${cx}" y="${cy}" width="${logoSize}" height="${logoSize}" rx="${logoR}" ry="${logoR}"/></clipPath>`;
      }
      const clipAttr = logoRounded ? ` clip-path="url(#logoClip)"` : "";
      logoSvg = `${padRect}<image href="${logoDataUrl}" x="${cx}" y="${cy}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"${clipAttr}/>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" shape-rendering="crispEdges" width="${size}" height="${size}">
  <defs>
    ${gradDef("fgGrad", fg)}
    ${bgTransparent ? "" : gradDef("bgGrad", bg)}
    ${logoClipDef}
  </defs>
  ${bgTransparent ? "" : `<rect width="${vbW}" height="${vbH}" fill="${bgFill}"/>`}
  ${modulePath ? `<path d="${modulePath}" fill="${fgFill}"/>` : ""}
  ${logoSvg}
</svg>`;
  }, [
    url,
    effectiveEc,
    margin,
    fg,
    bg,
    size,
    bgTransparent,
    logoDataUrl,
    logoScale,
    logoPadding,
    logoRounded,
  ]);

  const generate = useCallback(async () => {
    if (!url.trim()) {
      toast.error("Please enter a URL first");
      return;
    }
    setIsGenerating(true);
    try {
      const canvas = await renderToCanvas(size);
      const png = canvas.toDataURL("image/png");
      const svg = await buildSvg();
      setDataUrl(png);
      svgRef.current = svg;
      setGeneratedUrl(url);
      toast.success("QR code generated");
    } catch (e) {
      toast.error("Failed to generate QR code");
    } finally {
      setIsGenerating(false);
    }
  }, [url, size, renderToCanvas, buildSvg]);

  const downloadFile = (href: string, filename: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportAs = async (format: "png" | "jpg" | "svg") => {
    if (!generatedUrl) return;
    try {
      if (format === "svg") {
        const blob = new Blob([svgRef.current], { type: "image/svg+xml" });
        downloadFile(URL.createObjectURL(blob), "qrcode.svg");
      } else if (format === "png") {
        downloadFile(dataUrl, "qrcode.png");
      } else {
        // JPG: composite onto opaque background
        const canvas = await renderToCanvas(size);
        const flat = document.createElement("canvas");
        flat.width = size;
        flat.height = size;
        const fctx = flat.getContext("2d")!;
        if (bgTransparent) {
          fctx.fillStyle = "#ffffff";
          fctx.fillRect(0, 0, size, size);
        } else {
          paintGradient(fctx, bg, size);
        }
        fctx.drawImage(canvas, 0, 0);
        downloadFile(flat.toDataURL("image/jpeg", 0.95), "qrcode.jpg");
      }
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="min-h-screen bg-[image:var(--gradient-subtle)]">
      <Toaster />
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-80 shrink-0 border-r border-border bg-card/60 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-2 border-b border-border px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] shadow-[var(--shadow-elegant)]">
              <QrCode className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">QR Studio</h1>
              <p className="text-xs text-muted-foreground">Modern QR builder</p>
            </div>
          </div>

          <div className="space-y-8 p-6">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Palette className="h-3.5 w-3.5" />
                Colors
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-background/50 p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 shrink-0 rounded-md border border-border"
                    style={{ background: gradientPreviewCss(fg) }}
                  />
                  <span className="text-xs font-medium">Foreground</span>
                </div>
                <GradientField label="Fill" value={fg} onChange={setFg} />
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-background/50 p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 shrink-0 rounded-md border border-border"
                    style={
                      bgTransparent
                        ? {
                            backgroundImage:
                              "linear-gradient(45deg, oklch(0.85 0 0) 25%, transparent 25%), linear-gradient(-45deg, oklch(0.85 0 0) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, oklch(0.85 0 0) 75%), linear-gradient(-45deg, transparent 75%, oklch(0.85 0 0) 75%)",
                            backgroundSize: "8px 8px",
                            backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                          }
                        : { background: gradientPreviewCss(bg) }
                    }
                  />
                  <span className="text-xs font-medium">Background</span>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={bgTransparent}
                    onCheckedChange={(v) => setBgTransparent(v === true)}
                  />
                  <span>Transparent background</span>
                </label>
                {!bgTransparent && (
                  <GradientField label="Fill" value={bg} onChange={setBg} />
                )}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5" />
                Settings
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Size</Label>
                  <span className="text-xs text-muted-foreground">{size}px</span>
                </div>
                <Slider
                  value={[size]}
                  min={128}
                  max={1024}
                  step={32}
                  onValueChange={(v) => setSize(v[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Margin</Label>
                  <span className="text-xs text-muted-foreground">{margin}</span>
                </div>
                <Slider
                  value={[margin]}
                  min={0}
                  max={8}
                  step={1}
                  onValueChange={(v) => setMargin(v[0])}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Error correction</Label>
                <Select value={ecLevel} onValueChange={(v) => setEcLevel(v as ECLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Low (7%)</SelectItem>
                    <SelectItem value="M">Medium (15%)</SelectItem>
                    <SelectItem value="Q">Quartile (25%)</SelectItem>
                    <SelectItem value="H">High (30%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <div className="rounded-xl border border-border bg-accent/40 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-accent-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Tip
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep strong contrast between foreground and background gradients to ensure your QR
                stays scannable.
              </p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex flex-1 flex-col">
          {/* Top bar */}
          <header className="flex h-16 items-center gap-3 border-b border-border bg-background/60 px-6 backdrop-blur-xl">
            <div className="relative flex-1 max-w-2xl">
              <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="https://your-link.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generate()}
                className="pl-9 h-10"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {generatedUrl && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Download className="h-4 w-4" />
                      Export
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportAs("png")}>
                      Export as PNG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportAs("jpg")}>
                      Export as JPG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportAs("svg")}>
                      Export as SVG
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                onClick={generate}
                disabled={isGenerating}
                className="gap-2 bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-95 transition-[var(--transition-smooth)]"
              >
                <Sparkles className="h-4 w-4" />
                {isGenerating ? "Generating..." : "Generate"}
              </Button>
            </div>
          </header>

          {/* Staging */}
          <div className="flex-1 flex items-center justify-center p-10">
            <div className="w-full max-w-2xl">
              <div
                className="relative rounded-3xl border border-border bg-card p-12 shadow-[var(--shadow-soft)]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, oklch(0.5 0.05 270 / 0.08) 1px, transparent 0)",
                  backgroundSize: "20px 20px",
                }}
              >
                <div
                  className="flex aspect-square items-center justify-center rounded-2xl bg-background"
                  style={
                    bgTransparent && dataUrl
                      ? {
                          backgroundImage:
                            "linear-gradient(45deg, oklch(0.9 0 0) 25%, transparent 25%), linear-gradient(-45deg, oklch(0.9 0 0) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, oklch(0.9 0 0) 75%), linear-gradient(-45deg, transparent 75%, oklch(0.9 0 0) 75%)",
                          backgroundSize: "20px 20px",
                          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                        }
                      : undefined
                  }
                >
                  {dataUrl ? (
                    <img
                      src={dataUrl}
                      alt="Generated QR code"
                      className="h-full w-full object-contain p-6 animate-in fade-in zoom-in-95 duration-500"
                    />
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
                        <QrCode className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h2 className="text-lg font-semibold">Your QR code will appear here</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Enter a URL above and click Generate
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {generatedUrl && (
                <p className="mt-4 text-center text-xs text-muted-foreground truncate">
                  Encoding: <span className="text-foreground">{generatedUrl}</span>
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
