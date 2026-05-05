import { Csound } from "@csound/browser";
import engineCsd from "../../starter.csd?raw";
import { compileClipEvent } from "../domain/normalize";
import type { Clip, GlobalControls, Timeline } from "../domain/types";

type CsoundInstance = NonNullable<Awaited<ReturnType<typeof Csound>>>;
type EnginePhase = "running" | "stopped";

export type PreviewCsound = {
  csound: CsoundInstance;
  audioContext: AudioContext;
  phase: EnginePhase;
  operation: Promise<void>;
  previewTimers: number[];
  onPreviewEnded?: () => void;
};

const DEFAULT_GLOBALS: GlobalControls = {
  master_gain: 0.76,
  master_drive: 0.18,
  master_reverb: 0.12,
  master_cutoff: 16000,
};

export async function createPreviewCsound(onPreviewEnded?: () => void): Promise<PreviewCsound> {
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
  await applyGlobalControls(csound, DEFAULT_GLOBALS);
  await csound.start();

  const engine: PreviewCsound = {
    csound,
    audioContext,
    phase: "running",
    operation: Promise.resolve(),
    previewTimers: [],
    onPreviewEnded,
  };

  csound.on("realtimePerformanceEnded", () => {
    engine.phase = "stopped";
  });

  return engine;
}

export async function previewTimeline(engine: PreviewCsound, timeline: Timeline) {
  return enqueue(engine, async () => {
    clearPreviewTimer(engine);
    await prepareRunningEngine(engine, timeline.globals);

    for (const clip of activeClips(timeline)) {
      if (clip.startMs <= 0) {
        const event = compileClipEvent(clip, 0, timeline.curves);
        if (event) await engine.csound.inputMessage(event);
      } else {
        const timer = window.setTimeout(() => {
          const event = compileClipEvent(clip, 0, timeline.curves);
          if (event) void engine.csound.inputMessage(event);
        }, clip.startMs);
        engine.previewTimers.push(timer);
      }
    }

    const endTimer = window.setTimeout(() => {
      engine.previewTimers = engine.previewTimers.filter((timer) => timer !== endTimer);
      engine.onPreviewEnded?.();
    }, timeline.effectiveDurationMs);
    engine.previewTimers.push(endTimer);
  });
}

export async function previewClip(engine: PreviewCsound, timeline: Timeline, clip: Clip) {
  return enqueue(engine, async () => {
    clearPreviewTimer(engine);
    await prepareRunningEngine(engine, timeline.globals);

    const event = compileClipEvent(clip, 0, timeline.curves);
    if (event) {
      await engine.csound.inputMessage(event);
    }

    const endTimer = window.setTimeout(() => {
      engine.previewTimers = engine.previewTimers.filter((timer) => timer !== endTimer);
      engine.onPreviewEnded?.();
    }, clip.durationMs + timeline.tailMs);
    engine.previewTimers.push(endTimer);
  });
}

export async function stopPreview(engine: PreviewCsound) {
  return enqueue(engine, async () => {
    clearPreviewTimer(engine);
    await engine.csound.setControlChannel("preview_active", 0);
    await engine.csound.setControlChannel("master_gain", 0);
    engine.onPreviewEnded?.();
  });
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

async function prepareRunningEngine(engine: PreviewCsound, globals: GlobalControls) {
  await engine.audioContext.resume();

  if (engine.phase !== "running") {
    await engine.csound.start();
    engine.phase = "running";
  }

  await engine.csound.setControlChannel("preview_active", 0);
  await delay(25);
  await applyGlobalControls(engine.csound, globals);
  await engine.csound.setControlChannel("preview_active", 1);
}

function enqueue(engine: PreviewCsound, task: () => Promise<void>) {
  const next = engine.operation
    .catch(() => undefined)
    .then(task);

  engine.operation = next.catch(() => undefined);
  return next;
}

function clearPreviewTimer(engine: PreviewCsound) {
  engine.previewTimers.forEach((timer) => window.clearTimeout(timer));
  engine.previewTimers = [];
}

function activeClips(timeline: Timeline) {
  const hasSolo = timeline.clips.some((clip) => clip.solo);
  return timeline.clips.filter((clip) => !clip.muted && (!hasSolo || clip.solo));
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
