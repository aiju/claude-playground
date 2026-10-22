# Cathedral Overdrive（大聖堂オーバードライブ）

A 4:50 instrumental that starts in a cathedral and ends up as eurobeat, then goes back again. A pipe organ chorale speeds up into a toccata, and the toccata turns into a 156 bpm eurobeat riff. Later the band drops out for an organ passacaglia, comes back in underneath the organ, and finally slows down into the cathedral for an organ chorale with bells.

It's in D minor, with the final chorus up a step in E minor and a Picardy (E major) ending. Everything is synthesized from scratch in plain JavaScript. There are no samples, no audio libraries and no vocals.

Listen: [`audio/cathedral-overdrive.mp3`](audio/cathedral-overdrive.mp3)

## Render it yourself

```sh
node render.js       # writes out/cathedral-overdrive.wav (+ .mp3), takes about 2 minutes
node render.js --stems --from 60 --to 124   # just the first riff (in beats), with per-bus stems
```

The mp3 is encoded with `ffmpeg` if it is installed. Otherwise run `npm install` first and lamejs is used instead.

## How the two worlds are joined

- **One riff, three instruments.** The main riff has a 3+3+2 rhythm. In the prologue the organ plays it as a toccata: every riff note is followed by chord tones stepping down, one per 16th note. In the eurobeat sections the supersaw lead plays the riff notes, and a 16th-note arpeggio plays that same toccata figure underneath. In the hybrid section the harpsichord takes it over.
- **Tempo map.** Tempo is set in beats with linear bpm ramps. The toccata accelerates from 84 to 156 bpm, so the organ's 16th notes become the eurobeat's 16th notes. The coda ramps back down from 156 to 66 bpm.
- **The pedal becomes the bass.** In the toccata the organ pedal plays the eurobeat octave-bass pattern before the synth bass takes it over at the drop. In the third passacaglia variation it plays the same pattern again just before the band returns.
- **Shared rooms.** The organ is heard from the nave through a 7.5 s cathedral reverb. Under the first riff the organ holds open fifths, so the cathedral keeps ringing into the eurobeat section. The final hit is sent into the cathedral as well, so its splash carries into the closing chorale.

## The organ

The organ is additive. Every stop is a rank of pipes with its own footage, harmonic recipe and speech time. Each pipe is slightly out of tune in its own fixed way.

- **Stops:** principals, flutes, stopped flutes, strings and a celeste, mutations, a mixture that breaks back an octave in the treble, and trumpet and bombarde reeds.
- **Registrations:** soft celeste with tremulant, a cornet (with the tierce), plenum and full organ. In the pedal, the 16′ and 10⅔′ stops combine into a "resultant" 32′.
- **Pipe speech:** notes start with a breathy chiff and carry a faint wind noise.
- **Pipe layout:** each note is panned to the C or C♯ side of the case, the way the pipes stand on a real organ.

## Layout

| File | What it does |
| --- | --- |
| `src/dsp.js` | PolyBLEP oscillators, wavetables, SVF and biquad filters, FFT convolution, synthetic room impulse responses, ping-pong delay, compressor, look-ahead limiter, WAV writer |
| `src/organ.js` | The pipe organ: stops, registrations, chiff, wind, tremulant |
| `src/synths.js` | Supersaw and pulse leads, synth brass, octave bass, arpeggio pluck, house piano, string pad, orchestra hit (crushed to 12 bits), noise risers |
| `src/percussion.js` | 909-style drums with a gated snare, timpani and timpani rolls, a minor-third church bell, a Karplus–Strong harpsichord |
| `src/theory.js` | Note names, a step-sequencer melody notation with bar checks, chords and voice-leading |
| `src/score.js` | The composition and the tempo map |
| `render.js` | Event dispatch, buses, kick sidechain, cathedral and hall reverbs, delay, mastering |

## Form

| Time | Section | What happens |
| --- | --- | --- |
| 0:00 | Bells | Three tolls of the great bell; the pedal creeps in |
| 0:08 | Chorale | The riff in augmentation on full organ, D minor to a cadenza and an A major fermata |
| 0:28 | Toccata | The riff as an organ toccata, accelerating to 156 bpm while stops are drawn; the drums build |
| 0:43 | Riff | The drop: supersaw riff, arpeggio, octave bass, brass, with the organ holding fifths underneath |
| 1:08 | Verse | Pulse lead in call and response, house piano, harpsichord broken chords |
| 1:32 | Pre-chorus | Rising sequence, snare build, a break on the dominant |
| 1:45 | Chorus | Opens on B♭ (a deceptive cadence), supersaw with a pulse an octave below |
| 2:09 | Riff | With the organ doubling the arpeggio |
| 2:22 | Passacaglia | The band stops for the bell: a ground bass with three variations (celeste and cornet, plenum with timpani, full-organ toccata as the kick returns) |
| 2:59 | Hybrid | Eurobeat under the organ, which plays the theme; harpsichord 16ths |
| 3:11 | Duel | Synth lead and organ trade phrases in harmonic minor, then play together |
| 3:23 | Pre-chorus | Pivots through C and D to B major |
| 3:36 | Final chorus | E minor, with organ, pedal and bells |
| 4:00 | Riff | In E minor |
| 4:12 | Coda | Final hit, ritardando into an organ chorale down the Andalusian bass, ending on E major with bells |
