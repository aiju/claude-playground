"""Chip-level netlist of the draft 0 CPU: a 5-stage pipeline (IF ID EX MEM
WB) in MC10H ECL, a 10E422 register file and CMOS SRAM local memories.
See docs/hardware-v0.md.

Net naming: pc = the PC register (word address, PC[31:2]); ir, irn, f_* =
IF/ID; x_* = ID/EX; m_* = EX/MEM; w_* = MEM/WB; e* = execute-stage nets.
A trailing _n is a complement. Externally driven (testbench) nets are in
EXTERNAL; the strobes RFWS_N and MWS_N are active low.
"""

from .blocks import Builder, bus
from .netlist import Netlist

EXTERNAL = ["CLK", "RESET", "RFSEL", "RFWS_N", "MWS_N", "BUSDONE"] + bus("BUSRD", 32)
RF_PART = "10E422-7"


def build(rf_part=RF_PART, ff=None, hold_fix=True):
    """ff: flip-flop timing for the hold fix, as in sta.Timing (None: the
    10H176's)."""
    nl = Netlist()
    b = Builder(nl)
    B = bus
    inv, or_, nor, and_ = b.inv, b.or_, b.nor, b.and_

    # ------------------------------------------------------------------
    # Clock domains. hold_p freezes the whole pipeline (bus wait, halted, or
    # an exception in MEM, which keeps its cause there); hold_f also holds
    # IF/ID during an interlock stall. The multiply unit runs on.
    STALL, FREEZE, HALTED = "stall", "freeze", "halted"
    b.block("clock")
    or_([FREEZE, HALTED, "m_exc"], out="hold_p")
    or_([FREEZE, HALTED, "m_exc", STALL], out="hold_f")
    or_([FREEZE, HALTED, "m_exc", "pc_stall"], out="hold_pc")
    b.clock_domain("p", "hold_p")
    b.clock_domain("f", "hold_f")
    b.clock_domain("pc", "hold_pc")
    b.clock_domain("u", "0")

    # ------------------------------------------------------------------
    # IF: PC, next PC, instruction memory
    b.block("fetch")
    pc, npc, pc4 = B("pc", 30), B("npc", 30), B("pc4", 30)
    b.reg(npc, pc, "pc")
    b.adder(pc + ["0", "0"], ["0"] * 32, ["0", "0", "0", "0"], "0", "1",
            pc4 + [None, None], prefix="inc")              # S=0000 M=0: F = A plus Cn
    tgt, red_q = B("tgt", 30), B("red_q", 30)
    # next PC: 0 sequential, 1 ID target, 2 EX redirect (registered); reset gives 0.
    # A stall holds the PC by gating its clock (pc_stall), except when a
    # redirect is due.
    b.mux4("npc_a", "npc_b", [pc4, tgt, red_q, "0"], npc, en="RESET")
    ia = B("ia_ttl", 19)
    for c in range(0, 19, 4):
        nl.add("10H125", **{f"D{k}": pc[c + k] for k in range(4) if c + k < 19},
               **{f"Q{k}": ia[c + k] for k in range(4) if c + k < 19})
    iq = B("iq_ttl", 32)
    for lane in range(4):
        nl.add("SRAM512Kx8", ref=f"IMEM{lane}", block="imem", CE="0", OE="0", WE="1",
               **{f"A{i}": ia[i] for i in range(19)}, **{f"Q{i}": iq[8 * lane + i] for i in range(8)})
    ifd, ifdn = B("ifd", 32), B("ifdn", 32)
    nbits = list(range(0, 6)) + [15] + list(range(26, 32))   # complements wanted: fn, op, offset sign
    for c in range(0, 32, 4):
        nl.add("10H124", **{f"D{k}": iq[c + k] for k in range(4)}, **{f"Q{k}": ifd[c + k] for k in range(4)},
               **{f"QN{k}": ifdn[c + k] for k in range(4) if c + k in nbits})
    ir, f_pc4 = B("ir", 32), B("f_pc4", 30)
    b.reg(ifd, ir, "f")
    b.reg(pc4, f_pc4, "f")
    irn = {k: f"irn[{k}]" for k in nbits}
    b.reg([ifdn[k] for k in nbits], [irn[k] for k in nbits], "f")
    for k in nbits:
        b.pair(ir[k], irn[k])

    # ------------------------------------------------------------------
    # ID: decode with 3-to-8 decoders whose active-low enables pick the
    # opcode group, so every instruction line is two gate levels deep.
    b.block("decode")
    op, opn = ir[26:32], [irn[26 + i] for i in range(6)]
    fn, fnn = ir[0:6], [irn[i] for i in range(6)]
    s_f, t_f, d_f = ir[21:26], ir[16:21], ir[11:16]
    o3 = op[0:3]
    e_r = or_([op[5], op[4], op[3]], out="e_r")           # low for op 000xxx
    e_i = or_([op[5], op[4], opn[3]], out="e_i")
    e_b = or_([op[5], opn[4], op[3]], out="e_b")
    e_j = or_([op[5], opn[4], opn[3]], out="e_j")
    e_l = or_([opn[5], op[4], op[3]], out="e_l")
    e_s = or_([opn[5], op[4], opn[3]], out="e_s")
    R = b.decoder(o3, e_r, "0", [None, "dR1", "dR2", "dR3", "dR4", "dR5", None, None])
    I = b.decoder(o3, e_i, "0", ["dI0", None, "dI2", "dI3", "dI4", "dI5", "dI6", "dI7"])
    Bd = b.decoder(o3, e_b, "0", ["dB0", "dB1", "dB2", "dB3", "dB4", "dB5", None, "dB7"])
    J = b.decoder(o3, e_j, "0", ["dJ0", "dJ1"] + [None] * 6)
    L = b.decoder(o3, e_l, "0", ["dL0", "dL1", "dL2", None, "dL4", "dL5", None, None])
    S = b.decoder(o3, e_s, "0", ["dS0", "dS1", "dS2"] + [None] * 5)
    f3 = fn[0:3]
    e_alu = or_([op[5], op[4], op[3], op[2], op[1]], out="e_alu")       # op 00000x
    e_sh = or_([op[5], op[4], op[3], op[2], op[0]], out="e_sh")         # op 0000x0
    e_md = or_([op[5], op[4], op[3], op[2]], out="e_md")                # op 0000xx
    e_lx = or_([op[5], op[4], op[3], op[1], op[0]], out="e_lx")         # op 000x00
    e_sy = or_([op[5], op[4], op[3], op[1]], out="e_sy")                # op 000x0x
    K = b.decoder(f3, e_alu, or_([opn[0], fn[3], fn[4], fn[5]]), [f"dK{i}" for i in range(8)])
    K += b.decoder(f3, e_alu, or_([opn[0], fnn[3], fn[4], fn[5]]), [f"dK{8 + i}" for i in range(7)] + [None])
    H = b.decoder(f3, e_sh, or_([opn[1], fn[3], fn[4], fn[5]]), [f"dH{i}" for i in range(8)])
    fsr = b.decoder(f3, e_sh, or_([opn[1], fnn[3], fn[4], fn[5]]), ["dFSR"] + [None] * 7)[0]
    M = b.decoder(f3, e_md, or_([opn[1], opn[0], fn[3], fn[4], fn[5]]), [f"dM{i}" for i in range(6)] + [None] * 2)
    M8 = b.decoder(f3, e_md, or_([opn[1], opn[0], fnn[3], fn[4], fn[5]]),
                   ["dMFHI", "dMFLO", "dMTHI", "dMTLO", "dMFHL", None, None, None])
    X = b.decoder(f3, e_lx, or_([opn[2], fn[3], fn[4], fn[5]]), ["dX0", "dX1", "dX2", None, "dX4", "dX5", None, None])
    Y = b.decoder(f3, e_sy, or_([opn[2], opn[0], fn[3], fn[4], fn[5]]), ["dJALR", "dHALT"] + [None] * 6)
    mfhi, mflo, mthi, mtlo, mfhl = M8[0:5]
    jalr, halt = Y[0], Y[1]
    jj, jal = J[0], J[1]
    lui, dbnz = I[7], Bd[7]
    # classes (each one OR level; the OR's NOR output is its complement)
    ialu = or_([I[0], I[2], I[3], I[4], I[5], I[6]], out="d_ialu")
    br = or_(Bd[0:6], out="d_br")
    ldm = or_([L[0], L[1], L[2], L[4], L[5]], out="d_ld")
    stm = or_([S[0], S[1], S[2]], out="d_st")
    ldx = or_([X[0], X[1], X[2], X[4], X[5]], out="d_ldx")
    alu_r = or_(K[0:15], out="d_alur")
    sh_reg = or_(H[0:4], out="d_shreg")
    sh_imm = or_(H[4:8], out="d_shimm")
    mstart = or_(M[0:6], out="d_mstart")
    shift_any = or_([sh_reg, sh_imm, fsr], out="d_shift")
    known = or_([alu_r, shift_any, mstart, mfhi, mflo, mthi, mtlo, mfhl, ldx, jalr, halt,
                 ialu, lui, br, dbnz, jj, jal, ldm, stm], out="d_known")
    illegal = inv(known)

    # ALU function from the decoded lines (see emc/hw/chips.py for the codes)
    memop = or_([op[5], R[4]], out="d_memop")            # loads, stores, indexed loads
    fb = or_([lui, jal, jalr], out="d_fb")               # F = B (immediate or link)
    addk = or_([K[0], K[8], K[10], I[0], memop], out="d_addk")
    subk = or_([K[1], K[2], K[3], K[9], K[11], I[2], I[3], br], out="d_subk")
    k_and, k_or, k_xor = or_([K[4], I[4]]), or_([K[5], I[5]]), or_([K[6], I[6]])
    zero = nor([alu_r, ialu, memop, br, fb, dbnz], out="d_zero")
    d_s0 = or_([subk, k_or, k_xor, K[12], K[13], dbnz])
    d_s1 = or_([addk, k_and, k_or, K[13], K[14], fb, dbnz])
    d_s2 = or_([addk, k_and, K[7], K[12], K[13], K[14], dbnz, zero])
    d_s3 = or_([subk, k_and, k_or, k_xor, K[12], fb, dbnz, zero])
    d_m = or_([k_and, k_or, k_xor, K[7], K[12], K[13], K[14], fb, zero])
    d_cin1 = or_([K[1], K[2], K[3], K[9], I[2], I[3]])
    d_cinc = or_([K[10], K[11]])
    d_cwr = or_([K[8], K[9], K[10], K[11]])
    slt = or_([K[2], K[3], I[2], I[3]], out="d_slt")
    late = or_([slt, ldm, ldx], out="d_late")
    # comparison sign: BLT/BGE (op 0x12/0x13), SLT, SLTI
    d_sgn = or_([Bd[2], Bd[3], K[2], I[2]])
    # shifter: hi 0 A, 1 A>>1 (SLL), 2 HI (MFHL), 3 sign (SRA); zero for SRL/MFHI/MFLO
    sll = or_([H[0], H[4]], out="d_sll")
    srl = or_([H[1], H[5]], out="d_srl")
    sra = or_([H[2], H[6]], out="d_sra")
    d_shen = or_([shift_any, mfhi, mflo, mfhl])
    d_shhi0 = or_([sll, sra])
    d_shhi1 = or_([mfhl, sra])
    d_shhiz = or_([srl, mfhi, mflo])
    # lo: 0 A, 1 B (FSR), 2 LO (MFHL, MFLO), 3 HI (MFHI); SLL: bits 30..0 zero, bit 31 = A0
    d_shlo0 = or_([fsr, mfhi])
    d_shlo1 = or_([mfhl, mflo, mfhi])
    # interlock sources, straight from the fields (emc/pipeline.py has the same rule)
    uses_s = e_j                                       # every group but J/JAL
    r_grp = b.comp[e_r]                                # op 000xxx
    bt = nor([e_b, and_([op[2], op[1], op[0]])])       # branches but not DBNZ
    uses_t = or_([r_grp, bt], out="d_uses_t")
    useimm = or_([ialu, lui, op[5], jal, jalr], out="d_useimm")
    # prediction straight from the opcode group: 010xxx is a branch, 011xxx a
    # jump (the illegal ones in those groups trap anyway)
    br_grp = b.comp[e_b]
    pred = nor([e_b, irn[15]], out="d_pred")             # backward branch
    jump = b.comp[e_j]
    dsd = or_([alu_r, shift_any, mfhi, mflo, mfhl, ldx, jalr], out="d_dsd")
    dst = or_([ialu, lui, ldm, dbnz], out="d_dst")
    munit = R[3]                                       # the multiply/divide group (op 3)

    # ------------------------------------------------------------------
    # ID: hazards and forwarding: one level after the comparators wherever
    # possible (the stall gates the IF/ID clock, so it must settle before
    # the clock's low phase)
    b.block("hazard")
    for n_ in ("x_wr", "x_lw", "m_wr", "f_v"):
        b.pair(n_, n_ + "_n")
    x_dest, m_dest = B("x_dest", 5), B("m_dest", 5)
    ne_sx, ne_tx = b.ne5(s_f, x_dest), b.ne5(t_f, x_dest)
    ne_sm, ne_tm = b.ne5(s_f, m_dest), b.ne5(t_f, m_dest)
    fa_x = nor([ne_sx, "x_wr_n"], out="d_fax")
    fb_x = nor([ne_tx, "x_wr_n"], out="d_fbx")
    fa_m = nor([ne_sm, "m_wr_n", fa_x], out="d_fam")
    fb_m = nor([ne_tm, "m_wr_n", fb_x], out="d_fbm")
    ldu_s = nor([ne_sx, "x_lw_n", b.comp[uses_s]])
    ldu_t = nor([ne_tx, "x_lw_n", b.comp[uses_t]])
    mstall = nor([inv(munit), nor(["x_mul", "busy"])], out="d_mstall")
    any_st = or_([ldu_s, ldu_t, mstall])
    or_(["f_v_n", b.comp[any_st]], out="stall_n", nout=STALL)
    sdm = and_([stm, fb_x, "x_lw"], out="d_sdm")       # store data from a load/SLT just ahead
    # GO: the instruction in ID moves to EX this cycle
    go = nor(["f_v_n", STALL, "exr_q"], out="d_go")
    # predicted-taken branches and jumps redirect fetch in their first ID
    # cycle, even while stalled; idrd remembers that it has
    idr = nor([b.comp[or_([pred, jump])], "f_v_n", "idrd"], out="d_idr")
    b.ctl_reg(nor([b.comp[or_([idr, "idrd"])], "stall_n", "exr_q", "RESET"]), "idrd", "p")
    # next-PC select: EX redirect > ID redirect > sequential; a stall
    # without a redirect holds the PC's clock
    b.ctl_reg("exr_d", "exr_q", "p", comp=True)
    nl.gate("or", ["exr_q"], t="npc_b")
    nor(["exr_q", b.comp[idr]], out="npc_a")
    nor(["stall_n", "exr_q", idr], out="pc_stall")
    # IF/ID valid: cleared by reset and redirects; kept while stalled
    keep = or_([and_([STALL, "f_v"]), and_(["stall_n", inv(idr)])])
    f_v_d = nor(["RESET", "exr_q", b.comp[keep]], out="f_v_d")
    b.reg([f_v_d, b.comp[f_v_d]], ["f_v", "f_v_n"], "p")

    # ------------------------------------------------------------------
    # ID: branch target and immediate
    b.block("target")
    # offset bits 16..29: jumps (op 011xxx) take ir[25:16] sign-extended,
    # branches (op 010xxx) ir[15]; op[3] tells them apart without decoding
    offs = ir[0:16] + B("d_off", 14, 16)
    b.mux2(op[3], [ir[15]] * 10, ir[16:26], offs[16:26])
    b.mux2(op[3], [ir[15]] * 4, [ir[25]] * 4, offs[26:30])
    b.adder(f_pc4 + ["0", "0"], offs + ["0", "0"], ["0", "1", "1", "0"], "0", "0",
            tgt + [None, None], prefix="tgt")                  # A plus B
    # immediate: 0 extended imm16, 1 PC4 (link; alternative of a predicted-taken
    # branch), 2 target (alternative of a predicted-not-taken one), 3 LUI
    b.block("imm")
    imm = B("d_imm", 32)
    sext = or_([ialu, op[5]], out="d_sext")
    zext = or_([I[4], I[5], I[6]])                            # ANDI ORI XORI zero-extend
    fill = and_([ir[15], sext, inv(zext)], out="d_fill")
    alt_pc4 = or_([pred, jump, jalr], out="d_altpc4")
    alt_tgt = nor([e_b, ir[15]], out="d_alttgt")             # forward branch
    ia_, ib_ = or_([alt_pc4, lui], out="d_imma"), or_([alt_tgt, lui], out="d_immb")
    b.mux4(ia_, ib_, [ir[0:2], ["0", "0"], ["0", "0"], ["0", "0"]], imm[0:2])
    b.mux4(ia_, ib_, [ir[2:16], f_pc4[0:14], tgt[0:14], ["0"] * 14], imm[2:16])
    b.mux4(ia_, ib_, [b.buf(fill, 16), f_pc4[14:30], tgt[14:30], ir[0:16]], imm[16:32])

    # ------------------------------------------------------------------
    # Register file: two copies of 32 x 32 in 10E422 RAMs (256 x 4, only
    # the low 32 words used). Written in the first part of the cycle (WB),
    # read in the second (ID).
    b.block("regfile")
    w_d, w_dest = B("w_d", 32), B("w_dest", 5)
    rf_out = {"a": B("rf_a", 32), "b": B("rf_b", 32)}
    we = []
    for _ in range(2):                                   # 16 RAMs, 4 per strobe output
        o = [b.tmp("we") for _ in range(3)]
        nl.gate("clkbuf", ["RFWS_N", "w_wr_n"], t=o)    # low only while strobing a write
        we += o
    k = 0
    for copy, field in (("a", s_f), ("b", t_f)):
        ra = B(f"ra_{copy}", 5)
        b.mux2("RFSEL", field[0:4], w_dest[0:4], ra[0:4])
        b.mux2("RFSEL", [field[4]], [w_dest[4]], [ra[4]])
        for c in range(8):
            nl.add(rf_part, ref=f"RF{copy.upper()}_{c}", CS="0", WE=we[k // 4],
                   **{f"A{i}": ra[i] for i in range(5)},
                   **{f"D{i}": w_d[4 * c + i] for i in range(4)},
                   **{f"Q{i}": rf_out[copy][4 * c + i] for i in range(4)})
            k += 1

    # ------------------------------------------------------------------
    # ID/EX register
    b.block("idex")
    x_a, x_b, x_imm, x_pc4 = B("x_a", 32), B("x_b", 32), B("x_imm", 32), B("x_pc4", 30)
    b.reg(rf_out["a"], x_a, "p")
    b.reg(rf_out["b"], x_b, "p")
    b.reg(imm, x_imm, "p")
    b.reg(f_pc4, x_pc4, "p")
    dest_d = [or_([and_([dsd, d_f[i]]), and_([dst, t_f[i]]), jal], out=f"d_dest{i}") for i in range(5)]
    b.reg(dest_d, x_dest, "p")
    # writes a register: the OR of dest_d, but with the fields tested for
    # non-zero straight from IR, in parallel with the decode
    nz_d, nz_t = or_(d_f, out="d_nzd"), or_(t_f, out="d_nzt")
    wr_d = and_([or_([and_([dsd, nz_d]), and_([dst, nz_t]), jal]), go], out="d_wr")
    b.ctl_reg(wr_d, "x_wr", "p", comp=True)
    b.ctl_reg(and_([late, wr_d]), "x_lw", "p", comp=True)
    b.ctl_reg(go, "x_v", "p")
    ctl = {
        "x_s0": d_s0, "x_s1": d_s1, "x_s2": d_s2, "x_s3": d_s3, "x_m": d_m,
        "x_cin1": d_cin1, "x_cinc": d_cinc, "x_cwr": d_cwr,
        "x_fa0": fa_x, "x_fa1": fa_m,
        "x_fb0": or_([fb_x, useimm]), "x_fb1": or_([fb_m, useimm]),
        "x_fs0": fb_x, "x_fs1": fb_m, "x_sdm": sdm,
        "x_shen_n": inv(d_shen), "x_shhi0": d_shhi0, "x_shhi1": d_shhi1, "x_shhiz": d_shhiz,
        "x_shlo0": d_shlo0, "x_shlo1": d_shlo1, "x_shsll": sll, "x_shamtr": sh_reg, "x_shinv": sll,
        "x_br": br_grp, "x_bc0": op[1], "x_bc1": op[2],
        "x_inv": b.xor(op[0], pred),                    # cond XOR this = misprediction
        "x_sgn": d_sgn, "x_jalr": jalr,
        "x_ld": or_([ldm, ldx]), "x_st": stm,
        "x_sz0": or_([and_([op[5], op[0]]), and_([ldx, fn[0]])]),
        "x_sz1": or_([and_([op[5], op[1]]), and_([ldx, fn[1]])]),
        "x_uns": or_([and_([ldm, op[2]]), and_([ldx, fn[2]])]),
        "x_mh": and_([or_([op[5], ldx]), and_([or_([and_([op[5], op[0]]), and_([ldx, fn[0]])]),
                                              inv(or_([and_([op[5], op[1]]), and_([ldx, fn[1]])]))])]),
        "x_mw": and_([or_([op[5], ldx]), or_([and_([op[5], op[1]]), and_([ldx, fn[1]])])]),
        "x_mj": jalr,
        "x_slt": slt, "x_mul": and_([mstart, go]), "x_mop0": fn[0], "x_mop1": fn[1], "x_mop2": fn[2],
        "x_mthi": mthi, "x_mtlo": mtlo, "x_halt": halt, "x_ill": illegal,
    }
    for name, d in ctl.items():
        b.ctl_reg(d, name, "p", comp=name in ("x_sgn", "x_mh", "x_mw", "x_mj"))

    # ------------------------------------------------------------------
    # EX: a redirect registered last cycle kills the instruction now in EX
    b.block("forward")
    xv = nor([inv("x_v"), "exr_q"], out="e_v")             # valid and not killed
    m_res, ea, eb, es = B("m_res", 32), B("ea", 32), B("eb", 32), B("es", 32)
    b.mux4("x_fa0", "x_fa1", [x_a, m_res, w_d, ["0"] * 32], ea)
    b.mux4("x_fb0", "x_fb1", [x_b, m_res, w_d, x_imm], eb)
    b.mux4("x_fs0", "x_fs1", [x_b, m_res, w_d, ["0"] * 32], es)
    ea31 = B("ea31c", 8)                                     # extra copies of A[31] for sign fill
    b.mux4("x_fa0", "x_fa1", [[x_a[31]] * 8, [m_res[31]] * 8, [w_d[31]] * 8, ["0"] * 8], ea31)

    # EX: ALU (its outputs and the shifter's are dotted onto eres)
    b.block("alu")
    eres = B("eres", 32)
    cflag = "cflag"
    cin = or_(["x_cin1", and_(["x_cinc", cflag])], out="e_cin")
    b.adder(ea, eb, ["x_s0", "x_s1", "x_s2", "x_s3"], "x_m", cin, eres, cout="e_cout", prefix="alu")
    c_wr = and_(["x_cwr", xv])
    b.reg([or_([and_([c_wr, "e_cout"]), and_([inv(c_wr), cflag])])], [cflag], "p")

    # EX: funnel shifter. in[62:0] = {hi[30:0], lo[31:0]}; out[j] = in[j + k]
    b.block("shifter")
    hi_w, lo_w = B("sh_hi", 31), B("sh_lo", 32)
    HI, LO = B("hi", 32), B("lo", 32)
    fills = [ea31[i // 4] for i in range(31)]
    b.mux4("x_shhi0", "x_shhi1", [ea[0:31], ea[1:32], HI[0:31], fills], hi_w, en="x_shhiz")
    b.mux4("x_shlo0", "x_shlo1", [ea[0:31], eb[0:31], LO[0:31], HI[0:31]], lo_w[0:31], en="x_shsll")
    nl.add("10H174", A="x_shlo0", B="x_shlo1", E="0", X0=ea[31], X1=eb[31], X2=LO[31], X3=HI[31], Z="sh_lo31a")
    nl.add("10H174", A="x_shsll", B="0", E="0", X0="sh_lo31a", X1=ea[0], Z=lo_w[31])
    kk, ksrc = B("sh_k", 5), B("sh_ksrc", 5)
    b.mux2("x_shamtr", x_imm[6:11], eb[0:5], ksrc)
    for i in range(5):
        b.xor(ksrc[i], "x_shinv", out=kk[i])
    w1, w2 = B("sh_w1", 47), B("sh_w2", 35)
    inp = lo_w + hi_w
    b.mux2(kk[4], inp[0:47], inp[16:63], w1)
    b.mux4(kk[2], kk[3], [w1[0:35], w1[4:39], w1[8:43], w1[12:47]], w2)
    b.mux4(kk[0], kk[1], [w2[0:32], w2[1:33], w2[2:34], w2[3:35]], eres, en="x_shen_n")

    # EX: branch resolution with the magnitude comparators. Bit 31 of both
    # operands is inverted for signed comparisons.
    b.block("branch")
    lt, ne, ltn = [], [], []
    for c in range(6):
        bits = list(range(5 * c, 5 * c + 5))
        lt.append(f"cmp_lt{c}")
        nl.add("10H166", LT=lt[c], GT=f"cmp_gt{c}",
               **{f"A{i}": ea[j] for i, j in enumerate(bits)}, **{f"B{i}": eb[j] for i, j in enumerate(bits)})
    # bits 30-31 twice: unsigned, and signed with the two sign bits swapped
    # (the same as inverting both); x_sgn enables one of them, their outputs dotted
    sg_n = b.comp["x_sgn"]
    nl.add("10H166", LT="cmp_lt6", GT="cmp_gt6", E="x_sgn", A0=ea[30], A1=ea[31], B0=eb[30], B1=eb[31])
    nl.add("10H166", LT="cmp_lt6", GT="cmp_gt6", E=sg_n, A0=ea[30], A1=eb[31], B0=eb[30], B1=ea[31])
    lt.append("cmp_lt6")
    for c in range(7):
        ne.append(or_([lt[c], f"cmp_gt{c}"], out=f"cmp_ne{c}"))
        or_([lt[c]], out=f"cmp_ltb{c}", nout=f"cmp_ltn{c}")
        ltn.append(f"cmp_ltn{c}")
    z_hi = nor(ne[4:7], out="cmp_eqhi")                   # chips 4..6 equal
    z_lo = nor(ne[0:4], out="cmp_eqlo")
    b.or_([b.comp[z_hi], b.comp[z_lo]], out="cmp_eq_n", nout="cmp_eq")
    eq = "cmp_eq"
    # A < B: the most significant unequal chip says less. The terms are
    # dotted (wired-OR); the top chip's LT joins in the last gate.
    for k in range(4):
        nl.gate("nor", [ltn[k]] + ne[k + 1:4] + [b.comp[z_hi]], f="cmp_ltlo")
    for k in range(4, 6):
        nl.gate("nor", [ltn[k]] + ne[k + 1:7], f="cmp_ltlo")
    ltv = or_(["cmp_ltlo", lt[6]], out="cmp_less", nout="cmp_ge")
    or_(ea[1:32] + [inv(ea[0])], out="br_notone", nout="br_one")   # A = 1: DBNZ falls through
    one = "br_one"
    # misprediction = condition XOR x_inv, as one 8:1 multiplexer: x_inv
    # (branch-if-not XOR predicted taken) picks the condition or its
    # complement; disabled unless a live branch is in EX. A live JALR is
    # dotted onto the same net.
    brv_n = or_([inv("x_br"), b.comp[xv]])                  # not a live branch
    nl.add("10H164", A="x_bc0", B="x_bc1", C="x_inv", E=brv_n, X0=eq, X1=ltv, X2=ltv, X3=one,
           X4="cmp_eq_n", X5="cmp_ge", X6="cmp_ge", X7="br_notone", Z="exr_d")
    nl.gate("nor", [inv("x_jalr"), b.comp[xv]], f="exr_d")
    b.mux2("x_jalr", x_imm[2:32], ea[2:32], B("red_d", 30))
    b.reg(B("red_d", 30), red_q, "p")

    # EX: exceptions (HALT, illegal, misaligned access or jump) from the
    # operands' low bits (the address is A + B)
    b.block("except")
    a0 = b.xor(ea[0], eb[0])
    c0 = nor([inv(ea[0]), inv(eb[0])])
    a1 = b.xor(b.xor(ea[1], eb[1]), c0)
    # x_mh: a half access, x_mw: a word access (loads and stores), x_mj: JALR
    mis = or_([nor([b.comp[a0], "x_mh_n"]), nor([b.comp[a0], "x_mw_n"]), nor([b.comp[a1], "x_mw_n"]),
               nor([inv(ea[0]), "x_mj_n"]), nor([inv(ea[1]), "x_mj_n"])], out="e_mis")
    exc = nor([b.comp[xv], b.comp[or_(["x_halt", "x_ill", mis])]], out="exc_ex")

    # EX: store data replication (byte to all lanes, half to both halves)
    b.block("stdata")
    es_rep = es[0:8] + B("es_rep", 24, 8)
    byte_ = nor(["x_sz0", "x_sz1"])
    b.mux2(byte_, es[8:16], es[0:8], es_rep[8:16])
    b.mux2("x_sz1", es[0:8], es[16:24], es_rep[16:24])
    b.mux4("x_sz0", "x_sz1", [es[0:8], es[8:16], es[24:32], es[0:8]], es_rep[24:32])

    # EX/MEM register
    b.block("exmem")
    m_sd, m_pc4 = B("m_sd", 32), B("m_pc4", 30)
    b.reg(eres, m_res, "p")
    b.reg(es_rep, m_sd, "p")
    b.reg(x_pc4, m_pc4, "p")
    b.reg(x_dest, m_dest, "p")
    ok = and_([xv, inv(exc)], out="e_ok")
    b.ctl_reg(and_(["x_wr", ok]), "m_wr", "p", comp=True)
    for name, d in {"m_v": ok, "m_ld": and_(["x_ld", ok]), "m_st": and_(["x_st", ok]),
                    "m_sz0": "x_sz0", "m_sz1": "x_sz1", "m_uns": "x_uns",
                    "m_late": "x_lw", "m_slt": "x_slt", "m_lt": ltv, "m_sdm": "x_sdm",
                    "m_exc": exc, "m_chalt": "x_halt", "m_cill": "x_ill"}.items():
        b.ctl_reg(d, name, "p")

    # ------------------------------------------------------------------
    # MEM: data memory, main-bus window, load alignment
    b.block("mem")
    mbus = and_([m_res[31], or_(["m_ld", "m_st"])], out="m_bus")
    and_([mbus, inv("BUSDONE")], out=FREEZE)
    da = B("da_ttl", 19)
    for c in range(0, 19, 4):
        nl.add("10H125", **{f"D{k}": m_res[2 + c + k] for k in range(4) if c + k < 19},
               **{f"Q{k}": da[c + k] for k in range(4) if c + k < 19})
    m_byte = nor(["m_sz0", "m_sz1"], out="m_byte")
    m_half = and_(["m_sz0", inv("m_sz1")], out="m_half")
    m_word = "m_sz1"
    r0, r1 = m_res[0], m_res[1]
    st_local = and_(["m_st", inv(mbus)], out="m_stloc")
    we_ttl = B("dwe_ttl", 4)
    we_ecl = []
    for k in range(4):
        hsel = r1 if k >= 2 else inv(r1)
        bsel = and_([r1 if k & 2 else inv(r1), r0 if k & 1 else inv(r0)])
        lane = or_([m_word, and_([m_half, hsel]), and_([m_byte, bsel])], out=f"m_lane{k}")
        stl_n = nor([and_([st_local, lane])])
        we_ecl.append(or_(["MWS_N", stl_n], out=f"m_we{k}"))   # one gate after the strobe
    nl.add("10H125", **{f"D{k}": we_ecl[k] for k in range(4)}, **{f"Q{k}": we_ttl[k] for k in range(4)})
    nl.add("10H125", D0="m_st", Q0="doe_ttl")
    # store data: from EX/MEM, or from MEM/WB when the load just ahead made it
    # (then replicate it here: EX/MEM.SD is already replicated)
    sdf = B("m_sdf", 32)
    b.mux2("m_sdm", m_sd, w_d, sdf)
    sdr = sdf[0:8] + B("m_sdr", 24, 8)
    b.mux2(and_(["m_sdm", m_byte]), sdf[8:16], sdf[0:8], sdr[8:16])
    b.mux2(and_(["m_sdm", inv(m_word)]), sdf[16:24], sdf[0:8], sdr[16:24])
    b.mux4(and_(["m_sdm", m_half]), and_(["m_sdm", m_byte]), [sdf[24:32], sdf[8:16], sdf[0:8], sdf[0:8]], sdr[24:32])
    dd = B("dd_ttl", 32)
    st_oe = inv("m_st")
    for c in range(0, 32, 9):
        nl.add("10H601", OE=st_oe, **{f"D{k}": sdr[c + k] for k in range(9) if c + k < 32},
               **{f"Q{k}": dd[c + k] for k in range(9) if c + k < 32})
    dq = B("dq_ttl", 32)
    for ln in range(4):
        nl.add("SRAM512Kx8", ref=f"DMEM{ln}", block="dmem", CE="0", OE="doe_ttl", WE=we_ttl[ln],
               **{f"A{i}": da[i] for i in range(19)},
               **{f"D{i}": dd[8 * ln + i] for i in range(8)},
               **{f"Q{i}": dq[8 * ln + i] for i in range(8)})
    ld = B("ld", 32)
    for c in range(0, 32, 4):
        nl.add("10H124", **{f"D{k}": dq[c + k] for k in range(4)}, **{f"Q{k}": ld[c + k] for k in range(4)})
    lanes = [ld[8 * k:8 * k + 8] for k in range(4)]
    wd_in = B("wd_in", 32)
    ld_off = nor([and_(["m_ld", inv(mbus)])], out="m_ldoff")
    # low byte: the lane picked by the address (byte), lane 0 or 2 (half), lane 0 (word)
    sa0 = and_([m_byte, r0])
    sa1 = and_([or_([m_byte, m_half]), r1])
    b.mux4(sa0, sa1, lanes, wd_in[0:8], en=ld_off)
    # the other bytes: one 10H164 per bit, whose inputs are lane bytes, the
    # four lanes' sign bits and 0, so sign extension costs no extra level
    uns = "m_uns"
    n_uses = [24, 40, 24, 40]
    sgn = []
    for k in range(4):
        copies = []
        for c in range((n_uses[k] + 15) // 16):          # 4 copies a 10H124, 4 loads each
            q = [f"ld_sgn{k}_{c}_{j}" for j in range(4)]
            nl.add("10H124", **{f"D{j}": dq[8 * k + 7] for j in range(4)}, **{f"Q{j}": q[j] for j in range(4)})
            copies += q
        sgn.append(iter([copies[i // 4] for i in range(n_uses[k])]))
    # bits 15..8, select (C B A): word or half@0 -> 000 lane 1; half@2 -> 001
    # lane 3; signed byte in lane k -> 2 + k; unsigned byte -> 110 (zero)
    hi_b = [or_([and_([m_half, r1]), and_([m_byte, inv(uns), r0])]),
            or_([and_([m_byte, inv(uns), inv(r1)]), and_([m_byte, uns])]),
            and_([m_byte, or_([r1, uns])])]
    for i in range(8):
        nl.add("10H164", A=hi_b[0], B=hi_b[1], C=hi_b[2], E=ld_off,
               X0=lanes[1][i], X1=lanes[3][i], X2=next(sgn[0]), X3=next(sgn[1]), X4=next(sgn[2]),
               X5=next(sgn[3]), X6="0", X7="0", Z=wd_in[8 + i])
    # bits 31..16: word -> 000 lanes 2, 3; signed half@0 -> 001 sign of lane 1;
    # signed half@2 -> 010 sign of lane 3; signed byte in lane k -> 011 + k;
    # unsigned byte or half -> 111 (zero)
    bh = or_([m_byte, m_half])
    sb = [and_([m_byte, inv(uns), r1 if k & 2 else inv(r1), r0 if k & 1 else inv(r0)]) for k in range(4)]
    sh0, sh2 = and_([m_half, inv(uns), inv(r1)]), and_([m_half, inv(uns), r1])
    ub = and_([bh, uns])
    t_a = or_([sh0, sb[0], sb[2], ub])
    t_b = or_([sh2, sb[0], sb[3], ub])
    t_c = or_([sb[1], sb[2], sb[3], ub])
    for i in range(16):
        nl.add("10H164", A=t_a, B=t_b, C=t_c, E=ld_off,
               X0=ld[16 + i], X1=next(sgn[1]), X2=next(sgn[3]), X3=next(sgn[0]), X4=next(sgn[1]),
               X5=next(sgn[2]), X6=next(sgn[3]), X7="0", Z=wd_in[16 + i])
    # the ALU result passes unless this is a load, an SLT or a bubble
    res_off = or_(["m_late", inv("m_v"), "RESET"], out="m_resoff")
    rof = b.fan(res_off, 6)
    for j, c in enumerate(range(0, 32, 6)):
        nl.add("10H188", E=rof[j], **{f"D{k}": m_res[c + k] for k in range(6) if c + k < 32},
               **{f"Q{k}": wd_in[c + k] for k in range(6) if c + k < 32})
    nl.gate("or", [and_(["m_slt", "m_lt", "m_v"])], t=wd_in[0])
    bus_off = nor([and_([mbus, "m_ld", "BUSDONE"])], out="m_busoff")
    bof = b.fan(bus_off, 6)
    rd = B("BUSRD", 32)
    for j, c in enumerate(range(0, 32, 6)):
        nl.add("10H188", E=bof[j], **{f"D{k}": rd[c + k] for k in range(6) if c + k < 32},
               **{f"Q{k}": wd_in[c + k] for k in range(6) if c + k < 32})

    # MEM/WB register; reset writes 0 to r0 (MEM/WB.DEST and the data are 0)
    b.block("memwb")
    b.reg(wd_in, w_d, "p")
    b.reg([and_([m_dest[i], inv("RESET")]) for i in range(5)], w_dest, "p")
    b.ctl_reg("m_v", "w_v", "p")
    w_wr_d = or_(["m_wr", "RESET"])
    b.reg([b.comp[w_wr_d]], ["w_wr_n"], "p")

    # ------------------------------------------------------------------
    # Stopping: an exception reaches MEM, the pipeline holds and the machine halts
    b.block("control")
    b.reg([and_([or_(["m_exc", HALTED]), inv("RESET")])], [HALTED], "u")

    # multiply/divide unit (behavioural for now); it must not start while
    # the pipeline is frozen or an exception holds it
    b.block("muldiv")
    go_mul = nor([FREEZE, HALTED, "m_exc", inv(xv)], out="md_go")
    nl.add("MULDIV", ref="MULDIV", C="CLK",
           START=and_(["x_mul", go_mul]), OP0="x_mop0", OP1="x_mop1", OP2="x_mop2",
           MTHI=and_(["x_mthi", go_mul]), MTLO=and_(["x_mtlo", go_mul]), BUSY="busy",
           **{f"A{i}": ea[i] for i in range(32)}, **{f"B{i}": eb[i] for i in range(32)},
           **{f"HI{i}": HI[i] for i in range(32)}, **{f"LO{i}": LO[i] for i in range(32)})
    b.flush()
    nl.check(external=EXTERNAL)
    if hold_fix:
        from . import sta
        sta.fix_hold(nl, EXTERNAL, ff)
        nl.check(external=EXTERNAL)
    return nl
