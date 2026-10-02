# Hot Metal Maths

A proof-of-concept typesetter, in plain JavaScript, that sets mathematics the
way Oxford books of the 1940s did. The model is G. H. Hardy's
[*Divergent Series*](https://www.math.stonybrook.edu/~bishop/classes/math638.F20/DivergentSeries(G.H.Hardy).pdf)
(Clarendon Press, 1949), set in Monotype Modern on a royal octavo page.

It takes LaTeX-flavoured source and produces finished pages as SVG: running
heads, numbered sections, equations numbered on the left, footnotes marked †
and ‡, and signature letters at the foot of each gathering. The two samples are
Hardy's own pages 1–6 and 42–43. Typeset here, pages 1, 2, 3, 42 and 43 end on
the same line as in the printed book, and pages 4 and 5 within three lines.

## Running it

Serve the folder over HTTP (browsers won't load ES modules from `file://`) and
open `index.html`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

The page shows the source on the left and the typeset proofs as book spreads on
the right, updating as you type. *Impression* sets how hard the type is
pressed into the paper, from a light kiss to a heavy squeeze; *Letterpress*
switches between printed and clean digital type. *Zoom* goes from half to ten
times the real size of the page (*Fit* fits it to the window); you can also
zoom with ctrl or ⌘ and the scroll wheel, or by pinching on a trackpad, and
drag a zoomed page about with the mouse.

From the command line, one SVG per page (they need a browser or another
viewer that handles SVG filters):

```sh
node tools/render.mjs samples/hardy-divergent-series.tex out/
```

No dependencies to install. Node 18 or later.

## The markup

```latex
\chapter{Introduction}                 % or \chapter[III]{General theorems}
\section{The sum of a series.} The series
$$\sum_0^\infty a_n = a_0+a_1+a_2+\dots$$
is said to be \emph{convergent}, to the sum $s$, if the `partial sum' ...
$$\no\label{geom} 1+x+x^2+\dots = \frac{1}{1-x}$$
... the left-hand side of \eqref{geom} ...\footnote{A note.}
```

| Markup | Result |
| --- | --- |
| `\chapter{Title}` | new chapter on a new page; `[III]` sets the numeral |
| `\section{Title.}` | numbered run-in heading in bold, **1.2.** |
| `$...$`, `$$...$$` | maths in the text, displayed maths |
| `\no`, `\label{k}` | in a display: number the equation, (1.2.3), at the left margin |
| `\\`, `&` | in a display: new line, alignment point |
| two `\no` on one line | equations side by side, as in Hardy's (1.1.1)–(1.1.8) |
| `\eqref{k}`, `\ref{k}` | (1.2.3), 1.2.3 |
| `\frac12` | ½ as a small case fraction (any fraction of two plain numbers) |
| `\tfrac`, `\dfrac` | text-size and display-size built-up fractions |
| `\sum`, `\Sum`, `\int` | small sum, large sum, upright integral |
| `\le`, `\ge` | the slanted ⩽ and ⩾ Hardy uses |
| `\footnote{...}` | footnote, marked †, ‡, §, ‖, ¶ afresh on each page |
| `\begin{theorem}...\end{theorem}` | THEOREM 1. and an italic statement |
| `\begin{items} \item[(A)] ... \end{items}` | list with hanging indentation |
| `\emph`, `\textbf`, `\textsc`, `\textup` | italic, bold, small capitals, upright |
| `\S`, `\SS`, `~`, `--`, `` `...' `` | §, §§, tie, en dash, single quotes |
| `\noindent`, `\newpage`, `\pagenumber{42}` | |

Maths mode knows the usual TeX symbols, Greek, `\mathfrak`, `\mathcal`,
`\mathbb`, `\mathrm`, `\text`, `\left`/`\right`, `\big` and friends,
`\sqrt`, `\overline`, operator names (`\sin`, `\cosec`, `\lim`, ...) and the
spacing commands.

## How it works

Everything from the fonts up is done here; nothing is delegated to the
browser's text layout.

- **Fonts** (`tools/build-fonts.py`, `fonts/`, `src/font.js`): New Computer
  Modern Book, a heavier cut of Knuth's Computer Modern, which was itself drawn
  from Monotype Modern. A build script turns it into JSON: outlines as SVG
  paths, metrics, kerning, ligatures, small capitals and the OpenType MATH
  table. It also raises the x-height by 8%, since Monotype Modern Extended,
  Oxford's face, has a larger one than Computer Modern.
- **Paragraphs** (`src/linebreak.js`, `src/hyphenate.js`, `src/compose.js`):
  Knuth and Plass's total-fit line breaking, as in TeX, with Liang's
  hyphenation. The classic TeX patterns turn out to hyphenate the way Hardy's
  compositors did (mathe-matician, repre-sentations, interpreta-tion), which
  modern Oxford patterns don't. Wider spaces after full stops, as was usual.
- **Maths** (`src/math/`): a TeX-style parser and layout following the rules
  of Appendix G of *The TeXbook* with the font's MATH parameters, changed
  where Oxford's house style differed from TeX's.
- **Pages** (`src/pages.js`): TeX's method of choosing page breaks by cost,
  with footnotes taking room from the page they fall on, pages filled out to
  the same depth, and no page ending just before a display.
- **Drawing** (`src/svg.js`): each glyph is a path, so the pages look the same
  everywhere.
- **Printing** (`src/letterpress.js`): the type is printed rather than drawn
  (see below).

## Printing

A letterpress page is not a clean vector drawing, and that is most of what
makes a scan of an old book look old. The renderer imitates how inked metal
type meets uncoated paper:

- **Squeeze.** Under pressure the ink is pushed a little past the edge of each
  letter. The filter blurs the type and cuts it again further out, so corners
  round off and the brackets of the serifs fill in.
- **Fibres.** The paper's fibres make that edge ragged. A fine noise field
  moves the cut in and out, but only near an edge, so it never puts ink where
  there was none.
- **Sorts.** Every letter was a separate piece of metal. Each glyph gets its
  own ink density, its own height (a low sort prints thinner and may break up,
  as a few in Hardy's book do), and a tiny shift and twist. These come from a
  random generator seeded with the page number, so a page always prints the
  same way.
- **Inking.** The rollers lay ink unevenly across the page; the squeeze
  leaves the middle of a stroke a shade lighter than its edges; and the
  paper's tooth leaves specks the ink missed.
- **Paper.** Faint grain running with the machine direction, a cloudier
  unevenness, and the page on the other side of the leaf showing through,
  mirrored.

Most of this lives in SVG filters, with every length in points, so the texture
belongs to the paper and doesn't change as the page is zoomed. The filters do
work at screen resolution, though, and detail finer than a pixel would only
alias. So `render()` takes the number of device pixels per point the page will
be shown at: at reading size the ink edge stays soft and the fine texture
fades out; zoomed in, it all comes back. The demo works this out from the page
size and the screen; the command line assumes 4 pixels per point. The
settings are under `letterpress` in `src/style.js`; set it to `null` for
clean digital type.

## The house style

What makes the pages look like the book rather than like LaTeX:

- no space around binary operators: a₀+a₁+a₂+..., 1−x
- the ellipsis is three full stops on the line: 1−1+1−...
- ½, ¼ and the like are small case fractions, even in displays
- square roots have no bar over them: √3, and √(n+1) for anything longer
- integrals are upright and take their limits above and below
- sums in displays are usually the small ∑, with limits above and below
- the decimal point is raised and the leading zero dropped: ·4142
- equation numbers (chapter.section.number) sit at the left margin; a display
  too wide to share a line with its number puts the number on the line above
- a display too wide to align is set with its first line to the left and its
  continuation to the right
- sections are run in, in bold: **1.3. First definitions.** The results...
- running heads in spaced capitals, with "1.2]" and the folio on rectos and
  the folio and "[Chap. I" on versos; none on a chapter's first page
- a signature letter (B, C, D, ...) at the foot of the first page of each
  gathering of sixteen
- one-line footnotes are centred
- 10½pt type on 13pt leading, 27 picas wide, 39 lines to the page

The measurements are in `src/style.js`.

## What it doesn't do yet

This is a proof of concept. It has one house style; footnotes never break
across pages; accents other than `\overline` aren't supported; there are no
tables, figures, indexes or contents pages; displays can't go inside
footnotes; and there is no PDF output (print the SVG pages from a browser
instead).

## Credits and licences

- Fonts: derived from New Computer Modern by Antonis Tsolomitis, GUST Font
  License; see `fonts/README.md`.
- Hyphenation patterns: Frank Liang's, with Gerard Kuiken's additions, from the
  hyph-utf8 package; see the notice in `hyphenation/en.js`.
- Sample text: G. H. Hardy, *Divergent Series* (Oxford, 1949), chapters I and
  III, included for comparison with the printed book.
