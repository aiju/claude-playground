"""Generates programs/sha256.s: SHA-256 (8-round unrolled compression, message schedule in registers).

The assembler has no macros, so the unrolled code is written by this
script. Run it from anywhere: python3 programs/gen/sha256.py
"""

import os

K = [
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
H0 = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]

def w(j):  # register holding the schedule word with index j mod 16
    return f"r{1 + j % 16}"

out = []
P = out.append

def sched():
    for j in range(16):
        d, s15, s2, s7 = w(j), w(j + 1), w(j + 14), w(j + 9)
        P(f"        ; W[t+{j}] = W[t+{j}-16] + s0(W[t+{j}-15]) + W[t+{j}-7] + s1(W[t+{j}-2])")
        P(f"        rori    r17, {s15}, 7")
        P(f"        rori    r18, {s15}, 18")
        P(f"        xor     r17, r17, r18")
        P(f"        srli    r18, {s15}, 3")
        P(f"        xor     r17, r17, r18")
        P(f"        add     {d}, {d}, r17")
        P(f"        rori    r17, {s2}, 17")
        P(f"        rori    r18, {s2}, 19")
        P(f"        xor     r17, r17, r18")
        P(f"        srli    r18, {s2}, 10")
        P(f"        xor     r17, r17, r18")
        P(f"        add     {d}, {d}, r17")
        P(f"        add     {d}, {d}, {s7}")
        P(f"        sw      {d}, [r20 + {4 * j}]")

def rounds():
    regs = [f"r{i}" for i in range(1, 9)]
    X = ["r13", "r14"]
    for j in range(8):
        A, B, C, D, E, F, G, H = (regs[(k - j) % 8] for k in range(8))
        xn, xo = X[j % 2], X[(j + 1) % 2]
        P(f"        ; round 8i+{j}: a..h = {A} {B} {C} {D} {E} {F} {G} {H}")
        P(f"        lw      r11, [r20 + {4 * j}]{'':10}; W[i]")
        P(f"        lw      r12, [r20 + {256 + 4 * j}]{'':8}; K[i]")
        P(f"        rori    r9, {E}, 6")
        P(f"        rori    r10, {E}, 11")
        P(f"        xor     r9, r9, r10")
        P(f"        rori    r10, {E}, 25")
        P(f"        xor     r9, r9, r10               ; S1(e)")
        P(f"        add     {H}, {H}, r11")
        P(f"        add     {H}, {H}, r12")
        P(f"        xor     r10, {F}, {G}")
        P(f"        and     r10, r10, {E}")
        P(f"        xor     r10, r10, {G}               ; Ch(e, f, g)")
        P(f"        add     {H}, {H}, r9")
        P(f"        add     {H}, {H}, r10               ; T1")
        P(f"        add     {D}, {D}, {H}                 ; e for the next round")
        P(f"        rori    r9, {A}, 2")
        P(f"        rori    r10, {A}, 13")
        P(f"        xor     r9, r9, r10")
        P(f"        rori    r10, {A}, 22")
        P(f"        xor     r9, r9, r10               ; S0(a)")
        P(f"        xor     {xn}, {A}, {B}                ; a ^ b, next round's b ^ c")
        P(f"        and     r10, {xn}, {xo}")
        P(f"        xor     r10, r10, {B}               ; Maj(a, b, c)")
        P(f"        add     {H}, {H}, r9")
        P(f"        add     {H}, {H}, r10               ; a for the next round")

def words(vals, per=4):
    for i in range(0, len(vals), per):
        P("        .word   " + ", ".join(f"{v:#010x}" for v in vals[i:i + per]))

