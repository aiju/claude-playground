// WebGL2 plumbing: one full-screen triangle and a fragment shader per scene
// (or per pair of scenes during a transition), compiled when first needed.

import { vertex, fragmentFor } from './glsl/composite.js';

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const lines = src.split('\n');
    const m = /ERROR: \d+:(\d+)/.exec(log);
    const ctx = m ? lines.slice(Math.max(0, +m[1] - 3), +m[1] + 2).join('\n') : '';
    throw new Error(`shader compile failed:\n${log}\n${ctx}`);
  }
  return s;
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.canvas = canvas;
    this.programs = new Map();
    this.vs = compile(gl, gl.VERTEX_SHADER, vertex);

    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    this.texText = this.makeTexture(0, true);
    this.texCtl = this.makeTexture(1, false);
  }

  // Start compiling a program without waiting for the driver.
  compileAsync(a, b) {
    const gl = this.gl;
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragmentFor(a, b));
    gl.compileShader(fs);
    const prog = gl.createProgram();
    gl.attachShader(prog, this.vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    return { prog, fs };
  }

  // Check a compiled program and look up its uniforms.
  finalize(key, { prog, fs }) {
    const gl = this.gl;
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog);
      throw new Error(`shader ${key} failed to build:\n${log}`);
    }
    const u = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(prog, info.name);
    }
    gl.useProgram(prog);
    gl.uniform1i(u.uText, 0);
    gl.uniform1i(u.uTextCtl, 1);
    const p = { prog, u };
    this.programs.set(key, p);
    return p;
  }

  program(a, b) {
    const key = b == null ? `${a}` : `${a}>${b}`;
    return this.programs.get(key) || this.finalize(key, this.compileAsync(a, b));
  }

  // Compile a list of [a, b] programs ahead of time, in parallel where the
  // driver allows, so playback never stalls on a compile.
  async warm(keys, onProgress = () => {}) {
    const gl = this.gl;
    const ext = gl.getExtension('KHR_parallel_shader_compile');
    const todo = keys
      .map(([a, b]) => ({ key: b == null ? `${a}` : `${a}>${b}`, a, b }))
      .filter((k, i, all) => !this.programs.has(k.key) && all.findIndex(o => o.key === k.key) === i);
    if (ext) {
      const pending = todo.map(k => ({ ...k, job: this.compileAsync(k.a, k.b) }));
      for (;;) {
        const ready = pending.filter(p => gl.getProgramParameter(p.job.prog, ext.COMPLETION_STATUS_KHR)).length;
        onProgress(ready / pending.length);
        if (ready === pending.length) break;
        await new Promise(r => setTimeout(r, 30));
      }
      for (const p of pending) this.finalize(p.key, p.job);
    } else {
      for (let i = 0; i < todo.length; i++) {
        this.finalize(todo[i].key, this.compileAsync(todo[i].a, todo[i].b));
        onProgress((i + 1) / todo.length);
        await new Promise(r => setTimeout(r, 0));
      }
    }
  }

  makeTexture(unit, mip) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { tex, unit, mip };
  }

  upload(t, source) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + t.unit);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (t.mip) gl.generateMipmap(gl.TEXTURE_2D);
  }

  // s: { time, a, b (or null), tA, tB, vA, vB, mix, trans, fade, level, pulse, beat, hits }
  draw(s, text) {
    const gl = this.gl;
    const { prog, u } = this.program(s.a, s.b);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.upload(this.texText, text.colour);
    this.upload(this.texCtl, text.control);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uTime, s.time);
    gl.uniform1f(u.uTA, s.tA);
    gl.uniform1f(u.uVarA, s.vA);
    if (s.b != null) {
      gl.uniform1f(u.uTB, s.tB);
      gl.uniform1f(u.uVarB, s.vB);
      gl.uniform1f(u.uMix, s.mix);
      gl.uniform1i(u.uTrans, s.trans);
    }
    gl.uniform1f(u.uFade, s.fade);
    if (u.uLevel) gl.uniform1f(u.uLevel, s.level);
    if (u.uPulse) gl.uniform1f(u.uPulse, s.pulse);
    if (u.uBeat) gl.uniform1f(u.uBeat, s.beat);
    if (u.uHits) gl.uniform2fv(u.uHits, s.hits.flat());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  finish() { this.gl.finish(); }
}
