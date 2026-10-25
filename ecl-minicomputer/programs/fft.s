; fft: a 1024-point complex fixed-point radix-2 FFT and its inverse.
;
; Q15 data in words, Q15 twiddles (1.0 = 32768) built from a quarter-wave
; sine table (data below, printed by programs/ref/fft.py --table). The
; forward transform halves every stage (result DFT/N); the inverse is the
; same code, unscaled, on swapped real and imaginary parts. The program
; transforms three sinusoids and a cosine plus LCG noise, prints the 8
; largest bins and a fold of the spectrum, transforms back and prints the
; round-trip error. The integer operations are spelled out in
; programs/ref/fft.py.
;
; Speed. Products are what costs: a MULT takes 8 cycles and the MFHL that
; reads it must come before the next MULT, so 9 cycles a product.
; - A twiddle product takes 3 multiplies (Gauss) instead of 4:
;     k1 = c (xr + xi),  tr = k1 - (c - s) xi,  ti = k1 - (c + s) xr
;   with c, c - s, c + s from a table (MFHL 16 gives the Q15 product
;   already halved for the stage; the inverse uses a table of doubled
;   values with the same code).
; - W = 1 and W = -i need no multiplies. Stages 1 and 2 (only those) are
;   done together in one pass that also does the bit-reversal gather;
;   in later stages each group does its j = 0 and j = h/2 butterflies
;   apart.
; - The other butterflies go in pairs j and j + h/2, whose twiddles
;   differ by a factor -i: W' = -s - ic, so one table entry (c, c - s,
;   c + s, -s, -c - s) serves both. The pair loop is scheduled around
;   its six products: everything else (12 loads, 8 stores, 4 shifts,
;   the arithmetic, pointer steps) fills their shadows, ~58 cycles for
;   two butterflies against 54 for the products alone.
        .include "lib/start.s"
        .include "lib/print.s"

N       = 1024
TE      = 20                    ; bytes per twiddle entry
TF      = 0x1000                ; forward twiddles, 256 entries
TI      = TF + 256 * TE         ; inverse twiddles (doubled)
REV8    = 0x3800                ; 4 * (8-bit reversal of i), i = 0..255
SINT    = 0x4000                ; 32768 sin(2 pi m / N), m = 0..1024
XR      = 0x6000                ; the signal
XI      = 0x7000
W1      = 0x8000                ; forward result: re here, im at +4096
W2      = 0xA000                ; inverse result
IMOFF   = 4096                  ; im array after the re array
PW      = 0xC000                ; power spectrum
LCG_A   = 1664525
LCG_C   = 1013904223

main:   addi    sp, sp, -16
        sw      lr, [sp + 12]
        sw      r16, [sp + 8]
        sw      r17, [sp + 4]
        sw      r18, [sp]

; ---- tables -------------------------------------------------------------------

; full sine table from the quarter wave: SINT[r] = SINT[512 - r] = Q[r],
; SINT[512 + r] = SINT[1024 - r] = -Q[r]
        la      r1, QW
        li      r2, SINT                ; &SINT[r]
        li      r3, SINT + 2048         ; &SINT[512 - r]
        li      r4, SINT + 2048         ; &SINT[512 + r]
        li      r5, SINT + 4096         ; &SINT[1024 - r]
        li      r6, 257
.sint:  lhu     r7, [r1]
        addi    r1, r1, 2
        sub     r8, r0, r7
        sw      r7, [r2]
        sw      r7, [r3]
        sw      r8, [r4]
        sw      r8, [r5]
        addi    r2, r2, 4
        addi    r3, r3, -4
        addi    r4, r4, 4
        addi    r5, r5, -4
        dbnz    r6, .sint

; twiddle entries k = 0..255: c = Q[256 - k], s = Q[k];
; c, c - s, c + s, -s, -c - s; doubled for the inverse
        la      r1, QW                  ; &Q[k]
        la      r2, QW + 512            ; &Q[256 - k]
        li      r3, TF
        li      r4, 256
