; pi: 500 decimal places of pi by Machin's formula,
;   pi = 16 atan(1/5) - 4 atan(1/239),  atan(1/x) = sum (-1)^k / ((2k+1) x^(2k+1))
; in fixed point: NL big-endian 32-bit limbs, limb 0 the integer part
; (55 fraction limbs = 529 decimal places, ~3 lost to truncation).
;
; Each series keeps a power P = c / x^(2k-1) (c = 16 or 4). Term k is
;   T = P / (x^2 (2k+1))   and then   P = P / x^2,
; two long divisions of the same limbs by small numbers. They run in one
; pass, top limb down, as two independent chains on one loop, which keeps
; the multiplier busy (one chain alone waits on itself).
;
; The machine's DIVU is 32/32 bits and takes 34 cycles, so a limb of a long
; division (64/32 bits) uses a precomputed reciprocal instead (Moller and
; Granlund, "Improved division by invariant integers", 2011): two MULTUs
; and a few adds. That needs the divisor's top bit set, so the divisor d is
; used as D = d << s, and the dividend is shifted left by s on the fly (the
; quotient is the same). The reciprocal v = floor((2^64 - 1) / D) - 2^32 is
; worked out per divisor with a few DIVUs. Positive and negative terms
; are summed separately (ADDS/ADDC) and subtracted at the end.

        .include "lib/start.s"
        .include "lib/print.s"

NL = 56                     ; limbs

main:   addi    sp, sp, -4
        sw      lr, [sp]
        li      r1, 5                   ; + 16 atan(1/5): even terms positive
        li      r2, 16
        la      r3, SPOS
        la      r4, SNEG
        call    atan
        li      r1, 239                 ; - 4 atan(1/239): even terms negative
        li      r2, 4
        la      r3, SNEG
        la      r4, SPOS
        call    atan
        call    subsums                 ; SPOS = SPOS - SNEG = pi
        call    printpi
        lw      lr, [sp]
        addi    sp, sp, 4
        ret

; atan: add c atan(1/x) into the sums.
; In: r1 = x, r2 = c, r3 = sum for even terms, r4 = sum for odd terms.
;   r23 x^2   r24 x^2 (2k+1)   r25 &PW[first non-zero limb]   r26 r27 the
;   sums for the next even and odd terms (swapped every term)   r28 2 x^2
;   r29 &PW[NL]   r16 x
atan:   addi    sp, sp, -60
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
        mov     r16, r1
        mov     r26, r3
        mov     r27, r4
        la      r29, PW + 4 * NL
        la      r25, PW
        sw      r2, [r25]               ; P = c
        addi    r5, r25, 4
.zero:  sw      r0, [r5]
        addi    r5, r5, 4
        bne     r5, r29, .zero
        call    recip                   ; P = c / x
        mov     r10, r1
        mov     r11, r2
        mov     r12, r3
        mov     r13, r4
        la      r1, PW
        li      r2, NL
        call    div1
        la      r1, PW                  ; term 0 is P itself
        mov     r2, r26
        mov     r3, r25
        call    addpass
        mul     r23, r16, r16           ; x^2: the power's divisor
        mov     r1, r23
        call    recip
        sw      r1, [pcon]
        sw      r2, [pcon + 4]
        sw      r3, [pcon + 8]
        sw      r4, [pcon + 12]
        add     r28, r23, r23           ; 2 x^2
        add     r24, r28, r23           ; 3 x^2: term 1's divisor
        ; term k: T = P / (x^2 (2k+1)), P = P / x^2
.term:  mov     r1, r24
        call    recip
        sw      r1, [tcon]
        sw      r2, [tcon + 4]
        sw      r3, [tcon + 8]
        sw      r4, [tcon + 12]
        mov     r1, r25
        sub     r2, r29, r25
        srli    r2, r2, 2
        call    fused
        la      r1, TT
        mov     r2, r27
        mov     r3, r25
        call    addpass
        mov     r1, r26                 ; the next term has the other sign
        mov     r26, r27
        mov     r27, r1
