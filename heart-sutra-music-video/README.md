# 般若 · Heart Sutra music video

A music video for a Heart Sutra song (Japanese verses, Sanskrit chant) made from
watercolour inkblots. It is painted live in the browser by WebGL shaders: folded
Rorschach blots, gold ink on indigo paper, sumi-e bamboo, a lotus at sunrise and
a closing ensō. The lyrics write themselves onto the page as they're sung,
stroke by stroke in calligraphic Japanese and syllable by syllable in Devanagari.

The scene-by-scene plan is in [OUTLINE.md](OUTLINE.md).

## Watch it live

```sh
node tools/serve.mjs      # then open http://localhost:8080
```

Click or press space to play. ← and → skip 5 s, the small ◀︎ 1f and 1f ▶︎
buttons (or , and .) step one frame at 30 fps, and F goes fullscreen. You can
jump to a scene from the menu or start at a time with `?t=83`. There's a
resolution menu if a scene stutters. You'll need a browser with WebGL2.

## Fix the timing

`timing.html` (with the server running, http://localhost:8080/timing.html) is
the timing editor. It plays the song under a scrolling view of every syllable
where the video places it, in kana and kanji or in transcription, over a
spectrogram of the singing. It also shows the lyric lines, scenes and their
handovers, the moments the scenes act on, and the drum hits and beat detected
in the audio. It reads the same timing code as the video (`src/schedule.js`),
and its edits change the same objects the video draws from, so what it shows
is what the video does.

It can play at half speed without changing the pitch, and it can play and draw
the separated vocals from `audio/vocals.mp3` if that file exists (it isn't
committed; see below).

Everything on it can be dragged: a syllable, either end of a syllable, the
syllables of a kanji, a group of syllables (⇧-click or ⇧-drag to select them),
a whole line, when a line is on screen, scene starts and handover lengths,
beats, sections and passages of other singing. Syllables that touch move
together, and ⌥-drag pulls them apart. ⌥← and ⌥→ nudge the selection by 10 ms.
Pressing J while it plays sets the selected syllable's start and moves on to
the next one; holding J sets its end too. There are clicks at every onset to
check the timing against the singing, and ⌘Z to undo. The page lists all the
keys.

Edits are saved as they're made, as the current value of every timing plus a
log of every edit (so they can be undone, even after a reload, and the
original values rebuilt). On the published page they go into the page's own
database; locally, into the browser. **Download edits** saves both as JSON, and

```sh
node tools/apply-timing.mjs heart-sutra-timings.json
```

writes the timings into `src/alignment.js`, `src/lyrics.js` and
`src/timeline.js`, rewriting only the numbers that changed, and checks that
the files read back the same.

`node tools/build-preview.mjs` packages the player into `out/preview/`, and
`node tools/build-preview.mjs timing` the timing editor into `out/timing/`, so
either can be hosted as a static page. Published, the editor needs the
artifact's `db` capability to save to its database, and `downloads` for its
download button.

## Render the video

```sh
npm install
node tools/render.mjs                                   # the whole video and its credits, into out/heart-sutra.mp4
node tools/render.mjs --from 212 --to 230 --out out/enso.mp4
node tools/render.mjs --gpu --fps 60                    # use this machine's GPU
```

You need ffmpeg (or set `FFMPEG=/path/to/ffmpeg`). Without `--gpu` it renders
on the CPU with SwiftShader, at about 2 s per 1080p frame.

## The final render, for YouTube (on a Mac)

`tools/render-youtube.mjs` renders the whole video on the GPU at 3840×2160 and
60 fps, in the format YouTube recommends (H.264 High in MP4, BT.709, keyframes
every half second, AAC at 384 kbps), and writes everything that goes up with
it into `out/youtube/`.

Once, to set up:

1. Install [Google Chrome](https://www.google.com/chrome/) and
   [Homebrew](https://brew.sh), then `brew install node ffmpeg`.
2. Get the project and its one dependency:
   ```sh
   git clone https://github.com/aiju/claude-playground.git
   cd claude-playground/heart-sutra-music-video
   npm install
   ```
3. Copy the song's lossless master into `audio/` as `master.wav` (or `.flac`,
   `.aif`). It stays on your machine: git ignores it. Without it, the render
   uses `audio/song.m4a`.

Then:

```sh
caffeinate -dims node tools/render-youtube.mjs --test   # 12 s, into out/youtube/test.mp4
caffeinate -dims node tools/render-youtube.mjs          # the whole video
```

`caffeinate` keeps the Mac awake; keep it plugged in. A Chrome window opens
(two, with the default `--jobs 2`): leave it on screen. The script prints
which GPU it's rendering on and stops if Chrome has fallen back to software,
then how long each frame takes and when it'll be done. It lines the master
up with `song.m4a`, which every timing was measured against, and prints the
offset it found. Watch the test through before the full run: problems that
only show on a real GPU would show there.

The render goes in 20-second chunks; if it stops for any reason, run the same
command again and it carries on from the last finished chunk. Try `--jobs 3`
if the frames come slowly and the Mac has memory to spare.

In `out/youtube/` afterwards:

| File | What to do with it |
|---|---|
| `heart-sutra-4k60.mp4` | Upload it |
| `heart-sutra.ja.srt` | YouTube Studio → Subtitles → Add language: Japanese → Upload file (with timing) |
| `heart-sutra.en.srt` | The same, as English: romanized lyrics over a translation |
| `description.txt` | Chapters and credits, for the description |
| `lyrics.txt` | The lyrics with romanization and translation, if you want them in the description |
| `thumbnail.jpg` | A frame for the thumbnail (`--thumbnail 186` picks another time) |

`node tools/youtube-extras.mjs` writes just the captions and text without
rendering. The captions come from `src/captions.js` (the romanization and
translation of each line), timed by the measured syllables.

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
| `src/timeline.js` | Scenes, their transitions and beats (the moments each one acts on), and the song's sections |
| `src/lyrics.js` | Lyric cues: when shown, text with readings (or Sanskrit transcription), placement, ink |
| `src/alignment.js` | When each line and syllable is actually sung (measured) |
| `src/schedule.js` | When each syllable is sung and each character written, from the readings in `lyrics.js` |
| `src/text.js` | Lays out the lyrics and writes each character while it's sung; sets the credits |
| `src/credits.js` | The credits after the song: who made it and what it's built on |
| `src/captions.js` | Romanization and English translation of every sung line, for the YouTube captions |
| `src/writing.js` | Time maps that say when the brush reaches each pixel of a glyph: for Japanese, each KanjiVG stroke is a brush moving over the font's glyph (strokes fitted to it, crossings inked by the earlier stroke, each stroke inking only the pieces of the glyph it runs through, the ink growing only outwards from where strokes touch down); for Devanagari, ink flowing through the letters, the headline appearing with them |
| `src/outlines.js` | Reads glyph outlines from the brush font's TrueType data: Japanese is drawn from them, and they tell the writing which parts of a character the font draws as separate pieces |
| `src/strokes.js` | Stroke paths for the lyric characters, generated from KanjiVG by `tools/fetch-strokes.mjs` |
| `src/strokes-traced.js` | Strokes traced by hand over the font's outlines for 色, 即, 是 and 空, which the chorus writes large; used instead of KanjiVG's for those four |
| `src/audio.js` | Decodes the song and finds loudness, drum hits and the beat for the visuals to react to |
| `src/renderer.js`, `src/main.js` | WebGL plumbing, the player, and the capture hook the tools use |
| `src/timing.js`, `src/spectrogram.js` | The timing editor |
| `src/edits.js`, `src/edit-ops.js`, `src/edit-store.js` | The editor's timings as JSON, its edit operations, and where it saves them (with the log for undo) |
| `tools/` | Static server, still and video renderers (and the final one for YouTube, with its captions and description), preview packager, font and stroke fetchers, alignment importer, timing writer and exporter |

Paint is tracked as optical density, so washes glaze over each other the way
transparent pigment does. Gold, white gouache and the lyrics sit on top as
opaque paint. Each frame depends only on the song time, so the offline render is
deterministic.

## Timing data

Everything time-based lives in three files, all in song seconds:

- **`src/alignment.js`**: when each lyric line is sung. `ALIGN` is keyed by
  the line's sung text plus which occurrence it is (`'ぎゃてい ぎゃてい#1'`,
  `'praj-nya pa-ra-mi-ta#3'`). Each entry has `start`, `end`, `conf`, `alt`,
  `unsure`, `note` and `sylls`, and `checked` once the line has been corrected
  by ear. `sylls` is `[start, end]` for every syllable. A syllable can end
  before the next one starts, for a breath or a rest; a character is written
  from its first syllable's start to its last one's end. `OTHER_SINGING`
  lists singing that isn't a lyric line.
- **`src/lyrics.js`**: the lines themselves. `t0`/`t1` is when a line is on
  screen, and the text carries readings (`'深[ふか]き'`) or, for Sanskrit, a
  hyphenated `roman`. Readings decide the syllables: small ゃゅょ join the kana
  before them, and Sanskrit splits on hyphens and spaces. At import time
  `lyrics.js` gives each line a `key` (its `ALIGN` key, or `deco:色#1` and
  `seal:ॐ#1` for the lines that aren't sung), matches it to its `ALIGN`
  entry and sets `cue.sylls`. Lines marked `deco` (the skandha kanji) and the
  `seal` (the last ॐ) aren't sung.
- **`src/timeline.js`**: `SCENES` (`t0`, handover length `tr`, transition
  `style`, and `beats`) and `SECTIONS`. Beats are the moments a scene acts on.
  A scene's first four beats reach its shader in order as `k0` (starts) and
  `k1` (ends) in scene time, so their order has meaning. For example, in
  *Full and empty* beat 0 fills the bowl, beat 1 drains it and beat 2 rinses
  the indigo away. Each beat's `label` says what it does.

**`syllable-timings.json`** holds the syllable timings from the first pass by
ear in the timing editor: for every sung line, each syllable's text, start
and end, whether the line was checked, and, where it changed, when the line is
on screen. They're worked into `alignment.js`, and the scenes, beats and
on-screen windows were retimed to them. `node tools/export-timings.mjs
edits.json` writes the file from the editor's edits (its download, or its
database state) for the next pass.

`src/schedule.js` turns a line into syllable times and character writing
times. The video, through `text.js`, and the timing editor both use it.
`src/edits.js` reads and writes every editable timing on those same objects
as plain JSON. The editor keeps its edits in that form, and
`tools/apply-timing.mjs` writes them back into the three files.

## Assets

- `audio/song.m4a`: the song (made with Suno).
- `fonts/`: [Yuji Syuku](https://fonts.google.com/specimen/Yuji+Syuku) and
  [Yatra One](https://fonts.google.com/specimen/Yatra+One), both under the SIL
  Open Font License. They're cut down to just the characters in the lyrics (and
  the credits); run `node tools/fetch-fonts.mjs` after changing them.
- `src/alignment.js`: when each lyric line and syllable is sung, generated by
  `node tools/import-alignment.mjs lines-aligned.json` from a forced-alignment
  run, then corrected by ear in the timing editor. That run separated the vocals with `audio-separator` (the Kim_Vocal_2
  model), then aligned the lyrics with stable-ts (Whisper large-v3 through
  faster-whisper) and with `ctc-forced-aligner` (MMS-300m), and combined the
  two. The separated vocals, saved as `audio/vocals.mp3`, are kept out of git.
- `src/strokes.js`: stroke order from [KanjiVG](https://kanjivg.tagaini.net) by
  Ulrich Apel and contributors, under CC BY-SA 3.0. Run
  `node tools/fetch-strokes.mjs` after changing the lyrics. The credits at the
  end of the video (`src/credits.js`) credit it, with the fonts and the aligners.
