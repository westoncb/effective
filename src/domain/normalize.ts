import { instruments, isKnownInstrument, makeClipReader } from "./registry";
import type {
  AssignmentAst,
  Clip,
  CurveDef,
  CurveRef,
  Diagnostic,
  GlobalControls,
  ParamSpec,
  ParamValue,
  ProgramAst,
  Timeline,
} from "./types";

const DEFAULT_DURATION_MS = 720;
const PREVIEW_TAIL_MS = 500;

const DEFAULT_GLOBALS: GlobalControls = {
  master_gain: 0.76,
  master_drive: 0.18,
  master_reverb: 0.12,
  master_cutoff: 16000,
};

const MASTER_PARAM_MAP: Record<string, keyof GlobalControls> = {
  gain: "master_gain",
  drive: "master_drive",
  reverb: "master_reverb",
  cutoff: "master_cutoff",
  master_gain: "master_gain",
  master_drive: "master_drive",
  master_reverb: "master_reverb",
  master_cutoff: "master_cutoff",
};

const MASTER_RANGES: Record<keyof GlobalControls, [number, number]> = {
  master_gain: [0, 1.5],
  master_drive: [0, 1],
  master_reverb: [0, 1],
  master_cutoff: [40, 24000],
};

const BUILTIN_CURVES = new Set(["linear", "exp", "ease.in", "ease.out", "ease.inout"]);

export function normalizeProgram(ast: ProgramAst): Timeline {
  const diagnostics: Diagnostic[] = [];
  const durationMs = ast.duration?.ms ?? DEFAULT_DURATION_MS;
  const globals = normalizeGlobals(ast.masterAssignments, diagnostics);
  const curves = normalizeCurves(ast.curves, diagnostics);
  const seenClipIds = new Map<string, Clip>();

  if (durationMs <= 0) {
    diagnostics.push({
      message: "Program duration must be greater than zero.",
      line: ast.duration?.line ?? 1,
      column: ast.duration?.column ?? 1,
      severity: "error",
      range: ast.duration?.range,
    });
  }

  const lanes = ast.lanes.map((lane) => {
    const clips = lane.clips.flatMap((clipAst, index) => {
      if (!isKnownInstrument(clipAst.instrument)) {
        diagnostics.push({
          message: `Unknown instrument "${clipAst.instrument}".`,
          line: clipAst.line,
          column: clipAst.column,
          severity: "error",
          range: clipAst.range,
        });
        return [];
      }

      if (!clipAst.start) {
        diagnostics.push({
          message: "Clip is missing a start time like @0ms.",
          line: clipAst.line,
          column: clipAst.column,
          severity: "error",
          range: clipAst.range,
        });
        return [];
      }

      if (!clipAst.duration) {
        diagnostics.push({
          message: "Clip is missing a duration like +120ms.",
          line: clipAst.line,
          column: clipAst.column,
          severity: "error",
          range: clipAst.range,
        });
        return [];
      }

      if (clipAst.duration.ms <= 0) {
        diagnostics.push({
          message: "Clip duration must be greater than zero.",
          line: clipAst.duration.line,
          column: clipAst.duration.column,
          severity: "error",
          range: clipAst.duration.range,
        });
      }

      if (clipAst.start.ms < 0) {
        diagnostics.push({
          message: "Clip start cannot be negative.",
          line: clipAst.start.line,
          column: clipAst.start.column,
          severity: "error",
          range: clipAst.start.range,
        });
      }

      if (clipAst.start.ms > durationMs) {
        diagnostics.push({
          message: "Clip starts after the declared program duration.",
          line: clipAst.start.line,
          column: clipAst.start.column,
          severity: "error",
          range: clipAst.start.range,
        });
      }

      const instrument = instruments[clipAst.instrument];
      const params = normalizeParams(instrument.params, clipAst.assignments, curves, diagnostics);
      const stableId = clipAst.id ?? `${lane.id}-${clipAst.instrument}-${clipAst.line}-${index}`;
      const clip: Clip = {
        id: clipAst.id,
        stableId,
        instrument: clipAst.instrument,
        laneId: lane.id,
        startMs: clipAst.start.ms,
        durationMs: clipAst.duration.ms,
        params,
        line: clipAst.line,
        sourceRange: clipAst.range,
      };

      if (clipAst.id) {
        const existing = seenClipIds.get(clipAst.id);
        if (existing) {
          diagnostics.push({
            message: `Duplicate clip ID "${clipAst.id}".`,
            line: clipAst.line,
            column: clipAst.column,
            severity: "error",
            range: clipAst.range,
          });
        } else {
          seenClipIds.set(clipAst.id, clip);
        }
      }

      return [clip];
    });

    return { id: lane.id, clips };
  });

  const clips = lanes.flatMap((lane) => lane.clips);
  const latestClipEnd = clips.reduce(
    (latest, clip) => Math.max(latest, clip.startMs + clip.durationMs),
    0,
  );
  const effectiveDurationMs = Math.max(durationMs, latestClipEnd) + PREVIEW_TAIL_MS;

  if (latestClipEnd + PREVIEW_TAIL_MS > durationMs) {
    diagnostics.push({
      message: `Preview auto-extends to ${Math.round(effectiveDurationMs)}ms to include the tail.`,
      line: ast.duration?.line ?? 1,
      column: ast.duration?.column ?? 1,
      severity: "warning",
      range: ast.duration?.range,
    });
  }

  const timelineWithoutScore: Omit<Timeline, "score"> = {
    durationMs,
    effectiveDurationMs,
    tailMs: PREVIEW_TAIL_MS,
    globals,
    curves,
    lanes,
    clips,
    diagnostics,
  };

  return {
    ...timelineWithoutScore,
    score: compileTimelineToScore(timelineWithoutScore),
  };
}