.twid:  lhu     r5, [r1]                ; s
        lhu     r6, [r2]                ; c
        addi    r1, r1, 2
        addi    r2, r2, -2
        sub     r7, r6, r5              ; c - s
        add     r8, r6, r5              ; c + s
        sub     r9, r0, r5              ; -s
        sub     r10, r0, r8             ; -c - s
        sw      r6, [r3]
        sw      r7, [r3 + 4]
        sw      r8, [r3 + 8]
        sw      r9, [r3 + 12]
        sw      r10, [r3 + 16]
        add     r6, r6, r6
        add     r7, r7, r7
        add     r8, r8, r8
        add     r9, r9, r9
        add     r10, r10, r10
        sw      r6, [r3 + TI - TF]
        sw      r7, [r3 + TI - TF + 4]
        sw      r8, [r3 + TI - TF + 8]
        sw      r9, [r3 + TI - TF + 12]
        sw      r10, [r3 + TI - TF + 16]
        addi    r3, r3, TE
        dbnz    r4, .twid

; REV8[i] = 4 rev8(i) = ((REV8[i >> 1] >> 1) & 0x3FC) | (i & 1) << 9
        sw      r0, [REV8]
        li      r1, 4                   ; 4i
        li      r2, 4 * 256
.rev:   srli    r3, r1, 1
        andi    r3, r3, 0x3FC           ; 4 (i >> 1)
        lw      r3, [r3 + REV8]
        andi    r4, r1, 4
        slli    r4, r4, 7               ; (i & 1) << 9
        srli    r3, r3, 1
        andi    r3, r3, 0x3FC
        or      r3, r3, r4
        sw      r3, [r1 + REV8]
        addi    r1, r1, 4
        bne     r1, r2, .rev

; ---- the signal ----------------------------------------------------------------
; re = SIN(50n) >> 1 + SIN(129n + 100) >> 2 + noise
; im = SIN(300n + 256) >> 2 + SIN(-77n) >> 3 + noise
; phases are kept as byte offsets into SINT; noise = (LCG >> 24) - 128

        li      r1, 0                   ; phases
        li      r2, 4 * 100
        li      r3, 4 * 256
        li      r4, 0
        li      r5, XR
        li      r6, N
        li      r7, 4092                ; phase mask
        li      r8, 7                   ; LCG state
        li      r9, LCG_A
        li      r10, LCG_C
        multu   r8, r9
.sig:   mflo    r8
        add     r8, r8, r10
        multu   r8, r9                  ; for the imaginary part's noise
        lw      r11, [r1 + SINT]
        lw      r12, [r2 + SINT]
        srli    r13, r8, 24
        addi    r13, r13, -128
        srai    r11, r11, 1
        srai    r12, r12, 2
        add     r11, r11, r12
        add     r11, r11, r13
        sw      r11, [r5]
        lw      r11, [r3 + SINT]
        lw      r12, [r4 + SINT]
        addi    r1, r1, 4 * 50
        addi    r2, r2, 4 * 129
        srai    r11, r11, 2
        srai    r12, r12, 3
        mflo    r8
        add     r8, r8, r10
        multu   r8, r9                  ; for the next real part's
        srli    r13, r8, 24
        addi    r13, r13, -128
        add     r11, r11, r12
        add     r11, r11, r13
        sw      r11, [r5 + XI - XR]
        addi    r3, r3, 4 * 300
        addi    r4, r4, -4 * 77
        and     r1, r1, r7
        and     r2, r2, r7
        and     r3, r3, r7
        and     r4, r4, r7
        addi    r5, r5, 4
        dbnz    r6, .sig

; ---- forward transform, the largest bins, fold ------------------------------------

        li      r1, XR
        li      r2, XI
        li      r3, W1
        li      r4, TF
        li      r5, 1
        call    fft

        la      r1, s_head
        call    puts

; power spectrum: xr^2 + xi^2 (MULT, MADD, MFLO), loads in the shadows
        li      r1, W1
        li      r2, PW
        li      r3, N
        lw      r4, [r1]
        lw      r5, [r1 + IMOFF]
.pow:   mult    r4, r4
        addi    r1, r1, 4
        lw      r4, [r1]
        madd    r5, r5
        lw      r5, [r1 + IMOFF]
        mflo    r6
        sw      r6, [r2]
        addi    r2, r2, 4
        dbnz    r3, .pow

