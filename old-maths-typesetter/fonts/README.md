# Font data

These JSON files hold glyph outlines and metrics for the typesetter. They are
**derived from New Computer Modern** by Antonis Tsolomitis (Book weight, 10pt
and 8pt designs, and New Computer Modern Math), which is released under the
[GUST Font License](http://tug.org/fonts/licenses/GUST-FONT-LICENSE.txt).

They are modified versions, not the original fonts:

- only the glyphs the typesetter uses are kept;
- the lowercase letters have a larger x-height, to come closer to Monotype
  Modern Extended, the face of Oxford's mathematics books of the 1940s;
- the outlines have been converted from OpenType to SVG path data.

`tools/build-fonts.py` regenerates them from the original fonts, which it
downloads from CTAN.