export function compileTimelineToScore(timeline: Omit<Timeline, "score">): string {
  return [
    'i "InitDefaults" 0 0.01',
    `i "Master" 0 ${seconds(timeline.effectiveDurationMs)}`,
    ...compileTimelineClipEvents(timeline),
    "e",
    "",
  ].join("\n");
}

export function compileTimelineClipEvents(timeline: Omit<Timeline, "score">): string[] {
  const hasSolo = timeline.clips.some((clip) => clip.solo);
  const activeClips = timeline.clips.filter((clip) => !clip.muted && (!hasSolo || clip.solo));

  return activeClips.flatMap((clip) => {
    const event = compileClipEvent(clip, clip.startMs, timeline.curves);
    return event ? [event] : [];
  });
}

export function compileClipEvent(
  clip: Clip,
  startMs = clip.startMs,
  curves: Record<string, CurveDef> = {},
): string | undefined {
  if (!isKnownInstrument(clip.instrument)) return undefined;

  const spec = instruments[clip.instrument];
  const reader = makeClipReader(clip);
  const pfields = spec
    .compilePfields(reader, {
      curveCode: (curve) => curveCode(curve, curves) ?? 0,
    })
    .map(formatNumber);

  return [
    "i",
    `"${clip.instrument}"`,
    seconds(startMs),
    seconds(clip.durationMs),
    ...pfields,
  ].join(" ");
}

export function curveCode(curve: CurveRef, curves: Record<string, CurveDef> = {}): number | undefined {
  const resolved = resolveCurveRef(curve, curves);
  switch (resolved) {
    case "linear":
      return 0;
    case "exp":
      return 1;
    case "ease.in":
      return 2;
    case "ease.out":
      return 3;
    case "ease.inout":
      return 4;
    default:
      return undefined;
  }
}

function normalizeGlobals(assignments: AssignmentAst[], diagnostics: Diagnostic[]): GlobalControls {
  const globals = { ...DEFAULT_GLOBALS };

  assignments.forEach((assignment) => {
    const globalName = MASTER_PARAM_MAP[assignment.name];
    if (!globalName) {
      diagnostics.push({
        message: `Unknown master parameter "${assignment.name}".`,
        line: assignment.line,
        column: assignment.column,
        severity: "error",
        range: assignment.range,
      });
      return;
    }

    const value = Number(assignment.value);
    if (!Number.isFinite(value)) {
      diagnostics.push({
        message: `Master parameter "${assignment.name}" must be numeric.`,
        line: assignment.line,
        column: assignment.column,
        severity: "error",
        range: assignment.range,
      });
      return;
    }

    const [min, max] = MASTER_RANGES[globalName];
    if (value < min || value > max) {
      diagnostics.push({
        message: `${assignment.name} must be between ${min} and ${max}.`,
        line: assignment.line,
        column: assignment.column,
        severity: "error",
        range: assignment.range,
      });
      return;
    }

    globals[globalName] = value;
  });

  return globals;
}

function normalizeCurves(curves: ProgramAst["curves"], diagnostics: Diagnostic[]) {
  const normalized: Record<string, CurveDef> = {};

  curves.forEach((curve) => {
    if (normalized[curve.name]) {
      diagnostics.push({
        message: `Duplicate curve "${curve.name}".`,
        line: curve.line,
        column: curve.column,
        severity: "error",
        range: curve.range,
      });
      return;
    }
    normalized[curve.name] = curve.def;
  });

  return normalized;
}

