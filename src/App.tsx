import { useEffect, useMemo, useRef, useState } from "react";
import {
  createPreviewCsound,
  previewClip,
  previewTimeline,
  stopPreview,
  type PreviewCsound,
} from "./audio/csound";
import {
  duplicateClipLine,
  nudgeNumberAt,
  setClipFlagForRanges,
  toggleClipFlagAt,
  toggleCommentForLine,
  type ClipFlag,
  type TextEdit,
} from "./editor/textTransforms";
import { defaultPreset, presets, type PresetProgram } from "./domain/presets";
import { buildProgram, type ProgramResult } from "./domain/program";
import { instruments } from "./domain/registry";
import type { Clip, Diagnostic, ParamSpec, ParamValue, Timeline } from "./domain/types";
import "./styles.css";

const INITIAL_SOURCE = defaultPreset.source;

type AudioState =
  | { status: "uninitialized" }
  | { status: "starting" }
  | { status: "ready" }
  | { status: "playing" }
  | { status: "error"; error: string };

type Selection = {
  clipId?: string;
  sourceCursor: number;
};

export default function App() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const engineRef = useRef<PreviewCsound | null>(null);
  const [source, setSource] = useState(INITIAL_SOURCE);
  const [program, setProgram] = useState<ProgramResult>(() => buildProgram(INITIAL_SOURCE));
  const [lastValidTimeline, setLastValidTimeline] = useState<Timeline | undefined>(
    () => buildProgram(INITIAL_SOURCE).timeline,
  );
  const [audio, setAudio] = useState<AudioState>({ status: "uninitialized" });
  const [selection, setSelection] = useState<Selection>({ sourceCursor: 0 });
  const [activePresetId, setActivePresetId] = useState<string>(defaultPreset.id);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = buildProgram(source);
      setProgram(next);
      if (next.timeline) setLastValidTimeline(next.timeline);
    }, 140);

    return () => window.clearTimeout(handle);
  }, [source]);

  const activeTimeline = program.timeline ?? lastValidTimeline;
  const selectedClip = useMemo(
    () => activeTimeline?.clips.find((clip) => clip.stableId === selection.clipId),
    [activeTimeline, selection.clipId],
  );

  async function preview() {
    if (!activeTimeline) return;

    try {
      const engine = await getAudioEngine();
      setAudio({ status: "playing" });
      await previewTimeline(engine, activeTimeline);
    } catch (error) {
      setAudio({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function previewSingleClip(clip: Clip) {
    if (!activeTimeline) return;

    try {
      const engine = await getAudioEngine();
      setAudio({ status: "playing" });
      await previewClip(engine, activeTimeline, clip);
    } catch (error) {
      setAudio({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function getAudioEngine() {
    if (engineRef.current) return engineRef.current;

    setAudio({ status: "starting" });
    const engine = await createPreviewCsound(() => setAudio({ status: "ready" }));
    engineRef.current = engine;
    return engine;
  }

  async function stop() {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      await stopPreview(engine);
      setAudio({ status: "ready" });
    } catch (error) {
      setAudio({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function applyTextEdit(edit: TextEdit) {
    setSource(edit.source);
    setActivePresetId("custom");
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(edit.selectionStart, edit.selectionEnd);
      updateSelection(edit.selectionStart);
    });
  }

  function loadPreset(preset: PresetProgram) {
    const next = buildProgram(preset.source);
    setSource(preset.source);
    setProgram(next);
    if (next.timeline) setLastValidTimeline(next.timeline);
    setSelection({ sourceCursor: 0 });
    setActivePresetId(preset.id);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(0, 0);
    });
  }

  function updateSelection(cursor: number) {
    const clip = activeTimeline?.clips.find(
      (item) => item.sourceRange && cursor >= item.sourceRange.start && cursor <= item.sourceRange.end,
    );
    setSelection({ sourceCursor: cursor, clipId: clip?.stableId });
  }

  function selectClip(clip: Clip) {
    setSelection({ sourceCursor: clip.sourceRange?.start ?? 0, clipId: clip.stableId });
    window.requestAnimationFrame(() => {
      if (clip.sourceRange) {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(clip.sourceRange.start, clip.sourceRange.end);
      }
    });
  }

  function toggleSelectedClipFlag(flag: ClipFlag) {
    const cursor = selectedClip?.sourceRange?.start ?? selection.sourceCursor;
    const edit = toggleClipFlagAt(source, cursor, flag);
    if (edit) applyTextEdit(edit);
  }

  function toggleLaneFlag(laneId: string, flag: ClipFlag) {
    const lane = activeTimeline?.lanes.find((item) => item.id === laneId);
    if (!lane) return;

    const clipsWithSource = lane.clips.filter((clip) => clip.sourceRange);
    const shouldEnable = flag === "mute"
      ? clipsWithSource.some((clip) => !clip.muted)
      : clipsWithSource.some((clip) => !clip.solo);
    const edit = setClipFlagForRanges(
      source,
      clipsWithSource.map((clip) => clip.sourceRange!),
      flag,
      shouldEnable,
    );
    if (edit) applyTextEdit(edit);
  }

  function onEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    const cursor = target.selectionStart;

    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void preview();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      void stop();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
      const edit = duplicateClipLine(source, cursor);
      if (edit) {
        event.preventDefault();
        applyTextEdit(edit);
      }
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "/") {
      event.preventDefault();
      const edit = toggleClipFlagAt(source, selectedClip?.sourceRange?.start ?? cursor, "mute");
      if (edit) {
        applyTextEdit(edit);
      } else {
        applyTextEdit(toggleCommentForLine(source, cursor));
      }
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const direction = event.key === "ArrowUp" ? 1 : -1;
      const multiplier = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
      const edit = nudgeNumberAt(source, cursor, direction, multiplier);
      if (edit) {
        event.preventDefault();
        applyTextEdit(edit);
      }
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">E</span>
          <span>Effect</span>
        </div>
        <div className="topbar-actions">
          <button className="primary" onClick={preview} disabled={audio.status === "starting"}>
            {audio.status === "starting" ? "Starting..." : "Preview"}
          </button>
          <button onClick={stop} disabled={audio.status !== "playing"}>Stop</button>
          <StatusPill label={program.status} tone={program.status === "valid" ? "good" : "bad"} />
          <StatusPill label={audio.status} tone={audio.status === "error" ? "bad" : "neutral"} />
        </div>
      </header>

      <PresetGallery activePresetId={activePresetId} onLoadPreset={loadPreset} />

      <section className="workspace">
        <section className="editor-panel" aria-label="Program editor">
          <textarea
            ref={textareaRef}
            value={source}
            spellCheck={false}
            onChange={(event) => {
              setSource(event.target.value);
              setActivePresetId("custom");
            }}
            onKeyDown={onEditorKeyDown}
            onSelect={(event) => updateSelection(event.currentTarget.selectionStart)}
          />
          <Diagnostics diagnostics={program.diagnostics} audio={audio} />
        </section>

        <section className="timeline-panel" aria-label="Timeline">
          {activeTimeline ? (
            <TimelineView
              timeline={activeTimeline}
              selectedClipId={selection.clipId}
              onSelectClip={selectClip}
              onAuditionClip={(clip) => void previewSingleClip(clip)}
              onToggleLaneFlag={toggleLaneFlag}
            />
          ) : (
            <div className="empty-state">No valid timeline</div>
          )}
        </section>

        <aside className="inspector" aria-label="Inspector">
          <Inspector
            clip={selectedClip}
            timeline={activeTimeline}
            onPreviewClip={(clip) => void previewSingleClip(clip)}
            onToggleClipFlag={toggleSelectedClipFlag}
          />
        </aside>
      </section>

      <section className="meter-panel" aria-label="Preview analysis">
        {activeTimeline ? <WaveformPreview timeline={activeTimeline} /> : null}
      </section>
    </main>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "good" | "bad" | "neutral" }) {
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

function PresetGallery({
  activePresetId,
  onLoadPreset,
}: {
  activePresetId: string;
  onLoadPreset: (preset: PresetProgram) => void;
}) {
  return (
    <section className="preset-gallery" aria-label="Preset gallery">
      {presets.map((preset) => (
        <button
          className={activePresetId === preset.id ? "active" : ""}
          key={preset.id}
          onClick={() => onLoadPreset(preset)}
          type="button"
        >
          {preset.name}
        </button>
      ))}
    </section>
  );
}

function Diagnostics({ diagnostics, audio }: { diagnostics: Diagnostic[]; audio: AudioState }) {
  const visible = diagnostics.slice(0, 4);
  return (
    <div className="diagnostics">
      {audio.status === "error" ? <div className="diag error">{audio.error}</div> : null}
      {visible.map((diagnostic, index) => (
        <div className={`diag ${diagnostic.severity}`} key={`${diagnostic.line}-${diagnostic.column}-${index}`}>
          <span>{diagnostic.severity}</span>
          <span>{diagnostic.line}:{diagnostic.column}</span>
          <span>{diagnostic.message}</span>
        </div>
      ))}
    </div>
  );
}

function TimelineView({
  timeline,
  selectedClipId,
  onSelectClip,
  onAuditionClip,
  onToggleLaneFlag,
}: {
  timeline: Timeline;
  selectedClipId?: string;
  onSelectClip: (clip: Clip) => void;
  onAuditionClip: (clip: Clip) => void;
  onToggleLaneFlag: (laneId: string, flag: ClipFlag) => void;
}) {
  const scaleMs = Math.max(timeline.durationMs, timeline.effectiveDurationMs - timeline.tailMs);
  const ticks = makeTicks(scaleMs);

  return (
    <div className="timeline">
      <div className="timeline-ruler">
        {ticks.map((tick) => (
          <span key={tick} style={{ left: `${(tick / scaleMs) * 100}%` }}>{tick}ms</span>
        ))}
      </div>
      <div className="lanes">
        {timeline.lanes.map((lane) => {
          const isMuted = lane.clips.length > 0 && lane.clips.every((clip) => clip.muted);
          const isSolo = lane.clips.some((clip) => clip.solo);

          return (
            <div className="lane" key={lane.id}>
              <div className="lane-name">
                <span>{lane.id}</span>
                <div className="lane-actions">
                  <button
                    className={isMuted ? "active" : ""}
                    onClick={() => onToggleLaneFlag(lane.id, "mute")}
                    type="button"
                  >
                    M
                  </button>
                  <button
                    className={isSolo ? "active" : ""}
                    onClick={() => onToggleLaneFlag(lane.id, "solo")}
                    type="button"
                  >
                    S
                  </button>
                </div>
              </div>
              <div className="lane-track">
                {ticks.map((tick) => (
                  <span className="grid-line" key={tick} style={{ left: `${(tick / scaleMs) * 100}%` }} />
                ))}
                {lane.clips.map((clip) => {
                  const left = (clip.startMs / scaleMs) * 100;
                  const width = Math.max((clip.durationMs / scaleMs) * 100, 4);
                  const spec = instruments[clip.instrument as keyof typeof instruments];
                  return (
                    <button
                      className={[
                        "clip-block",
                        `family-${spec?.family ?? "system"}`,
                        selectedClipId === clip.stableId ? "selected" : "",
                        clip.muted ? "muted" : "",
                        clip.solo ? "solo" : "",
                      ].join(" ")}
                      key={clip.stableId}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      onClick={() => onSelectClip(clip)}
                      onDoubleClick={() => {
                        onSelectClip(clip);
                        onAuditionClip(clip);
                      }}
                    >
                      <span>{clip.instrument}{clip.id ? `#${clip.id}` : ""}</span>
                      <small>
                        {clip.solo ? "S " : ""}{clip.muted ? "M " : ""}{clip.startMs}ms +{clip.durationMs}ms
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Inspector({
  clip,
  timeline,
  onPreviewClip,
  onToggleClipFlag,
}: {
  clip?: Clip;
  timeline?: Timeline;
  onPreviewClip: (clip: Clip) => void;
  onToggleClipFlag: (flag: ClipFlag) => void;
}) {
  if (!clip || !timeline) {
    return (
      <>
        <h2>Inspector</h2>
        <div className="muted-line">No clip selected</div>
      </>
    );
  }

  const spec = instruments[clip.instrument as keyof typeof instruments];
  return (
    <>
      <h2>{clip.instrument}</h2>
      <div className="clip-meta">
        <span>{clip.id ? `#${clip.id}` : clip.stableId}</span>
        <span>{clip.laneId}</span>
        <span>{clip.startMs}ms</span>
        <span>+{clip.durationMs}ms</span>
      </div>
      <div className="inspector-actions">
        <button className="primary" onClick={() => onPreviewClip(clip)}>Preview Clip</button>
        <button className={clip.muted ? "active" : ""} onClick={() => onToggleClipFlag("mute")}>
          {clip.muted ? "Unmute" : "Mute"}
        </button>
        <button className={clip.solo ? "active" : ""} onClick={() => onToggleClipFlag("solo")}>
          {clip.solo ? "Unsolo" : "Solo"}
        </button>
      </div>
      <div className="param-list">
        {spec.params.map((param) => (
          <ParamRow key={param.name} param={param} value={clip.params[param.name]} />
        ))}
      </div>
      <pre className="score-preview">{timeline.score}</pre>
    </>
  );
}

function ParamRow({ param, value }: { param: ParamSpec; value: ParamValue }) {
  const label =
    value.kind === "ramp"
      ? `${formatParam(value.from)} -> ${formatParam(value.to)}  ${value.curve}`
      : formatParam(value.value);

  return (
    <div className="param-row">
      <span>{param.label ?? param.name}</span>
      <strong>{label}</strong>
      <small>{param.unit && param.unit !== "none" ? param.unit : ""}</small>
      {value.kind === "ramp" ? <MiniCurve curve={value.curve} /> : null}
    </div>
  );
}

function MiniCurve({ curve }: { curve: string }) {
  const path =
    curve === "exp"
      ? "M2 30 C18 30 20 6 46 4"
      : curve.includes("out")
        ? "M2 30 C22 8 28 4 46 4"
        : curve.includes("in")
          ? "M2 30 C20 30 28 6 46 4"
          : "M2 30 L46 4";
  return (
    <svg className="mini-curve" viewBox="0 0 48 34" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function WaveformPreview({ timeline }: { timeline: Timeline }) {
  const clips = audibleClips(timeline);
  const bars = Array.from({ length: 96 }, (_, index) => {
    const t = (index / 95) * timeline.effectiveDurationMs;
    const amp = clips.reduce((sum, clip) => {
      const value = clip.params.amp;
      const clipAmp = value?.kind === "scalar" ? value.value : 0.12;
      const inClip = t >= clip.startMs && t <= clip.startMs + clip.durationMs;
      if (!inClip) return sum;
      const age = (t - clip.startMs) / clip.durationMs;
      const env = Math.sin(Math.max(0, Math.min(1, age)) * Math.PI);
      return sum + clipAmp * env;
    }, 0);
    return Math.min(1, amp);
  });

  return (
    <div className="waveform">
      <div className="waveform-label">
        <span>Waveform</span>
        <span>{Math.round(timeline.effectiveDurationMs)}ms</span>
      </div>
      <div className="waveform-bars">
        {bars.map((bar, index) => (
          <span key={index} style={{ height: `${Math.max(5, bar * 100)}%` }} />
        ))}
      </div>
    </div>
  );
}

function audibleClips(timeline: Timeline) {
  const hasSolo = timeline.clips.some((clip) => clip.solo);
  return timeline.clips.filter((clip) => !clip.muted && (!hasSolo || clip.solo));
}

function makeTicks(durationMs: number) {
  const step = durationMs <= 900 ? 100 : durationMs <= 1800 ? 200 : 500;
  const ticks: number[] = [];
  for (let tick = 0; tick <= durationMs; tick += step) ticks.push(tick);
  return ticks;
}

function formatParam(value: number) {
  if (Math.abs(value) >= 100) return Math.round(value).toString();
  return Number(value.toFixed(3)).toString();
}
