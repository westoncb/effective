<CsoundSynthesizer>
<CsOptions>
-odac -d -m0
</CsOptions>

<CsInstruments>
sr = 48000
ksmps = 16
nchnls = 2
0dbfs = 1

giSine ftgen 0, 0, 16384, 10, 1

gaBusL init 0
gaBusR init 0

chn_k "master_gain", 3
chn_k "master_drive", 3
chn_k "master_reverb", 3
chn_k "master_cutoff", 3
chn_k "js_globals_ready", 3
chn_k "preview_active", 3

opcode CurveRamp, k, iiii
  iFrom, iTo, iCurve, iDur xin

  kPos linseg 0, max(0.001, iDur), 1

  if iCurve == 1 then
    kOut expseg max(0.0001, iFrom), max(0.001, iDur), max(0.0001, iTo)
  elseif iCurve == 2 then
    kShape = kPos * kPos
    kOut = iFrom + ((iTo - iFrom) * kShape)
  elseif iCurve == 3 then
    kInv = 1 - kPos
    kShape = 1 - (kInv * kInv)
    kOut = iFrom + ((iTo - iFrom) * kShape)
  elseif iCurve == 4 then
    if kPos < 0.5 then
      kShape = 2 * kPos * kPos
    else
      kInv = -2 * kPos + 2
      kShape = 1 - ((kInv * kInv) / 2)
    endif
    kOut = iFrom + ((iTo - iFrom) * kShape)
  else
    kOut = iFrom + ((iTo - iFrom) * kPos)
  endif

  xout kOut
endop

instr InitDefaults
  kReady chnget "js_globals_ready"

  if kReady < 0.5 then
    chnset 0.75, "master_gain"
    chnset 0.20, "master_drive"
    chnset 0.12, "master_reverb"
    chnset 16000, "master_cutoff"
  endif
endin

instr Master
  kGain   chnget "master_gain"
  kDrive  chnget "master_drive"
  kRevAmt chnget "master_reverb"
  kCutoff chnget "master_cutoff"

  aInL = gaBusL
  aInR = gaBusR

  kDriveAmt = 1.0 + (kDrive * 8.0)

  aSatL = tanh(aInL * kDriveAmt) / tanh(kDriveAmt)
  aSatR = tanh(aInR * kDriveAmt) / tanh(kDriveAmt)

  aRevL, aRevR reverbsc aSatL, aSatR, 0.72, kCutoff

  aMixL = (aSatL * (1.0 - kRevAmt)) + (aRevL * kRevAmt)
  aMixR = (aSatR * (1.0 - kRevAmt)) + (aRevR * kRevAmt)

  aMixL tone aMixL, kCutoff
  aMixR tone aMixR, kCutoff

  aOutL limit aMixL * kGain, -0.98, 0.98
  aOutR limit aMixR * kGain, -0.98, 0.98

  outs aOutL, aOutR

  clear gaBusL, gaBusR
endin


; p4 amp
; p5 startHz
; p6 endHz
; p7 curve code
; p8 drive 0..1
; p9 pan 0..1
instr SubDrop
  kPreviewActive chnget "preview_active"
  if kPreviewActive < 0.5 then
    turnoff
  endif

  iAmp     = p4
  iStartHz = p5
  iEndHz   = p6
  iCurve   = p7
  iDrive   = p8
  iPan     = p9

  kFreq CurveRamp iStartHz, iEndHz, iCurve, p3
  aEnv  linseg 0, 0.006, 1, max(0.020, p3 * 0.70), 0.22, max(0.020, p3 * 0.30), 0

  aSig poscil iAmp, kFreq, giSine
  aSig = aSig * aEnv

  iDriveAmt = 1.0 + (iDrive * 9.0)
  aSig = tanh(aSig * iDriveAmt) / tanh(iDriveAmt)

  aL, aR pan2 aSig, iPan
  gaBusL = gaBusL + aL
  gaBusR = gaBusR + aR
endin


; p4 amp
; p5 freq
; p6 punch 0..1
; p7 drive 0..1
; p8 pan 0..1
instr BassThump
  kPreviewActive chnget "preview_active"
  if kPreviewActive < 0.5 then
    turnoff
  endif

  iAmp   = p4
  iFreq  = p5
  iPunch = p6
  iDrive = p7
  iPan   = p8

  kFreq expseg iFreq * (1.5 + iPunch * 2.0), 0.025, iFreq, max(0.020, p3 - 0.025), iFreq * 0.98
  aEnv  linseg 0, 0.004, 1, p3 * 0.28, 0.55, p3 * 0.68, 0

  aSig poscil iAmp, kFreq, giSine
  aSig = aSig * aEnv

  iDriveAmt = 1.0 + (iDrive * 12.0)
  aSig = tanh(aSig * iDriveAmt) / tanh(iDriveAmt)

  aSig tone aSig, 1800

  aL, aR pan2 aSig, iPan
  gaBusL = gaBusL + aL
  gaBusR = gaBusR + aR
