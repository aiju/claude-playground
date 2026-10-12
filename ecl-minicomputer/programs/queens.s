; queens: count the N-queens solutions for N = 1..11 by bitmask backtracking.
;
; The board state is three bit sets: columns in use (c), squares attacked
; along left-going diagonals (l) and along right-going diagonals (r). A row's
; candidates are mask & ~(c | l | r). Placing a queen b moves to the next
; row with c |= b, l = (l | b) << 1, r = (r | b) >> 1.
;
; The search is iterative with a small stack holding, per row, the
; candidates still to try and the row's c, l, r. (Rebuilding them from the
; child's state would save stores, but r loses a bit off the bottom at each
; level and the losses add up as the search climbs back.) A candidate whose
; next row would be empty is rejected before anything is pushed, and the
; row before the last doesn't descend: for each queen there it only tests
; whether the last row still has a free square.
;
; Mirror symmetry halves the work: only first-row queens in the left half
; are searched and counted twice, plus the middle column once for odd N.

        .include "lib/start.s"
        .include "lib/print.s"

main:   addi    sp, sp, -16
        sw      lr, [sp + 12]
        sw      r16, [sp + 8]
        sw      r17, [sp + 4]
        sw      r18, [sp]
        li      r16, 1                  ; r16 = N
.nloop: li      r17, 1                  ; N = 1: one solution, nothing to search
        li      r1, 1
        beq     r16, r1, .print
        srli    r18, r16, 1             ; r18 = N / 2
        li      r1, 1
        sll     r1, r1, r18
        addi    r1, r1, -1              ; first-row queens in columns 0 .. N/2-1
        mov     r2, r16
        call    solve
        add     r17, r1, r1             ; counted twice (mirror images)
        andi    r1, r16, 1
        beqz    r1, .print
        li      r1, 1
        sll     r1, r1, r18             ; odd N: the middle column, once
        mov     r2, r16
        call    solve
        add     r17, r17, r1
.print: la      r1, msg_n
        call    puts
        mov     r1, r16
        call    print_udec
        la      r1, msg_colon
        call    puts
        mov     r1, r17
        call    print_udec
        call    newline
        addi    r16, r16, 1
        slti    r1, r16, 12
        bnez    r1, .nloop
        lw      r18, [sp]
        lw      r17, [sp + 4]
        lw      r16, [sp + 8]
        lw      lr, [sp + 12]
        addi    sp, sp, 16
        ret

; solve: count the solutions whose first-row queen is one of the bits of r1.
; In: r1 = first-row candidates, r2 = N (2 or more). Out: r1 = count.
; Leaf; uses r1-r15.
;
; Rows alternate between two register sets, so moving to the child row
; needs no copying: a row in set A has its child in set B and the other
; way round.
;   set A: r1 candidates left   r2 c    r3 l    r4 r
;   set B: r15 candidates left  r6 c    r7 l    r8 r
;   r5 queen b   r9 mask   r10 stack pointer   r11 stack bottom (sentinel)
;   r12 row N-2   r13 count   r14 current row
; A stack entry is 20 bytes: candidates left, c, l, r, row. A row is pushed
; only if it still has candidates when we descend from it, so every entry
; popped has work to do. Pops always reload into set A.
solve:  li      r9, 1
        sll     r9, r9, r2
        addi    r9, r9, -1              ; mask = (1 << N) - 1
        la      r11, qstack             ; qstack[0] is the sentinel
        addi    r10, r11, 20
        addi    r12, r2, -2
        li      r13, 0
        li      r14, 0
        li      r2, 0
        li      r3, 0
        li      r4, 0
        beqz    r1, .done
        beq     r14, r12, .leafA        ; N = 2: row 0 is already the row before the last

        ; set A: try its lowest candidate b, child row into set B
.descA: neg     r5, r1
        and     r5, r1, r5              ; b
        xor     r1, r1, r5              ; the rest
        or      r6, r2, r5              ; child c
        or      r7, r3, r5
        slli    r7, r7, 1               ; child l
        or      r8, r4, r5
        srli    r8, r8, 1               ; child r
        or      r15, r6, r7
        or      r15, r15, r8
        andn    r15, r9, r15            ; child candidates
        beqz    r15, .deadA             ; no square in the next row: next b
        beqz    r1, .lastA              ; b was the row's last candidate: don't come back
        sw      r1, [r10]
        sw      r2, [r10 + 4]
        sw      r3, [r10 + 8]
        sw      r4, [r10 + 12]
        sw      r14, [r10 + 16]
        addi    r10, r10, 20
.lastA: addi    r14, r14, 1
        beq     r14, r12, .leafB

        ; set B: the same with the sets swapped
.descB: neg     r5, r15
        and     r5, r15, r5
        xor     r15, r15, r5
        or      r2, r6, r5
        or      r3, r7, r5
        slli    r3, r3, 1
        or      r4, r8, r5
        srli    r4, r4, 1
        or      r1, r2, r3
        or      r1, r1, r4
        andn    r1, r9, r1
        beqz    r1, .deadB
        beqz    r15, .lastB
        sw      r15, [r10]
        sw      r6, [r10 + 4]
        sw      r7, [r10 + 8]
        sw      r8, [r10 + 12]
        sw      r14, [r10 + 16]
        addi    r10, r10, 20
.lastB: addi    r14, r14, 1
        bne     r14, r12, .descA

        ; row N-2: count the queens here that leave the last row a square
.leafA: slli    r6, r3, 1
        srli    r7, r4, 1
        or      r6, r6, r7
        or      r6, r6, r2
        andn    r6, r9, r6              ; last-row squares free of the existing queens
        j       .lloop
.leafB: mov     r1, r15
        slli    r2, r7, 1
        srli    r3, r8, 1
        or      r2, r2, r3
        or      r2, r2, r6
        andn    r6, r9, r2
.lloop: neg     r7, r1
        and     r5, r1, r7              ; b
        slli    r7, r5, 1
        srli    r8, r5, 1
        or      r7, r7, r8
        or      r7, r7, r5              ; last-row squares b attacks
        andn    r7, r6, r7
        sltu    r7, r0, r7              ; 1 if one is left
        xor     r1, r1, r5              ; (SLT results come late: fill the gap)
        add     r13, r13, r7
        bnez    r1, .lloop
        j       .up

.deadB: bnez    r15, .descB
        j       .up
.deadA: bnez    r1, .descA
        ; backtrack: pop the nearest row with candidates left, into set A
.up:    addi    r10, r10, -20
        lw      r1, [r10]
        lw      r2, [r10 + 4]
        lw      r3, [r10 + 8]
        lw      r4, [r10 + 12]
        lw      r14, [r10 + 16]
        bne     r10, r11, .descA        ; stop at the sentinel
.done:  mov     r1, r13
        ret

        .data
msg_n:  .asciz  "N="
msg_colon: .asciz ": "
        .align  4
qstack: .space  20 * 16
