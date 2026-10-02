#!/usr/bin/env python3
"""Measure how type is printed in an image of a page of text, to calibrate
the letterpress settings in src/style.js against scans of real books.

    pip install numpy pillow
    python3 tools/measure-ink.py scan.png,400,scan render.png,400,ours

Each argument is image,ppi,label. Use crops of running text at the scan's
full resolution (no rescaling). Reports, for each image: the paper's colour
and the standard deviation of its texture; the ink's colour; how far the
edge of the ink runs from 10% to 90% darkness, in points; and the peak
darkness of stems and of hairlines (0 = paper, 1 = the darkest ink).

To measure the typesetter's own output at the same resolution, render a
page with render(page, { px: ppi / 72 }) and screenshot the SVG at
ppi / 72 pixels per point.
"""

import sys
import numpy as np
from PIL import Image

def measure(path, ppi, label):
    im = np.asarray(Image.open(path).convert('RGB')).astype(float)
    L = im.mean(axis=2)
    paper = np.percentile(L, 90)
    inkL = np.percentile(L, 0.5)
    pmask = L > np.percentile(L, 70)
    paper_rgb = im[pmask].mean(0)
    paper_std = L[pmask].std()
    imask = L < inkL + 0.15 * (paper - inkL)
    ink_rgb = im[imask].mean(0)
    # darkness: 0 paper .. 1 darkest ink
    D = np.clip((paper - L) / (paper - inkL), 0, 1)
    # horizontal edge profiles: for every row, find transitions crossing 0.5
    widths = []
    for y in range(D.shape[0]):
        row = D[y]
        for x in range(2, len(row) - 6):
            if row[x] < 0.5 <= row[x + 1]:  # rising edge (paper -> ink)
                # 10%..90% width around it
                a = x
                while a > 0 and row[a] > 0.1: a -= 1
                b = x + 1
                while b < len(row) - 1 and row[b] < 0.9: b += 1
                if b - a < 12 and row[min(b + 2, len(row) - 1)] > 0.85:
                    widths.append(b - a)
    widths = np.array(widths)
    # stem vs hairline: max darkness of thick vs thin runs along rows
    thick, thin = [], []
    for y in range(D.shape[0]):
        row = D[y] > 0.35
        x = 0
        while x < len(row):
            if row[x]:
                s = x
                while x < len(row) and row[x]: x += 1
                run = x - s
                peak = D[y, s:x].max()
                if run >= 0.6 * ppi / 72: thick.append(peak)
                elif run <= 0.25 * ppi / 72 + 1: thin.append(peak)
            x += 1
    px_pt = ppi / 72
    print(f'{label}: paper rgb {paper_rgb.round()} (std {paper_std:.1f})  ink rgb {ink_rgb.round()}  '
          f'edge 10-90% {np.median(widths)/px_pt:.2f}pt (n={len(widths)})  '
          f'stem peak {np.median(thick):.2f}  hairline peak {np.median(thin):.2f}')

for spec in sys.argv[1:]:
    path, ppi, label = spec.split(',')
    measure(path, float(ppi), label)