; the 8 largest: 8 scans for the maximum (lowest bin on ties), each
; printed and then knocked out with -1
        li      r16, 8
.top:   li      r1, PW
        li      r2, PW + 4 * N
        li      r3, -1                  ; best power
        li      r4, PW                  ; where
.scan:  lw      r5, [r1]
        lw      r6, [r1 + 4]
        addi    r1, r1, 8
        bgt     r5, r3, .new0           ; out of line: rare after the start
.back0: bgt     r6, r3, .new1
.back1: bne     r1, r2, .scan
        li      r1, -1
        sw      r1, [r4]
        li      r1, PW
        sub     r17, r4, r1             ; 4 * bin
        la      r1, s_bin
        call    puts
        srli    r1, r17, 2
        call    print_udec
        li      r1, ':'
        call    putc
        call    space
        li      r1, W1
        add     r1, r1, r17
        lw      r1, [r1]
        call    print_dec
        call    space
        li      r1, W1 + IMOFF
        add     r1, r1, r17
        lw      r1, [r1]
        call    print_dec
        call    newline
        dbnz    r16, .top
        j       .fold
.new0:  mov     r3, r5
        addi    r4, r1, -8
        j       .back0
.new1:  mov     r3, r6
        addi    r4, r1, -4
        j       .back1

.fold:  li      r1, W1
        li      r2, N
        li      r3, 0
.fl:    lw      r4, [r1]
        lw      r5, [r1 + IMOFF]
        addi    r1, r1, 4
        rori    r3, r3, 27
        xor     r3, r3, r4
        rori    r3, r3, 27
        xor     r3, r3, r5
        dbnz    r2, .fl
        mov     r16, r3
        la      r1, s_fold
        call    puts
        mov     r1, r16
        call    print_hex
        call    newline

; ---- inverse: the forward code, unscaled, with re and im swapped ---------------

        li      r1, W1 + IMOFF
        li      r2, W1
        li      r3, W2
        li      r4, TI
        li      r5, 0
        call    fft

; round-trip error: y re is at W2 + IMOFF, y im at W2
        li      r1, XR
        li      r2, N
        li      r16, 0                  ; max |error|
        li      r17, 0                  ; sum |error|
.err:   lw      r3, [r1 + W2 + IMOFF - XR]
        lw      r4, [r1]
        lw      r5, [r1 + W2 - XR]
        lw      r6, [r1 + XI - XR]
        addi    r1, r1, 4
        sub     r3, r3, r4
        srai    r4, r3, 31
        xor     r3, r3, r4
        sub     r3, r3, r4              ; |error| of re
        sub     r5, r5, r6
        srai    r6, r5, 31
        xor     r5, r5, r6
        sub     r5, r5, r6              ; |error| of im
        add     r17, r17, r3
        add     r17, r17, r5
        bgt     r3, r16, .emax0
.eb0:   bgt     r5, r16, .emax1
.eb1:   dbnz    r2, .err
        j       .done
.emax0: mov     r16, r3
        j       .eb0
.emax1: mov     r16, r5
        j       .eb1

.done:  la      r1, s_rt
        call    puts
        mov     r1, r16
        call    print_udec
        la      r1, s_sum
        call    puts
        mov     r1, r17
        call    print_udec
        la      r1, s_over
        call    puts

        lw      r18, [sp]
        lw      r17, [sp + 4]
        lw      r16, [sp + 8]
        lw      lr, [sp + 12]
        addi    sp, sp, 16
        ret

; fft: r1 = input re, r2 = input im (any arrays), r3 = output (re there,
; im at +4096), r4 = twiddle table, r5 = shift per stage (1 forward, 0
; inverse). Saves r16-r29 and uses lr as a register.
fft:    addi    sp, sp, -68
        sw      lr, [sp + 64]
        sw      r16, [sp + 60]
        sw      r17, [sp + 56]
        sw      r18, [sp + 52]
        sw      r19, [sp + 48]
        sw      r20, [sp + 44]
        sw      r21, [sp + 40]
        sw      r22, [sp + 36]
        sw      r23, [sp + 32]
        sw      r24, [sp + 28]
        sw      r25, [sp + 24]
        sw      r26, [sp + 20]
        sw      r27, [sp + 16]
        sw      r28, [sp + 12]
        sw      r29, [sp + 8]
        sw      r3, [sp + 4]            ; [sp + 4] output base
        mov     r7, r5                  ; r7 shift
        mov     r31, r4                 ; r31 twiddle table