.adv:   lw      r1, [r25]               ; skip limbs of P that became zero
        bnez    r1, .next
        addi    r25, r25, 4
        bne     r25, r29, .adv
        j       .done                   ; P = 0: no more terms
.next:  add     r24, r24, r28           ; x^2 (2k+3)
        j       .term
.done:  lw      r29, [sp]
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

; recip: divisor constants for d = r1 (2 .. 2^31 - 1).
; Out: r1 = D = d << s (top bit set), r2 = v = floor((2^64 - 1) / D) - 2^32,
; r3 = s, r4 = 32 - s. Leaf; uses r1-r9.
; floor((2^64 - 1) / (d 2^s)) = floor((2^(64-s) - 1) / d), a number of
; 64 - s one bits divided by d. DIVU does it s bits at a time: with a
; remainder below d < 2^(32-s), (r << s) + (2^s - 1) still fits in 32 bits.
; The quotient's bits above bit 31 fall off the top, which subtracts 2^32.
recip:  mov     r5, r1                  ; d
        li      r3, 0                   ; s = leading zeros of d
        mov     r6, r1
        srli    r7, r6, 16
        bnez    r7, .c8
        slli    r6, r6, 16
        addi    r3, r3, 16
.c8:    srli    r7, r6, 24
        bnez    r7, .c4
        slli    r6, r6, 8
        addi    r3, r3, 8
.c4:    srli    r7, r6, 28
        bnez    r7, .c2
        slli    r6, r6, 4
        addi    r3, r3, 4
.c2:    srli    r7, r6, 30
        bnez    r7, .c1
        slli    r6, r6, 2
        addi    r3, r3, 2
.c1:    bltz    r6, .norm
        slli    r6, r6, 1
        addi    r3, r3, 1
.norm:  li      r7, 64                  ; r6 = D
        sub     r7, r7, r3              ; 64 - s bits: a first chunk of
        li      r8, 0                   ; r7 = 1..s bits, then r8 chunks of s
.split: bge     r3, r7, .first          ; (64 - s > s, so r8 ends up 1 or more)
        sub     r7, r7, r3
        addi    r8, r8, 1
        j       .split
.first: li      r9, 1
        sll     r9, r9, r7
        addi    r9, r9, -1
        divu    r9, r5
        mflo    r2                      ; quotient so far
        mfhi    r7                      ; remainder
        li      r9, 1
        sll     r9, r9, r3
        addi    r9, r9, -1              ; 2^s - 1
.chunk: sll     r1, r7, r3
        or      r1, r1, r9
        divu    r1, r5
        sll     r2, r2, r3
        mflo    r1
        mfhi    r7
        or      r2, r2, r1
        dbnz    r8, .chunk
        mov     r1, r6
        li      r4, 32
        sub     r4, r4, r3
        ret

; div1: divide the r2 limbs from r1 down by D = r10 (v = r11, s = r12,
; 32 - s = r13) in place. The limb after the last must be zero. Leaf;
; uses r1-r9.
div1:   lw      r3, [r1]
        srl     r4, r3, r13             ; u1: the bits shifted out of the top
.l:     lw      r5, [r1 + 4]            ; the next limb down
        multu   r11, r4                 ; v * u1
        sll     r6, r3, r12
        srl     r7, r5, r13
        or      r6, r6, r7              ; u0: this limb shifted left s
        addi    r9, r4, 1
        mov     r3, r5
        mfhi    r7
        mflo    r8
        adds    r8, r8, r6              ; (q1, q0) = v u1 + (u1 + 1, u0)
        addc    r7, r7, r9
        multu   r7, r10
        mflo    r9
        sub     r4, r6, r9              ; r = u0 - q1 D (mod 2^32)
        sltu    r9, r8, r4              ; r > q0: q1 was one too big
        nop
        neg     r9, r9
        add     r7, r7, r9
        and     r9, r9, r10
        add     r4, r4, r9
        bgeu    r4, r10, .fix           ; r >= D: q1 one too small (rare)
.ok:    sw      r7, [r1]
        addi    r1, r1, 4
        dbnz    r2, .l
        ret
.fix:   sub     r4, r4, r10
        addi    r7, r7, 1
        j       .ok

