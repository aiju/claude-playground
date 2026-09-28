# Video concepts

Brainstorm for the Xerox Alto explainer: the story I'd like to tell, a visual and sound language, and treatments at three lengths. The facts behind all of this are in [the research report](reports/Xerox%20Alto%20explainer%20research.md). Figures that the research could only confirm from search snippets are marked *(check)*; they need a primary-source look before they go into a final script.

## The story: a computer wasted on one person

Most Alto videos tell one of two stories. One is a list of firsts: mouse, windows, Ethernet, laser printer. The other is the "Steve Jobs stole it and Xerox fumbled the future" legend. The first is a list rather than a story. The second is half myth, and it has been done many times.

I'd rather tell the story that the hardware itself tells, because it is both technical and historical:

> In 1972 a computer was far too expensive to spend on one human. The Alto did exactly that, and extravagantly: nearly half its memory held the picture on the screen, and more than half its processor's time went to drawing it. The program you wrote ran in the gaps between pixels.

The argument runs like this:

1. **The world in 1972.** Computers were time-shared. The expensive thing was the machine, so many people queued for one. Terminals stored characters: an 80×24 screen is about 2 KB.
2. **The bet.** Butler Lampson's "Why Alto" memo (December 1972) and Alan Kay's framing say the same thing: build now, at a high price, the machine that will be cheap in ten years, and find out what people do with it. Chuck Thacker started building on 22 November 1972. The first one worked in April 1973 and cost roughly $12k to build *(check)*. Lampson reckoned that a product version in 1974 would have cost about $40,000 (roughly $260k today *(check)*) and "would have had few buyers".
3. **The extravagance, made concrete.**
   - The screen is 606×808 pixels, with one bit in memory for every pixel. That is 61,408 bytes of a 128 KB machine: nearly half.
   - Keeping it on screen used roughly 60% of the processor's cycles. That figure is from the 1979 paper *(check)*; a count from Xerox's microcode gives about 51% for the display-word task alone, so they agree.
4. **The trick that paid for it.** The Alto had no display controller, no disk controller and no network controller. A single microcoded processor did all of those jobs:
   - It switched between up to 16 hardware "tasks" on every microinstruction, in priority order, at no cost.
   - Display, disk, Ethernet and memory refresh all had higher priority than the task that ran your program. The disk-word task outranks even the display, because a disk word that arrives late is lost for good.
   - That task, which emulated the instruction set you actually programmed, was **task 0, the lowest priority**. The "computer" got the leftovers.
5. **What the extravagance bought.**
   - Bitmapped type: Bravo, the WYSIWYG editor.
   - Overlapping windows and live objects: Smalltalk.
   - A printer that could print whatever the screen showed.
   - An Ethernet clocked from the same 170 ns heartbeat: one bit every two cycles, hence the odd 2.94 Mbit/s.
   - Email, file servers, and network games like Maze War.
6. **The bet paid off, just not for Xerox.** About 2,000 Altos were built, and none were sold as a product. Ten years after Lampson's hypothetical $40,000 product, in January 1984, the Macintosh shipped with 128 KB of memory (the Alto's standard size), a bitmapped screen and a mouse, for $2,495. Today the device in your hand spends much of its power, and a good chunk of its chip, on its screen, and nobody calls that a waste.

This story gives the video an idea to explain, not just a list of events. It also gives it a hero visual that no other Alto video has: the scanline timeline, where you watch the processor's cycles being handed out and your program getting the leftovers. And it deals with the Jobs myth in passing (see the research report) instead of building everything around it.

The research report ends on a different framing that's worth taking seriously: **the network is the story, not the box.** A lone Alto was an expensive terminal. An Alto on Ethernet, with file servers, Grapevine mail and a laser printer, was the modern office ten years early. I agree, but a network story needs room to set up all its parts, so it suits the medium-length video better than a short. Treatment B below uses both: the box's "task zero" trick as the way in, and the network as the spine.

