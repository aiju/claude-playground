; console output through the I/O page
CONSOLE = 0xFFFFFF00

; putc: write the byte in r1
putc:   sb      r1, [CONSOLE]
        ret

; puts: write the NUL-terminated string at r1
puts:   lbu     r2, [r1]
        beqz    r2, .done
.loop:  sb      r2, [CONSOLE]
        addi    r1, r1, 1
        lbu     r2, [r1]
        bnez    r2, .loop
.done:  ret
