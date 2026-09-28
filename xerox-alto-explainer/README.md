# Xerox Alto explainer

An explainer video about the Xerox Alto (Xerox PARC, 1973), made for technically minded viewers who aren't hardware engineers. The plan is to generate the visuals and sound effects in JavaScript and the narration with Gemini TTS.

The chosen direction is **Task Zero**: a ~110-second 9:16 short that is all about the Alto's microcoded processor. The script and storyboard are in [`script.md`](script.md). Style frames render; the full video doesn't yet.

## Render the style frames

```sh
npm install        # Playwright, for headless Chromium
node stills.js     # writes out/stills/*.png at 1080x1920
```

Scenes are drawn on a 540x960 canvas, snapped to a five-colour palette (ink, paper and the Alto mouse buttons' red, yellow and blue), then scaled up with nearest-neighbour sampling.

## Layout

| Path | What it is |
| --- | --- |
| [`script.md`](script.md) | Narration, storyboard, sound plan and fact sheet for the chosen short |
| [`video-concepts.md`](video-concepts.md) | The first brainstorm: story angles and treatments at about 2, 9 and 20+ minutes |
| `src/`, `stills.js` | The renderer: palette, frame quantizer, drawing helpers and scenes |
| [`reports/Xerox Alto explainer research.md`](reports/Xerox%20Alto%20explainer%20research.md) | The research report: history, hardware, software, networking and printing, influence, restoration, conflicting sources, myths, story hooks and numbers to double-check |
| [`research_notes/`](research_notes) | Raw research notes: the general round, and a processor deep dive from primary sources |

## A note on sources

The first research round ran in an environment that blocked most primary-source sites, so the general report marks which claims come from documents read in full and which only from search-result summaries (marked †). The processor deep dive came later, with those sites open. It rests on the Alto Hardware Manuals, Xerox's 1979 microcode listing, the schematics and Thacker et al.'s 1979 paper, and `script.md` has a fact sheet tracing each narrated claim to them.