; ---- stages 1 and 2 with the bit-reversal gather --------------------------------
; Output group g (elements 4g .. 4g+3) takes inputs rev10(4g + m) =
; rev8(g) + {0, 512, 256, 768}. Stage 1 pairs them with W = 1, stage 2
; with W = 1 and W = -i.
        li      r8, 0                   ; 4g
        li      r24, 4 * 256
        lw      r9, [REV8]
.pa:    add     r10, r1, r9
        add     r11, r2, r9
        lw      r12, [r10]              ; re of inputs 0, 1, 2, 3
        lw      r13, [r10 + 2048]
        lw      r14, [r10 + 1024]
        lw      r15, [r10 + 3072]
        lw      r16, [r11]              ; im
        lw      r17, [r11 + 2048]
        lw      r18, [r11 + 1024]
        lw      r19, [r11 + 3072]
        sra     r12, r12, r7
        sra     r13, r13, r7
        sra     r14, r14, r7
        sra     r15, r15, r7
        sra     r16, r16, r7
        sra     r17, r17, r7
        sra     r18, r18, r7
        sra     r19, r19, r7
        add     r20, r12, r13           ; stage 1: b0 .. b3 re
        sub     r21, r12, r13
        add     r22, r14, r15
        sub     r23, r14, r15
        add     r12, r16, r17           ; im
        sub     r13, r16, r17
        add     r14, r18, r19
        sub     r15, r18, r19
        sra     r20, r20, r7
        sra     r21, r21, r7
        sra     r22, r22, r7
        sra     r12, r12, r7
        sra     r13, r13, r7
        sra     r14, r14, r7
        sra     r16, r15, r7            ; -i b3: re = b3 im >> s
        sub     r17, r0, r23
        sra     r17, r17, r7            ;        im = (-b3 re) >> s
        add     r18, r20, r22           ; stage 2
        sw      r18, [r3]
        sub     r18, r20, r22
        sw      r18, [r3 + 8]
        add     r18, r21, r16
        sw      r18, [r3 + 4]
        sub     r18, r21, r16
        sw      r18, [r3 + 12]
        add     r18, r12, r14
        sw      r18, [r3 + IMOFF]
        sub     r18, r12, r14
        sw      r18, [r3 + IMOFF + 8]
        add     r18, r13, r17
        sw      r18, [r3 + IMOFF + 4]
        sub     r18, r13, r17
        sw      r18, [r3 + IMOFF + 12]
        addi    r8, r8, 4
        lw      r9, [r8 + REV8]         ; (one past the end at the last)
        addi    r3, r3, 16
        bne     r8, r24, .pa

; ---- stages 3 .. 10: h = 4 .. 512 -------------------------------------------------
; r29 4h (bytes), r6 twiddle step per j = (512 / h) entries, r28 groups
; left, r27 group base, [sp] groups per stage.
;
; Pair loop registers: r1 r2 = top and bottom of butterfly j (re; im at
; +4096), r3 r4 = the same for j + h/2, r5 twiddle entry, r8 count;
; r9 c, r10 c - s, r11 c + s, r12 -s, r13 -c - s; r14 r15 xr, xi (j);
; r16 r17 xr, xi (j + h/2); r18 r19 u >> s; r20 xr + xi; r21 k1;
; r22 r23 the other two products; r24 r25 t; r26 output.
        li      r29, 16
        li      r6, 128 * TE
        li      r1, 128
        sw      r1, [sp]
.stage: lw      r27, [sp + 4]
        lw      r28, [sp]
