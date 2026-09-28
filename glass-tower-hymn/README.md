# Hymn of the Glass Tower（硝子の塔の讃歌）

An instrumental in the style of the Ar tonelico II and Umineko openings: gothic, ethnic-tinged symphonic pop in D minor at 150 bpm. Everything is synthesized from scratch in plain JavaScript. There are no samples and no audio libraries.

Listen: [`audio/glass-tower.mp3`](audio/glass-tower.mp3)

## Render it yourself

```sh
npm install          # optional: only needed for the mp3 encoder
node render.js       # writes out/glass-tower.wav (+ .mp3), ~80 s
node render.js --stems --from 40 --to 56   # one section, with per-bus stems
```

## Layout

| File | What it does |
| --- | --- |
| `src/dsp.js` | Oscillators (PolyBLEP saw, table sine), SVF/biquad filters, FDN hall reverb, ping-pong delay, compressor, look-ahead limiter, WAV writer |
| `src/instruments.js` | String ensembles, formant choir, expressive violin/whistle/"aah" leads, Karplus–Strong harpsichord/harp/santur/pizzicato, additive piano, music box and glockenspiel, drums and percussion |
| `src/theory.js` | Note names, a compact melody notation with bar-length checks, chord parsing and voice-leading |
| `src/score.js` | The composition |
| `render.js` | Tempo map, event dispatch, bus mixing, mastering |

## Form

| Bar | Section |
| --- | --- |
| 0 | Intro: music box theme over an "oo" choir |
| 8 | Riff: orchestral hit, 16th-note string ostinato, theme on violin and choir |
| 16 | Verse: low whistle, harp, darbuka |
| 32 | Pre-chorus: rising strings, one-bar break |
| 40 | Chorus: 王道進行 (B♭–C–Am–Dm) with full orchestra |
| 56 | Riff |
| 64 | Santur solo in A Phrygian dominant |
| 72 | Breakdown: music box and piano, build into B7 |
| 80 | Final chorus, up a step to E minor |
| 100 | Outro riff and final hit |
| 108 | Coda: music box, ritardando |
