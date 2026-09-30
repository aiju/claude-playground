//MANDEL   JOB 1,MANDELBROT,CLASS=A,MSGCLASS=A,MSGLEVEL=(1,1),
//             REGION=256K
//*
//* THE MANDELBROT SET ON THE LINE PRINTER.  ASSEMBLER F ASSEMBLES
//* THE PROGRAM, THE LINKAGE EDITOR LINKS IT AND THE GO STEP RUNS IT.
//*
//MANDEL   EXEC ASMFCLG
//*
//* THE PROCEDURE WANTS ITS WORK FILES ON SEPARATE CHANNELS AND DRIVES,
//* BUT THIS SYSTEM HAS ONLY TWO PUBLIC WORK PACKS, BOTH ON CHANNEL 1.
//*
//ASM.SYSUT1 DD SEP=
//ASM.SYSUT3 DD UNIT=SYSSQ
//ASM.SYSPUNCH DD DUMMY
//ASM.SYSIN DD *
         TITLE 'MANDEL - THE MANDELBROT SET IN HEX FLOATING POINT'
***********************************************************************
*                                                                     *
*  MANDEL PRINTS THE MANDELBROT SET ON THE LINE PRINTER.  IT USES     *
*  ONLY THE SYSTEM/360 INSTRUCTION SET, AND DOES ITS ARITHMETIC IN    *
*  LONG (64-BIT) HEXADECIMAL FLOATING POINT.                          *
*                                                                     *
*  EACH PRINT POSITION STANDS FOR A POINT C OF THE COMPLEX PLANE.     *
*  STARTING FROM Z = 0, THE PROGRAM SETS Z = Z*Z + C OVER AND OVER    *
*  UNTIL ABS(Z) > 2 OR IT HAS DONE IT 64 TIMES, AND PRINTS A          *
*  CHARACTER THAT SHOWS HOW MANY TIMES IT TOOK.  POINTS THAT ARE      *
*  STILL IN AFTER 64 TIMES ARE IN THE SET, AND ARE PRINTED AS @.      *
*                                                                     *
*  THE 1403 PRINTS 10 CHARACTERS TO THE INCH ACROSS AND 6 LINES TO    *
*  THE INCH DOWN, SO A STEP DOWN IS 10/6 OF A STEP ACROSS.            *
*                                                                     *
***********************************************************************
         SPACE 2
COLS     EQU   120                 PRINT POSITIONS ACROSS
ROWS     EQU   57                  LINES DOWN
MIDROW   EQU   28                  THE LINE WITH Y = 0
MARGIN   EQU   6                   BLANK POSITIONS ON THE LEFT
MAXITER  EQU   64                  ITERATIONS BEFORE WE GIVE UP
         SPACE 2
R0       EQU   0
R1       EQU   1
R2       EQU   2                   LINE NUMBER
R3       EQU   3                   COLUMN NUMBER
R4       EQU   4                   ITERATIONS LEFT
R5       EQU   5                   NEXT PRINT POSITION
R6       EQU   6
R12      EQU   12                  BASE REGISTER
R13      EQU   13
R14      EQU   14
R15      EQU   15
F0       EQU   0                   THE S/360 HAS FOUR FLOATING POINT
F2       EQU   2                   REGISTERS, 0, 2, 4 AND 6
F4       EQU   4
F6       EQU   6
         EJECT
MANDEL   CSECT
         SAVE  (14,12)
         BALR  R12,0
         USING *,R12
         ST    R13,SAVEAREA+4
         LA    R13,SAVEAREA
         OPEN  (PRINTER,OUTPUT)
*
*        THE HEADING, WITH THE DATE AND THE TIME OF DAY
*
         TIME  DEC                 R0 = HHMMSSTH, R1 = 00YYDDDF
         ST    R1,WORK
         UNPK  DIGITS(5),WORK+1(3) YYDDD
         MVC   HDATE(2),DIGITS
         MVC   HDATE+3(3),DIGITS+2
         ST    R0,WORK
         UNPK  DIGITS(7),WORK(4)   HHMMSS, AND A TENTH WE IGNORE
         MVC   HTIME(2),DIGITS
         MVC   HTIME+3(2),DIGITS+2
         MVC   HTIME+6(2),DIGITS+4
         PUT   PRINTER,HEADING
*
*        THE PICTURE, ONE LINE AT A TIME
*
         LA    R1,MIDROW
         BAL   R14,FLOAT
         MD    F0,DY
         STD   F0,YTOP             Y OF THE TOP LINE
         SR    R2,R2
