#!/usr/bin/env python3
"""Turn OpenType fonts into the compact JSON glyph files the typesetter reads.

The typesetter does its own layout and draws every glyph as an SVG path, so it
needs outlines and metrics rather than font files. For each face this script
keeps only the glyphs we use and writes:

  glyph outlines (SVG path data, font units, y pointing up), advance widths
  and bounding boxes, the cmap, kerning pairs, ligatures, small capitals and,
  for the maths font, the OpenType MATH table (constants, italic corrections,
  size variants, extensible assemblies) and the script-size alternates.

The source fonts are New Computer Modern (GUST Font License), fetched from
CTAN into tools/.cache on first run. Needs Python 3 with fontTools:

    pip install fonttools
    python3 tools/build-fonts.py
"""

import json
import os
import sys
import unicodedata
import urllib.request

from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, ".cache")
OUT = os.path.join(HERE, "..", "fonts")
CTAN = "https://mirrors.ctan.org/fonts/newcomputermodern/otf/"

# Output name -> source file. Two optical sizes of the roman and italic, as a
# hot-metal foundry would have cut them: the 10pt design for the text, the
# 8pt design (sturdier and wider) for footnotes and other small matter.
FACES = {
    "roman": "NewCM10-Book.otf",
    "italic": "NewCM10-BookItalic.otf",
    "bold": "NewCM10-Bold.otf",
    "roman8": "NewCM08-Book.otf",
    "italic8": "NewCM08-BookItalic.otf",
    "math": "NewCMMath-Book.otf",
}

TEXT_CHARS = (
    [chr(c) for c in range(0x20, 0x7F)]
    + [chr(c) for c in range(0xA0, 0x100)]
    + list("‘’“”‚„–—‐†‡§¶‖•…·′″−€ŒœŠšŽžŸıȷ")
)

MATH_CHARS = (
    list("0123456789+-=<>()[]{}|/\\,;:.!?'*")
    + [chr(c) for c in range(0x1D434, 0x1D468)]  # math italic A-Z a-z
    + ["ℎ"]  # italic h
    + [chr(c) for c in range(0x1D6E2, 0x1D71C)]  # italic Greek
    + [chr(c) for c in range(0x0391, 0x03AA)]  # upright Greek capitals
    + [chr(c) for c in range(0x03B1, 0x03CA)]  # upright Greek lowercase
    + [chr(c) for c in range(0x1D504, 0x1D51E)]  # fraktur capitals
    + list("ℭℌℑℜℨ")
    + [chr(c) for c in range(0x1D49C, 0x1D4B6)]  # script capitals
    + list("ℬℰℱℋℐℒℳℛ")
    + list("ℕℤℚℝℂℙ")
    + list(
        "∑∏∐∫∬∭∮⋃⋂⋁⋀√∞∂∇±∓×÷·∘•⋅∗⋆∪∩∧∨¬∀∃∄∅∈∉∋⊂⊃⊆⊇≤≥⩽⩾≠≈≃≅≡∼∝≪≫"
        "→←↔⇒⇐⇔↦↑↓↗↘⟶⟵⟹|‖⟨⟩⌊⌋⌈⌉…⋯⋮⋱′″‴ℓℏ°∠⊥∥≺≻⊕⊗⊖∖−∣∤≍⋄◦†‡§"
    )
    + ["−"]
)

LIGATURES = {"ff", "fi", "fl", "ffi", "ffl", "f_f", "f_i", "f_l", "f_f_i", "f_f_l"}

# Glyphs picked by name: the upright integrals Oxford's Monotype cases had.
MATH_NAMED = ["integral.up", "integral.v1.up", "integral.v1"]


