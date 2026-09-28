# Xerox Alto explainer

An explainer video about the Xerox Alto (Xerox PARC, 1973), made for technically minded viewers who aren't hardware engineers. The pictures, sound effects and music are generated in JavaScript and the narration with Gemini TTS.

The chosen direction is **Task Zero**: a two-minute 9:16 short that is all about the Alto's microcoded processor. The script and storyboard are in [`script.md`](script.md). The whole short plays in a real-time preview; there's no renderer for the final video file yet, on purpose, until the cut is final.

## Watch the preview

```sh
node serve.js      # then open http://localhost:8123/
```

No install needed. The preview draws every frame live at 30 fps, in sync with the soundtrack, so what it shows is the video itself. It builds the soundtrack when it loads, in a couple of seconds.

- <kbd>Space</kbd> plays and pauses; <kbd>←</kbd> <kbd>→</kbd> step a second (<kbd>Shift</kbd> for five), <kbd>,</kbd> <kbd>.</kbd> a frame.
- <kbd>1</kbd>–<kbd>8</kbd> or <kbd>[</kbd> <kbd>]</kbd> jump between sections; <kbd>L</kbd> loops the current one.
- <kbd>V</kbd> <kbd>E</kbd> <kbd>M</kbd> mute the voice, effects and music; <kbd>C</kbd> turns on captions.
- "Copy timestamp" copies the time, section, line and word, for feedback. A link ending in `#t62.5` opens at 62.5 s.

## How it's made

- **Timeline** (`src/timeline.js`): places each narration clip after a pause of its own and turns the word timings in `voice/manifest.json` into cue times, so a scene can say "when *register* is spoken".
- **Scenes** (`src/scenes/`): one module per shot, each a pure function of time that draws the frame and places its own sound effects. `src/scenes/index.js` is the shot list. Frames are drawn on a 540 × 960 canvas, snapped to a five-colour palette (ink, paper and the Alto mouse buttons' red, yellow and blue), then scaled up with nearest-neighbour sampling.
- **Sound** (`src/audio/`): synthesised from scratch on sample buffers (DSP adapted from `sunken-bell-song`). The music is a 7 : 24 polyrhythm, because the Alto's CPU and pixel clocks are geared 7 : 24, and its heartbeat ticks drive some of the pictures. Music ducks under the voice, and one limiter watches all three stems, so muting one in the preview doesn't change the others.

## Narration

The clips are committed in [`voice/`](voice), one MP3 per script line, so nothing needs regenerating to watch the preview.

```sh
GEMINI_API_KEY=… node tts.js   # needs ffmpeg
```

`tts.js` reads the narration lines (N1…N16) from `script.md` and sends each to Gemini TTS (`gemini-3.8-flash-tts`, voice Iapetus) with a fixed style direction. Every clip is then transcribed by `gemini-3.8-flash` and compared with the script. The TTS model sometimes reads its directions aloud, invents an intro or repeats a sentence, so a take that doesn't match is generated again. Each take that passes also gets word timings. Clips that already passed are kept; `--force` redoes them, `--realign` redoes only the word timings, and `--voice`, `--lines N3,N4` and `--out` pick what to generate and where. The TTS model allows 10 requests a minute, so a full run takes a few minutes.

If a proxy adds the API key to requests instead, leave `GEMINI_API_KEY` unset and run `NODE_USE_ENV_PROXY=1 node tts.js` so that Node's `fetch` goes through the proxy.

## Checking without watching

```sh
npm install                      # Playwright, for headless Chromium
node frames.js 12.5 47.2         # single frames: out/frames/t0012.50.png …
node frames.js --sheet --every 1 # a contact sheet of the whole video
node frames.js --perf            # drawing time per frame
node mix.js --stems              # the soundtrack as WAV, with levels (needs ffmpeg)
```

## Layout

| Path | What it is |
| --- | --- |
| [`script.md`](script.md) | Narration, storyboard, sound plan and fact sheet for the chosen short |
| [`video-concepts.md`](video-concepts.md) | The first brainstorm: story angles and treatments at about 2, 9 and 20+ minutes |
| `player.html`, `serve.js`, `src/player.js` | The real-time preview |
| `src/timeline.js`, `src/render.js`, `src/scenes/`, `src/lib/` | Timeline, frame renderer, scenes and drawing helpers |
| `src/audio/` | Soundtrack: DSP, instruments, music and the mix |
| `src/fonts/` | Subsets of DejaVu Sans and Sans Mono, so text renders the same everywhere ([licence](src/fonts/LICENSE)) |
| `tts.js`, [`voice/`](voice) | The narration: Gemini TTS per line with a transcription check and word timings, and the clips it made |
| `frames.js`, `mix.js` | Checks: frames and contact sheets in headless Chromium, and the soundtrack in Node |
| [`reports/Xerox Alto explainer research.md`](reports/Xerox%20Alto%20explainer%20research.md) | The research report: history, hardware, software, networking and printing, influence, restoration, conflicting sources, myths, story hooks and numbers to double-check |
| [`research_notes/`](research_notes) | Raw research notes: the general round, and a processor deep dive from primary sources |

## A note on sources

The first research round ran in an environment that blocked most primary-source sites, so the general report marks which claims come from documents read in full and which only from search-result summaries (marked †). The processor deep dive came later, with those sites open. It rests on the Alto Hardware Manuals, Xerox's 1979 microcode listing, the schematics and Thacker et al.'s 1979 paper, and `script.md` has a fact sheet tracing each narrated claim to them.
