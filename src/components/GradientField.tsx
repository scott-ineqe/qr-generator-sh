import { Plus, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export type GradientType = "solid" | "linear" | "radial" | "conic";

export type GradientStop = { color: string };

export type GradientValue = {
  type: GradientType;
  angle: number; // degrees, used for linear/conic
  stops: GradientStop[];
};

export function defaultGradient(color: string): GradientValue {
  return { type: "solid", angle: 90, stops: [{ color }] };
}

export function GradientField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: GradientValue;
  onChange: (v: GradientValue) => void;
}) {
  const update = (patch: Partial<GradientValue>) => onChange({ ...value, ...patch });

  const setStop = (i: number, color: string) => {
    const stops = value.stops.map((s, idx) => (idx === i ? { color } : s));
    update({ stops });
  };

  const addStop = () => {
    const last = value.stops[value.stops.length - 1]?.color ?? "#000000";
    update({ stops: [...value.stops, { color: last }] });
  };

  const removeStop = (i: number) => {
    if (value.stops.length <= 1) return;
    update({ stops: value.stops.filter((_, idx) => idx !== i) });
  };

  const onTypeChange = (t: GradientType) => {
    if (t === "solid") {
      update({ type: t, stops: [value.stops[0] ?? { color: "#000000" }] });
    } else if (value.stops.length < 2) {
      update({
        type: t,
        stops: [
          value.stops[0] ?? { color: "#000000" },
          { color: "#ffffff" },
        ],
      });
    } else {
      update({ type: t });
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Select value={value.type} onValueChange={(v) => onTypeChange(v as GradientType)}>
          <SelectTrigger className="h-7 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="linear">Linear</SelectItem>
            <SelectItem value="radial">Radial</SelectItem>
            <SelectItem value="conic">Conic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        {value.stops.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5"
          >
            <input
              type="color"
              value={s.color}
              onChange={(e) => setStop(i, e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent"
            />
            <input
              type="text"
              value={s.color}
              onChange={(e) => setStop(i, e.target.value)}
              className="w-full bg-transparent text-xs font-mono outline-none"
            />
            {value.type !== "solid" && value.stops.length > 1 && (
              <button
                type="button"
                onClick={() => removeStop(i)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove color"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}

        {value.type !== "solid" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStop}
            className="h-7 w-full gap-1 text-xs"
          >
            <Plus className="h-3 w-3" /> Add color
          </Button>
        )}
      </div>

      {(value.type === "linear" || value.type === "conic") && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Angle</Label>
            <span className="text-xs text-muted-foreground">{value.angle}°</span>
          </div>
          <Slider
            value={[value.angle]}
            min={0}
            max={360}
            step={1}
            onValueChange={(v) => update({ angle: v[0] })}
          />
        </div>
      )}
    </div>
  );
}

export function gradientPreviewCss(g: GradientValue): string {
  if (g.type === "solid" || g.stops.length < 2) {
    return g.stops[0]?.color ?? "#000";
  }
  const stops = g.stops.map((s) => s.color).join(", ");
  if (g.type === "linear") return `linear-gradient(${g.angle}deg, ${stops})`;
  if (g.type === "radial") return `radial-gradient(circle, ${stops})`;
  return `conic-gradient(from ${g.angle}deg, ${stops})`;
}

export function paintGradient(
  ctx: CanvasRenderingContext2D,
  g: GradientValue,
  size: number,
) {
  if (g.type === "solid" || g.stops.length < 2) {
    ctx.fillStyle = g.stops[0]?.color ?? "#000";
    ctx.fillRect(0, 0, size, size);
    return;
  }

  const stops = g.stops;
  const addStops = (grad: CanvasGradient) => {
    stops.forEach((s, i) => grad.addColorStop(i / (stops.length - 1), s.color));
  };

  if (g.type === "linear") {
    const rad = (g.angle * Math.PI) / 180;
    const cx = size / 2;
    const cy = size / 2;
    const half = size / 2;
    const dx = Math.cos(rad) * half;
    const dy = Math.sin(rad) * half;
    const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    addStops(grad);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  } else if (g.type === "radial") {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / Math.sqrt(2),
    );
    addStops(grad);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  } else {
    // conic - fallback for older browsers via manual sweep
    const anyCtx = ctx as unknown as {
      createConicGradient?: (angle: number, x: number, y: number) => CanvasGradient;
    };
    if (typeof anyCtx.createConicGradient === "function") {
      const grad = anyCtx.createConicGradient(
        (g.angle * Math.PI) / 180,
        size / 2,
        size / 2,
      );
      addStops(grad);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    } else {
      // Fallback: linear
      const grad = ctx.createLinearGradient(0, 0, size, size);
      addStops(grad);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
  }
}
