export type PresetProgram = {
  id: string;
  name: string;
  source: string;
};

export const presets: PresetProgram[] = [
  {
    id: "soft-confirm",
    name: "Soft Confirm",
    source: `dur 960ms
master gain=.70 drive=.12 reverb=.16 cutoff=15500

curve shine = ease out
curve air = ease inout

click:
  [SoftClick#tap @0ms +52ms amp=.22 bright=.42 body=.58 pan=.49]

tone:
  [GlassPing#shine @26ms +330ms amp=.16 freq=640 bright=.22 pan=.53]
  [SoftChime#warm @58ms +410ms amp=.10 freq=420 detune=.18 pan=.47]

air:
  [AirTail#tail @48ms +390ms amp=.07 bright=.28 pan=.50]
`,
  },
  {
    id: "primary-click",
    name: "Primary Click",
    source: `dur 720ms
master gain=.78 drive=.16 reverb=.07 cutoff=17000

body:
  [BassThump#weight @0ms +120ms amp=.11 freq=86 punch=.62 drive=.25 pan=.49]

click:
  [SoftClick#front @0ms +45ms amp=.30 bright=.64 body=.45 pan=.50]
  [MetalTick#edge @14ms +65ms amp=.055 freq=1900 hard=.38 pan=.52]

air:
  [AirTail#short @18ms +210ms amp=.035 bright=.48 pan=.50]
`,
  },
  {
    id: "toggle",
    name: "Toggle Tick",
    source: `dur 760ms
master gain=.72 drive=.10 reverb=.10 cutoff=16000

click:
  [SoftClick#down @0ms +42ms amp=.23 bright=.48 body=.55 pan=.48]
  [MetalTick#lift @38ms +54ms amp=.06 freq=1450 hard=.28 pan=.53]

tone:
  [GlassPing#state @48ms +230ms amp=.09 freq=520 bright=.18 pan=.51]

air:
  [AirTail#space @44ms +260ms amp=.04 bright=.30 pan=.50]
`,
  },
  {
    id: "notification-bloom",
    name: "Notification Bloom",
    source: `dur 1250ms
master gain=.68 drive=.10 reverb=.24 cutoff=18000

curve open = ease out
curve lift = exp

motion:
  [Whoosh#open @0ms +360ms amp=.09 cutoff=900->7600 curve=open pan=.48]

tone:
  [SoftChime#base @70ms +520ms amp=.17 freq=480 detune=.28 pan=.46]
  [GlassPing#spark @118ms +430ms amp=.13 freq=760 bright=.34 pan=.56]

air:
  [AirTail#halo @145ms +560ms amp=.08 bright=.42 pan=.50]
`,
  },
  {
    id: "error-nudge",
    name: "Error Nudge",
    source: `dur 940ms
master gain=.74 drive=.22 reverb=.08 cutoff=12000

body:
  [BassThump#thud @0ms +150ms amp=.16 freq=70 punch=.74 drive=.44 pan=.50]

noise:
  [ErrorBuzz#rough @12ms +250ms amp=.19 freq=185 rough=.68 pan=.49]
  [MetalTick#edge @32ms +85ms amp=.045 freq=920 hard=.70 pan=.54]

air:
  [NoiseBurst#grain @44ms +170ms amp=.055 hp=1400 lp=7200 pan=.50]
`,
  },
  {
    id: "thinking-pulse",
    name: "Thinking Pulse",
    source: `dur 1800ms
master gain=.62 drive=.10 reverb=.18 cutoff=14500

pulse:
  [ComputePulse#one @0ms +420ms amp=.13 freq=300 rate=5.2 depth=.42 pan=.46]
  [ComputePulse#two @390ms +430ms amp=.12 freq=330 rate=5.8 depth=.48 pan=.54]
  [ComputePulse#three @790ms +480ms amp=.115 freq=315 rate=6.4 depth=.52 pan=.50]

texture:
  [AirTail#bed @0ms +1280ms amp=.035 bright=.22 pan=.50]
`,
  },
  {
    id: "modal-whoosh",
    name: "Modal Whoosh",
    source: `dur 1180ms
master gain=.70 drive=.12 reverb=.15 cutoff=17000

curve rise = ease out
curve sweep = exp

motion:
  [ReverseSwell#lift @0ms +430ms amp=.12 freq=380 sweep=.58 pan=.47]
  [Whoosh#pass @40ms +460ms amp=.13 cutoff=650->9300 curve=rise pan=.53]

hit:
  [SoftClick#settle @420ms +58ms amp=.18 bright=.50 body=.44 pan=.50]

air:
  [AirTail#tail @250ms +420ms amp=.065 bright=.44 pan=.50]
`,
  },
  {
    id: "delete-thud",
    name: "Delete Thud",
    source: `dur 1020ms
master gain=.76 drive=.28 reverb=.10 cutoff=13000

curve drop = exp

bass:
  [SubDrop#fall @0ms +300ms amp=.22 freq=118->54 curve=drop drive=.48 pan=.50]
  [BassThump#impact @22ms +170ms amp=.16 freq=66 punch=.78 drive=.46 pan=.50]

click:
  [SoftClick#snap @0ms +44ms amp=.18 bright=.52 body=.38 pan=.48]

noise:
  [NoiseBurst#dust @70ms +260ms amp=.055 hp=850 lp=6200 pan=.52]
`,
  },
];

export const defaultPreset = presets[0];
