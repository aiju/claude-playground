; bignum: 1000! and Fibonacci(10000) with 32-bit limbs. For each: the number
; of decimal digits and the first and last 50 digits.
;
; Numbers are arrays of 32-bit limbs, least significant first, each with a
; zero word just below it and zeros above it.
;
; 1000!: multiply by 2, 3, ... 1000, packing as many consecutive factors
;   into one 32-bit multiplier as fit (about 3 per pass near 1000), so each
;   limb costs one MULTU per ~30 bits of factorial.
; Fibonacci(10000): F(n+3) = 4 F(n) + F(n-3), so a_k = F(3k+1) satisfies
;   a_k+1 = 4 a_k + a_k-1. 4 a_k is one FSR per limb (the funnel shift takes
;   the top bits of the limb below), so a pass is a single ADDS/ADDC carry
;   chain doing three Fibonacci steps: 3332 passes instead of 9999.
; Decimal: repeated division by 10^9, top limb down, in place. Each limb is
;   a 64/32 division done with a precomputed reciprocal (Moller and
;   Granlund, "Improved division by invariant integers", 2011): two MULTUs
;   and a few adds instead of a divide the machine doesn't have. The divisor
;   must have its top bit set, so it divides 4N by 4 * 10^9 (same quotient,
;   4 times the remainder), shifting N left by 2 on the fly with FSR.

        .include "lib/start.s"
        .include "lib/print.s"

FACT   = 0x10004            ; 1000!, up to 300 limbs (0x10000 is its zero word)
FIBX   = 0x11004            ; Fibonacci arrays, up to 260 limbs each
FIBY   = 0x12004
GROUPS = 0x13000            ; base-10^9 digits, least significant first
DIVN   = 0xEE6B2800         ; 4 * 10^9, normalised divisor
DIVV   = 0x12E0BE82         ; floor((2^64 - 1) / DIVN) - 2^32

main:   addi    sp, sp, -4
        sw      lr, [sp]
        call    fact1000
        mov     r2, r1
        li      r1, FACT
        la      r3, lab_fact
        call    report
        call    fib10000
        mov     r2, r1
        li      r1, FIBY
        la      r3, lab_fib
        call    report
        lw      lr, [sp]
        addi    sp, sp, 4
        ret

; fact1000: FACT = 1000!. Returns r1 = number of limbs. Leaf; uses r1-r15.
; Only the odd part of each factor is multiplied in; the powers of two
; (994 bits in all) are one shift at the end. That cuts the limb
; multiplications by about a fifth: the number is shorter all the way.
;   r10 limbs   r11 next factor k   r12 multiplier (packed odd parts)
;   r13 total shift   r14 odd part of k   r15 its trailing zeros
fact1000:
        li      r1, 1
        li      r2, FACT
        sw      r1, [r2]
        li      r10, 1
        li      r11, 2
        li      r13, 0
.pass:  li      r12, 1                  ; pack odd parts while the product fits
.pack:  slti    r1, r11, 1001
        beqz    r1, .mul
        mov     r14, r11
        li      r15, 0
.odd:   andi    r1, r14, 1              ; strip k's factors of 2
        bnez    r1, .isodd
        srli    r14, r14, 1
        addi    r15, r15, 1
        j       .odd
.isodd: multu   r12, r14
        mfhi    r1
        bnez    r1, .mul                ; doesn't fit: multiply, k waits
        mflo    r12
        add     r13, r13, r15
        addi    r11, r11, 1
        j       .pack
        ; FACT *= r12. The multiply for limb i+1 starts before limb i's carry
        ; is added in, so the loop runs at the multiplier's pace.
.mul:   li      r1, 1
        beq     r12, r1, .tail          ; nothing packed (factors that are powers of 2)
        li      r2, FACT
        li      r4, 0                   ; carry
        mov     r3, r10
        lw      r5, [r2]
        multu   r5, r12
        lw      r5, [r2 + 4]
