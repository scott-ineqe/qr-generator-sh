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

export const Route = createFileRoute("/")({
  component: QRBuilder,
});

type ECLevel = "L" | "M" | "Q" | "H";

function QRBuilder() {
  const [url, setUrl] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [fgColor, setFgColor] = useState("#1a1033");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(2);
  const [ecLevel, setEcLevel] = useState<ECLevel>("M");
  const [dataUrl, setDataUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const svgRef = useRef<string>("");

  const generate = useCallback(async () => {
    if (!url.trim()) {
      toast.error("Please enter a URL first");
      return;
    }
    setIsGenerating(true);
    try {
      const opts = {
        errorCorrectionLevel: ecLevel,
        margin,
        width: size,
        color: { dark: fgColor, light: bgColor },
      };
      const png = await QRCode.toDataURL(url, opts);
      const svg = await QRCode.toString(url, { ...opts, type: "svg" });
      setDataUrl(png);
      svgRef.current = svg;
      setGeneratedUrl(url);
      toast.success("QR code generated");
    } catch (e) {
      toast.error("Failed to generate QR code");
    } finally {
      setIsGenerating(false);
    }
  }, [url, ecLevel, margin, size, fgColor, bgColor]);

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
      } else {
        const mime = format === "png" ? "image/png" : "image/jpeg";
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        if (format === "jpg") {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, size, size);
        }
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, size, size);
          downloadFile(canvas.toDataURL(mime, 0.95), `qrcode.${format}`);
        };
        img.src = dataUrl;
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
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Palette className="h-3.5 w-3.5" />
                Colors
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Foreground" value={fgColor} onChange={setFgColor} />
                <ColorField label="Background" value={bgColor} onChange={setBgColor} />
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
                Higher error correction allows the code to remain scannable even when partially
                obscured.
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
                <div className="flex aspect-square items-center justify-center rounded-2xl bg-background">
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

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-xs font-mono outline-none"
        />
      </div>
    </div>
  );
}
