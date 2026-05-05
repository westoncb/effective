import type {
  CurveRef,
  InstrumentSpec,
  NormalizedClipReader,
  ParamSpec,
  ParamValue,
} from "./types";

const scalar = (
  name: string,
  defaultValue: number,
  min: number,
  max: number,
  unit: ParamSpec["unit"] = "none",
  aliases: string[] = [],
): ParamSpec => ({
  name,
  kind: "scalar",
  default: defaultValue,
  min,
  max,
  unit,
  aliases,
});

const ramp = (
  name: string,
  from: number,
  to: number,
  curve: CurveRef,
  min: number,
  max: number,
  unit: ParamSpec["unit"] = "none",
  aliases: string[] = [],
): ParamSpec => ({
  name,
  kind: "ramp",
  default: { from, to, curve },
  min,
  max,
  unit,
  aliases,
});

export const instruments = {
  SubDrop: {
    name: "SubDrop",
    family: "bass",
    params: [
      scalar("amp", 0.4, 0, 1, "amp"),
      ramp("freq", 140, 55, "exp", 20, 400, "hz"),
      scalar("drive", 0.4, 0, 1),
      scalar("pan", 0.5, 0, 1, "pan"),
    ],
    compilePfields: (clip) => [
      clip.scalar("amp"),
      clip.ramp("freq").from,
      clip.ramp("freq").to,
      clip.scalar("drive"),
      clip.scalar("pan"),
    ],
  },
  BassThump: {
    name: "BassThump",
    family: "bass",
    params: [
      scalar("amp", 0.34, 0, 1, "amp"),
      scalar("freq", 72, 20, 240, "hz"),
      scalar("punch", 0.55, 0, 1),
      scalar("drive", 0.35, 0, 1),
      scalar("pan", 0.5, 0, 1, "pan"),
    ],
    compilePfields: (clip) => [
      clip.scalar("amp"),
      clip.scalar("freq"),
      clip.scalar("punch"),
      clip.scalar("drive"),
      clip.scalar("pan"),
    ],
  },
  SoftClick: {
    name: "SoftClick",
    family: "click",
    params: [
      scalar("amp", 0.28, 0, 1, "amp"),
      scalar("bright", 0.55, 0, 1, "none", ["brightness"]),
      scalar("body", 0.4, 0, 1),
      scalar("pan", 0.5, 0, 1, "pan"),
    ],
    compilePfields: (clip) => [
      clip.scalar("amp"),
      clip.scalar("bright"),
      clip.scalar("body"),
      clip.scalar("pan"),
    ],
  },
  NoiseBurst: {
    name: "NoiseBurst",
    family: "noise",
    params: [
      scalar("amp", 0.16, 0, 1, "amp"),
      scalar("hp", 900, 20, 18000, "hz", ["hpHz"]),
      scalar("lp", 9000, 100, 24000, "hz", ["lpHz"]),
      scalar("pan", 0.5, 0, 1, "pan"),
    ],
    compilePfields: (clip) => [
      clip.scalar("amp"),
      clip.scalar("hp"),
      clip.scalar("lp"),
      clip.scalar("pan"),
    ],
  },
  Whoosh: {
    name: "Whoosh",
    family: "motion",
    params: [
      scalar("amp", 0.18, 0, 1, "amp"),
      ramp("cutoff", 900, 9000, "exp", 40, 22000, "hz"),
      scalar("pan", 0.5, 0, 1, "pan"),
    ],
    compilePfields: (clip) => [
      clip.scalar("amp"),
      clip.ramp("cutoff").from,
      clip.ramp("cutoff").to,
      clip.scalar("pan"),
    ],
  },
  GlassPing: {
    name: "GlassPing",
    family: "tone",
    params: [
      scalar("amp", 0.2, 0, 1, "amp"),
      scalar("freq", 620, 80, 6000, "hz"),
      scalar("bright", 0.25, 0, 1, "none", ["brightness"]),
      scalar("pan", 0.5, 0, 1, "pan"),
    ],
    compilePfields: (clip) => [
      clip.scalar("amp"),
      clip.scalar("freq"),
      clip.scalar("bright"),
      clip.scalar("pan"),
    ],
  },
  SoftChime: {
    name: "SoftChime",
    family: "tone",
    params: [
      scalar("amp", 0.22, 0, 1, "amp"),
      scalar("freq", 480, 80, 6000, "hz"),
      scalar("detune", 0.24, 0, 1),
      scalar("pan", 0.5, 0, 1, "pan"),
    ],
    compilePfields: (clip) => [
      clip.scalar("amp"),
      clip.scalar("freq"),
      clip.scalar("detune"),
      clip.scalar("pan"),
    ],
  },
  ErrorBuzz: {
    name: "ErrorBuzz",
    family: "system",
    params: [
      scalar("amp", 0.26, 0, 1, "amp"),
      scalar("freq", 190, 40, 2000, "hz"),
      scalar("rough", 0.7, 0, 1, "none", ["roughness"]),
      scalar("pan", 0.5, 0, 1, "pan"),
    ],
    compilePfields: (clip) => [
      clip.scalar("amp"),
      clip.scalar("freq"),
      clip.scalar("rough"),
      clip.scalar("pan"),
    ],
  },
  ComputePulse: {
    name: "ComputePulse",
    family: "system",
    params: [
      scalar("amp", 0.18, 0, 1, "amp"),
      scalar("freq", 320, 60, 2000, "hz"),
      scalar("rate", 5.5, 0.2, 30, "hz"),
      scalar("depth", 0.45, 0, 1),
      scalar("pan", 0.5, 0, 1, "pan"),
    ],
    compilePfields: (clip) => [
      clip.scalar("amp"),
      clip.scalar("freq"),
      clip.scalar("rate"),
      clip.scalar("depth"),
      clip.scalar("pan"),
    ],
  },
  AirTail: {
    name: "AirTail",
    family: "noise",
    params: [
      scalar("amp", 0.1, 0, 1, "amp"),
      scalar("bright", 0.35, 0, 1, "none", ["brightness"]),
      scalar("pan", 0.5, 0, 1, "pan"),
    ],
    compilePfields: (clip) => [
      clip.scalar("amp"),
      clip.scalar("bright"),
      clip.scalar("pan"),
    ],
  },
  ReverseSwell: {
    name: "ReverseSwell",
    family: "motion",
    params: [
      scalar("amp", 0.16, 0, 1, "amp"),
      scalar("freq", 480, 60, 4000, "hz"),
      scalar("sweep", 0.5, 0, 1),
      scalar("pan", 0.5, 0, 1, "pan"),
    ],
    compilePfields: (clip) => [
      clip.scalar("amp"),
      clip.scalar("freq"),
      clip.scalar("sweep"),
      clip.scalar("pan"),
    ],
  },
  MetalTick: {
    name: "MetalTick",
    family: "click",
    params: [
      scalar("amp", 0.12, 0, 1, "amp"),
      scalar("freq", 1150, 120, 9000, "hz"),
      scalar("hard", 0.45, 0, 1, "none", ["hardness"]),
      scalar("pan", 0.5, 0, 1, "pan"),
    ],
    compilePfields: (clip) => [
      clip.scalar("amp"),
      clip.scalar("freq"),
      clip.scalar("hard"),
      clip.scalar("pan"),
    ],
  },
} satisfies Record<string, InstrumentSpec>;

export type InstrumentName = keyof typeof instruments;

export const instrumentNames = Object.keys(instruments) as InstrumentName[];

export function isKnownInstrument(name: string): name is InstrumentName {
  return Object.prototype.hasOwnProperty.call(instruments, name);
}

export function specParamByInputName(
  spec: InstrumentSpec,
  inputName: string,
): ParamSpec | undefined {
  return spec.params.find(
    (param) => param.name === inputName || param.aliases?.includes(inputName),
  );
}

export function getScalarParam(params: Record<string, ParamValue>, name: string) {
  const param = params[name];
  return param?.kind === "scalar" ? param.value : undefined;
}

export function makeClipReader(clip: Omit<NormalizedClipReader, "scalar" | "ramp">): NormalizedClipReader {
  return {
    ...clip,
    scalar(name) {
      const param = clip.params[name];
      if (param?.kind === "scalar") return param.value;
      if (param?.kind === "ramp") return param.from;
      return 0;
    },
    ramp(name) {
      const param = clip.params[name];
      if (param?.kind === "ramp") return param;
      if (param?.kind === "scalar") {
        return { from: param.value, to: param.value, curve: "linear" };
      }
      return { from: 0, to: 0, curve: "linear" };
    },
  };
}