.ml:    mflo    r6
        mfhi    r7
        multu   r5, r12                 ; next limb (past the end it multiplies a zero)
        adds    r6, r6, r4              ; low half + carry
        addc    r4, r7, r0              ; carry = high half + carry out
        sw      r6, [r2]
        lw      r5, [r2 + 8]
        addi    r2, r2, 4
        dbnz    r3, .ml
        beqz    r4, .tail
        sw      r4, [r2]                ; the product grew a limb
        addi    r10, r10, 1
.tail:  slti    r1, r11, 1001
        bnez    r1, .pass

        ; FACT <<= r13: whole limbs (r13 / 32) and bits (r13 % 32), top down.
        ; The low limb's bits come in as (x >> 1) >> (31 - bits), which is
        ; right for 0 bits too.
        srli    r4, r13, 5              ; limb shift
        andi    r5, r13, 31             ; bit shift
        li      r6, 31
        sub     r6, r6, r5
        li      r2, FACT
        slli    r3, r10, 2
        add     r2, r2, r3              ; &FACT[n] (zero)
        slli    r3, r4, 2
        add     r3, r3, r2              ; destination &FACT[n + limb shift]
        mov     r7, r10
        lw      r8, [r2]                ; FACT[n] = 0
.sh:    lw      r9, [r2 - 4]            ; the limb below
        sll     r8, r8, r5
        srli    r1, r9, 1
        srl     r1, r1, r6
        or      r8, r8, r1
        sw      r8, [r3]
        mov     r8, r9
        addi    r2, r2, -4
        addi    r3, r3, -4
        dbnz    r7, .sh
        sll     r8, r8, r5
        sw      r8, [r3]                ; limb 0 shifted
.zero:  beq     r3, r2, .zdone          ; the vacated low limbs
        addi    r3, r3, -4
        sw      r0, [r3]
        j       .zero
.zdone: add     r10, r10, r4
        addi    r10, r10, 1             ; limbs, maybe one too many ...
        slli    r1, r10, 2
        li      r2, FACT - 4
        add     r1, r1, r2
        lw      r1, [r1]
        bnez    r1, .done
        addi    r10, r10, -1            ; ... if the top one is zero
.done:  mov     r1, r10
        ret

; fib10000: FIBY = F(10000). Returns r1 = number of limbs.
; X and Y hold a_k-1 and a_k (a_k = F(3k+1)); each round does
; X = 4Y + X, then Y = 4X + Y. Uses r1-r17.
;   r16 rounds left   r17 limbs in the larger number
fib10000:
        addi    sp, sp, -12
        sw      lr, [sp + 8]
        sw      r16, [sp + 4]
        sw      r17, [sp]
        li      r1, 1
        li      r2, FIBX
        sw      r1, [r2]                ; a_0 = F(1) = 1
        li      r1, 3
        li      r2, FIBY
        sw      r1, [r2]                ; a_1 = F(4) = 3
        li      r17, 1
        li      r16, 1666               ; a_2 .. a_3333
.round: li      r1, FIBX
        li      r2, FIBY
        call    quadadd
        li      r1, FIBY
        li      r2, FIBX
        call    quadadd
        dbnz    r16, .round
        mov     r1, r17
        lw      r17, [sp]
        lw      r16, [sp + 4]
        lw      lr, [sp + 8]
        addi    sp, sp, 12
        ret

; quadadd: [r1] += 4 * [r2], where [r2] has r17 limbs and the result may
; have one more; updates r17. Leaf; uses r1-r15.
; 8 limbs a pass, 5 instructions a limb: load the source limb, load the
; destination limb, FSR (source limb times 4, with the top bits of the limb
; below), ADDC, store. Loads run a limb ahead, so nothing stalls.
;   source limbs r4-r11 (r11 also feeds limb 0 of the next pass)
;   destination limbs r12/r13 alternately, shifted source r14
quadadd:
        mov     r3, r1
        addi    r15, r17, 8
        srli    r15, r15, 3             ; passes of 8 limbs covering r17 + 1 limbs
        li      r11, 0                  ; the limb below limb 0
        adds    r0, r0, r0              ; C = 0
        lw      r4, [r2]
        lw      r12, [r1]
