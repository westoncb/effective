import { Csound } from "@csound/browser";
import engineCsd from "../../starter.csd?raw";
import type { GlobalControls, Timeline } from "../domain/types";

type CsoundInstance = NonNullable<Awaited<ReturnType<typeof Csound>>>;

export type PreviewCsound = {
  csound: CsoundInstance;
  audioContext: AudioContext;
};

const DEFAULT_GLOBALS: GlobalControls = {
  master_gain: 0.76,
  master_drive: 0.18,
  master_reverb: 0.12,
  master_cutoff: 16000,
};

export async function createPreviewCsound(): Promise<PreviewCsound> {
  const audioContext = new AudioContext({
    latencyHint: "interactive",
    sampleRate: 48000,
  });

  const csound = await Csound({
    audioContext,
    inputChannelCount: 0,
    outputChannelCount: 2,
    autoConnect: true,
    useWorker: true,
    useSAB: globalThis.crossOriginIsolated,
  });

  if (!csound) throw new Error("Csound failed to initialize");

  await configureAndCompile(csound);
  await audioContext.resume();
  await csound.start();
  await applyGlobalControls(csound, DEFAULT_GLOBALS);

  return { csound, audioContext };
}

export async function previewTimeline(engine: PreviewCsound, timeline: Timeline) {
  await resetForNextPreview(engine.csound);
  await applyGlobalControls(engine.csound, timeline.globals);
  await engine.audioContext.resume();
  await engine.csound.start();
  await engine.csound.readScore(timeline.score);
}

export async function stopPreview(engine: PreviewCsound) {
  await engine.csound.stop().catch(() => undefined);
  await engine.csound.cleanup().catch(() => undefined);
  await engine.csound.reset().catch(() => undefined);
  await configureAndCompile(engine.csound);
  await applyGlobalControls(engine.csound, DEFAULT_GLOBALS);
  await engine.csound.start();
}

async function resetForNextPreview(csound: CsoundInstance) {
  await csound.stop().catch(() => undefined);
  await csound.cleanup().catch(() => undefined);
  await csound.reset().catch(() => undefined);
  await configureAndCompile(csound);
}

async function configureAndCompile(csound: CsoundInstance) {
  await csound.setOption("-d");
  await csound.setOption("-m0");
  await csound.compileCsdText(engineCsd);
}

async function applyGlobalControls(csound: CsoundInstance, globals: GlobalControls) {
  await csound.setControlChannel("js_globals_ready", 1);
  await csound.setControlChannel("master_gain", globals.master_gain);
  await csound.setControlChannel("master_drive", globals.master_drive);
  await csound.setControlChannel("master_reverb", globals.master_reverb);
  await csound.setControlChannel("master_cutoff", globals.master_cutoff);
}
