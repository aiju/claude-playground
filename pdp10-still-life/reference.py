#!/usr/bin/env python3
"""A model of STILL.MAC in Python, for trying out changes to the scene
quickly and for checking the PDP-10's output.

It is the same algorithm with the same constants, the same integer hash
and the same random numbers, in double precision instead of the KA10's
27-bit fractions.

usage: reference.py banner                  print the ASCII Clawd
       reference.py image W H S out.png     render WxH with SxS samples
"""
import math, sys

def dot(a,b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def sub(a,b): return (a[0]-b[0],a[1]-b[1],a[2]-b[2])
def add(a,b): return (a[0]+b[0],a[1]+b[1],a[2]+b[2])
def mul(a,s): return (a[0]*s,a[1]*s,a[2]*s)
def cmul(a,b): return (a[0]*b[0],a[1]*b[1],a[2]*b[2])
def mix(a,b,t): return add(mul(a,1-t), mul(b,t))
def norm(a): return mul(a, 1/math.sqrt(dot(a,a)))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
fl = math.floor
def frac(x): return x - fl(x)
D2R = math.pi/180

# The scene, as on the "The scene" page of still.mac.  Centimetres, Y up;
# the table top is the floor of the room.
CAMP, LOOK, FOV = (1.0, 15.0, -28.0), (0.2, 4.0, 4.0), 32.0
ROOMLO, ROOMHI = (-60.0, 0.0, -90.0), (60.0, 85.0, 24.0)
WIN = (26.0, 56.0, -16.0, 6.0)             # window in the left wall: y from, y to, z from, z to
LE = (46.0, 46.5, 48.0)                    # light from the window
AMBI = (0.060, 0.052, 0.044)               # light from the rest of the room
NSHAD = 4                                   # shadow rays to the window per point
RED, WHITE = (0.50, 0.035, 0.035), (0.80, 0.78, 0.72)
CHECK, THREAD, WRINK = 2.2, 0.22, 18.0     # gingham repeat, thread width, wrinkle depth
WAINY, BOARD = 13.0, 11.0                  # top of the panelling, width of a board
WOOD1, WOOD2 = (0.46, 0.26, 0.11), (0.26, 0.13, 0.05)
PAPER1, PAPER2, GOLD = (0.62, 0.60, 0.48), (0.30, 0.38, 0.28), (0.55, 0.45, 0.20)
PLASTER = (0.70, 0.67, 0.60)
GX, GY0, GZ = -4.0, 0.0, 5.0                # the glass: centre of its foot
GR, GH, GT, GB, GW = 3.3, 10.5, 0.24, 0.9, 7.0   # radius, height, wall, base, water level
IOR = (1.0, 1.5, 1.33)                      # air, glass, water
SIGMA = ((0.0, 0.0, 0.0), (0.030, 0.010, 0.022), (0.020, 0.006, 0.004))   # absorption per cm
GLSHAD = 0.62                               # light getting through the glass to its shadow
PX, PY, DEPTH, BEV = 0.42, 0.84, 8.0, 0.12  # Clawd's pixel size, depth in pixels, edge rounding
CLAWDP, CLAWDA = (4.4, 0.0, 2.2), -30.0
CLAWD = [(3, 15, 1, 5, 0, 8, 1),            # body
         (1, 3, 2, 3, 1, 7, 1),             # arms
         (15, 17, 2, 3, 1, 7, 1),
         (4, 5, 0, 1, 0, 1, 1), (6, 7, 0, 1, 0, 1, 1),        # legs, front
         (11, 12, 0, 1, 0, 1, 1), (13, 14, 0, 1, 0, 1, 1),
         (4, 5, 0, 1, 7, 8, 1), (6, 7, 0, 1, 7, 8, 1),        # and back
         (11, 12, 0, 1, 7, 8, 1), (13, 14, 0, 1, 7, 8, 1),
         (5, 6, 3, 4, -0.4, 1, 2), (12, 13, 3, 4, -0.4, 1, 2)]   # eyes, standing proud
GLAZE, EYECOL = (0.92, 0.26, 0.085), (0.015, 0.012, 0.010)
MAXDEP, MINWT = 10, 0.01
EPS, NUDGE, FAR = 1e-3, 5e-3, 1e6

# Worked out from it, as INIT does
CLC, CLS = math.cos(CLAWDA*D2R), math.sin(CLAWDA*D2R)
BOXES = [((x0-9)*PX, y0*PY, (z0-DEPTH/2)*PX, (x1-9)*PX, y1*PY, (z1-DEPTH/2)*PX, m)
         for x0, x1, y0, y1, z0, z1, m in CLAWD]
BBOX = (-8*PX, 0.0, (-0.4-DEPTH/2)*PX, 8*PX, 5*PY, DEPTH/2*PX)
GRI = GR - GT
CAMF = norm(sub(LOOK, CAMP)); CAMR = norm(cross((0,1,0), CAMF)); CAMU = cross(CAMF, CAMR)
TANF = math.tan(FOV*D2R/2)
WINA = (WIN[1]-WIN[0])*(WIN[3]-WIN[2])
LIGHTK = WINA/(NSHAD*math.pi)
# The glass of water, as flat circles: height, from radius, to radius,
# normal up or down, medium on the normal's side, medium on the other
DISKS = [(GY0, 0.0, GR, -1.0, 0, 1),               # the bottom
         (GY0 + GB, 0.0, GRI, 1.0, 2, 1),         # the floor of the inside
         (GY0 + GH, GRI, GR, 1.0, 0, 1),          # the rim
         (GY0 + GW, 0.0, GRI, 1.0, 0, 2)]         # the top of the water

# ---- integer hash and random numbers ----
M35 = (1 << 35) - 1
def hashi(i, j, k):
    h = (i+0o100000)*0o123457 + (j+0o100000)*0o156201 + (k+0o100000)*0o104763
    h ^= h >> 11
    h = (h*0o3261354525) & M35
    h ^= h >> 15
    h = (h*0o1215371625) & M35
    h ^= h >> 13
    return (h >> 8) & 0o177777
def hash3(i, j, k): return hashi(i, j, k)/65536.0

SEED = [1]
def rand():
    SEED[0] = (SEED[0]*0o3261354525 + 0o1234567) & M35
    return ((SEED[0] >> 19) & 0o177777)/65536.0

def noise2(x, y, seed):
    ix, iy = fl(x), fl(y); fx, fy = x-ix, y-iy
    sx, sy = fx*fx*(3-2*fx), fy*fy*(3-2*fy)
    a, b = hash3(ix, iy, seed), hash3(ix+1, iy, seed)
    c, d = hash3(ix, iy+1, seed), hash3(ix+1, iy+1, seed)
    ab = a + (b-a)*sx; cd = c + (d-c)*sx
    return ab + (cd-ab)*sy

def fbm2(x, y, seed):
    """two octaves"""
    return 0.5*noise2(x, y, seed) + 0.25*noise2(x*2.03, y*2.03, seed+1)

# ---- intersections ----
def slab(o, inv, b):
    tn, tf, ax = -1e30, 1e30, 0
    for a in range(3):
        t1 = (b[a]-o[a])*inv[a]; t2 = (b[a+3]-o[a])*inv[a]
        if t1 > t2: t1, t2 = t2, t1
        if t1 > tn: tn, ax = t1, a
        if t2 < tf: tf = t2
    return None if tn > tf else (tn, tf, ax)

def clawd_ray(o, d):
    q = sub(o, CLAWDP)
    lo = (CLC*q[0] + CLS*q[2], q[1], CLC*q[2] - CLS*q[0])
    ld = (CLC*d[0] + CLS*d[2], d[1], CLC*d[2] - CLS*d[0])
    return lo, ld, tuple(1e30 if x == 0 else 1/x for x in ld)

def cyl(o, d, r):
    """crossings of the ray with the upright cylinder of radius r round the glass"""
    ox, oz = o[0]-GX, o[2]-GZ
    a = d[0]*d[0] + d[2]*d[2]
    if a < 1e-12: return None
    b = ox*d[0] + oz*d[2]; c = ox*ox + oz*oz - r*r
    disc = b*b - a*c
    if disc < 0: return None
    s = math.sqrt(disc)
    return (-b - s)/a, (-b + s)/a

STATS = dict(camera=0, reflected=0, refracted=0, shadow=0, deepest=0)

def trace(o, d):
    """-> (t, normal, kind, info).  kind 0: the room (info: face), 1: the
    glass (info: media), 2: Clawd (info: material, point in Clawd's space)"""
    bt, bn, bk, bi = FAR, None, -1, None
    for a in range(3):                                   # the room
        if d[a] > 0: t, f = (ROOMHI[a]-o[a])/d[a], 2*a+1
        elif d[a] < 0: t, f = (ROOMLO[a]-o[a])/d[a], 2*a
        else: continue
        if EPS < t < bt:
            n = [0.0, 0.0, 0.0]; n[a] = -1.0 if f & 1 else 1.0
            bt, bn, bk, bi = t, tuple(n), 0, f
    for r, y0, inner in ((GR, GY0, False), (GRI, GY0 + GB, True)):   # the walls of the glass
        h = cyl(o, d, r)
        if h is None: continue
        for t in h:
            if EPS < t < bt:
                y = o[1] + d[1]*t
                if y0 <= y <= GY0 + GH:
                    nx, nz = (o[0] + d[0]*t - GX)/r, (o[2] + d[2]*t - GZ)/r
                    if inner:     # normal into the hollow, where there is water or air
                        bt, bn, bk, bi = t, (-nx, 0.0, -nz), 1, (2 if y < GY0 + GW else 0, 1)
                    else:
                        bt, bn, bk, bi = t, (nx, 0.0, nz), 1, (0, 1)
    if d[1] != 0:                                        # its flat parts
        for y, rmin, rmax, ny, m1, m2 in DISKS:
            t = (y - o[1])/d[1]
            if EPS < t < bt:
                x, z = o[0] + d[0]*t - GX, o[2] + d[2]*t - GZ
                r2 = x*x + z*z
                if rmin*rmin <= r2 <= rmax*rmax:
                    bt, bn, bk, bi = t, (0.0, ny, 0.0), 1, (m1, m2)
    lo, ld, inv = clawd_ray(o, d)                        # Clawd
    h = slab(lo, inv, BBOX)
    if h and h[1] > EPS and h[0] < bt:
        hb = None
        for b in BOXES:
            h = slab(lo, inv, b)
            if h and EPS < h[0] < bt:
                bt, hb = h[0], b
        if hb:
            pl = add(lo, mul(ld, bt))
            q = tuple(min(max(pl[a], hb[a]+BEV), hb[a+3]-BEV) for a in range(3))
            n = norm(sub(pl, q))                         # rounded edges
            bn, bk, bi = (CLC*n[0] - CLS*n[2], n[1], CLS*n[0] + CLC*n[2]), 2, (hb[6], pl)
    return None if bk < 0 else (bt, bn, bk, bi)

def shadow(p, q):
    """how much of the light leaving window point q reaches p"""
    STATS["shadow"] += 1
    d = sub(q, p); dist = math.sqrt(dot(d, d)); d = mul(d, 1/dist)
    lo, ld, inv = clawd_ray(p, d)
    h = slab(lo, inv, BBOX)
    if h and h[1] > EPS and h[0] < dist:
        for b in BOXES:
            h = slab(lo, inv, b)
            if h and h[1] > EPS and h[0] < dist: return 0.0
    h = cyl(p, d, GR)
    if h:
        for t in h:
            if EPS < t < dist and GY0 <= p[1] + d[1]*t <= GY0 + GH: return GLSHAD
    return 1.0

def direct(p, n):
    """light from the window reaching p, and the rest of the room's"""
    e = list(AMBI)
    for k in range(NSHAD):
        u = ((k & 1) + rand())*0.5
        v = ((k >> 1) + rand())*0.5
        q = (ROOMLO[0], WIN[0] + (WIN[1]-WIN[0])*u, WIN[2] + (WIN[3]-WIN[2])*v)
        l = sub(q, p); d2 = dot(l, l); ln = mul(l, 1/math.sqrt(d2))
        cs = dot(n, ln); cw = -ln[0]
        if cs <= 0 or cw <= 0: continue
        tr = shadow(add(p, mul(n, NUDGE)), q)
        if tr == 0: continue
        g = cs*cw*tr*LIGHTK/d2
        for c in range(3): e[c] += LE[c]*g
    return tuple(e)

# ---- textures ----
def gingham(x, z):
    sx = 1.0 if frac(x/CHECK) < 0.5 else 0.0
    sz = 1.0 if frac(z/CHECK) < 0.5 else 0.0
    a = (sx + sz)*0.5
    if sx*sz: a += 0.12
    col = mix(WHITE, RED, a)
    ix, iz = fl(x/THREAD), fl(z/THREAD)                # over and under
    u = frac(x/THREAD) if (ix + iz) & 1 else frac(z/THREAD)
    w = 2*u - 1
    return mul(col, 0.72 + 0.28*(1 - w*w) + 0.06*(hash3(ix, iz, 3) - 0.5))

def cloth_normal(x, z):
    n0 = fbm2(x*0.09, z*0.09, 11)
    dx = (fbm2((x+0.4)*0.09, z*0.09, 11) - n0)/0.4
    dz = (fbm2(x*0.09, (z+0.4)*0.09, 11) - n0)/0.4
    return norm((-dx*WRINK, 1.0, -dz*WRINK))

def wood(u, v, seed):
    """a flat-sawn board: the grain runs along u, v is across it"""
    c = 4.0 + 6.0*hash3(seed, 1, 7); dd = 1.0 + 4.0*hash3(seed, 2, 7)
    w = v - c; e = dd + 0.015*u
    g = fbm2(u*0.04, v*0.3, seed)
    ring = frac(math.sqrt(w*w + e*e)*0.7 + g*2.5)
    col = mix(WOOD1, WOOD2, ring*ring*ring)
    return mul(col, 0.88 + 0.24*noise2(u*0.6, v*6.0, seed+5))

def wall_back(x, y):
    if y < WAINY:                                      # oak boards
        bi = fl(x/BOARD); bu = frac(x/BOARD)
        col = mul(wood(y, bu*BOARD, 20 + (bi & 7)), 0.85 + 0.3*hash3(bi, 0, 21))
        if bu < 0.03 or bu > 0.97: col = mul(col, 0.35)
        return col
    if y < WAINY + 2.2:                                # the rail
        return mul(WOOD2, 1.1 + 0.3*noise2(x*0.3, y, 25))
    col = PAPER2 if 0.35 < frac(x/5.0) < 0.65 else PAPER1   # wallpaper
    if abs(frac(x/5.0 + 0.5) - 0.5) + abs(frac(y/5.0) - 0.5) < 0.08: col = GOLD
    return mul(col, 0.93 + 0.07*noise2(x*2.0, y*2.0, 30))

def plaster(p):
    return mul(PLASTER, 0.9 + 0.1*noise2(p[0]*0.2 + p[1]*0.1, p[2]*0.2 + p[1]*0.13, 40))

def glaze(pl, m):
    if m == 2: return EYECOL
    col = mul(GLAZE, 0.92 + 0.12*noise2(pl[0]*3.0, pl[1]*3.0 + pl[2]*3.0, 60))
    if hash3(fl(pl[0]*12), fl(pl[1]*12), fl(pl[2]*12)) < 0.025: col = mul(col, 0.55)
    return col

# ---- shading ----
def schlick(r0, x):
    return r0 + (1-r0)*x*x*x*x*x if x >= 1e-6 else r0

def shade(o, d, depth, wt, med):
    STATS["deepest"] = max(STATS["deepest"], depth)
    hit = trace(o, d)
    if hit is None: return (0.0, 0.0, 0.0)
    t, n, kind, info = hit
    col = shade_hit(add(o, mul(d, t)), d, n, kind, info, depth, wt)
    if med:                                            # absorbed on the way through
        s = SIGMA[med]
        col = tuple(col[c]/(1 + s[c]*t) for c in range(3))
    return col

def shade_hit(p, d, n, kind, info, depth, wt):
    if depth >= MAXDEP or wt < MINWT: return AMBI
    if kind == 1:                                      # glass or water
        mo, mi = info
        cosi = -dot(d, n)
        if cosi > 0: mfrom, mto, nn, c = mo, mi, n, cosi
        else: mfrom, mto, nn, c = mi, mo, mul(n, -1), -cosi
        n1, n2 = IOR[mfrom], IOR[mto]
        eta = n1/n2
        refl = add(d, mul(nn, 2*c))
        k = 1 - eta*eta*(1 - c*c)
        STATS["reflected"] += 1
        if k < 0:                                      # total internal reflection
            return shade(add(p, mul(nn, NUDGE)), refl, depth+1, wt, mfrom)
        ct = math.sqrt(k)
        refr = add(mul(d, eta), mul(nn, eta*c - ct))
        r0 = (n1 - n2)/(n1 + n2); r0 = r0*r0
        R = schlick(r0, 1 - (c if n1 <= n2 else ct))
        STATS["refracted"] += 1
        col = mul(shade(add(p, mul(nn, NUDGE)), refl, depth+1, wt*R, mfrom), R)
        return add(col, mul(shade(sub(p, mul(nn, NUDGE)), refr, depth+1, wt*(1-R), mto), 1-R))
    if kind == 0:                                      # the room
        f = info
        if f == 0 and WIN[0] <= p[1] <= WIN[1] and WIN[2] <= p[2] <= WIN[3]:
            return LE                                  # the window
        if f == 2:
            alb = gingham(p[0], p[2]); n = cloth_normal(p[0], p[2])
        elif f == 5: alb = wall_back(p[0], p[1])
        else: alb = plaster(p)
        return cmul(alb, direct(p, n))
    m, pl = info                                       # Clawd, glazed
    alb = glaze(pl, m)
    cosi = -dot(d, n)
    if cosi < 0: n, cosi = mul(n, -1), -cosi
    refl = add(d, mul(n, 2*cosi))
    R = schlick(0.05, 1 - cosi)
    col = mul(cmul(alb, direct(p, n)), 1 - R)
    STATS["reflected"] += 1
    return add(col, mul(shade(add(p, mul(n, NUDGE)), refl, depth+1, wt*R, 0), R))

def sample(sx, sy):
    STATS["camera"] += 1
    d = norm(add(add(CAMF, mul(CAMR, sx)), mul(CAMU, sy)))
    return shade(CAMP, d, 0, 1.0, 0)

def banner():
    """Clawd in ASCII from the table the 3D Clawd is built from: each pixel
    is two characters wide and two lines high, Clawd's shape on a terminal"""
    lines = []
    for y in range(4, -1, -1):
        line = ""
        for x in range(18):
            inb = lambda b: b[0] <= x < b[1] and b[2] <= y < b[3]
            on = any(inb(b) for b in CLAWD if b[6] == 1) and not any(inb(b) for b in CLAWD if b[6] == 2)
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
                    SEED[0] = hashi(i, j, sj*S + si)*997 + 1
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
        from untape import write_png
        W, H, S = map(int, sys.argv[2:5])
        write_png(sys.argv[5], W, H, b"".join(image(W, H, S)))
        for k in ("camera", "reflected", "refracted", "shadow"):
            print(f"{k.capitalize()} rays".ljust(15) + f"{STATS[k]:10d}")
        print("Deepest level".ljust(15) + f"{STATS['deepest']:10d}")
    else:
        sys.exit(__doc__)
