#!/usr/bin/env python3
"""A model of DSTAR.MAC in Python, for trying out changes to the scene
quickly and for checking the PDP-10's output.

It is the same algorithm with the same constants and the same integer
hash, in double precision instead of the KA10's 27-bit fractions.  At
640x480 it agrees with the KA10's picture to within 2 in 255 on all but
a handful of pixels.

usage: reference.py preview                 print the terminal preview
       reference.py image W H S out.png     render WxH with SxS samples
"""
import math, sys
from untape import write_png

def dot(a,b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def sub(a,b): return (a[0]-b[0],a[1]-b[1],a[2]-b[2])
def add(a,b): return (a[0]+b[0],a[1]+b[1],a[2]+b[2])
def mul(a,s): return (a[0]*s,a[1]*s,a[2]*s)
def norm(a): return mul(a, 1/math.sqrt(dot(a,a)))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
D2R = math.pi/180

# The scene, as on the "The scene" page of dstar.mac
DSHLAT, DSHLON, DSHANG, DISHR = 28.0, 0.0, 15.0, 0.42
TW, TD = 0.011, 0.028
CAMAZ, CAMEL, CAMRO, CAMD, FOV = 36.0, 10.0, -14.0, 4.4, 40.0
SHIFTX, SHIFTY = -0.30, 0.02
LCAM = (-0.62, 0.50, -0.50)
EMR, EMSINK = 0.03, 0.012
LENSR, LENSF, LENSK = 0.018, 0.80, 0.006
FOCD, BEAML = 0.30, 30.0
EPS = 1.0e-5

# Worked out from it, as INIT does
la, lo = DSHLAT*D2R, DSHLON*D2R
UD = (math.cos(la)*math.sin(lo), math.sin(la), -math.cos(la)*math.cos(lo))
E1 = norm(cross(UD, (0,1,0)))
E2 = cross(UD, E1)
SA, CA = math.sin(DSHANG*D2R), math.cos(DSHANG*D2R)
DR2 = DISHR*DISHR
DK = CA + math.sqrt(DR2 - SA*SA)
DC = mul(UD, DK)
IR = 1.0 - TD; IR2 = IR*IR
EMC = mul(UD, DK - DISHR - EMSINK)
LENS = []
for k in range(8):
    c, s = math.cos(k*45*D2R), math.sin(k*45*D2R)
    r = SA*LENSF
    h = DK - math.sqrt(DR2 - r*r) - LENSK
    LENS.append(add(add(mul(UD, h), mul(E1, c*r)), mul(E2, s*r)))
SMALL = [(EMC, EMR, 4)] + [(lc, LENSR, 5) for lc in LENS]
FOCUS = mul(UD, CA + FOCD)
BEAMEND = mul(UD, BEAML)
az, el, ro = CAMAZ*D2R, CAMEL*D2R, CAMRO*D2R
CP = (CAMD*math.cos(el)*math.sin(az), CAMD*math.sin(el), -CAMD*math.cos(el)*math.cos(az))
F = norm(mul(CP, -1))
R0 = norm(cross((0,1,0), F))
U0 = cross(F, R0)
CR = add(mul(R0, math.cos(ro)), mul(U0, math.sin(ro)))
CU = sub(mul(U0, math.cos(ro)), mul(R0, math.sin(ro)))
L = norm(add(add(mul(CR, LCAM[0]), mul(CU, LCAM[1])), mul(F, LCAM[2])))
TANF = math.tan(FOV*D2R/2)
# beam segments: start, end, 1/sigma^2, weight
SEGS = [(FOCUS, BEAMEND, 1/0.035**2, 1.0), (FOCUS, BEAMEND, 1/0.11**2, 0.25)]
SEGS += [(lc, FOCUS, 1/0.007**2, 0.6) for lc in LENS]

def inside(p):
    r2 = dot(p,p)
    if r2 > 1.0 + EPS: return False
    q = sub(p, DC)
    if dot(q,q) < DR2 - EPS: return False
    if abs(p[1]) < TW - EPS and r2 > IR2 + EPS: return False
    return True

def sphere(o, d, c, r2):
    oc = sub(o, c)
    b = dot(oc, d); cc = dot(oc, oc) - r2
    disc = b*b - cc
    if disc < 0: return None
    s = math.sqrt(disc)
    return (-b - s, -b + s)

def trace(o, d, tmin):
    """first hit -> (t, point, normal, sid) or None"""
    best = [1e30, -1, None]
    def cons(t, sid):
        if t <= tmin or t >= best[0]: return
        if inside(add(o, mul(d, t))): best[0], best[1] = t, sid
    r = sphere(o, d, (0,0,0), 1.0)
    if r is None: return None
    cons(r[0], 0); cons(r[1], 0)
    rd = sphere(o, d, DC, DR2)
    if rd:
        cons(rd[0], 1); cons(rd[1], 1)
    r = sphere(o, d, (0,0,0), IR2)
    if r:
        cons(r[0], 2); cons(r[1], 2)
    if d[1] != 0:
        cons((TW - o[1])/d[1], 3)
        cons((-TW - o[1])/d[1], 6)
    if rd:
        for c, rr, sid in SMALL:
            r = sphere(o, d, c, rr*rr)
            if r and tmin < r[0] < best[0]:
                best = [r[0], sid, (c, rr)]
    t, sid, sm = best
    if sid < 0: return None
    p = add(o, mul(d, t))
    if sid == 0: n = p
    elif sid == 1: n = mul(sub(DC, p), 1/DISHR)
    elif sid == 2: n = mul(p, 1/IR)
    elif sid == 3: n = (0,-1,0)
    elif sid == 6: n = (0,1,0)
    else: n = mul(sub(p, sm[0]), 1/sm[1])
    return t, p, n, sid

M35 = (1 << 35) - 1
def hash3(i, j, k):
    h = (i+0o100000)*0o123457 + (j+0o100000)*0o156201 + (k+0o100000)*0o104763
    h ^= h >> 11
    h = (h*0o3261354525) & M35
    h ^= h >> 15
    h = (h*0o1215371625) & M35
    h ^= h >> 13
    return ((h >> 8) & 0o177777) / 65536.0

fl = math.floor
def shade(o, d):
    """-> (r,g,b) or None for a miss, plus t of the hit"""
    hit = trace(o, d, 0.0)
    if hit is None: return None, None
    t, p, n, sid = hit
    if dot(n, d) > 0: n = mul(n, -1)
    if sid == 1:
        q = dot(p, UD)
        rho = math.sqrt(max(0.0, dot(p,p) - q*q))/SA
        alb = 0.42 + 0.05*(fl(rho*6.0) & 1)
    elif sid >= 4 and sid != 6:
        alb = 0.6
    else:
        a = hash3(fl(p[0]*7.0), fl(p[1]*22.0), fl(p[2]*7.0))
        b = hash3(fl(p[0]*30.0), fl(p[1]*44.0), fl(p[2]*30.0))
        c = hash3(fl(p[0]*90.0), fl(p[1]*90.0), fl(p[2]*90.0))
        alb = 0.40 + 0.12*a + 0.10*b + 0.06*c
        if a > 0.85: alb *= 0.8
        if sid != 0: alb *= 0.6
    diff = dot(n, L)
    lit = 0.0
    if diff > 0 and trace(add(p, mul(n, 1e-3)), L, 1e-4) is None:
        lit = diff
    er = eg = eb = 0.0
    if sid == 0 and lit < 0.05:
        c = hash3(fl(p[0]*160.0), fl(p[1]*160.0), fl(p[2]*160.0))
        if c < 0.012:
            k = 0.45 - 9.0*lit
            er, eg, eb = k, k*0.8, k*0.5
    if 1 <= sid <= 5:
        q = sub(p, FOCUS)
        g = 0.012/(0.004 + dot(q,q))
        er += 0.10*g; eg += 0.45*g; eb += 0.12*g
    return (alb*(0.024 + lit) + er, alb*(0.027 + 0.97*lit) + eg, alb*(0.036 + 0.92*lit) + eb), t

def glow(d, thit):
    g = 0.0
    for p0, p1, isig, wt in SEGS:
        v = sub(p1, p0); w0 = sub(CP, p0)
        c = dot(v,v); e = dot(v,w0)
        b = dot(d, v); dd = dot(d, w0)
        den = c - b*b
        if den <= 1e-12: continue
        s = min(1.0, max(0.0, (e - b*dd)/den))
        t = max(0.0, b*s - dd)
        if thit is not None and t > thit: continue
        q = sub(add(w0, mul(d, t)), mul(v, s))
        x = dot(q,q)*isig
        g += wt/((1.0 + x)*(1.0 + x))
    return g

def sample(sx, sy):
    d = norm(add(add(F, mul(CR, sx)), mul(CU, sy)))
    c, t = shade(CP, d)
    g = glow(d, t)
    g2 = 0.6*g*g
    if c is None: c = (0.0, 0.0, 0.0)
    return (c[0] + 0.45*g + g2, c[1] + g + g2, c[2] + 0.40*g + g2), t is None

def star(ix, iy):
    if hash3(ix, iy, 7) >= 0.0035: return (0.0, 0.0, 0.0)
    b = hash3(ix, iy, 11)
    v = 0.2 + 0.8*b*b*b
    tint = hash3(ix, iy, 13)
    if tint < 0.3: return (v*0.75, v*0.82, v)
    if tint > 0.8: return (v, v*0.88, v*0.7)
    return (v, v, v)

RAMP = " .:-=+*#%@"
def ascii_art(cols=79, rows=36):
    sc = TANF/(rows/2)
    lines = []
    for j in range(rows):
        line = ""
        for i in range(cols):
            (r, g, b), miss = sample((i + 0.5 - cols/2)*sc*0.5 + SHIFTX*TANF,
                                     (rows/2 - j - 0.5)*sc + SHIFTY*TANF)
            lum = 0.3*r + 0.59*g + 0.11*b
            k = min(9, fl(math.sqrt(lum)*10.0)) if lum > 0 else 0
            ch = RAMP[k]
            if miss and k == 0 and hash3(i, j, 5) < 0.02: ch = "."
            line += ch
        lines.append(line.rstrip())
    return "\n".join(lines)

def image(W, H, S):
    sc = TANF/(H/2)
    rows = []
    for j in range(H):
        row = bytearray()
        for i in range(W):
            acc = [0.0, 0.0, 0.0]; misses = 0
            for sj in range(S):
                for si in range(S):
                    c, miss = sample((i + (si+0.5)/S - W/2)*sc + SHIFTX*TANF,
                                     (H/2 - j - (sj+0.5)/S)*sc + SHIFTY*TANF)
                    misses += miss
                    for k in range(3): acc[k] += c[k]
            st = star(i, j)
            for k in range(3):
                v = (acc[k] + st[k]*misses)/(S*S)
                row.append(max(0, min(255, fl(math.sqrt(max(0.0, v))*255.0 + 0.5))))
        rows.append(bytes(row))
    return rows

if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "preview":
        print(ascii_art())
    elif len(sys.argv) == 6 and sys.argv[1] == "image":
        W, H, S = int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
        write_png(sys.argv[5], W, H, b"".join(image(W, H, S)))
    else:
        sys.exit(__doc__)