; fused: for the r2 limbs of PW from r1 down: TT = PW / Dt and PW = PW / Dp,
; constants from tcon and pcon. Both chains read the same limbs; each limb
; is four multiplies. The T chain's last two steps are finished at the top
; of the next limb, after the P chain's first multiply has started, so the
; multiplier doesn't wait for them. Uses r1-r22.
;   r1 limb pointer   r2 limbs left   r3 this limb   r4 the next one down
;   P chain: r5 s  r6 32-s  r7 v  r8 D  r9 r (u1)  r10 u0  r11 q1  r12 q0  r13
;   T chain: r14 s r15 32-s r16 v r17 D r18 r (u1) r19 u0  r20 q1  r21 q0  r22
fused:  lw      r8, [pcon]
        lw      r7, [pcon + 4]
        lw      r5, [pcon + 8]
        lw      r6, [pcon + 12]
        lw      r17, [tcon]
        lw      r16, [tcon + 4]
        lw      r14, [tcon + 8]
        lw      r15, [tcon + 12]
        lw      r3, [r1]
        srl     r9, r3, r6              ; P: u1 = the top bits
        srl     r19, r3, r15            ; T: a dummy finished step whose
        li      r20, 0                  ; remainder is the top bits
        li      r21, -1
        multu   r0, r0
.fl:    mflo    r22                     ; T: finish the previous limb
        multu   r7, r9                  ; P: v * u1
        sub     r18, r19, r22           ; T: r = u0 - q1 D
        sltu    r22, r21, r18
        lw      r4, [r1 + 4]
        neg     r22, r22
        add     r20, r20, r22
        and     r22, r22, r17
        add     r18, r18, r22
        bgeu    r18, r17, .fixt
.okt:   sw      r20, [r1 + TT - PW - 4] ; T: quotient of the previous limb
        sll     r10, r3, r5
        srl     r13, r4, r6
        or      r10, r10, r13           ; P: u0
        sll     r19, r3, r14
        srl     r22, r4, r15
        or      r19, r19, r22           ; T: u0
        addi    r13, r9, 1
        addi    r22, r18, 1
        mov     r3, r4
        mfhi    r11
        mflo    r12
        multu   r16, r18                ; T: v * u1
        adds    r12, r12, r10           ; P: (q1, q0) = v u1 + (u1 + 1, u0)
        addc    r11, r11, r13
        mfhi    r20
        mflo    r21
        multu   r11, r8                 ; P: q1 * D
        adds    r21, r21, r19           ; T: (q1, q0)
        addc    r20, r20, r22
        mflo    r13
        multu   r20, r17                ; T: q1 * D
        sub     r9, r10, r13            ; P: r = u0 - q1 D
        sltu    r13, r12, r9
        addi    r1, r1, 4
        neg     r13, r13
        add     r11, r11, r13
        and     r13, r13, r8
        add     r9, r9, r13
        bgeu    r9, r8, .fixp
.okp:   sw      r11, [r1 - 4]           ; P: quotient
        dbnz    r2, .fl
        mflo    r22                     ; T: finish the last limb
        sub     r18, r19, r22
        sltu    r22, r21, r18
        nop
        neg     r22, r22
        add     r20, r20, r22
        and     r22, r22, r17
        add     r18, r18, r22
        bgeu    r18, r17, .fixt2
.okt2:  sw      r20, [r1 + TT - PW - 4]
        ret
.fixt:  sub     r18, r18, r17
        addi    r20, r20, 1
        j       .okt
.fixp:  sub     r9, r9, r8
        addi    r11, r11, 1
        j       .okp
.fixt2: sub     r18, r18, r17
        addi    r20, r20, 1
        j       .okt2

; addpass: add the limbs of the array at r1 into the array at r2, from limb
; NL-1 up to the limb whose address in PW is r3 (the same index), then
; ripple the carry further up. Leaf; uses r1-r8.
addpass:
        la      r4, PW + 4 * NL
        sub     r8, r4, r3
        srli    r8, r8, 2               ; limbs
        addi    r4, r1, 4 * NL - 4      ; source, bottom limb
        addi    r5, r2, 4 * NL - 4      ; destination
        adds    r0, r0, r0              ; C = 0