.q8:    lw      r5, [r2 + 4]
        fsr     r14, r4, r11, 30
        lw      r13, [r1 + 4]
        addc    r12, r12, r14
        sw      r12, [r1]
        lw      r6, [r2 + 8]
        fsr     r14, r5, r4, 30
        lw      r12, [r1 + 8]
        addc    r13, r13, r14
        sw      r13, [r1 + 4]
        lw      r7, [r2 + 12]
        fsr     r14, r6, r5, 30
        lw      r13, [r1 + 12]
        addc    r12, r12, r14
        sw      r12, [r1 + 8]
        lw      r8, [r2 + 16]
        fsr     r14, r7, r6, 30
        lw      r12, [r1 + 16]
        addc    r13, r13, r14
        sw      r13, [r1 + 12]
        lw      r9, [r2 + 20]
        fsr     r14, r8, r7, 30
        lw      r13, [r1 + 20]
        addc    r12, r12, r14
        sw      r12, [r1 + 16]
        lw      r10, [r2 + 24]
        fsr     r14, r9, r8, 30
        lw      r12, [r1 + 24]
        addc    r13, r13, r14
        sw      r13, [r1 + 20]
        lw      r11, [r2 + 28]
        fsr     r14, r10, r9, 30
        lw      r13, [r1 + 28]
        addc    r12, r12, r14
        sw      r12, [r1 + 24]
        lw      r4, [r2 + 32]           ; limb 0 of the next pass
        fsr     r14, r11, r10, 30
        lw      r12, [r1 + 32]
        addc    r13, r13, r14
        sw      r13, [r1 + 28]
        addi    r1, r1, 32
        addi    r2, r2, 32
        dbnz    r15, .q8
        slli    r15, r17, 2             ; did the sum grow a limb?
        add     r15, r15, r3
        lw      r15, [r15]
        beqz    r15, .same
        addi    r17, r17, 1
.same:  ret

; report: print "<label> has D digits", then the first and last 50 digits
; of the r2-limb number at r1 (destroyed). r3 = label.
;   r20 number of groups   r21 label   r22 buffer index   r23 digits left
report: addi    sp, sp, -20
        sw      lr, [sp + 16]
        sw      r20, [sp + 12]
        sw      r21, [sp + 8]
        sw      r22, [sp + 4]
        sw      r23, [sp]
        mov     r21, r3
        call    to_dec
        mov     r20, r1
        ; the top group, without its leading zeros
        slli    r1, r20, 2
        li      r2, GROUPS - 4
        add     r1, r1, r2
        lw      r1, [r1]
        call    render9
        li      r22, 0
.lz:    la      r1, digbuf
        add     r1, r1, r22
        lbu     r1, [r1]
        addi    r22, r22, 1
        li      r2, '0'
        beq     r1, r2, .lz
        addi    r22, r22, -1            ; r22 = leading zeros of the top group
        ; digit count = 9 * groups - leading zeros
        mov     r1, r21
        call    puts
        la      r1, msg_has
        call    puts
        slli    r1, r20, 3
        add     r1, r1, r20
        sub     r1, r1, r22
        call    print_udec
        la      r1, msg_digits
        call    puts
        ; first 50 digits: the top group from its first non-zero digit, then
        ; whole groups, stopping after 50
        la      r1, msg_first
        call    puts
        li      r23, 50
        mov     r1, r22
.f1:    call    put9from                ; groups in r20 counting down
        beqz    r23, .last
        addi    r20, r20, -1
        slli    r1, r20, 2
        li      r2, GROUPS - 4
        add     r1, r1, r2
        lw      r1, [r1]
        call    render9
        li      r1, 0
        j       .f1
        ; last 50 digits: the low 5 digits of group 5, then groups 4..0
.last:  call    newline
        la      r1, msg_last
        call    puts
        li      r23, 50
        li      r20, 5
.l1:    slli    r1, r20, 2
        li      r2, GROUPS
        add     r1, r1, r2
        lw      r1, [r1]
        call    render9
        li      r1, 0
        li      r2, 5
        bne     r20, r2, .l2
        li      r1, 4                   ; group 5: skip its top 4 digits
.l2:    call    put9from
        addi    r20, r20, -1
        bgez    r20, .l1
        call    newline
        lw      r23, [sp]
        lw      r22, [sp + 4]
        lw      r21, [sp + 8]
        lw      r20, [sp + 12]
        lw      lr, [sp + 16]
        addi    sp, sp, 20
        ret