endin


; p4 amp
; p5 brightness 0..1
; p6 body 0..1
; p7 pan 0..1
instr SoftClick
  kPreviewActive chnget "preview_active"
  if kPreviewActive < 0.5 then
    turnoff
  endif

  iAmp    = p4
  iBright = p5
  iBody   = p6
  iPan    = p7

  aNoise rand 1
  aNoise buthp aNoise, 900 + (iBright * 4000)
  aNoise butlp aNoise, 3000 + (iBright * 12000)

  aEnv linseg 0, 0.0015, 1, max(0.004, p3 * 0.35), 0.18, max(0.006, p3 * 0.65), 0
  aClick = aNoise * aEnv * iAmp

  aBody poscil iAmp * iBody * 0.18, 180 + (iBright * 500), giSine
  aBodyEnv linseg 0, 0.002, 1, max(0.012, p3 - 0.002), 0
  aSig = aClick + (aBody * aBodyEnv)

  aL, aR pan2 aSig, iPan
  gaBusL = gaBusL + aL
  gaBusR = gaBusR + aR
endin


; p4 amp
; p5 hpHz
; p6 lpHz
; p7 pan 0..1
instr NoiseBurst
  kPreviewActive chnget "preview_active"
  if kPreviewActive < 0.5 then
    turnoff
  endif

  iAmp = p4
  iHp  = p5
  iLp  = p6
  iPan = p7

  aNoise rand 1
  aSig buthp aNoise, iHp
  aSig butlp aSig, iLp

  aEnv linseg 0, 0.003, 1, max(0.010, p3 * 0.45), 0.25, max(0.010, p3 * 0.55), 0
  aSig = aSig * aEnv * iAmp

  aL, aR pan2 aSig, iPan
  gaBusL = gaBusL + aL
  gaBusR = gaBusR + aR
endin


; p4 amp
; p5 startCutoff
; p6 endCutoff
; p7 curve code
; p8 pan 0..1
instr Whoosh
  kPreviewActive chnget "preview_active"
  if kPreviewActive < 0.5 then
    turnoff
  endif

  iAmp   = p4
  iStart = p5
  iEnd   = p6
  iCurve = p7
  iPan   = p8

  aNoise rand 1
  kCut CurveRamp max(40, iStart), max(40, iEnd), iCurve, p3

  aSig buthp aNoise, kCut * 0.45
  aSig butlp aSig, kCut

  aEnv linseg 0, p3 * 0.20, 1, p3 * 0.55, 0.65, p3 * 0.25, 0
  aSig = aSig * aEnv * iAmp

  aL, aR pan2 aSig, iPan
  gaBusL = gaBusL + aL
  gaBusR = gaBusR + aR
endin


; p4 amp
; p5 freq
; p6 brightness 0..1
; p7 pan 0..1
instr GlassPing
  kPreviewActive chnget "preview_active"
  if kPreviewActive < 0.5 then
    turnoff
  endif

  iAmp    = p4
  iFreq   = p5
  iBright = p6
  iPan    = p7

  aEnv linseg 0, 0.006, 1, p3 * 0.22, 0.45, p3 * 0.72, 0

  a1 poscil iAmp * 0.65, iFreq, giSine
  a2 poscil iAmp * 0.32, iFreq * 2.01, giSine
  a3 poscil iAmp * 0.18, iFreq * (2.73 + iBright * 0.15), giSine
  a4 poscil iAmp * 0.10, iFreq * (4.12 + iBright * 0.30), giSine

  aSig = (a1 + a2 + a3 + a4) * aEnv
  aSig buthp aSig, 180

  aL, aR pan2 aSig, iPan
  gaBusL = gaBusL + aL
  gaBusR = gaBusR + aR
endin


; p4 amp
; p5 freq
; p6 detune 0..1
; p7 pan 0..1
instr SoftChime
  kPreviewActive chnget "preview_active"
  if kPreviewActive < 0.5 then
    turnoff
  endif

  iAmp    = p4
  iFreq   = p5
  iDetune = p6
  iPan    = p7

  aEnv linseg 0, 0.010, 1, p3 * 0.38, 0.30, p3 * 0.58, 0

  a1 poscil iAmp * 0.42, iFreq, giSine
  a2 poscil iAmp * 0.30, iFreq * (1.5 + iDetune * 0.05), giSine
  a3 poscil iAmp * 0.21, iFreq * (2.0 - iDetune * 0.03), giSine
  a4 poscil iAmp * 0.13, iFreq * (3.01 + iDetune * 0.07), giSine

  aSig = (a1 + a2 + a3 + a4) * aEnv
  aSig tone aSig, 9000

  aL, aR pan2 aSig, iPan
  gaBusL = gaBusL + aL
  gaBusR = gaBusR + aR
endin