P(r'''; sha256: SHA-256 of four messages: "", "abc", the 56-byte FIPS 180 test
; message, and 16 KB from a 32-bit LCG. Prints each digest in hex.
;
; sha_block works in two phases.
;  1. Load the 16 message words, byte-swap them (the machine is
;     little-endian, SHA-256 big-endian) and run the message schedule with
;     the 16 most recent words in r1-r16. Each step overwrites the register
;     holding W[t-16] with W[t], so a 16-step unrolled body needs no moves
;     and no loads; every W[t] is stored for phase 2.
;  2. 64 rounds, unrolled 8 times. The 8 working variables stay in r1-r8;
;     instead of shifting them along each round, the code renames them
;     (round j of 8 sees a..h in registers rotated by j), so after 8 rounds
;     they are back in place. Maj(a, b, c) = b ^ ((a ^ b) & (b ^ c)) and
;     this round's a ^ b is the next round's b ^ c, so Maj costs 3
;     instructions. K follows W in memory, so one pointer serves both.
;     A round is 25 instructions with no stalls.

        .include "lib/start.s"
        .include "lib/print.s"

LCG_A  = 1664525
LCG_C  = 1013904223
LCG_A2 = 0x17385ca9         ; LCG_A ** 2 mod 2**32: two steps at once
LCG_C2 = 0x47502932         ; LCG_C * (LCG_A + 1) mod 2**32

main:   addi    sp, sp, -8
        sw      lr, [sp + 4]
        sw      r16, [sp]
        la      r1, msg_empty
        li      r2, 0
        la      r3, lab_empty
        call    sha256
        la      r1, msg_abc
        li      r2, 3
        la      r3, lab_abc
        call    sha256
        la      r1, msg_fips
        li      r2, 56
        la      r3, lab_fips
        call    sha256
        la      r1, bigmsg              ; 16 KB of LCG output, seed 1
        li      r2, 4096
        li      r3, 1
        call    lcg_fill
        la      r1, bigmsg
        li      r2, 16384
        la      r3, lab_lcg
        call    sha256
        lw      r16, [sp]
        lw      lr, [sp + 4]
        addi    sp, sp, 8
        ret

; lcg_fill: store r2 words (even, 2 or more) of x = LCG_A x + LCG_C at r1,
; starting from the seed r3 (x1 first). Leaf; uses r1-r10.
; The multiplier is slow and can't overlap itself, so the work is split:
; it makes every other word, two steps ahead (x[n+2] = LCG_A2 x[n] + LCG_C2),
; while the ALU makes the word in between with shifts and adds
; (LCG_A = 25 * 139 * 479) in the multiply's shadow.
lcg_fill:
        li      r4, LCG_A2
        li      r5, LCG_C2
        li      r7, LCG_C
        li      r8, LCG_A
        multu   r3, r8
        mflo    r6
        add     r6, r6, r7              ; x1
        srli    r2, r2, 1               ; pairs
.loop:  multu   r6, r4                  ; x[n+2], meanwhile x[n+1] = A x[n] + C:
        slli    r8, r6, 4
        slli    r9, r6, 3
        add     r8, r8, r9
        add     r8, r8, r6              ; x * 25
        slli    r9, r8, 7
        slli    r10, r8, 3
        add     r9, r9, r10
        slli    r10, r8, 1
        add     r9, r9, r10
        add     r8, r9, r8              ; * 139
        slli    r9, r8, 9
        slli    r10, r8, 5
        sub     r9, r9, r10
        sub     r8, r9, r8              ; * 479
        add     r8, r8, r7              ; + C
        sw      r6, [r1]
        sw      r8, [r1 + 4]
        addi    r1, r1, 8
        mflo    r6
        add     r6, r6, r5
        dbnz    r2, .loop
        ret

; sha256: hash the r2 bytes at r1 and print the digest, then the label at r3.
; r22-r29 belong to this routine across sha_block calls:
;   r25 label   r26 length   r28 full blocks left   r29 block pointer
sha256: addi    sp, sp, -60
        sw      lr, [sp + 56]
        sw      r16, [sp + 52]
        sw      r17, [sp + 48]
        sw      r18, [sp + 44]
        sw      r19, [sp + 40]
        sw      r20, [sp + 36]
        sw      r21, [sp + 32]
        sw      r22, [sp + 28]
        sw      r23, [sp + 24]
        sw      r24, [sp + 20]
        sw      r25, [sp + 16]
        sw      r26, [sp + 12]
        sw      r27, [sp + 8]
        sw      r28, [sp + 4]
        sw      r29, [sp]
        mov     r29, r1
        mov     r26, r2
        mov     r25, r3
        la      r4, H0                  ; H = initial hash value
        la      r5, H
        li      r6, 8
.hinit: lw      r7, [r4]
        addi    r4, r4, 4
        sw      r7, [r5]
        addi    r5, r5, 4
        dbnz    r6, .hinit
        srli    r28, r26, 6
        beqz    r28, .tail
.full:  call    sha_block
        addi    r29, r29, 64
        dbnz    r28, .full
        ; the last partial block: bytes, 0x80, zeros, bit length (big-endian)
.tail:  la      r4, padbuf
        li      r6, 32
.zero:  sw      r0, [r4]
        addi    r4, r4, 4
        dbnz    r6, .zero
        la      r4, padbuf
        andi    r6, r26, 63             ; bytes left
        beqz    r6, .copied
.copy:  lbu     r7, [r29]
        addi    r29, r29, 1
        sb      r7, [r4]
        addi    r4, r4, 1
        dbnz    r6, .copy
.copied:
        li      r7, 0x80
        sb      r7, [r4]
        andi    r6, r26, 63
        la      r29, padbuf
        addi    r4, r29, 56             ; length field of block 1 ...
        slti    r7, r6, 56
        bnez    r7, .len
        addi    r4, r29, 120            ; ... or of block 2 if the 0x80 didn't leave room
.len:   slli    r7, r26, 3              ; bit length, low word
        srli    r8, r26, 29             ; high word
        srli    r9, r8, 24
        sb      r9, [r4]
        srli    r9, r8, 16
        sb      r9, [r4 + 1]
        srli    r9, r8, 8
        sb      r9, [r4 + 2]
        sb      r8, [r4 + 3]
        srli    r9, r7, 24
        sb      r9, [r4 + 4]
        srli    r9, r7, 16
        sb      r9, [r4 + 5]
        srli    r9, r7, 8
        sb      r9, [r4 + 6]
        sb      r7, [r4 + 7]
        call    sha_block
        andi    r6, r26, 63
        slti    r7, r6, 56
        bnez    r7, .print
        addi    r29, r29, 64
        call    sha_block
.print: la      r28, H
        li      r27, 8
.hex:   lw      r1, [r28]
        call    print_hex
        addi    r28, r28, 4
        dbnz    r27, .hex
        call    space
        mov     r1, r25
        call    puts
        call    newline
        lw      r29, [sp]
        lw      r28, [sp + 4]
        lw      r27, [sp + 8]
        lw      r26, [sp + 12]
        lw      r25, [sp + 16]
        lw      r24, [sp + 20]
        lw      r23, [sp + 24]
        lw      r22, [sp + 28]
        lw      r21, [sp + 32]
        lw      r20, [sp + 36]
        lw      r19, [sp + 40]
        lw      r18, [sp + 44]
        lw      r17, [sp + 48]
        lw      r16, [sp + 52]
        lw      lr, [sp + 56]
        addi    sp, sp, 60
        ret

; sha_block: compress the 64-byte block at r29 into H.
; Private convention: uses r1-r21, keeps r22-r29.
sha_block:
        la      r20, W
        li      r19, 0x00FF00FF
        ; load the block and byte-swap it into r1-r16 = W[0..15]''')