ROWLOOP  LR    R1,R2
         BAL   R14,FLOAT
         MD    F0,DY
         LD    F2,YTOP
         SDR   F2,F0
         STD   F2,CIMAG            Y = YTOP - LINE * DY
         MVI   LINE,C' '           BLANK THE LINE: SINGLE SPACE, AND
         MVC   LINE+1(L'LINE-1),LINE  LET MVC SPREAD THE BLANK ALONG
         LTR   R2,R2
         BNZ   FIRSTCOL
         MVI   LINE,C'0'           DOUBLE SPACE BEFORE THE FIRST LINE
FIRSTCOL LA    R5,LINE+1+MARGIN
         SR    R3,R3
COLLOOP  LR    R1,R3
         BAL   R14,FLOAT
         MD    F0,DX
         AD    F0,XLEFT
         STD   F0,CREAL            X = XLEFT + COLUMN * DX
         SDR   F0,F0               F0 = REAL PART OF Z
         SDR   F2,F2               F2 = IMAGINARY PART OF Z
         LA    R4,MAXITER
ITERATE  LDR   F4,F0
         MDR   F4,F0               F4 = ZR*ZR
         LDR   F6,F2
         MDR   F6,F2               F6 = ZI*ZI
         STD   F6,ZISQ
         ADR   F6,F4               F6 = ZR*ZR + ZI*ZI
         CD    F6,FOUR
         BH    ESCAPED             ABS(Z) > 2: IT GOES OFF TO INFINITY
         MDR   F2,F0
         ADR   F2,F2
         AD    F2,CIMAG            ZI = 2*ZR*ZI + Y
         SD    F4,ZISQ
         AD    F4,CREAL
         LDR   F0,F4               ZR = ZR*ZR - ZI*ZI + X
         BCT   R4,ITERATE
ESCAPED  LA    R6,MAXITER
         SR    R6,R4               ITERATIONS DONE, UP TO MAXITER
         IC    R6,SHADES(R6)
         STC   R6,0(,R5)
         LA    R5,1(,R5)
         LA    R3,1(,R3)
         C     R3,=A(COLS)
         BL    COLLOOP
         PUT   PRINTER,LINE
         LA    R2,1(,R2)
         C     R2,=A(ROWS)
         BL    ROWLOOP
*
*        THE FOOTING, AND HOME
*
         PUT   PRINTER,FOOTING
         CLOSE (PRINTER)
         L     R13,SAVEAREA+4
         RETURN (14,12),RC=0
         EJECT
***********************************************************************
*                                                                     *
*  FLOAT SETS F0 TO THE INTEGER IN R1, WHICH MUST NOT BE NEGATIVE.    *
*  THERE IS NO INSTRUCTION FOR THIS.  INSTEAD WE PUT THE INTEGER IN   *
*  THE LOW WORD OF A LONG FLOATING POINT NUMBER WHOSE EXPONENT IS     *
*  16**14, WHICH MAKES THE 14 HEX DIGITS OF THE FRACTION AN INTEGER,  *
*  AND ADD IT TO ZERO, WHICH NORMALIZES IT.  RETURNS VIA R14.         *
*                                                                     *
***********************************************************************
FLOAT    ST    R1,FLOATW+4
         SDR   F0,F0
         AD    F0,FLOATW
         BR    R14
         EJECT
*
*        CONSTANTS AND WORK AREAS
*
SAVEAREA DC    18F'0'
FLOATW   DC    X'4E000000',F'0'    EXPONENT 16**14, FRACTION 0
FOUR     DC    D'4'
DX       DC    D'0.025'            3 UNITS ACROSS IN 120 COLUMNS
DY       DC    D'0.04166666666666667'   DX * 10/6
XLEFT    DC    D'-2.2375'          -2.25, PLUS HALF A COLUMN
YTOP     DS    D
CREAL    DS    D
CIMAG    DS    D
ZISQ     DS    D
WORK     DS    F
DIGITS   DS    CL7
*
*        THE CHARACTER TO PRINT FOR EACH NUMBER OF ITERATIONS
*
SHADES   DC    CL4' '              0-3
         DC    C'.,:'              4, 5, 6
         DC    C';;'               7-8
         DC    C'--'               9-10
         DC    C'==='              11-13
         DC    4C'+'               14-17
         DC    6C'*'               18-23
         DC    9C'X'               24-32
         DC    12C'%'              33-44
         DC    19C'#'              45-63
         DC    C'@'                64: IN THE SET
*
*        PRINT LINES: A CARRIAGE CONTROL CHARACTER AND 132 POSITIONS
*
HEADING  DC    C'1',CL6' '         SKIP TO A NEW PAGE
         DC    C'THE MANDELBROT SET, COMPUTED IN SYSTEM/360 '
         DC    CL37'HEXADECIMAL FLOATING POINT'
         DC    C'DATE '
HDATE    DC    C'YY.DDD'
         DC    C'   TIME '
HTIME    DC    C'HH.MM.SS'
         DC    CL19' '
FOOTING  DC    C'0',CL6' '         DOUBLE SPACE
         DC    C'X FROM -2.25 TO 0.75, Y FROM -1.17 TO 1.17.  '
         DC    C'@ MEANS STILL BOUNDED AFTER 64 ITERATIONS.'
         DC    CL39' '
LINE     DS    CL133
*
PRINTER  DCB   DDNAME=SYSPRINT,DSORG=PS,MACRF=PM,RECFM=FBA,LRECL=133,  X
               BLKSIZE=133
         LTORG
         END   MANDEL
/*
//LKED.SYSUT1 DD UNIT=SYSDA
//GO.SYSPRINT DD SYSOUT=A
//