Working titles: **"Task Zero"**, **"Your Program Runs in the Gaps"**, **"A Computer Wasted on One Person"**.

## Visual language

- **1-bit, Alto-native.** Most frames are black on paper-white, with dithered shading and a portrait 3:4 "screen" as the recurring frame. Everything is drawn from scratch in JS, including an original bitmap typeface in the spirit of the Alto's fonts, not a copy of them.
- **Three accent colours: red, yellow, blue.** The Alto's mouse buttons were officially named RED, YELLOW and BLUE. Those are the only colours in the video. They colour-code things like the tasks in the scheduler timeline and the three layers of the network.
- **The first picture on an Alto was Cookie Monster**, sketched by Alan Kay on the group's painting system. We shouldn't draw the character. The narration can say it, while the screen shows an original pixel-art cookie with a bite taken out.
- **Hero visuals** (each could be a reusable scene module):
  1. **Scanline timeline.** One 38.08 µs scanline is exactly 224 cycles of 170 ns. The slots fill in colour by task: display word, cursor, memory refresh, disk words cutting in, and the emulator in grey filling the gaps.
  2. **Memory bar.** 128 KB, with 60 KB lighting up as "the screen".
  3. **Priority encoder as a game.** Tasks raise their hands; the highest one wins the next cycle. The disk-word task always wins, and the emulator only gets a turn when nobody else has a hand up.
  4. **Scan-out.** The bitmap drawn onto the screen line by line, zooming in to single bits in memory words.
  5. **Piece table.** A Bravo edit that never moves the text, only the descriptors.
  6. **Ethernet.** Packets on a coax line, collisions, and binary exponential backoff as dice with more and more sides.
  7. **Laser page.** A page built up from scanlines at 1 page per second.
  8. **Disk sector.** Header, label and data. The labels let the Scavenger rebuild a scrambled disk.
  9. **Recreated screens.** Bravo, Laurel, Smalltalk-76 and the Executive, rebuilt from the layouts described in the 1976 Alto User's Handbook and Lampson's 1986 paper.
  10. **Price tags.** An Alto as a 1974 product, per Lampson: about $40,000, never offered for sale. Mac 128K, 1984: $2,495.
- **No real people's voices, and no photos.** People appear as names, dates and their paraphrased ideas. The TTS narrator never plays Kay, Jobs or anyone else.

## Sound design

All of it can be synthesised in JS, the way the music projects in this repo already work (the code gets copied and adapted, not imported):

- **Alto ambience:** a fan hum and the whine of the Diablo disk spinning up (spin-up took roughly 20 s to a minute), plus head-seek clunks on every disk access.
- **UI foley:** keyboard clacks and a soft click for each mouse button.
- **The "heartbeat":** a slowed-down pulse train standing in for the 170 ns microcycle. It is pitched per task, so the scanline timeline is audible: display task high, disk low, emulator a soft tick in the gaps.
- **Ethernet:** short noise bursts for packets, a "bonk" for a collision, and rising pitches for backoff.
- **Laser printer:** motor whir and paper feed.
- **Music (optional):** a sparse synth pad. Alan Kay notes the Alto could play 12-voice music in real time, so a quiet 12-voice chord at the end would be a nice nod.

## Treatments

### A. Short: "Task Zero" (≈2–2½ min, ≈320 words of narration)

**Recommended.** I'd also make this one **vertical (9:16)**: the Alto's screen was portrait, like a phone's. A 1080×1440 Alto screen fills most of the frame, with room for captions. The last beat, the phone in your hand, then lands in the format people are watching it in.