for j in range(16):
    P(f"        lw      {w(j)}, [r29 + {4 * j}]")
for j in range(16):
    P(f"        rori    r17, {w(j)}, 8")
    P(f"        rori    r18, {w(j)}, 24")
    P(f"        andn    r17, r17, r19")
    P(f"        and     r18, r18, r19")
    P(f"        or      {w(j)}, r17, r18")
    P(f"        sw      {w(j)}, [r20 + {4 * j}]")
P('''        ; message schedule: W[16..63], 16 per pass; r20 points at W[t]
        addi    r20, r20, 64
        li      r21, 3
.sched:''')
sched()
P('''        addi    r20, r20, 64
        dbnz    r21, .sched

        ; rounds: a..h in r1-r8, r20 points at W[i] (and K[i] 256 bytes on)
        la      r20, W
        lw      r1, [H]
        lw      r2, [H + 4]
        lw      r3, [H + 8]
        lw      r4, [H + 12]
        lw      r5, [H + 16]
        lw      r6, [H + 20]
        lw      r7, [H + 24]
        lw      r8, [H + 28]
        xor     r14, r2, r3             ; b ^ c for round 0
        li      r21, 8
.round:''')
rounds()
P('''        addi    r20, r20, 32
        dbnz    r21, .round

        ; H += a..h
        lw      r9, [H]
        lw      r10, [H + 4]
        lw      r11, [H + 8]
        lw      r12, [H + 12]
        add     r1, r1, r9
        add     r2, r2, r10
        lw      r9, [H + 16]
        lw      r10, [H + 20]
        add     r3, r3, r11
        add     r4, r4, r12
        lw      r11, [H + 24]
        lw      r12, [H + 28]
        add     r5, r5, r9
        add     r6, r6, r10
        add     r7, r7, r11
        add     r8, r8, r12
        sw      r1, [H]
        sw      r2, [H + 4]
        sw      r3, [H + 8]
        sw      r4, [H + 12]
        sw      r5, [H + 16]
        sw      r6, [H + 20]
        sw      r7, [H + 24]
        sw      r8, [H + 28]
        ret

        .data
        .align  4
W:      .space  256                     ; message schedule; K must follow it
K:''')
words(K)
P("H0:")
words(H0)
P('''H:      .space  32
padbuf: .space  128
msg_empty:
        .byte   0
msg_abc:
        .asciz  "abc"
msg_fips:
        .asciz  "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
lab_empty:
        .asciz  "empty"
lab_abc:
        .asciz  "abc"
lab_fips:
        .asciz  "fips-56"
lab_lcg:
        .asciz  "lcg-16k"
        .align  4
bigmsg: .space  16384''')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sha256.s'), 'w').write("\n".join(["; Generated by programs/gen/sha256.py: edit that, not this file.", ";"] + out) + "\n")
