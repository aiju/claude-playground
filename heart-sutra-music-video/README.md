# 般若 · Heart Sutra music video

A music video for a Heart Sutra song (Japanese verses, Sanskrit chant) made from
watercolour inkblots. It is painted live in the browser by WebGL shaders: folded
Rorschach blots, gold ink on indigo paper, sumi-e bamboo, a lotus at sunrise and
a closing ensō. The lyrics are brushed onto the page in calligraphic Japanese and
Devanagari as they're sung.

The scene-by-scene plan is in [OUTLINE.md](OUTLINE.md).

## Watch it live

```sh
node tools/serve.mjs      # then open http://localhost:8080
```

Click or press space to play. ← and → skip 5 s, and F goes fullscreen. You can
start somewhere specific with `?t=83`. You'll need a browser with WebGL2.

## Render stills

```sh
npm install                              # playwright-core, to drive headless Chromium
node tools/stills.mjs --storyboard       # one frame per scene, into out/stills
node tools/stills.mjs 83.5 187 --w 1280 --h 720
```

The script looks for Chromium at the path Playwright uses in Claude's sandbox.
Set `CHROMIUM=/path/to/chrome` to use another one. Without a GPU it renders on
the CPU (SwiftShader), at about 1–4 s per 1080p frame.

## How it works

| File | What it does |
| --- | --- |
| `src/glsl/lib.js` | Noise, shape distance functions and the watercolour kit: washes with pooled dark edges, granulation, backruns, brushed lines, splatter, folded blots, gold leaf, paper |
| `src/glsl/scenes.js` | One shader function per scene |
| `src/glsl/composite.js` | Builds a shader per scene (or per pair during a transition): paint, transition, lyric ink, paper |
| `src/timeline.js` | Scene list and transitions |
| `src/lyrics.js` | Lyric cues: time, text, placement, ink |
| `src/text.js` | Brushes lyrics into a canvas character by character; the shader turns that into ink |
| `src/audio.js` | Decodes the song and finds loudness, drum hits and the beat for the visuals to react to |
| `src/renderer.js`, `src/main.js` | WebGL plumbing, the player, and the capture hook the tools use |
| `tools/` | Static server, still renderer, font fetcher |

Paint is tracked as optical density, so washes glaze over each other the way
transparent pigment does. Gold, white gouache and the lyrics sit on top as
opaque paint. Each frame depends only on the song time, so the offline render is
deterministic.

## Assets

- `audio/song.m4a`: the song (made with Suno).
- `fonts/`: [Yuji Syuku](https://fonts.google.com/specimen/Yuji+Syuku) and
  [Yatra One](https://fonts.google.com/specimen/Yatra+One), both under the SIL
  Open Font License. They're cut down to just the characters in the lyrics; run
  `node tools/fetch-fonts.mjs` after changing them.
