// Lyric cues. Times are in seconds from the start of the song.
//
// script: 'ja' is drawn with the brush font (vertical by default),
//         'sa' is Sanskrit in Devanagari (always horizontal).
// dir:    'v' vertical (top to bottom), 'h' horizontal.
// x, y:   anchor in normalised screen space, 0..1 from the top left.
//         For vertical text the anchor is the top of the column,
//         for horizontal text it is the centre of the line.
// size:   font size as a fraction of the screen height.
// ink:    'gold' (金泥 on indigo), 'sumi' (墨), 'shu' (朱, vermilion), 'white', 'indigo'.
// sung:   what the singer actually sings, when the displayed text differs
//         (sutra phrases are sung as kana readings but shown as kanji).
//
// The sutra quotations (色即是空…, 不生不滅…, 羯諦…) are sung as their
// Japanese readings; they are shown in kanji so the screen carries the
// characters themselves.

export const CUES = [
  // Intro
  { t0: 1.0, t1: 10.6, text: 'ॐ', script: 'sa', x: 0.5, y: 0.5, size: 0.30, ink: 'gold' },
  { t0: 11.2, t1: 20.8, text: 'प्रज्ञापारमिता', script: 'sa', x: 0.5, y: 0.8, size: 0.085, ink: 'gold' },
  { t0: 22.0, t1: 35.8, text: 'प्रज्ञापारमिता', script: 'sa', x: 0.66, y: 0.24, size: 0.11, ink: 'gold' },

  // Verse 1
  { t0: 37.0, t1: 43.6, text: '深き 智慧の 海の底', script: 'ja', dir: 'v', x: 0.84, y: 0.14, size: 0.078, ink: 'gold' },
  { t0: 42.8, t1: 49.4, text: '観る者は 静かに 目を開く', script: 'ja', dir: 'v', x: 0.14, y: 0.10, size: 0.072, ink: 'gold' },
  { t0: 48.7, t1: 55.6, text: 'かたちも こころも 風の砂', script: 'ja', dir: 'h', x: 0.5, y: 0.83, size: 0.074, ink: 'gold' },
  { t0: 55.0, t1: 66.8, text: '五つの ひかりが ほどけてゆく', script: 'ja', dir: 'v', x: 0.88, y: 0.08, size: 0.070, ink: 'gold' },
  // the five skandhas (五蘊), one inside each light; not sung, they come undone with the lights
  { t0: 55.4, t1: 61.5, text: '色', script: 'ja', dir: 'h', x: 0.5, y: 0.28, size: 0.05, ink: 'gold', deco: true },
  { t0: 55.8, t1: 62.0, text: '受', script: 'ja', dir: 'h', x: 0.3875, y: 0.425, size: 0.05, ink: 'gold', deco: true },
  { t0: 56.1, t1: 62.5, text: '想', script: 'ja', dir: 'h', x: 0.4305, y: 0.66, size: 0.05, ink: 'gold', deco: true },
  { t0: 56.5, t1: 63.0, text: '行', script: 'ja', dir: 'h', x: 0.5695, y: 0.66, size: 0.05, ink: 'gold', deco: true },
  { t0: 56.8, t1: 63.5, text: '識', script: 'ja', dir: 'h', x: 0.6125, y: 0.425, size: 0.05, ink: 'gold', deco: true },

  // Pre-chorus
  { t0: 68.3, t1: 73.8, text: '何も 失くさず 何も 得ず', script: 'ja', dir: 'v', x: 0.80, y: 0.12, size: 0.074, ink: 'gold' },
  { t0: 72.2, t1: 78.0, text: 'ただ 満ちて ただ 空っぽで', script: 'ja', dir: 'v', x: 0.20, y: 0.12, size: 0.074, ink: 'gold' },
  { t0: 75.8, t1: 79.6, text: 'रूपं शून्यता', script: 'sa', x: 0.5, y: 0.5, size: 0.10, ink: 'gold' },

  // Chorus
  { t0: 79.0, t1: 86.2, text: '色即是空', script: 'ja', dir: 'v', x: 0.84, y: 0.12, size: 0.17, ink: 'sumi', sung: 'しきそくぜくう' },
  { t0: 82.0, t1: 86.2, text: '空即是色', script: 'ja', dir: 'v', x: 0.16, y: 0.12, size: 0.17, ink: 'sumi', sung: 'くうそくぜしき' },
  { t0: 85.2, t1: 91.6, text: 'रूपं शून्यता शून्यतैव रूपम्', script: 'sa', x: 0.5, y: 0.86, size: 0.075, ink: 'shu' },
  { t0: 91.0, t1: 98.2, text: 'この てのひらに 宇宙が 透ける', script: 'ja', dir: 'v', x: 0.86, y: 0.10, size: 0.068, ink: 'sumi' },
  { t0: 98.0, t1: 106.0, text: 'うまれず ほろびず 光は 巡る', script: 'ja', dir: 'ring', x: 0.5, y: 0.5, size: 0.064, ink: 'sumi', radius: 0.36 },

  // Verse 2
  { t0: 122.6, t1: 130.0, text: '恐れの 鎖も さかさまの 夢も', script: 'ja', dir: 'v', x: 0.12, y: 0.06, size: 0.062, ink: 'sumi', mirror: 0.62 },
  { t0: 129.5, t1: 137.0, text: 'けいげなき 心に 溶けてゆく', script: 'ja', dir: 'v', x: 0.88, y: 0.08, size: 0.066, ink: 'sumi' },
  { t0: 136.5, t1: 144.0, text: '向こう岸で 誰かが 呼んでいる', script: 'ja', dir: 'h', x: 0.5, y: 0.2, size: 0.066, ink: 'sumi' },
  { t0: 143.5, t1: 150.6, text: '名前の ない 声で', script: 'ja', dir: 'h', x: 0.5, y: 0.8, size: 0.07, ink: 'indigo' },

  // Bridge: call (left, sumi) and response (right, vermilion)
  { t0: 150.7, t1: 156.6, text: '不生 不滅', script: 'ja', dir: 'v', x: 0.1, y: 0.1, size: 0.13, ink: 'sumi', sung: 'ふしょう ふめつ' },
  { t0: 153.7, t1: 156.8, text: 'अनुत्पन्ना अनिरुद्धा', script: 'sa', x: 0.74, y: 0.2, size: 0.075, ink: 'shu' },
  { t0: 156.7, t1: 162.6, text: '不垢 不浄', script: 'ja', dir: 'v', x: 0.1, y: 0.1, size: 0.13, ink: 'sumi', sung: 'ふく ふじょう' },
  { t0: 159.7, t1: 162.8, text: 'अमला अविमला', script: 'sa', x: 0.74, y: 0.2, size: 0.08, ink: 'shu' },
  { t0: 162.7, t1: 168.8, text: '不増 不減', script: 'ja', dir: 'v', x: 0.1, y: 0.1, size: 0.13, ink: 'sumi', sung: 'ふぞう ふげん' },
  { t0: 165.7, t1: 169.0, text: 'अनूना अपरिपूर्णाः', script: 'sa', x: 0.74, y: 0.2, size: 0.075, ink: 'shu' },

  // Build
  { t0: 169.0, t1: 172.6, text: '羯諦 羯諦', script: 'ja', dir: 'v', x: 0.82, y: 0.16, size: 0.12, ink: 'sumi', sung: 'ぎゃてい ぎゃてい' },
  { t0: 172.4, t1: 175.9, text: '波羅羯諦', script: 'ja', dir: 'v', x: 0.62, y: 0.14, size: 0.13, ink: 'sumi', sung: 'はらぎゃてい' },
  { t0: 175.8, t1: 179.3, text: '波羅僧羯諦', script: 'ja', dir: 'v', x: 0.40, y: 0.10, size: 0.135, ink: 'sumi', sung: 'はらそうぎゃてい' },
  { t0: 179.2, t1: 182.9, text: '菩提薩婆訶', script: 'ja', dir: 'v', x: 0.18, y: 0.08, size: 0.15, ink: 'sumi', sung: 'ぼじそわか' },

  // Climax
  { t0: 182.4, t1: 189.2, text: 'गते गते पारगते', script: 'sa', x: 0.5, y: 0.2, size: 0.13, ink: 'gold' },
  { t0: 189.0, t1: 195.6, text: 'पारसंगते बोधि स्वाहा', script: 'sa', x: 0.5, y: 0.82, size: 0.12, ink: 'gold' },
  { t0: 195.5, t1: 201.6, text: 'गते गते पारगते', script: 'sa', x: 0.3, y: 0.3, size: 0.075, ink: 'shu', echo: true },
  { t0: 201.5, t1: 208.0, text: 'पारसंगते बोधि स्वाहा', script: 'sa', x: 0.7, y: 0.72, size: 0.075, ink: 'shu', echo: true },

  // Final chorus
  { t0: 211.5, t1: 218.0, text: '色即是空', script: 'ja', dir: 'v', x: 0.84, y: 0.12, size: 0.17, ink: 'sumi', sung: 'しきそくぜくう' },
  { t0: 214.5, t1: 218.0, text: '空即是色', script: 'ja', dir: 'v', x: 0.16, y: 0.12, size: 0.17, ink: 'sumi', sung: 'くうそくぜしき' },
  { t0: 217.6, t1: 223.6, text: 'रूपं शून्यता शून्यतैव रूपम्', script: 'sa', x: 0.5, y: 0.14, size: 0.075, ink: 'shu' },
  { t0: 223.8, t1: 230.6, text: '彼岸の 風に 私は ほどける', script: 'ja', dir: 'v', x: 0.85, y: 0.1, size: 0.07, ink: 'sumi', unravel: true },
  { t0: 230.5, t1: 240.4, text: 'うまれず ほろびず 詩は 巡る', script: 'ja', dir: 'ring', x: 0.5, y: 0.5, size: 0.064, ink: 'sumi', radius: 0.36 },

  // Outro
  { t0: 241.0, t1: 248.5, text: 'बोधि स्वाहा', script: 'sa', x: 0.5, y: 0.78, size: 0.07, ink: 'sumi' },
  { t0: 249.5, t1: 257.8, text: 'ॐ', script: 'sa', x: 0.78, y: 0.72, size: 0.14, ink: 'shu', seal: true },
];

