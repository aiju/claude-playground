#!/usr/bin/env python3
"""A model of GLASS.MAC in Python, for trying out changes to the scene
quickly and for checking the PDP-10's output.

It is the same algorithm with the same constants, in double precision
instead of the KA10's 27-bit fractions.

usage: reference.py banner                  print the ASCII Clawd
       reference.py image W H S out.png     render WxH with SxS samples
"""
import math, sys
from untape import write_png

def dot(a,b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def sub(a,b): return (a[0]-b[0],a[1]-b[1],a[2]-b[2])
def add(a,b): return (a[0]+b[0],a[1]+b[1],a[2]+b[2])
def mul(a,s): return (a[0]*s,a[1]*s,a[2]*s)
def cmul(a,b): return (a[0]*b[0],a[1]*b[1],a[2]*b[2])
def norm(a): return mul(a, 1/math.sqrt(dot(a,a)))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def powi(x, n):
    """x^(2^n), going to 0 below 1e-15 as the KA10 code does to dodge underflow"""
    for _ in range(n):
        x = x*x
        if x < 1e-15: return 0.0
    return x
D2R = math.pi/180
fl = math.floor

# The scene, as on the "The scene" page of glass.mac
CAM, LOOK, FOV = (0.45, 0.95, -4.7), (0.12, 0.72, 0.3), 40.0
SUN = norm((-0.86, 0.26, -0.44))
SUNCOL = (1.25, 0.88, 0.58)
AMB = (0.07, 0.08, 0.13)
ZENITH, DUSK, GLOWC = (0.025, 0.06, 0.22), (0.62, 0.36, 0.30), (1.0, 0.55, 0.20)
FLOOR1, FLOOR2, FLOORREF, CHECKS = (0.82, 0.76, 0.64), (0.07, 0.09, 0.13), 0.22, 2.0
HAZE = 28.0
CLAWDCOL, EYECOL = (0.72, 0.22, 0.12), (0.02, 0.015, 0.012)
MIRRORTINT, AMBERTINT, IOR = (0.88, 0.90, 0.95), (1.0, 0.55, 0.14), 1.5
M_FLOOR, M_CLAWD, M_EYE, M_MIRROR, M_GLASS, M_AMBER = range(6)
SPHERES = [((0.78, 0.5, -0.62), 0.5, M_GLASS),
           ((-1.85, 0.85, 1.2), 0.85, M_MIRROR),
           ((-0.85, 0.28, -1.05), 0.28, M_AMBER)]
# Clawd, in logo pixels: x0 x1 y0 y1 z0 z1 material.  A pixel is PX wide and deep, PY high.
DEPTH = 8
CLAWD = [(3, 15, 1, 2, 0, DEPTH, M_CLAWD), (1, 17, 2, 3, 0, DEPTH, M_CLAWD),
         (3, 15, 4, 5, 0, DEPTH, M_CLAWD), (3, 5, 3, 4, 0, DEPTH, M_CLAWD),
         (6, 12, 3, 4, 0, DEPTH, M_CLAWD), (13, 15, 3, 4, 0, DEPTH, M_CLAWD),
         (5, 6, 3, 4, 1, DEPTH, M_EYE), (12, 13, 3, 4, 1, DEPTH, M_EYE)]
for x in (4, 6, 11, 13):
    CLAWD += [(x, x+1, 0, 1, 0, 1, M_CLAWD), (x, x+1, 0, 1, DEPTH-1, DEPTH, M_CLAWD)]
PX, PY = 0.1, 0.2
CLAWDP, CLAWDA = (0.0, 0.0, 0.45), -18.0
DSDIR, DSDIST, DSR = norm((0.30, 0.17, 1.0)), 90.0, 7.5
DISHDIR, DSAXIS = norm((-0.62, 0.42, -0.66)), norm((0.25, 1.0, 0.1))
MAXDEPTH, MINWT = 6, 0.01
EPS, NUDGE, FAR = 1e-4, 1e-3, 1e6

# Worked out from it, as INIT does
CR, SR = math.cos(CLAWDA*D2R), math.sin(CLAWDA*D2R)
BOXES = [((x0-9)*PX, y0*PY, (z0-DEPTH/2)*PX, (x1-9)*PX, y1*PY, (z1-DEPTH/2)*PX, m)
         for x0, x1, y0, y1, z0, z1, m in CLAWD]
BBOX = (-8*PX, 0.0, -DEPTH/2*PX, 8*PX, 5*PY, DEPTH/2*PX)
SUNH = norm((SUN[0], 0.0, SUN[2]))
DSC = mul(DSDIR, DSDIST)
DISHC, DISHR = add(DSC, mul(DISHDIR, DSR*1.16)), DSR*0.40
CAMF = norm(sub(LOOK, CAM)); CAMR = norm(cross((0,1,0), CAMF)); CAMU = cross(CAMF, CAMR)
TANF = math.tan(FOV*D2R/2)

def sphere(o, d, c, r):
    oc = sub(o, c); b = dot(oc, d); cc = dot(oc, oc) - r*r
    disc = b*b - cc
    if disc < 0: return None
    s = math.sqrt(disc)
    return -b - s, -b + s

def slab(o, inv, b):
    """-> (tnear, tfar, axis of tnear) or None"""
    tn, tf, ax = -1e30, 1e30, 0
    for a in range(3):
        t1 = (b[a] - o[a])*inv[a]; t2 = (b[a+3] - o[a])*inv[a]
        if t1 > t2: t1, t2 = t2, t1
        if t1 > tn: tn, ax = t1, a
        if t2 < tf: tf = t2
    return None if tn > tf else (tn, tf, ax)

def clawd_ray(o, d):
    q = sub(o, CLAWDP)
    lo = (CR*q[0] + SR*q[2], q[1], CR*q[2] - SR*q[0])
    ld = (CR*d[0] + SR*d[2], d[1], CR*d[2] - SR*d[0])
    return lo, ld, tuple(1e30 if x == 0 else 1/x for x in ld)

def trace(o, d):
    """-> (t, normal, material) or None"""
    bt, bn, bm = FAR, None, -1
    if d[1] < 0:
        t = -o[1]/d[1]
        if EPS < t < bt: bt, bn, bm = t, (0.0, 1.0, 0.0), M_FLOOR
    for c, r, m in SPHERES:
        h = sphere(o, d, c, r)
        if h:
            t = h[0] if h[0] > EPS else h[1]
            if EPS < t < bt:
                bt, bm = t, m
                bn = mul(sub(add(o, mul(d, t)), c), 1/r)
    lo, ld, inv = clawd_ray(o, d)
    h = slab(lo, inv, BBOX)
    if h and h[1] > EPS and h[0] < bt:
        for b in BOXES:
            h = slab(lo, inv, b)
            if h and EPS < h[0] < bt:
                a = h[2]
                n = [0.0, 0.0, 0.0]; n[a] = -1.0 if ld[a] > 0 else 1.0
                bt, bm = h[0], b[6]
                bn = (CR*n[0] - SR*n[2], n[1], SR*n[0] + CR*n[2])
    return None if bm < 0 else (bt, bn, bm)

def shadow(p):
    """how much sunlight gets to p"""
    STATS["shadow"] += 1
    tr = 1.0
    for c, r, m in SPHERES:
        h = sphere(p, SUN, c, r)
        if h and h[1] > EPS:
            if m == M_MIRROR: return 0.0
            tr *= 0.72 if m == M_GLASS else 0.45
    lo, ld, inv = clawd_ray(p, SUN)
    h = slab(lo, inv, BBOX)
    if h and h[1] > EPS:
        for b in BOXES:
            h = slab(lo, inv, b)
            if h and h[1] > EPS: return 0.0
    return tr

def skygrad(d):
    y = max(0.0, d[1])
    hl = math.sqrt(d[0]*d[0] + d[2]*d[2])
    w = 1.0 if hl == 0 else (1 + (d[0]*SUNH[0] + d[2]*SUNH[2])/hl)/2
    w = w*w
    hor = add(mul(DUSK, 1-w), mul(GLOWC, w))
    f = 1 - powi(1 - y, 3)
    c = add(mul(hor, 1-f), mul(ZENITH, f))
    s = max(0.0, dot(d, SUN))
    return add(c, mul(SUNCOL, powi(s, 10)*25 + powi(s, 5)*0.6))

def sky(d):
    """the sky, and the Death Star in it (so far away that the ray starts at 0,0,0)"""
    h = sphere((0,0,0), d, DSC, DSR)
    if h and h[0] > 0:
        p = mul(d, h[0])
        q = sub(p, DISHC)
        if dot(q, q) >= DISHR*DISHR:
            n = mul(sub(p, DSC), 1/DSR)
        else:
            p = mul(d, sphere((0,0,0), d, DISHC, DISHR)[1])
            pc = sub(p, DSC)
            n = None if dot(pc, pc) > DSR*DSR else mul(sub(DISHC, p), 1/DISHR)
        if n is not None:
            v = 0.40*max(0.0, dot(n, SUN)) + 0.015
            if abs(dot(sub(p, DSC), DSAXIS)) < DSR*0.012: v *= 0.35
            return add(mul(skygrad(d), 0.25), (v*0.85, v*0.80, v*0.78))
    return skygrad(d)

STATS = dict(camera=0, reflected=0, refracted=0, shadow=0, deepest=0)

def shade(o, d, depth, wt):
    STATS["deepest"] = max(STATS["deepest"], depth)
    hit = trace(o, d)
    if hit is None: return sky(d)
    if depth >= MAXDEPTH or wt < MINWT: return AMB
    t, n, m = hit
    p = add(o, mul(d, t))
    cosi = -dot(d, n)
    refl = add(d, mul(n, 2*cosi))
    if m == M_GLASS or m == M_AMBER:
        if cosi > 0: eta, nn, c = 1/IOR, n, cosi
        else: eta, nn, c = IOR, mul(n, -1), -cosi
        k = 1 - eta*eta*(1 - c*c)
        if k < 0:                                           # total internal reflection
            STATS["reflected"] += 1
            return shade(add(p, mul(nn, NUDGE)), refl, depth+1, wt)
        ct = math.sqrt(k)
        refr = add(mul(d, eta), mul(nn, eta*c - ct))
        x = 1 - (c if eta < 1 else ct)
        R = 0.04 + 0.96*x*x*x*x*x if x >= 1e-6 else 0.04    # Schlick
        STATS["reflected"] += 1; STATS["refracted"] += 1
        col = mul(shade(add(p, mul(nn, NUDGE)), refl, depth+1, wt*R), R)
        tc = shade(sub(p, mul(nn, NUDGE)), refr, depth+1, wt*(1-R))
        if m == M_AMBER: tc = cmul(tc, AMBERTINT)
        col = add(col, mul(tc, 1-R))
        if cosi > 0: col = add(col, mul(SUNCOL, powi(max(0.0, dot(refl, SUN)), 7)*3.0))
        return col
    if m == M_MIRROR:
        STATS["reflected"] += 1
        col = cmul(shade(add(p, mul(n, NUDGE)), refl, depth+1, wt*0.9), MIRRORTINT)
        return add(col, mul(SUNCOL, powi(max(0.0, dot(refl, SUN)), 8)*2.0))
    if m == M_FLOOR:
        if t < 1000.0:
            alb = FLOOR1 if (fl(p[0]*CHECKS) + fl(p[2]*CHECKS)) & 1 == 0 else FLOOR2
        else:
            alb = mul(add(FLOOR1, FLOOR2), 0.5)
        gloss = 0.25
    else:
        alb, gloss = (CLAWDCOL if m == M_CLAWD else EYECOL), 0.5
    diff = dot(n, SUN)
    sh = shadow(add(p, mul(n, NUDGE))) if diff > 0 else 0.0
    col = cmul(alb, add(AMB, mul(SUNCOL, max(0.0, diff)*sh*1.05)))
    col = add(col, mul(SUNCOL, powi(max(0.0, dot(refl, SUN)), 6)*sh*gloss))
    if m == M_FLOOR:
        STATS["reflected"] += 1
        rc = shade(add(p, mul(n, NUDGE)), refl, depth+1, wt*FLOORREF)
        col = add(mul(col, 1 - FLOORREF), mul(rc, FLOORREF))
        f = 1/(1 + (t/HAZE)*(t/HAZE))
        col = add(mul(col, f), mul(skygrad((d[0], 0.0, d[2])), 1-f))
    return col

def sample(sx, sy):
    STATS["camera"] += 1
    d = norm(add(add(CAMF, mul(CAMR, sx)), mul(CAMU, sy)))
    return shade(CAM, d, 0, 1.0)

def banner():
    """Clawd in ASCII, drawn from the front faces in CLAWD: each pixel is two
    characters wide and two lines high, which is Clawd's shape on a terminal"""
    lines = []
    for y in range(4, -1, -1):
        line = ""
        for x in range(18):
            on = any(x0 <= x < x1 and y0 <= y < y1 and z0 == 0 and m == M_CLAWD
                     for x0, x1, y0, y1, z0, z1, m in CLAWD)
            line += "##" if on else "  "
        lines += [line.rstrip()] * 2
    return "\n".join(lines)

def image(W, H, S):
    sc = TANF/(H/2); rows = []
    for j in range(H):
        row = bytearray()
        for i in range(W):
            acc = [0.0, 0.0, 0.0]
            for sj in range(S):
                for si in range(S):
                    c = sample((i + (si+0.5)/S - W/2)*sc, (H/2 - j - (sj+0.5)/S)*sc)
                    for k in range(3): acc[k] += c[k]
            for k in range(3):
                row.append(max(0, min(255, fl(math.sqrt(max(0.0, acc[k]/(S*S)))*255.0 + 0.5))))
        rows.append(bytes(row))
    return rows

if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "banner":
        print(banner())
    elif len(sys.argv) == 6 and sys.argv[1] == "image":
        W, H, S = map(int, sys.argv[2:5])
        write_png(sys.argv[5], W, H, b"".join(image(W, H, S)))
        for k in ("camera", "reflected", "refracted", "shadow"):
            print(f"{k.capitalize()} rays".ljust(15) + f"{STATS[k]:10d}")
        print("Deepest level".ljust(15) + f"{STATS['deepest']:10d}")
    else:
        sys.exit(__doc__)