def fetch(name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print("downloading", name, file=sys.stderr)
        urllib.request.urlretrieve(CTAN + name, path)
    return path


# Monotype Modern Extended, the face of Oxford's mathematics books, has a
# larger x-height than Monotype Modern 8A, from which Computer Modern was
# drawn: in Hardy's book the x-height is 0.68 of the capital height, in
# Computer Modern 0.63. We make up the difference by stretching the lowercase
# letters between baseline and x-height and taking it back out of the
# ascenders, so capitals, figures and ascender tops stay where they are.
XHEIGHT_BOOST = 1.08
ASCENDER_TOP = 0.75  # in ems: points above this are left alone


class XHeightWarp:
    def __init__(self, xheight, upm, boost):
        self.xh = xheight
        self.top = ASCENDER_TOP * upm
        self.k = boost

    def __call__(self, y):
        xh, top, k = self.xh, self.top, self.k
        if y <= 0 or y >= top:
            return y
        if y <= xh:
            return y * k
        return k * xh + (y - xh) * (top - k * xh) / (top - xh)


def warped_names(font, is_math):
    """Glyphs whose x-height should grow: lowercase letters and their kin."""
    cmap = font.getBestCmap()
    names = set()
    for cp, g in cmap.items():
        ch = chr(cp)
        if unicodedata.category(ch) == "Ll" or ch in ":;":
            names.add(g)
    if not is_math:
        for g in font.getGlyphOrder():
            if g.endswith(".sc") or g in LIGATURES:
                names.add(g)
    return names


class CompactPathPen(BasePen):
    """SVG path data with integer coordinates and relative commands, which
    keeps the glyph files about half the size of plain absolute paths."""

    def __init__(self, glyphset, warp=None):
        super().__init__(glyphset)
        self.out = []
        self.x = self.y = 0
        self.warp = warp

    def _pt(self, pt):
        return (pt[0], self.warp(pt[1])) if self.warp else pt

    def _nums(self, *vals):
        s = ""
        for v in vals:
            t = str(v)
            s += t if (not s or t.startswith("-")) else " " + t
        return s

    def _rel(self, pt):
        pt = self._pt(pt)
        x, y = round(pt[0]), round(pt[1])
        d = (x - self.x, y - self.y)
        self.x, self.y = x, y
        return d

    def _moveTo(self, pt):
        pt = self._pt(pt)
        x, y = round(pt[0]), round(pt[1])
        self.x, self.y = x, y
        self.out.append("M" + self._nums(x, y))

    def _lineTo(self, pt):
        dx, dy = self._rel(pt)
        if dy == 0:
            self.out.append("h" + self._nums(dx))
        elif dx == 0:
            self.out.append("v" + self._nums(dy))
        else:
            self.out.append("l" + self._nums(dx, dy))

    def _curveToOne(self, p1, p2, p3):
        x0, y0 = self.x, self.y
        p1, p2 = self._pt(p1), self._pt(p2)
        a = (round(p1[0]) - x0, round(p1[1]) - y0)
        b = (round(p2[0]) - x0, round(p2[1]) - y0)
        c = self._rel(p3)
        self.out.append("c" + self._nums(*a, *b, *c))

    def _closePath(self):
        self.out.append("z")

    def getCommands(self):
        return "".join(self.out)


def lookups_for(table, tag):
    """All lookups (unwrapped from extension lookups) that a feature uses."""
    if table is None:
        return []
    idx = set()
    for fr in table.FeatureList.FeatureRecord:
        if fr.FeatureTag == tag:
            idx.update(fr.Feature.LookupListIndex)
    result = []
    for i in sorted(idx):
        lk = table.LookupList.Lookup[i]
        for st in lk.SubTable:
            if lk.LookupType in (7, 9):  # extension
                st = st.ExtSubTable
            result.append(st)
    return result


def gsub_single(font, tag):
    table = font["GSUB"].table if "GSUB" in font else None
    out = {}
    for st in lookups_for(table, tag):
        if hasattr(st, "mapping"):
            for a, b in st.mapping.items():
                out.setdefault(a, [b])
        elif hasattr(st, "alternates"):
            for a, alts in st.alternates.items():
                out.setdefault(a, list(alts))
    return out


def gsub_ligatures(font):
    table = font["GSUB"].table if "GSUB" in font else None
    out = []
    for st in lookups_for(table, "liga"):
        if hasattr(st, "ligatures"):
            for first, ligs in st.ligatures.items():
                for lig in ligs:
                    out.append(([first] + list(lig.Component), lig.LigGlyph))
    return out


def gpos_kerning(font, keep):
    table = font["GPOS"].table if "GPOS" in font else None
    pairs = {}
    for st in lookups_for(table, "kern"):
        if getattr(st, "LookupType", 2) != 2 and not hasattr(st, "PairSet") and not hasattr(st, "Class1Record"):
            continue
        if st.Format == 1:
            for i, g1 in enumerate(st.Coverage.glyphs):
                if g1 not in keep:
                    continue
                for pvr in st.PairSet[i].PairValueRecord:
                    v = getattr(pvr.Value1, "XAdvance", 0) if pvr.Value1 else 0
                    if v and pvr.SecondGlyph in keep:
                        pairs.setdefault((g1, pvr.SecondGlyph), v)
        elif st.Format == 2:
            cd1 = st.ClassDef1.classDefs if st.ClassDef1 else {}
            cd2 = st.ClassDef2.classDefs if st.ClassDef2 else {}
            seconds = [g for g in keep]
            for g1 in st.Coverage.glyphs:
                if g1 not in keep:
                    continue
                rec = st.Class1Record[cd1.get(g1, 0)]
                for g2 in seconds:
                    c2 = rec.Class2Record[cd2.get(g2, 0)]
                    v = getattr(c2.Value1, "XAdvance", 0) if c2.Value1 else 0
                    if v:
                        pairs.setdefault((g1, g2), v)
    return pairs


def math_table(font):
    m = font["MATH"].table
    consts = {}
    mc = m.MathConstants
    for name in dir(mc):
        if name[0].isupper():
            v = getattr(mc, name)
            v = getattr(v, "Value", v)
            if isinstance(v, (int, float)):
                consts[name[0].lower() + name[1:]] = v
    gi = m.MathGlyphInfo
    ital = {}
    if gi.MathItalicsCorrectionInfo:
        info = gi.MathItalicsCorrectionInfo
        for g, rec in zip(info.Coverage.glyphs, info.ItalicsCorrection):
            ital[g] = rec.Value
    accent = {}
    if gi.MathTopAccentAttachment:
        info = gi.MathTopAccentAttachment
        for g, rec in zip(info.TopAccentCoverage.glyphs, info.TopAccentAttachment):
            accent[g] = rec.Value
    mv = m.MathVariants
    vert = {}
    for g, con in zip(mv.VertGlyphCoverage.glyphs, mv.VertGlyphConstruction):
        variants = [(r.VariantGlyph, r.AdvanceMeasurement) for r in con.MathGlyphVariantRecord]
        assembly = None
        if con.GlyphAssembly:
            assembly = [
                (p.glyph, p.StartConnectorLength, p.EndConnectorLength, p.FullAdvance, p.PartFlags)
                for p in con.GlyphAssembly.PartRecords
            ]
        vert[g] = (variants, assembly)
    return consts, ital, accent, vert, mv.MinConnectorOverlap


def build(name, filename):
    font = TTFont(fetch(filename))
    glyphset = font.getGlyphSet()
    order = font.getGlyphOrder()
    cmap = font.getBestCmap()
    is_math = name == "math"
    chars = MATH_CHARS if is_math else TEXT_CHARS

    keep = []
    seen = set()

    def add(g):
        if g in glyphset and g not in seen:
            seen.add(g)
            keep.append(g)

    add(".notdef")
    char_map = {}
    for ch in chars:
        g = cmap.get(ord(ch))
        if g:
            add(g)
            char_map[ord(ch)] = g

    ligatures = []
    smcp = {}
    ssty = {}
    vert = {}
    if not is_math:
        for comps, lig in gsub_ligatures(font):
            # the classic five (ff fi fl ffi ffl) and nothing fancier
            if lig in LIGATURES and all(c in seen for c in comps):
                add(lig)
                ligatures.append((comps, lig))
        for a, (b, *_) in gsub_single(font, "smcp").items():
            if a in seen and len(a) == 1 and a.islower():
                add(b)
                smcp[a] = b
    else:
        for g in MATH_NAMED:
            add(g)
        consts, ital, accent, vert_all, overlap = math_table(font)
        # size variants and extensible pieces of everything we keep
        for g in list(keep):
            if g in vert_all:
                variants, assembly = vert_all[g]
                vert[g] = vert_all[g]
                for v, _ in variants:
                    add(v)
                for part in assembly or []:
                    add(part[0])
        for g in MATH_NAMED:
            if g in vert_all:
                vert[g] = vert_all[g]
                for v, _ in vert_all[g][0]:
                    add(v)
        sub = gsub_single(font, "ssty")
        for g in list(keep):
            if g in sub:
                alts = sub[g]
                for a in alts:
                    add(a)
                ssty[g] = alts

    index = {g: i for i, g in enumerate(keep)}
    kern = gpos_kerning(font, seen)

    os2 = font["OS/2"]
    warp = XHeightWarp(os2.sxHeight, font["head"].unitsPerEm, XHEIGHT_BOOST)
    to_warp = warped_names(font, is_math)
    if is_math:
        # and the script-size forms of those letters
        to_warp |= {a for g in list(to_warp) for a in ssty.get(g, [])}

    glyphs = []
    for g in keep:
        w = warp if g in to_warp else None
        pen = CompactPathPen(glyphset, w)
        glyphset[g].draw(pen)
        bp = BoundsPen(glyphset)
        glyphset[g].draw(bp)
        b = bp.bounds or (0, 0, 0, 0)
        if w:
            b = (b[0], w(b[1]), b[2], w(b[3]))
        glyphs.append({
            "n": g,
            "w": round(glyphset[g].width),
            "b": [round(x) for x in b],
            "d": pen.getCommands(),
        })

    data = {
        # modified (subset, x-height, converted), so not the original's name
        "name": f"Hot Metal {name} (modified from {font['name'].getDebugName(4)})",
        "source": filename,
        "copyright": font["name"].getDebugName(0),
        "upm": font["head"].unitsPerEm,
        "ascender": font["hhea"].ascent,
        "descender": font["hhea"].descent,
        "xHeight": round(os2.sxHeight * XHEIGHT_BOOST),
        "capHeight": os2.sCapHeight,
        "cmap": {str(c): index[g] for c, g in char_map.items()},
        "glyphs": glyphs,
    }

    kern_out = {}
    for (a, b), v in kern.items():
        kern_out.setdefault(str(index[a]), {})[str(index[b])] = v
    data["kern"] = kern_out

    if not is_math:
        data["ligatures"] = [[[index[c] for c in comps], index[lig]] for comps, lig in ligatures]
        data["smcp"] = {str(index[a]): index[b] for a, b in smcp.items()}
    else:
        data["named"] = {g: index[g] for g in MATH_NAMED if g in index}
        data["math"] = {
            "constants": consts,
            "italic": {str(index[g]): v for g, v in ital.items() if g in index},
            "accent": {str(index[g]): v for g, v in accent.items() if g in index},
            "minConnectorOverlap": overlap,
            "vertical": {
                str(index[g]): {
                    "variants": [[index[v], adv] for v, adv in variants if v in index],
                    "assembly": [
                        [index[p[0]], p[1], p[2], p[3], p[4]] for p in assembly
                    ] if assembly else None,
                }
                for g, (variants, assembly) in vert.items()
                if g in index
            },
            "ssty": {str(index[g]): [index[a] for a in alts if a in index] for g, alts in ssty.items()},
        }

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + ".json")
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"{name}: {len(glyphs)} glyphs, {os.path.getsize(path) // 1024} KB", file=sys.stderr)


if __name__ == "__main__":
    for name, filename in FACES.items():
        build(name, filename)
