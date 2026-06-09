export interface ChartPoint {
  date: string;
  netWorth: number;
}

export interface ChartLayout {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  plotW: number;
  plotH: number;
}

export interface ChartTick {
  value: number;
  y: number;
  label: string;
}

export interface ChartDateLabel {
  date: string;
  x: number;
  anchor: "start" | "middle" | "end";
}

export interface NetWorthChartGeometry {
  layout: ChartLayout;
  xAt: (index: number) => number;
  yAt: (value: number) => number;
  linePath: string;
  ticks: ChartTick[];
  xLabels: ChartDateLabel[];
  minV: number;
  maxV: number;
  domainStart: string;
  domainEnd: string;
}

export interface ChartGeometryOptions {
  /** Selected range in months (0 = all available history). */
  rangeMonths?: number;
  ytd?: boolean;
  sparse?: boolean;
}

const LAYOUT: ChartLayout = {
  width: 800,
  height: 220,
  padLeft: 4,
  padRight: 78,
  padTop: 14,
  padBottom: 30,
  plotW: 0,
  plotH: 0,
};
LAYOUT.plotW = LAYOUT.width - LAYOUT.padLeft - LAYOUT.padRight;
LAYOUT.plotH = LAYOUT.height - LAYOUT.padTop - LAYOUT.padBottom;

function compactMoney(n: number): string {
  return Math.abs(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

function parseDay(date: string): number {
  return new Date(`${date}T12:00:00`).getTime();
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function yearStart(date: string): string {
  const y = date.slice(0, 4);
  return `${y}-01-01`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function computeYDomain(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const center = (rawMin + rawMax) / 2;

  if (rawMin === rawMax) {
    const minSpan = Math.max(Math.abs(center) * 0.16, 1200);
    return { min: center - minSpan / 2, max: center + minSpan / 2 };
  }

  const span = rawMax - rawMin;
  const pad = Math.max(span * 0.08, Math.abs(center) * 0.03);
  return { min: rawMin - pad, max: rawMax + pad };
}

/** Three horizontal guides — top, middle, bottom (Fidelity-style). */
function buildYTicks(minV: number, maxV: number, yAt: (v: number) => number): ChartTick[] {
  const mid = (minV + maxV) / 2;
  return [
    { value: maxV, y: yAt(maxV), label: compactMoney(maxV) },
    { value: mid, y: yAt(mid), label: compactMoney(mid) },
    { value: minV, y: yAt(minV), label: compactMoney(minV) },
  ];
}

function computeXDomain(
  points: ChartPoint[],
  options?: ChartGeometryOptions,
): { startMs: number; endMs: number; startDate: string; endDate: string } {
  const endDate = points[points.length - 1]?.date ?? points[0].date;
  const endMs = parseDay(endDate);
  const earliestMs = parseDay(points[0].date);

  let startDate: string;
  const rangeMonths = options?.rangeMonths ?? 0;

  if (options?.ytd) {
    startDate = yearStart(endDate);
  } else if (options?.sparse && points.length < 5) {
    startDate = addDays(endDate, -21);
  } else if (rangeMonths > 0) {
    startDate = addMonths(endDate, rangeMonths);
  } else {
    startDate = points[0].date;
  }

  let startMs = parseDay(startDate);
  if (rangeMonths === 0 && !options?.sparse && !options?.ytd) {
    startMs = Math.min(startMs, earliestMs);
  }
  if (options?.sparse) {
    startMs = Math.max(startMs, earliestMs);
  }

  if (endMs <= startMs) {
    startDate = addDays(endDate, -7);
    startMs = parseDay(startDate);
  }

  return { startMs, endMs, startDate, endDate };
}

function buildLinePath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return "";
  return coords
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}

function sliceLinePath(coords: { x: number; y: number }[], start: number, end: number): string {
  return buildLinePath(coords.slice(start, end + 1));
}

export function buildNetWorthChartGeometry(
  points: ChartPoint[],
  options?: ChartGeometryOptions,
): NetWorthChartGeometry | null {
  if (points.length === 0) return null;

  const values = points.map((p) => p.netWorth);
  const { min: minV, max: maxV } = computeYDomain(values);
  const spanV = maxV - minV || 1;
  const { startMs, endMs, startDate, endDate } = computeXDomain(points, options);
  const spanMs = endMs - startMs || 1;

  const xAt = (index: number) => {
    const dateMs = parseDay(points[index].date);
    const ratio = clamp((dateMs - startMs) / spanMs, 0, 1);
    return LAYOUT.padLeft + ratio * LAYOUT.plotW;
  };

  const yAt = (value: number) =>
    LAYOUT.padTop + (1 - (value - minV) / spanV) * LAYOUT.plotH;

  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.netWorth) }));
  const linePath = buildLinePath(coords);
  const ticks = buildYTicks(minV, maxV, yAt);

  const xLabels: ChartDateLabel[] = [
    {
      date: startDate,
      x: LAYOUT.padLeft,
      anchor: "start",
    },
    {
      date: endDate,
      x: LAYOUT.padLeft + LAYOUT.plotW,
      anchor: "end",
    },
  ];

  return {
    layout: LAYOUT,
    xAt,
    yAt,
    linePath,
    ticks,
    xLabels,
    minV,
    maxV,
    domainStart: startDate,
    domainEnd: endDate,
  };
}

export function splitPathsAtIndex(
  geometry: NetWorthChartGeometry,
  points: ChartPoint[],
  splitIndex: number,
): { dashedPath: string; solidPath: string } {
  if (splitIndex <= 0 || points.length < 2) {
    return { dashedPath: "", solidPath: geometry.linePath };
  }

  const coords = points.map((p, i) => ({
    x: geometry.xAt(i),
    y: geometry.yAt(p.netWorth),
  }));

  const clamped = Math.min(splitIndex, points.length - 1);
  return {
    dashedPath: sliceLinePath(coords, 0, clamped),
    solidPath: sliceLinePath(coords, clamped, points.length - 1),
  };
}
