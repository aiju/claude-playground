# Xerox Alto explainer

An explainer video about the Xerox Alto (Xerox PARC, 1973), made for technically minded viewers who aren't hardware engineers. The plan is to generate the visuals and sound effects in JavaScript and the narration with Gemini TTS.

The chosen direction is **Task Zero**: a two-minute 9:16 short that is all about the Alto's microcoded processor. The script and storyboard are in [`script.md`](script.md). The narration and style frames render; the full video doesn't yet.

## Render the style frames

```sh
npm install        # Playwright, for headless Chromium
node stills.js     # writes out/stills/*.png at 1080x1920
```

Scenes are drawn on a 540x960 canvas, snapped to a five-colour palette (ink, paper and the Alto mouse buttons' red, yellow and blue), then scaled up with nearest-neighbour sampling.

## Generate the narration

```sh
GEMINI_API_KEY=… node tts.js   # one clip per script line: out/voice/N1.wav …
node narration.js              # joins them: out/narration.wav, plus a timeline in out/narration.json
```

`tts.js` reads the narration lines (N1…N16) from `script.md` and sends each to Gemini TTS (`gemini-3.8-flash-tts`, voice Charon) with a fixed style direction. Every clip is then transcribed by `gemini-3.8-flash` and compared with the script. The TTS model sometimes reads its directions aloud, invents an intro or repeats a sentence, so a take that doesn't match is generated again. Clips that already passed are kept; `--force` redoes them, `--voice`, `--lines N3,N4` and `--out` pick what to generate and where. The TTS model allows 10 requests a minute, so a full run takes a few minutes.

If a proxy adds the API key to requests instead, leave `GEMINI_API_KEY` unset and run `NODE_USE_ENV_PROXY=1 node tts.js` so that Node's `fetch` goes through the proxy.

## Layout

| Path | What it is |
| --- | --- |
| [`script.md`](script.md) | Narration, storyboard, sound plan and fact sheet for the chosen short |
| [`video-concepts.md`](video-concepts.md) | The first brainstorm: story angles and treatments at about 2, 9 and 20+ minutes |
| `src/`, `stills.js` | The renderer: palette, frame quantizer, drawing helpers and scenes |
| `tts.js`, `narration.js` | The narration: Gemini TTS per line with a transcription check, then one track and a timeline |
| [`reports/Xerox Alto explainer research.md`](reports/Xerox%20Alto%20explainer%20research.md) | The research report: history, hardware, software, networking and printing, influence, restoration, conflicting sources, myths, story hooks and numbers to double-check |
| [`research_notes/`](research_notes) | Raw research notes: the general round, and a processor deep dive from primary sources |

## A note on sources

The first research round ran in an environment that blocked most primary-source sites, so the general report marks which claims come from documents read in full and which only from search-result summaries (marked †). The processor deep dive came later, with those sites open. It rests on the Alto Hardware Manuals, Xerox's 1979 microcode listing, the schematics and Thacker et al.'s 1979 paper, and `script.md` has a fact sheet tracing each narrated claim to them.