| Time | Beat | Narration idea (sketch, not script) | Visual |
| --- | --- | --- | --- |
| 0:00 | Hook | "In 1973, a computer was too expensive to waste on one person. This one was built to be wasted." | A mainframe with a queue of terminals and people waiting. The queue dissolves into one desk, one person, one machine. |
| 0:12 | The bet | PARC's Computer Science Lab. Lampson's pitch: build now what will be cheap in ten years. Thacker starts on 22 Nov 1972. | The portrait screen frame appears. A calendar flips Nov → Apr. |
| 0:30 | First light | April 1973: the first picture on the screen was Cookie Monster. | A scanline sweeps down and draws an original pixel cookie with a bite taken out. |
| 0:40 | Half the memory | Every pixel is a bit, so 606×808 bits come to about 60 KB of a 128 KB machine. A text terminal needed about 2 KB. | The memory bar fills to 47%. The terminal's 2 KB shows as a sliver beside it. |
| 0:58 | One processor, sixteen jobs | There's no display controller and no disk controller. One processor switches between 16 tasks on every cycle, for free. | The priority-encoder game, with tasks raising their hands. |
| 1:15 | Task zero | One scanline is 224 cycles. Display, disk and refresh take theirs first, and your program, task 0, gets what's left: roughly 40% of a visible line. | The **scanline timeline**, slowed down and audible, then zoomed out to a whole frame. |
| 1:40 | What it bought | WYSIWYG, windows, laser printing, Ethernet, email, Maze War. About 2,000 built, none ever sold. | A quick montage of the recreated screens, 1-bit throughout, each tagged with its year. |
| 1:58 | Payoff | Jan 1984: 128 KB, bitmap and mouse for $2,495. Apple had toured PARC in 1979. The waste became the default. | The price curve. The Alto frame morphs into a compact Mac-like outline, then into a phone outline. |
| 2:15 | Button | "Your screen still gets the cycles first." | A single scanline and the title card **TASK ZERO**, with a soft 12-voice chord. |

Before writing the script, decide: one Apple line or none? The Jobs story is so well known that leaving it out entirely can look like an omission. One accurate sentence is enough in a short: Apple visited PARC in December 1979, in a deal that let Xerox buy pre-IPO Apple stock. It fixes the myth without spending time on it.

### B. Medium: "One Keystroke, 1978" (≈8–10 min)

This keeps the same thesis, but the spine is a single journey, which works well for technical viewers. We follow **one keystroke** typed by a PARC researcher in 1978 all the way to a printed page and an email. Along the way we pass through every layer of the system, and each stop is a short deep dive:

1. **Cold open.** Night at PARC. A person sits down, puts in their own disk pack (you carried your files around physically) and boots. The Diablo spins up.
2. **Key down.**
   - The keyboard is just four memory-mapped words. No interrupt.
   - The emulator task polls them, and the emulator is task 0.
   - Here we introduce the microcoded processor and task switching, and bring in the scanline timeline.
3. **Into Bravo.**
   - The character lands in a piece table: edits splice descriptors and never move the text.
   - Bravo's modes, then Gypsy's rebellion: modeless editing, cut/copy/paste, double-click.
   - Larry Tesler's NO MODES licence plate.
4. **Onto the screen.**
   - BitBLT redraws the line.
   - The display task scans the bitmap out: 60 KB, most of the cycles.
   - Aside: overlapping windows in Smalltalk, and children building tools in it.
5. **Save.**
   - The disk sector's header, label and data.
   - Every block knows which file and page it belongs to, so the Scavenger can rebuild a scrambled disk in about a minute.
   - The OS gets out of your way: the "junta".
6. **Print.**
   - A Press file goes onto the Ethernet. Explain 2.94 Mbit/s, CSMA/CD and backoff, with Metcalfe's May 1973 memo sketch redrawn.
   - Pup gateways link the nets (about 25 networks by 1980).
   - The laser printer: 500 dpi, a page per second, 1973.
7. **Send.**
   - Laurel and Grapevine mail.
   - Maze War players shooting each other across the same wire.
   - The Worm programs that ran on 100+ Altos overnight, until one went wrong.