function normalizeParams(
  specs: ParamSpec[],
  assignments: AssignmentAst[],
  curves: Record<string, CurveDef>,
  diagnostics: Diagnostic[],
): Record<string, ParamValue> {
  const params: Record<string, ParamValue> = {};
  const supplied = new Set<string>();
  let lastRampName: string | undefined;

  specs.forEach((spec) => {
    params[spec.name] =
      typeof spec.default === "number"
        ? { kind: "scalar", value: spec.default }
        : { kind: "ramp", ...spec.default };
  });

  assignments.forEach((assignment) => {
    if (assignment.name === "curve") {
      if (!lastRampName || params[lastRampName]?.kind !== "ramp") {
        diagnostics.push({
          message: "`curve=` must follow a ramp assignment in the same clip.",
          line: assignment.line,
          column: assignment.column,
          severity: "error",
          range: assignment.range,
        });
        return;
      }
      if (!isCurveKnown(assignment.value, curves)) {
        diagnostics.push({
          message: `Unknown curve reference "${assignment.value}".`,
          line: assignment.line,
          column: assignment.column,
          severity: "error",
          range: assignment.range,
        });
        return;
      }
      params[lastRampName] = {
        ...(params[lastRampName] as Extract<ParamValue, { kind: "ramp" }>),
        curve: assignment.value,
      };
      return;
    }

    const spec = specs.find(
      (item) => item.name === assignment.name || item.aliases?.includes(assignment.name),
    );
    if (!spec) {
      diagnostics.push({
        message: `Unknown parameter "${assignment.name}".`,
        line: assignment.line,
        column: assignment.column,
        severity: "error",
        range: assignment.range,
      });
      return;
    }

    supplied.add(spec.name);
    const value = parseParamValue(assignment, diagnostics);
    if (!value) return;

    if (spec.kind === "scalar" && value.kind === "ramp") {
      diagnostics.push({
        message: `${spec.name} does not accept ramps.`,
        line: assignment.line,
        column: assignment.column,
        severity: "error",
        range: assignment.range,
      });
      return;
    }

    if (spec.kind === "ramp" && value.kind === "scalar") {
      params[spec.name] = {
        kind: "ramp",
        from: value.value,
        to: value.value,
        curve: "linear",
      };
      lastRampName = spec.name;
    } else {
      params[spec.name] = value;
      lastRampName = value.kind === "ramp" ? spec.name : undefined;
    }

    checkRange(spec, params[spec.name], assignment, diagnostics);
  });

  specs.forEach((spec) => {
    if (!supplied.has(spec.name)) {
      checkRange(spec, params[spec.name], undefined, diagnostics);
    }
  });

  return params;
}

function parseParamValue(
  assignment: AssignmentAst,
  diagnostics: Diagnostic[],
): ParamValue | undefined {
  const rampMatch = assignment.value.match(/^(-?(?:\d+\.?\d*|\.\d+))->(-?(?:\d+\.?\d*|\.\d+))$/);
  if (rampMatch) {
    return {
      kind: "ramp",
      from: Number(rampMatch[1]),
      to: Number(rampMatch[2]),
      curve: "linear",
    };
  }

  const timeMatch = assignment.value.match(/^(-?(?:\d+\.?\d*|\.\d+))(ms|s)$/);
  if (timeMatch) {
    return {
      kind: "scalar",
      value: timeMatch[2] === "s" ? Number(timeMatch[1]) * 1000 : Number(timeMatch[1]),
    };
  }

  const scalar = Number(assignment.value);
  if (Number.isFinite(scalar)) {
    return { kind: "scalar", value: scalar };
  }

  diagnostics.push({
    message: `Invalid value "${assignment.value}". Use a number, time, or number->number ramp.`,
    line: assignment.line,
    column: assignment.column,
    severity: "error",
    range: assignment.range,
  });
  return undefined;
}

function checkRange(
  spec: ParamSpec,
  value: ParamValue,
  assignment: AssignmentAst | undefined,
  diagnostics: Diagnostic[],
) {
  if (spec.min === undefined && spec.max === undefined) return;

  const values = value.kind === "ramp" ? [value.from, value.to] : [value.value];
  const min = spec.min ?? -Infinity;
  const max = spec.max ?? Infinity;

  if (values.some((item) => item < min || item > max)) {
    diagnostics.push({
      message: `${spec.name} must be between ${min} and ${max}.`,
      line: assignment?.line ?? 1,
      column: assignment?.column ?? 1,
      severity: "error",
      range: assignment?.range,
    });
  }
}

function isCurveKnown(curve: CurveRef, curves: Record<string, CurveDef>) {
  return BUILTIN_CURVES.has(curve) || curve in curves;
}

function resolveCurveRef(curve: CurveRef, curves: Record<string, CurveDef>) {
  if (BUILTIN_CURVES.has(curve)) return curve;
  const def = curves[curve];
  if (!def) return curve;
  if (def.type === "linear") return "linear";
  if (def.type === "exp") return "exp";
  if (def.type === "ease") return def.shape ? `ease.${def.shape}` : "ease.inout";
  return curve;
}

function seconds(ms: number) {
  return formatNumber(ms / 1000);
}

function formatNumber(value: number) {
  if (Math.abs(value) < 0.0005) return "0";
  return Number(value.toFixed(4)).toString();
}