; put9from: print digbuf[r1..8], but no more than r23 digits; r23 -= count.
put9from:
        la      r2, digbuf
        add     r2, r2, r1
        la      r3, digbuf + 9
.p:     beqz    r23, .done
        beq     r2, r3, .done
        lbu     r4, [r2]
        sb      r4, [CONSOLE]
        addi    r2, r2, 1
        addi    r23, r23, -1
        j       .p
.done:  ret

; render9: write r1 (< 10^9) to digbuf as 9 digits with leading zeros.
; Leaf; uses r1-r6.
render9:
        la      r2, digbuf + 9
        li      r3, 0xCCCCCCCD          ; x / 10 = (x * 0xCCCCCCCD) >> 35
        li      r4, 9
.d:     multu   r1, r3
        mfhi    r5
        srli    r5, r5, 3               ; q = x / 10
        slli    r6, r5, 2
        add     r6, r6, r5
        slli    r6, r6, 1               ; 10 q
        sub     r6, r1, r6
        addi    r6, r6, '0'
        addi    r2, r2, -1
        sb      r6, [r2]
        mov     r1, r5
        dbnz    r4, .d
        ret

; to_dec: convert the r2-limb number at r1 (destroyed) to base 10^9 at
; GROUPS, least significant first. Returns r1 = number of groups.
; Uses r1-r24.
;
; Each limb step is a chain of two multiplies (~2 x 18 cycles) plus a few
; ALU ops, and the next limb needs its remainder, so one pass can't keep the
; multiplier busy. Two passes run interleaved instead: pass A divides N
; (giving Q) while pass B divides Q, two limbs behind A so that the limbs
; of Q it needs are already there. B starts two (zero) limbs above the top
; and finishes the last two limbs on its own.
;   r1 pointer to A's limb (B's is 8 bytes up)   r2 limbs left in the pass
;   A: r3 remainder (u1)  r4 limb  r5 next limb  r6 u0  r7 q1  r8 q0
;      r10 mask  r13 u1 + 1          (r9 scratch)
;   B: r17 remainder  r18 limb  r19 next limb  r20 u0  r21 q1  r22 q0
;      r23 mask  r24 u1 + 1
;   r11 DIVN  r12 DIVV  r14 next group  r15 &top limb  r16 limb 0
to_dec: addi    sp, sp, -40
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
        mov     r16, r1
        li      r11, DIVN
        li      r12, DIVV
        li      r14, GROUPS
        slli    r15, r2, 2
        add     r15, r15, r1
        addi    r15, r15, -4            ; &top limb
.pass:  sub     r2, r15, r16
        srli    r2, r2, 2
        addi    r2, r2, 1               ; limbs
        mov     r1, r15
        lw      r4, [r1]
        srli    r3, r4, 30              ; u1: the 2 bits shifted out of the top
        slti    r9, r2, 2
        bnez    r9, .single

        ; two passes at once. B's state starts as a finished dummy step on
        ; a zero limb (its quotient lands on a zero limb above the number).
        li      r17, 0
        li      r18, 0
        li      r20, 0
        li      r21, 0
        li      r22, 0
        multu   r0, r0
.dl:    mflo    r9                      ; B: finish the step started last time
        multu   r12, r3                 ; A: v * u1
        sub     r17, r20, r9            ; B: r = u0 - q1 d
        sltu    r23, r22, r17
        lw      r5, [r1 - 4]            ; A: the limb below
        neg     r23, r23
        add     r21, r21, r23
        and     r23, r23, r11
        add     r17, r17, r23
        bgeu    r17, r11, .fixb
