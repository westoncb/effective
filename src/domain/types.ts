export type Ms = number;
export type Seconds = number;

export type SourceRange = {
  start: number;
  end: number;
};

export type DiagnosticSeverity = "error" | "warning";

export type Diagnostic = {
  message: string;
  line: number;
  column: number;
  severity: DiagnosticSeverity;
  range?: SourceRange;
};

export type CurveRef =
  | "linear"
  | "exp"
  | "ease.in"
  | "ease.out"
  | "ease.inout"
  | string;

export type CurveDef = {
  type: "linear" | "exp" | "ease";
  shape?: "in" | "out" | "inout";
  tension?: number;
};

export type ParamValue =
  | { kind: "scalar"; value: number }
  | { kind: "ramp"; from: number; to: number; curve: CurveRef };

export type GlobalControls = {
  master_gain: number;
  master_drive: number;
  master_reverb: number;
  master_cutoff: number;
};

export type Clip = {
  id?: string;
  stableId: string;
  instrument: string;
  laneId: string;
  startMs: Ms;
  durationMs: Ms;
  params: Record<string, ParamValue>;
  muted?: boolean;
  solo?: boolean;
  sourceRange?: SourceRange;
  line: number;
};

export type Lane = {
  id: string;
  clips: Clip[];
};

export type Timeline = {
  durationMs: number;
  effectiveDurationMs: number;
  tailMs: number;
  globals: GlobalControls;
  curves: Record<string, CurveDef>;
  lanes: Lane[];
  clips: Clip[];
  score: string;
  diagnostics: Diagnostic[];
};

export type ParamUnit = "amp" | "hz" | "ratio" | "pan" | "ms" | "none";

export type ParamSpec = {
  name: string;
  label?: string;
  kind: "scalar" | "ramp";
  default: number | { from: number; to: number; curve: CurveRef };
  min?: number;
  max?: number;
  unit?: ParamUnit;
  aliases?: string[];
};

export type NormalizedClipReader = Clip & {
  scalar: (name: string) => number;
  ramp: (name: string) => { from: number; to: number; curve: CurveRef };
};

export type InstrumentCompileContext = {
  curveCode: (curve: CurveRef) => number;
};

export type InstrumentSpec = {
  name: string;
  family: "bass" | "click" | "tone" | "noise" | "motion" | "system";
  params: ParamSpec[];
  compilePfields: (clip: NormalizedClipReader, context: InstrumentCompileContext) => number[];
};

export type TimeAst = {
  ms: Ms;
  raw: string;
  line: number;
  column: number;
  range: SourceRange;
};

export type AssignmentAst = {
  name: string;
  value: string;
  line: number;
  column: number;
  range: SourceRange;
};

export type CurveAst = {
  name: string;
  def: CurveDef;
  line: number;
  column: number;
  range: SourceRange;
};

export type ClipAst = {
  instrument: string;
  id?: string;
  start?: TimeAst;
  duration?: TimeAst;
  assignments: AssignmentAst[];
  line: number;
  column: number;
  range: SourceRange;
};

export type LaneAst = {
  id: string;
  clips: ClipAst[];
  line: number;
  column: number;
};

export type ProgramAst = {
  duration?: TimeAst;
  masterAssignments: AssignmentAst[];
  curves: CurveAst[];
  lanes: LaneAst[];
};

export type ParseResult = {
  ast?: ProgramAst;
  diagnostics: Diagnostic[];
};