.group: srli    r3, r29, 1
        add     r2, r27, r29            ; bottom of j = 0
        add     r3, r27, r3             ; top of j = h/2
        add     r4, r3, r29             ; bottom of j = h/2
        add     r5, r31, r6             ; twiddle for j = 1
        lw      r14, [r2 + 4]           ; start the pair loop: xr, xi of j = 1
        lw      r15, [r2 + IMOFF + 4]
        lw      r9, [r5]
        lw      r10, [r5 + 4]
        lw      r11, [r5 + 8]
        add     r20, r14, r15
        lw      r12, [r5 + 12]
        lw      r13, [r5 + 16]
        mult    r9, r20                 ; k1 for j = 1
        ; under it: j = 0 (W = 1) ...
        lw      r16, [r27]
        lw      r17, [r27 + IMOFF]
        lw      r18, [r2]
        lw      r19, [r2 + IMOFF]
        sra     r16, r16, r7
        sra     r17, r17, r7
        sra     r18, r18, r7
        sra     r19, r19, r7
        add     r21, r16, r18
        sw      r21, [r27]
        sub     r21, r16, r18
        sw      r21, [r2]
        add     r21, r17, r19
        sw      r21, [r27 + IMOFF]
        sub     r21, r17, r19
        sw      r21, [r2 + IMOFF]
        ; ... and j = h/2 (W = -i: t = (xi >> s, (-xr) >> s))
        lw      r16, [r3]
        lw      r17, [r3 + IMOFF]
        lw      r18, [r4]
        lw      r19, [r4 + IMOFF]
        sra     r16, r16, r7
        sra     r17, r17, r7
        sub     r22, r0, r18
        sra     r21, r19, r7
        sra     r22, r22, r7
        add     r23, r16, r21
        sw      r23, [r3]
        sub     r23, r16, r21
        sw      r23, [r4]
        add     r23, r17, r22
        sw      r23, [r3 + IMOFF]
        sub     r23, r17, r22
        sw      r23, [r4 + IMOFF]
        addi    r1, r27, 4              ; j = 1
        addi    r2, r2, 4
        addi    r3, r3, 4
        addi    r4, r4, 4
        srli    r8, r29, 3
        addi    r8, r8, -1              ; h/2 - 1 pairs
; The loop starts with k1 for j in flight. The comments give each
; product's shadow; the last one holds the end of the j + h/2 butterfly
; and the next k1.
.pair:  mfhl    r21, 16                 ; k1 = c (xr + xi)
        mult    r10, r15                ; (c - s) xi
        lw      r18, [r1]
        lw      r19, [r1 + IMOFF]
        lw      r16, [r4]
        lw      r17, [r4 + IMOFF]
        add     r5, r5, r6
        lw      r9, [r5]                ; next c
        sra     r18, r18, r7
        mfhl    r22, 16
        mult    r11, r14                ; (c + s) xr
        sra     r19, r19, r7
        sub     r24, r21, r22           ; tr
        add     r26, r18, r24
        sw      r26, [r1]
        sub     r26, r18, r24
        sw      r26, [r2]
        add     r20, r16, r17
        mfhl    r23, 16
        mult    r12, r20                ; k1' = -s (xr' + xi')
        sub     r25, r21, r23           ; ti
        add     r26, r19, r25
        sw      r26, [r1 + IMOFF]
        sub     r26, r19, r25
        sw      r26, [r2 + IMOFF]
        lw      r18, [r3]
        lw      r19, [r3 + IMOFF]
        mfhl    r21, 16
        mult    r13, r17                ; (-c - s) xi'
        lw      r12, [r5 + 12]          ; next -s
        sra     r18, r18, r7
        sra     r19, r19, r7
        addi    r1, r1, 4
        addi    r2, r2, 4
        lw      r14, [r2]               ; next xr, xi
        lw      r15, [r2 + IMOFF]
        mfhl    r22, 16
        mult    r10, r16                ; (c - s) xr'
        lw      r13, [r5 + 16]          ; next -c - s
        lw      r10, [r5 + 4]           ; next c - s
        add     r20, r14, r15
        sub     r24, r21, r22           ; tr'
        add     r26, r18, r24
        sw      r26, [r3]
        sub     r26, r18, r24
        mfhl    r23, 16
        mult    r9, r20                 ; next k1 (spare on the last round)
        sw      r26, [r4]
        sub     r25, r21, r23           ; ti'
        add     r26, r19, r25
        sw      r26, [r3 + IMOFF]
        sub     r26, r19, r25
        sw      r26, [r4 + IMOFF]
        lw      r11, [r5 + 8]           ; next c + s
        addi    r3, r3, 4
        addi    r4, r4, 4
        dbnz    r8, .pair
        add     r27, r27, r29           ; next group
        add     r27, r27, r29
        dbnz    r28, .group
        lw      r1, [sp]                ; next stage
        srli    r1, r1, 1
        sw      r1, [sp]
        slli    r29, r29, 1
        srli    r6, r6, 1
        li      r1, 4 * N
        bne     r29, r1, .stage

        lw      r29, [sp + 8]
        lw      r28, [sp + 12]
        lw      r27, [sp + 16]
        lw      r26, [sp + 20]
        lw      r25, [sp + 24]
        lw      r24, [sp + 28]
        lw      r23, [sp + 32]
        lw      r22, [sp + 36]
        lw      r21, [sp + 40]
        lw      r20, [sp + 44]
        lw      r19, [sp + 48]
        lw      r18, [sp + 52]
        lw      r17, [sp + 56]
        lw      r16, [sp + 60]
        lw      lr, [sp + 64]
        addi    sp, sp, 68
        ret

        .data
