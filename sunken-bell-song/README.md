# The Sunken Bell（沈鐘）

A 4-minute instrumental in the lineage of the Ar tonelico II and Umineko openings: layered choir, orchestra, ethnic soloists and electronics. A bell has sunk into the sea and still tolls under the water. The piece moves between that underwater world and a dense hybrid band.

It's in C minor at 138 bpm, with a 7/8 Hijaz dance in the middle and a Picardy (C major) ending. Everything is synthesized from scratch in plain JavaScript. There are no samples and no audio libraries.

Listen: [`audio/sunken-bell.mp3`](audio/sunken-bell.mp3)

## Render it yourself

```sh
npm install          # optional: only needed for the mp3 encoder
node render.js       # writes out/sunken-bell.wav (+ .mp3), ~3.5 min
node render.js --stems --from 216 --to 280   # the first chorus (in beats), with per-bus stems
```

## What makes it layered

- **Heterophony:** duduk and erhu play the same melody, each with its own ornaments (slides, mordents, grace notes) and slightly loose timing.
- **Choir lines:** wordless ensembles of 6 formant-filtered voices follow the melody an octave below and above, as backing vocals would. Separate SATB pads and a staccato chant choir sit underneath.
- **Counter-melodies:** cellos, violas, altos and horns have their own lines in the chorus, not just block chords.
- **Harmony:** a chromatic lament bass under the theme (C–B–B♭–A–A♭–G), and extended and borrowed chords (Fm9, D♭maj7♯11, G7♭9, Bdim7).
- **Electronics:** a filtered arpeggiator, a supersaw pad and a sub bass are ducked by the kick drum. They sink "under water" behind a low-pass filter in the breakdown.
- **Production:** convolution reverb with a synthesized hall impulse response, ping-pong delay, bus saturation, compression and a look-ahead limiter.

## Layout

| File | What it does |
| --- | --- |
| `src/dsp.js` | Oscillators, filters, FFT convolution, hall impulse response, sidechain envelope, saturation, dynamics, WAV writer |
| `src/instruments.js` | String ensembles, formant choir, the expressive lead phrase engine, plucked strings, piano, music box, drums |
| `src/voices.js` | Additive duduk, erhu and flute; choir and string ensemble lines; chant; oud tremolo; synths; church bell; riq, claps, finger cymbals; water |
| `src/theory.js` | Melody notation with bar checks (any meter) and ornament flags; extended chords; voice-leading |
| `src/score.js` | The composition |
| `render.js` | Tempo map, event dispatch, buses, sidechain, underwater automation, mastering |

## Form

| Section | Meter | What happens |
| --- | --- | --- |
| Prologue | 4/4, 92 bpm | Water, the sunken bell, a duduk solo over a hummed drone |
| Awakening | 4/4 | The arpeggiator opens up; choir swells |
| Theme | 4/4 | Full band over the lament bass |
| Verse | 4/4 | Erhu with flute replies, piano, frame drums, cello counter-line |
| Pre-chorus | 4/4 | Chant choir and strings build; one-bar break |
| Chorus | 4/4 | Erhu melody with duduk and choir octaves, counter-melodies |
| Hijaz dance | 7/8 (2+2+3) | Oud riff, duduk and erhu trading solos, then in thirds |
| Choir | 4/4 | Half-time choir climax |
| Underwater | 4/4 | The band sinks behind a low-pass filter; flute, piano, bell |
| Final chorus | 4/4 | Everything, plus a flute descant |
| Outro | 4/4 | Theme returns and resolves to C major |
| Coda | 4/4 | The bell rings on under the water |