8. **Zoom out.**
   - Futures Day (Boca Raton, 10 Nov 1977). Xerox's executives saw all of it, and the company backed its Dallas division's word processors instead *(check)*.
   - December 1979: the Apple visits and the pre-IPO stock deal. Apple saw Altos, but the famous moment happened on a Dorado, the Alto's successor: Jobs complained about jumpy scrolling, and Dan Ingalls made it smooth in under a minute, live, because Smalltalk could be changed while it ran (Kay's account).
   - Myth check: Apple's plans already called for a bitmap display and a pointing device *(check)*, and Atkinson's regions went beyond what Smalltalk did *(check)*. Xerox did profit, from the laser printer, and its lawsuit against Apple failed mainly because it was filed too late.
   - The diaspora: Word, 3Com, Adobe, Lisa/Mac, SUN.
9. **Coda.**
   - 2016: Y Combinator's Alto (donated by Alan Kay) is restored. There's smoke from a miswired probe, a dead inverter gate, and a boot disk overwritten with random data decades ago by a disk-test program.
   - In 2026 you can run an Alto, and its laser printer, in an emulator. The last shot is the keystroke from the cold open, still on the screen.

### C. Long: "Personal Distributed Computing" (≈20–25 min), sketch only

A chaptered documentary. It would only be worth doing if B works.

1. **1970:** why a copier company founded a computer lab; Taylor's ARPA network of people; the MAXC clone.
2. **1972:** "Do you have any money?", the Why Alto memo, and the bet.
3. **The machine:** B's hardware stops, expanded (microinstruction format, BitBLT, memory, refresh done in microcode).
4. **The software:** Alto OS, BCPL, Mesa, Bravo/Gypsy, Smalltalk, Markup/Draw/Sil.
5. **The network:** Ethernet, Pup (and Xerox's lawyers keeping it out of the TCP discussions), servers, the Worm.
6. **The printer:** Starkweather's laser printer, and the Xerox 9700 that paid for a lot of research.
7. **Fumbling the future?** Futures Day, the Star, the Jobs visits, the lawsuit, and a fair verdict.
8. **The afterlife:** the diaspora, restoration, emulation, the 2023 archive release, and PARC's handover to SRI.

## Other angles I considered

- **"Did Xerox really fumble the future?"** as a myth-busting piece. It works well as a companion short to A, but it's weaker as the main video.
- **The restoration as a frame story**, opening on the 2016 power-up. It's gripping, but it's CuriousMarc's and Ken Shirriff's story, told well in their own videos and posts. Better as a coda.
- **"Everything on one desk"**: a guided tour of an office in 1978 where every object is a first. It's pretty, but it's a list again, and B does the same job with a spine.
- **A PARC people portrait** (Taylor's Dealer meetings, beanbag chairs, the Class One/Class Two argument rules). It's great colour, but it would need a lot of material about real people that we'd have to paraphrase carefully. I'd use a few moments from it inside B or C.

## Suggestions for the pipeline

- **Audio first.** Generate the narration line by line with Gemini TTS, measure each clip, then build the visual timeline from the real durations rather than guessing. Scenes are functions of time `t` that draw one frame on a canvas, so rendering is deterministic and any scene can be re-rendered on its own.
- **Rendering.** Headless Chromium through Playwright is already installed, so the scenes can use the normal Canvas 2D API and render frame by frame. H.264 encoding needs an ffmpeg with libx264; the ffmpeg bundled with Playwright here only does VP8, so we'd add `ffmpeg-static` from npm.
- **Gemini TTS.** The API endpoint is reachable from this environment, but no API key is set. We'll need a `GEMINI_API_KEY` added as an environment secret before the audio step. One consistent narrator voice, with the style prompt kept short and fixed across lines.
- **What goes into git.** Commit the source, the script and the final compressed video (well under 10 MB for a 2-minute 1-bit-style video at 1080×1920). Keep frames, raw TTS wavs and intermediate renders in a `.gitignore`d `out/`.
- **A fact-check pass before scripting.** The research environment blocked Wikipedia, bitsavers, righto.com and computerhistory.org, so some numbers rest on search snippets. The report has a list of numbers to double-check. If you can allow those domains for a later session, I'll verify every number the script actually uses against the primary source.