// Roughly how many syllables (morae) each kanji is sung as here, so a line
// can be written at the pace it's sung. Kana count one each.
const MORA = {
  深: 2, 智: 1, 慧: 1, 海: 2, 底: 2, 観: 1, 者: 2, 静: 2, 目: 1, 開: 2, 風: 2, 砂: 2,
  五: 2, 何: 2, 失: 1, 得: 1, 満: 1, 空: 2, 色: 2, 即: 2, 是: 1, 宇: 1, 宙: 2, 透: 1,
  光: 3, 巡: 2, 恐: 2, 鎖: 3, 夢: 2, 心: 3, 溶: 1, 向: 1, 岸: 2, 誰: 2, 呼: 1, 名: 1,
  前: 2, 声: 2, 不: 1, 生: 2, 滅: 2, 垢: 1, 浄: 2, 増: 2, 減: 2, 羯: 1, 諦: 2, 波: 1,
  羅: 1, 僧: 2, 菩: 1, 提: 1, 薩: 1, 婆: 1, 訶: 1, 彼: 1, 私: 3, 詩: 2,
};
const SMALL = new Set('ゃゅょぁぃぅぇぉャュョァィゥェォ');

export function moraOf(ch) {
  if (MORA[ch]) return MORA[ch];
  if (SMALL.has(ch)) return 0.5;
  return /[\u3040-\u30ff]/.test(ch) ? 1 : 2;
}

// Syllables in a Devanagari string: every vowel, written or inherent.
export function syllables(text) {
  const cps = [...text];
  let n = 0;
  cps.forEach((c, i) => {
    const k = c.codePointAt(0);
    const virama = cps[i + 1] === '\u094D';
    if ((k >= 0x0915 && k <= 0x0939 && !virama) || (k >= 0x0904 && k <= 0x0914)) n++;
  });
  return Math.max(1, n);
}

// Every character the fonts need to cover.
export function charset(script) {
  const s = new Set();
  for (const c of CUES) if (c.script === script) for (const ch of c.text) if (ch !== ' ') s.add(ch);
  return [...s].join('');
}