.a:     lw      r6, [r4]
        lw      r7, [r5]
        addi    r4, r4, -4
        addc    r7, r7, r6
        sw      r7, [r5]
        addi    r5, r5, -4
        dbnz    r8, .a
.r:     addc    r6, r0, r0              ; carry out of the top: r6 = C, C = 0
        beqz    r6, .done
        lw      r7, [r5]
        adds    r7, r7, r6
        sw      r7, [r5]
        addi    r5, r5, -4
        j       .r
.done:  ret

; subsums: SPOS = SPOS - SNEG. Leaf; uses r1-r6.
subsums:
        la      r1, SPOS + 4 * NL - 4
        la      r2, SNEG + 4 * NL - 4
        li      r3, NL
        subs    r0, r0, r0              ; C = 1: no borrow
.s:     lw      r4, [r1]
        lw      r5, [r2]
        addi    r2, r2, -4
        subc    r4, r4, r5
        sw      r4, [r1]
        addi    r1, r1, -4
        dbnz    r3, .s
        ret

; printpi: print "3." and the first 500 decimals, 50 to a line. The
; fraction is multiplied by 10^9 over and over; what comes out of the top
; is the next 9 digits.
printpi:
        addi    sp, sp, -12
        sw      lr, [sp + 8]
        sw      r16, [sp + 4]
        sw      r17, [sp]
        lw      r1, [SPOS]
        addi    r1, r1, '0'
        call    putc
        li      r1, '.'
        call    putc
        call    newline
        la      r16, digits
        li      r17, 56                 ; 504 digits
.group: la      r2, SPOS + 4 * NL - 4     ; fraction *= 10^9, bottom limb up
        li      r3, 1000000000
        li      r4, 0                   ; carry
        li      r8, NL - 1
        lw      r5, [r2]
        multu   r5, r3
        lw      r5, [r2 - 4]
.m:     mflo    r6
        mfhi    r7
        multu   r5, r3                  ; the next limb up
        adds    r6, r6, r4
        addc    r4, r7, r0
        sw      r6, [r2]
        lw      r5, [r2 - 8]
        addi    r2, r2, -4
        dbnz    r8, .m
        mov     r1, r4                  ; the 9 digits that came out
        mov     r2, r16
        call    render9
        addi    r16, r16, 9
        dbnz    r17, .group
        la      r16, digits
        li      r17, 10
.line:  li      r3, 50
.ch:    lbu     r1, [r16]
        sb      r1, [CONSOLE]
        addi    r16, r16, 1
        dbnz    r3, .ch
        call    newline
        dbnz    r17, .line
        lw      r17, [sp]
        lw      r16, [sp + 4]
        lw      lr, [sp + 8]
        addi    sp, sp, 12
        ret

; render9: write r1 (< 10^9) at r2 as 9 digits with leading zeros.
; Leaf; uses r1-r6.
render9:
        addi    r2, r2, 9
        li      r3, 0xCCCCCCCD          ; x / 10 = (x * 0xCCCCCCCD) >> 35
        li      r4, 9
.d:     multu   r1, r3
        mfhi    r5
        srli    r5, r5, 3
        slli    r6, r5, 2
        add     r6, r6, r5
        slli    r6, r6, 1               ; 10 (x / 10)
        sub     r6, r1, r6
        addi    r6, r6, '0'
        addi    r2, r2, -1
        sb      r6, [r2]
        mov     r1, r5
        dbnz    r4, .d
        ret

        .data
        .align  4
pcon:   .space  16                      ; D, v, s, 32 - s for P / x^2
tcon:   .space  16                      ; the same for T = P / (x^2 (2k+1))
        .word   0
PW:     .space  4 * NL                  ; the power
        .word   0                       ; (a zero after each array)
        .word   0
TT:     .space  4 * NL                  ; the term
        .word   0
        .word   0
SPOS:     .space  4 * NL                  ; sum of positive terms, then pi
        .word   0
        .word   0
SNEG:     .space  4 * NL                  ; sum of negative terms
        .word   0
digits: .space  512