s_head: .asciz  "1024-point FFT, Q15, scaled by 1/2 a stage\n"
s_bin:  .asciz  "bin "
s_fold: .asciz  "spectrum fold "
s_rt:   .asciz  "round trip: max |error| "
s_sum:  .asciz  ", sum |error| "
s_over: .asciz  " over 2048 values\n"
        .align  2
; Q[m] = round(32768 sin(2 pi m / 1024)), m = 0..256
QW:
        .half   0, 201, 402, 603, 804, 1005, 1206, 1407, 1608, 1809, 2009, 2210, 2411, 2611, 2811, 3012
        .half   3212, 3412, 3612, 3812, 4011, 4211, 4410, 4609, 4808, 5007, 5205, 5404, 5602, 5800, 5998, 6195
        .half   6393, 6590, 6787, 6983, 7180, 7376, 7571, 7767, 7962, 8157, 8351, 8546, 8740, 8933, 9127, 9319
        .half   9512, 9704, 9896, 10088, 10279, 10469, 10660, 10850, 11039, 11228, 11417, 11605, 11793, 11980, 12167, 12354
        .half   12540, 12725, 12910, 13095, 13279, 13463, 13646, 13828, 14010, 14192, 14373, 14553, 14733, 14912, 15091, 15269
        .half   15447, 15624, 15800, 15976, 16151, 16326, 16500, 16673, 16846, 17018, 17190, 17361, 17531, 17700, 17869, 18037
        .half   18205, 18372, 18538, 18703, 18868, 19032, 19195, 19358, 19520, 19681, 19841, 20001, 20160, 20318, 20475, 20632
        .half   20788, 20943, 21097, 21251, 21403, 21555, 21706, 21856, 22006, 22154, 22302, 22449, 22595, 22740, 22884, 23028
        .half   23170, 23312, 23453, 23593, 23732, 23870, 24008, 24144, 24279, 24414, 24548, 24680, 24812, 24943, 25073, 25202
        .half   25330, 25457, 25583, 25708, 25833, 25956, 26078, 26199, 26320, 26439, 26557, 26674, 26791, 26906, 27020, 27133
        .half   27246, 27357, 27467, 27576, 27684, 27791, 27897, 28002, 28106, 28209, 28311, 28411, 28511, 28610, 28707, 28803
        .half   28899, 28993, 29086, 29178, 29269, 29359, 29448, 29535, 29622, 29707, 29792, 29875, 29957, 30038, 30118, 30196
        .half   30274, 30350, 30425, 30499, 30572, 30644, 30715, 30784, 30853, 30920, 30986, 31050, 31114, 31177, 31238, 31298
        .half   31357, 31415, 31471, 31527, 31581, 31634, 31686, 31737, 31786, 31834, 31881, 31927, 31972, 32015, 32058, 32099
        .half   32138, 32177, 32214, 32251, 32286, 32319, 32352, 32383, 32413, 32442, 32470, 32496, 32522, 32546, 32568, 32590
        .half   32610, 32629, 32647, 32664, 32679, 32693, 32706, 32718, 32729, 32738, 32746, 32753, 32758, 32762, 32766, 32767
        .half   32768