.fixedb:
        sw      r21, [r1 + 12]          ; B: quotient limb
        lw      r19, [r1 + 4]           ; B: the limb below, from A last time
        fsr     r6, r4, r5, 30          ; A: u0
        addi    r13, r3, 1
        fsr     r20, r18, r19, 30       ; B: u0
        addi    r24, r17, 1
        mov     r18, r19
        mfhi    r7
        mflo    r8
        multu   r12, r17                ; B: v * u1
        adds    r8, r8, r6              ; A: (q1, q0) = v u1 + (u1 + 1, u0)
        addc    r7, r7, r13
        mov     r4, r5
        mfhi    r21
        mflo    r22
        multu   r7, r11                 ; A: q1 * d
        adds    r22, r22, r20           ; B: (q1, q0)
        addc    r21, r21, r24
        mflo    r9
        multu   r21, r11                ; B: q1 * d
        sub     r3, r6, r9              ; A: r = u0 - q1 d
        sltu    r10, r8, r3             ; r > q0: q1 was one too big
        addi    r1, r1, -4
        neg     r10, r10
        add     r7, r7, r10
        and     r10, r10, r11
        add     r3, r3, r10
        bgeu    r3, r11, .fixa          ; r >= d: q1 one too small (rare)
.fixeda:
        sw      r7, [r1 + 4]            ; A: quotient limb
        dbnz    r2, .dl
        mflo    r9                      ; B: finish its last interleaved step
        sub     r17, r20, r9
        sltu    r23, r22, r17
        nop
        neg     r23, r23
        add     r21, r21, r23
        and     r23, r23, r11
        add     r17, r17, r23
        bgeu    r17, r11, .fixb2
.fixedb2:
        sw      r21, [r1 + 12]
        srli    r3, r3, 2               ; A's remainder: the next 9 digits
        sw      r3, [r14]
        addi    r1, r1, 8               ; B: limbs 1 and 0 on its own
        li      r2, 2
        mov     r3, r17
        mov     r4, r18
        call    div_run
        srli    r3, r3, 2               ; B's remainder: the 9 after those
        sw      r3, [r14 + 4]
        addi    r14, r14, 8
        j       .shrink

.single:
        call    div_run
        srli    r3, r3, 2
        sw      r3, [r14]
        addi    r14, r14, 4
.shrink:
        lw      r9, [r15]               ; drop top limbs that became zero
        bnez    r9, .pass
        addi    r15, r15, -4
        bgeu    r15, r16, .shrink       ; until no limbs are left
        li      r1, GROUPS
        sub     r1, r14, r1
        srli    r1, r1, 2
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
.fixa:  sub     r3, r3, r11
        addi    r7, r7, 1
        j       .fixeda
.fixb:  sub     r17, r17, r11
        addi    r21, r21, 1
        j       .fixedb
.fixb2: sub     r17, r17, r11
        addi    r21, r21, 1
        j       .fixedb2

; div_run: divide r2 limbs by 10^9, from the limb at r1 down, in place.
; In: r3 = remainder so far (u1), r4 = the limb at r1. Out: r3 = 4 times
; the remainder. One limb at a time; uses r1-r10, r13.
div_run:
.limb:  lw      r5, [r1 - 4]            ; the limb below (a zero below limb 0)
        multu   r12, r3                 ; v * u1
        fsr     r6, r4, r5, 30          ; u0: this limb shifted left 2
        addi    r13, r3, 1
        mfhi    r7
        mflo    r8
        adds    r8, r8, r6              ; (q1, q0) = v u1 + (u1 + 1, u0)
        addc    r7, r7, r13
        multu   r7, r11
        mov     r4, r5
        mflo    r9
        sub     r3, r6, r9              ; r = u0 - q1 d (mod 2^32)
        sltu    r10, r8, r3             ; r > q0: q1 was one too big
        nop
        neg     r10, r10
        add     r7, r7, r10
        and     r10, r10, r11
        add     r3, r3, r10
        bgeu    r3, r11, .fix           ; r >= d: q1 one too small (rare)
.fixed: sw      r7, [r1]
        addi    r1, r1, -4
        dbnz    r2, .limb
        ret
.fix:   sub     r3, r3, r11
        addi    r7, r7, 1
        j       .fixed

        .data
lab_fact:
        .asciz  "1000!"
lab_fib:
        .asciz  "F(10000)"
msg_has:
        .asciz  " has "
msg_digits:
        .asciz  " digits\n"
msg_first:
        .asciz  "first 50: "
msg_last:
        .asciz  "last 50:  "
digbuf: .space  12