; p4 amp
; p5 freq
; p6 roughness 0..1
; p7 pan 0..1
instr ErrorBuzz
  kPreviewActive chnget "preview_active"
  if kPreviewActive < 0.5 then
    turnoff
  endif

  iAmp   = p4
  iFreq  = p5
  iRough = p6
  iPan   = p7

  kModFreq = 18 + (iRough * 55)
  aMod poscil 1, kModFreq, giSine
  aCarrier poscil iAmp, iFreq + (aMod * iFreq * 0.04 * iRough), giSine

  aEnv linseg 0, 0.004, 1, p3 * 0.40, 0.75, p3 * 0.56, 0

  aSig = aCarrier * aEnv
  aSig = tanh(aSig * (1.5 + iRough * 8.0)) / tanh(1.5 + iRough * 8.0)
  aSig butlp aSig, 2500 + (iRough * 6000)

  aL, aR pan2 aSig, iPan
  gaBusL = gaBusL + aL
  gaBusR = gaBusR + aR
endin


; p4 amp
; p5 baseFreq
; p6 rate
; p7 depth 0..1
; p8 pan 0..1
instr ComputePulse
  kPreviewActive chnget "preview_active"
  if kPreviewActive < 0.5 then
    turnoff
  endif

  iAmp   = p4
  iFreq  = p5
  iRate  = p6
  iDepth = p7
  iPan   = p8

  kGate poscil 0.5, iRate, giSine
  kGate = kGate + 0.5

  kFreq = iFreq * (1.0 + (kGate * iDepth * 0.20))

  a1 poscil iAmp, kFreq, giSine
  a2 poscil iAmp * 0.35, kFreq * 2.01, giSine

  aEnv linseg 0, 0.006, 1, p3 * 0.80, 0.35, p3 * 0.19, 0
  aSig = (a1 + a2) * aEnv * (0.55 + kGate * 0.45)

  aSig tone aSig, 8000

  aL, aR pan2 aSig, iPan
  gaBusL = gaBusL + aL
  gaBusR = gaBusR + aR
endin


; p4 amp
; p5 brightness 0..1
; p6 pan 0..1
instr AirTail
  kPreviewActive chnget "preview_active"
  if kPreviewActive < 0.5 then
    turnoff
  endif

  iAmp    = p4
  iBright = p5
  iPan    = p6

  aNoise rand 1
  aSig buthp aNoise, 3500 + (iBright * 3500)
  aSig butlp aSig, 8000 + (iBright * 10000)

  aEnv linseg 0, p3 * 0.12, 1, p3 * 0.72, 0.22, p3 * 0.16, 0
  aSig = aSig * aEnv * iAmp

  aL, aR pan2 aSig, iPan
  gaBusL = gaBusL + aL
  gaBusR = gaBusR + aR
endin


; p4 amp
; p5 freq
; p6 sweep 0..1
; p7 pan 0..1
instr ReverseSwell
  kPreviewActive chnget "preview_active"
  if kPreviewActive < 0.5 then
    turnoff
  endif

  iAmp   = p4
  iFreq  = p5
  iSweep = p6
  iPan   = p7

  kFreq expseg iFreq * (0.65 + iSweep * 0.25), max(0.010, p3), iFreq * (1.15 + iSweep * 0.65)
  aTone poscil iAmp, kFreq, giSine

  aNoise rand 1
  aNoise buthp aNoise, 1200
  aNoise butlp aNoise, 6000 + iSweep * 7000

  aEnv linseg 0, p3 * 0.75, 1, p3 * 0.25, 0

  aSig = ((aTone * 0.55) + (aNoise * 0.25)) * aEnv

  aL, aR pan2 aSig, iPan
  gaBusL = gaBusL + aL
  gaBusR = gaBusR + aR
endin


; p4 amp
; p5 freq
; p6 hardness 0..1
; p7 pan 0..1
instr MetalTick
  kPreviewActive chnget "preview_active"
  if kPreviewActive < 0.5 then
    turnoff
  endif

  iAmp      = p4
  iFreq     = p5
  iHardness = p6
  iPan      = p7

  aEnv linseg 0, 0.001, 1, p3 * 0.20, 0.30, p3 * 0.79, 0

  a1 poscil iAmp * 0.50, iFreq, giSine
  a2 poscil iAmp * 0.35, iFreq * 2.71, giSine
  a3 poscil iAmp * 0.25, iFreq * 5.18, giSine

  aNoise rand iAmp * 0.12 * iHardness
  aNoise buthp aNoise, 4000

  aSig = ((a1 + a2 + a3) * aEnv) + (aNoise * aEnv)
  aSig = tanh(aSig * (1.0 + iHardness * 6.0)) / tanh(1.0 + iHardness * 6.0)

  aL, aR pan2 aSig, iPan
  gaBusL = gaBusL + aL
  gaBusR = gaBusR + aR
endin

</CsInstruments>
<CsScore>
i "InitDefaults" 0 0.01
i "Master" 0 604800
f 0 604800
e
</CsScore>
</CsoundSynthesizer>
