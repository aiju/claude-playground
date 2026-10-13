; exercise: every instruction and every forwarding/stall path of the draft 0
; pipeline, checked by comparing the netlist against the ISA simulator
; (registers, memory, output and the cycle of every write-back).
        .text
        li      sp, 0x200000
        ; ---- ALU, both immediates, forwarding EX->EX and MEM->EX
        li      r1, 0x12345678
        li      r2, -77
        add     r3, r1, r2          ; EX/MEM forward of r2? (r2 two back)
        sub     r4, r3, r1          ; EX/MEM forward of r3
        and     r5, r4, r3
        or      r6, r5, r1
        xor     r7, r6, r4
        nor     r8, r7, r2
        andn    r9, r8, r1
        orn     r10, r9, r2
        xnor    r11, r10, r3
        slt     r12, r2, r1         ; late result
        sltu    r13, r2, r1
        add     r14, r12, r13       ; uses an SLT result right away: 1 bubble
        slti    r15, r2, -76
        sltiu   r16, r1, 5
        addi    r17, r1, -1000
        andi    r18, r1, 0xF0F0
        ori     r19, r2, 0x8000
        xori    r20, r19, 0xFFFF
        lui     r21, 0xBEEF
        add     r21, r21, r21
        ; ---- carry chain
        li      r1, 0xFFFFFFFF
        li      r2, 1
        adds    r22, r1, r2
        addc    r23, r0, r0
        subs    r24, r0, r2
        subc    r25, r0, r0
        ; ---- shifts
        li      r1, 0x80000011
        li      r2, 7
        sll     r3, r1, r2
        srl     r4, r1, r2
        sra     r5, r1, r2
        ror     r6, r1, r2
        slli    r7, r1, 0
        slli    r8, r1, 31
        srli    r9, r1, 31
        srai    r10, r1, 13
        rori    r11, r1, 31
        fsr     r12, r1, r3, 9
        sll     r13, r12, r1        ; amount from a just-computed register
        ; ---- multiply/divide
        li      r1, -123456
        li      r2, 789012
        mult    r1, r2
        add     r26, r1, r2          ; independent work in the shadow
        mfhi    r14
        mflo    r15
        multu   r1, r2
        mfhl    r16, 7
        madd    r1, r2
        mfhi    r17
        maddu   r2, r2
        mflo    r18
        div     r1, r2
        mflo    r19
        mfhi    r20
        divu    r1, r2
        mflo    r21
        mthi    r1
        mtlo    r2
        mfhi    r22
        mflo    r23
        divu    r1, r0              ; divide by zero
        mfhi    r24
        mflo    r25
        ; ---- memory: sizes, sign extension, load-use, store-data forwarding
        la      r1, buf
        li      r2, 0x80FF7F01
        sw      r2, [r1]
        lw      r3, [r1]
        add     r4, r3, r3          ; load-use: 1 bubble
        lb      r5, [r1 + 1]
        lbu     r6, [r1 + 1]
        lb      r7, [r1 + 3]
        lh      r8, [r1 + 2]
        lhu     r9, [r1 + 2]
        lh      r10, [r1]
        sb      r2, [r1 + 5]
        sh      r2, [r1 + 10]
        lw      r11, [r1]
        sw      r11, [r1 + 12]       ; store data straight from a load (MEM forward)
        lbu     r12, [r1 + 3]
        sb      r12, [r1 + 16]       ; byte store data from a load
        lhu     r12, [r1 + 2]
        sh      r12, [r1 + 18]
        li      r13, 4
        lwx     r14, [r1 + r13]
        lbx     r15, [r1 + r13]
        lbux    r16, [r1 + r13]
        lhx     r17, [r1 + r13]
        lhux    r18, [r1 + r13]
        lw      r19, [r1 + 12]
        lw      r20, [r1 + 16]
        addi    r21, r1, 4
        lw      r22, [r21]           ; base from the previous instruction
        lw      r23, [r1]
        lw      r24, [r21 + 8]
        ; ---- branches: every condition, taken and not, both directions
        li      r1, -5
        li      r2, 3
        li      r30, 0
        beq     r1, r1, .b1
        ori     r30, r30, 1
.b1:    bne     r1, r1, .b2
        ori     r30, r30, 2
.b2:    blt     r1, r2, .b3
        ori     r30, r30, 4
.b3:    bge     r1, r2, .b4
        ori     r30, r30, 8
.b4:    bltu    r1, r2, .b5
        ori     r30, r30, 16
.b5:    bgeu    r1, r2, .b6
        ori     r30, r30, 32
.b6:    li      r3, 10
        li      r4, 0
.loop:  addi    r4, r4, 3
        lw      r5, [r0 + buf]
        bne     r5, r0, .ok          ; load then branch: early redirect while stalled
        nop
.ok:    dbnz    r3, .loop            ; backward, taken 9 times
        li      r5, 4
.back:  addi    r5, r5, -1
        bgtz    r5, .back
        ; ---- calls
        jal     sub1
        la      r6, sub2
        callr   r6
        j       .fwd
        li      r7, 999
.fwd:   li      r8, 1
        ; console output through the bus
        li      r1, 'O'
        sb      r1, [0xFFFFFF00]
        li      r1, 'K'
        sb      r1, [0xFFFFFF00]
        lw      r9, [0xFFFFFF00]    ; console input (none: all ones)
        add     r10, r9, r9
        li      r1, '\n'
        sb      r1, [0xFFFFFF00]
        halt

sub1:   addi    r29, r29, 1
        ret
sub2:   addi    r29, r29, 2
        lw      r28, [r0 + buf]
        jr      lr

        .data
buf:    .space  32
