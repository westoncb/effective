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
  [SoftClick#tap @0ms +52ms amp=.22 snap=.42 body=.58 pan=.49]

tone:
  [GlassPing#shine @26ms +330ms amp=.16 tone=640 shine=.22 pan=.53]
  [SoftChime#warm @58ms +410ms amp=.10 tone=420 warmth=.18 pan=.47]

air:
  [AirTail#tail @48ms +390ms amp=.07 air=.28 pan=.50]
`,
  },
  {
    id: "primary-click",
    name: "Primary Click",
    source: `dur 720ms
master gain=.78 drive=.16 reverb=.07 cutoff=17000

body:
  [BassThump#weight @0ms +120ms amp=.11 tone=86 punch=.62 body=.25 pan=.49]

click:
  [SoftClick#front @0ms +45ms amp=.30 snap=.64 body=.45 pan=.50]
  [MetalTick#edge @14ms +65ms amp=.055 tone=1900 snap=.38 pan=.52]

air:
  [AirTail#short @18ms +210ms amp=.035 air=.48 pan=.50]
`,
  },
  {
    id: "toggle",
    name: "Toggle Tick",
    source: `dur 760ms
master gain=.72 drive=.10 reverb=.10 cutoff=16000

click:
  [SoftClick#down @0ms +42ms amp=.23 snap=.48 body=.55 pan=.48]
  [MetalTick#lift @38ms +54ms amp=.06 tone=1450 snap=.28 pan=.53]

tone:
  [GlassPing#state @48ms +230ms amp=.09 tone=520 shine=.18 pan=.51]

air:
  [AirTail#space @44ms +260ms amp=.04 air=.30 pan=.50]
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
  [Whoosh#open @0ms +360ms amp=.09 motion=900->7600 curve=open pan=.48]

tone:
  [SoftChime#base @70ms +520ms amp=.17 tone=480 warmth=.28 pan=.46]
  [GlassPing#spark @118ms +430ms amp=.13 tone=760 shine=.34 pan=.56]

air:
  [AirTail#halo @145ms +560ms amp=.08 air=.42 pan=.50]
`,
  },
  {
    id: "error-nudge",
    name: "Error Nudge",
    source: `dur 940ms
master gain=.74 drive=.22 reverb=.08 cutoff=12000

body:
  [BassThump#thud @0ms +150ms amp=.16 tone=70 punch=.74 body=.44 pan=.50]

noise:
  [ErrorBuzz#rough @12ms +250ms amp=.19 tone=185 grain=.68 pan=.49]
  [MetalTick#edge @32ms +85ms amp=.045 tone=920 snap=.70 pan=.54]

air:
  [NoiseBurst#grain @44ms +170ms amp=.055 thin=1400 air=7200 pan=.50]
`,
  },
  {
    id: "thinking-pulse",
    name: "Thinking Pulse",
    source: `dur 1800ms
master gain=.62 drive=.10 reverb=.18 cutoff=14500

pulse:
  [ComputePulse#one @0ms +420ms amp=.13 tone=300 speed=5.2 motion=.42 pan=.46]
  [ComputePulse#two @390ms +430ms amp=.12 tone=330 speed=5.8 motion=.48 pan=.54]
  [ComputePulse#three @790ms +480ms amp=.115 tone=315 speed=6.4 motion=.52 pan=.50]

texture:
  [AirTail#bed @0ms +1280ms amp=.035 air=.22 pan=.50]
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
  [ReverseSwell#lift @0ms +430ms amp=.12 tone=380 motion=.58 pan=.47]
  [Whoosh#pass @40ms +460ms amp=.13 motion=650->9300 curve=rise pan=.53]

hit:
  [SoftClick#settle @420ms +58ms amp=.18 snap=.50 body=.44 pan=.50]

air:
  [AirTail#tail @250ms +420ms amp=.065 air=.44 pan=.50]
`,
  },
  {
    id: "delete-thud",
    name: "Delete Thud",
    source: `dur 1020ms
master gain=.76 drive=.28 reverb=.10 cutoff=13000

curve drop = exp

bass:
  [SubDrop#fall @0ms +300ms amp=.22 tone=118->54 curve=drop weight=.48 pan=.50]
  [BassThump#impact @22ms +170ms amp=.16 tone=66 punch=.78 body=.46 pan=.50]

click:
  [SoftClick#snap @0ms +44ms amp=.18 snap=.52 body=.38 pan=.48]

noise:
  [NoiseBurst#dust @70ms +260ms amp=.055 thin=850 air=6200 pan=.52]
`,
  },
];

export const defaultPreset = presets[0];
