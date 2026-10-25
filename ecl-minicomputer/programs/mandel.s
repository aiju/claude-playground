; mandel: a fixed-point Mandelbrot set as 72 x 30 ASCII art, up to 255
; iterations a pixel, and the total iteration count.
;
; Q24 fixed point. Each iteration needs only two products:
;   zr' = (zr + zi)(zr - zi) >> 24 + cr      MULT, MFHL 24
;   zi' = zr * zi >> 23 + ci                 MULT, MFHL 23 (twice zr*zi)
; and the escape test is a box, |zr| > 2 or |zi| > 2, which is an ADD and
; an unsigned compare per component: no squares. See programs/ref/mandel.py.
;
; The multiplier is the bottleneck: a product takes 8 cycles, and the
; MFHL that reads it has to come before the next MULT, so a product costs
; 9. The loop is ordered so that the next product starts as soon as its
; operands exist, with everything else in the shadows:
;
;   zr*zi for z(k+1) starts 1 cycle after zr(k+1) is known; zi(k+1) and
;   (zr+zi), (zr-zi) are worked out under it; then (zr+zi)(zr-zi)
;   starts, and zi(k+1) is tested under that.
;
; 19 cycles an iteration: 18 for the two products, 1 for the ADD of cr.
        .include "lib/start.s"
        .include "lib/print.s"

COLS    = 72
ROWS    = 30
DX      = 629146                ; ~2.7 / 72: x from -2.1 to 0.6
DY      = 1342178               ; ~2.4 / 30: y from -1.2 to 1.2
X0      = -35232154 + DX / 2    ; centre of the first column
Y0      = -(ROWS - 1) * DY / 2  ; rows symmetric about y = 0
TWO     = 2 << 24
FOUR    = 4 << 24
MAXIT   = 255

main:   addi    sp, sp, -40
        sw      lr, [sp + 36]
        sw      r16, [sp + 32]
        sw      r17, [sp + 28]
        sw      r18, [sp + 24]
        sw      r19, [sp + 20]
        sw      r20, [sp + 16]
        sw      r21, [sp + 12]
        sw      r22, [sp + 8]
        sw      r23, [sp + 4]
        sw      r24, [sp]

        li      r16, Y0                 ; r16 ci
        li      r17, ROWS
        li      r20, TWO
        li      r21, FOUR
        li      r22, 0                  ; r22 total of the counts
        li      r23, DX
        li      r24, DY
.row:   li      r18, X0                 ; r18 cr
        li      r19, COLS

; one pixel: r1 zr, r2 zi, r3 zr + zi, r4 zr - zi, r5 2*zr*zi,
; r6 (zr + zi)(zr - zi), r7 test, r8 values left to compute
.pix:   add     r7, r18, r20            ; z1 = c: escaped already?
        bgtu    r7, r21, .esc1
        add     r7, r16, r20
        bgtu    r7, r21, .esc1
        mult    r18, r16                ; zr * zi for z2
        add     r3, r18, r16
        sub     r4, r18, r16
        li      r8, MAXIT - 1           ; z2 .. z255
.iter:  mfhl    r5, 23                  ; 2 zr zi
        mult    r3, r4                  ; (zr + zi)(zr - zi)
        add     r2, r5, r16             ; zi'
        add     r7, r2, r20
        bgtu    r7, r21, .esc           ; |zi'| > 2
        mfhl    r6, 24
        add     r1, r6, r18             ; zr'
        mult    r1, r2                  ; next zr * zi
        add     r3, r1, r2
        sub     r4, r1, r2
        add     r7, r1, r20
        bgtu    r7, r21, .esc           ; |zr'| > 2
        dbnz    r8, .iter
        addi    r22, r22, MAXIT         ; never escaped
        li      r1, '@'
        j       .out
.esc1:  li      r8, MAXIT               ; count 1
.esc:   li      r1, MAXIT + 1           ; escaped at z(256 - r8)
        sub     r1, r1, r8
        add     r22, r22, r1
        lbu     r1, [r1 + CHARS]
.out:   sb      r1, [CONSOLE]
        add     r18, r18, r23
        dbnz    r19, .pix
        li      r1, '\n'
        sb      r1, [CONSOLE]
        add     r16, r16, r24
        dbnz    r17, .row

        la      r1, s_iter
        call    puts
        mov     r1, r22
        call    print_udec
        call    newline

        lw      r24, [sp]
        lw      r23, [sp + 4]
        lw      r22, [sp + 8]
        lw      r21, [sp + 12]
        lw      r20, [sp + 16]
        lw      r19, [sp + 20]
        lw      r18, [sp + 24]
        lw      r17, [sp + 28]
        lw      r16, [sp + 32]
        lw      lr, [sp + 36]
        addi    sp, sp, 40
        ret

        .data
; CHARS[n]: the character for a pixel that escaped at z(n), by the bit
; length of n (there's no count-leading-zeros instruction)
CHARS:  .byte   0
        .space  1, ' '
        .space  2, '.'
        .space  4, ':'
        .space  8, '-'
        .space  16, '='
        .space  32, '+'
        .space  64, '*'
        .space  128, '#'
s_iter: .asciz  "iterations "
