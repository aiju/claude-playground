// Frank Liang's hyphenation algorithm, as used by TeX.

export class Hyphenator {
  constructor(patterns, exceptions = [], { leftMin = 2, rightMin = 3 } = {}) {
    this.leftMin = leftMin;
    this.rightMin = rightMin;
    this.patterns = new Map();
    this.maxLen = 0;
    for (const pat of patterns.split(/\s+/)) {
      if (!pat) continue;
      const letters = pat.replace(/\d/g, "");
      const values = new Array(letters.length + 1).fill(0);
      let i = 0;
      for (const ch of pat) {
        if (ch >= "0" && ch <= "9") values[i] = Number(ch);
        else i++;
      }
      this.patterns.set(letters, values);
      this.maxLen = Math.max(this.maxLen, letters.length);
    }
    this.exceptions = new Map();
    for (const ex of exceptions) {
      const word = ex.replace(/-/g, "");
      const points = [];
      let i = 0;
      for (const ch of ex) {
        if (ch === "-") points.push(i);
        else i++;
      }
      this.exceptions.set(word, points);
    }
    this.cache = new Map();
  }

  // Positions i (0 < i < word.length) where a hyphen may go before word[i].
  points(word) {
    const lower = word.toLowerCase();
    if (this.cache.has(lower)) return this.cache.get(lower);
    let result;
    if (this.exceptions.has(lower)) {
      result = this.exceptions.get(lower);
    } else {
      const w = "." + lower + ".";
      const values = new Array(w.length + 1).fill(0);
      for (let i = 0; i < w.length; i++) {
        for (let j = i + 1; j <= Math.min(w.length, i + this.maxLen); j++) {
          const v = this.patterns.get(w.slice(i, j));
          if (v) for (let k = 0; k < v.length; k++) values[i + k] = Math.max(values[i + k], v[k]);
        }
      }
      result = [];
      // values[k+1] sits between w[k] and w[k+1], i.e. before word[k]
      for (let k = this.leftMin; k <= lower.length - this.rightMin; k++) {
        if (values[k + 1] % 2 === 1) result.push(k);
      }
    }
    this.cache.set(lower, result);
    return result;
  }
}
