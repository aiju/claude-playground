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
// text:   Japanese carries the sung reading in brackets after each kanji,
//         '深[ふか]き'; only the characters appear on screen.
// roman:  for Sanskrit, the sung syllables, hyphenated as on the lyric sheet.
// t0..t1 is when a line is on screen; when each syllable is sung comes from
// alignment.js (measured), attached below as `sylls`. Each cue also gets a
// `key` that names it in the timing editor: the alignment key for a sung
// line, and 'deco:色#1' or 'seal:ॐ#1' for the others.
//
// The sutra quotations (色即是空…, 不生不滅…, 羯諦…) are sung as their
// Japanese readings; they are shown in kanji so the screen carries the
// characters themselves.

import { plain, parseRuby } from './schedule.js';
import { ALIGN } from './alignment.js';

export const CUES = [
  // Intro
  { t0: 5.8, t1: 15.0, text: 'ॐ', roman: 'om', script: 'sa', x: 0.5, y: 0.5, size: 0.30, ink: 'gold' },
  { t0: 14.0, t1: 20.6, text: 'प्रज्ञापारमिता', roman: 'praj-nya pa-ra-mi-ta', script: 'sa', x: 0.5, y: 0.8, size: 0.085, ink: 'gold' },
  { t0: 17.7, t1: 26.0, text: 'प्रज्ञापारमिता', roman: 'praj-nya pa-ra-mi-ta', script: 'sa', x: 0.66, y: 0.24, size: 0.11, ink: 'gold' },

  // Verse 1
  { t0: 35.75, t1: 43.2, text: '深[ふか]き 智[ち]慧[え]の 海[うみ]の底[そこ]', script: 'ja', dir: 'v', x: 0.84, y: 0.14, size: 0.078, ink: 'gold' },
  { t0: 42.4, t1: 50.6, text: '観[み]る者[もの]は 静[しず]かに 目[め]を開[ひら]く', script: 'ja', dir: 'v', x: 0.14, y: 0.10, size: 0.072, ink: 'gold' },
  { t0: 49.6, t1: 57.4, text: 'かたちも こころも 風[かぜ]の砂[すな]', script: 'ja', dir: 'h', x: 0.5, y: 0.83, size: 0.074, ink: 'gold' },
  { t0: 56.4, t1: 64.8, text: '五[いつ]つの ひかりが ほどけてゆく', script: 'ja', dir: 'v', x: 0.88, y: 0.08, size: 0.070, ink: 'gold' },
  // the five skandhas (五蘊), one inside each light; not sung, they come undone with the lights
  { t0: 56.7, t1: 62.0, text: '色[しき]', script: 'ja', dir: 'h', x: 0.5, y: 0.28, size: 0.05, ink: 'gold', deco: true },
  { t0: 57.0, t1: 62.5, text: '受[じゅ]', script: 'ja', dir: 'h', x: 0.3875, y: 0.425, size: 0.05, ink: 'gold', deco: true },
  { t0: 57.3, t1: 63.0, text: '想[そう]', script: 'ja', dir: 'h', x: 0.4305, y: 0.66, size: 0.05, ink: 'gold', deco: true },
  { t0: 57.6, t1: 63.5, text: '行[ぎょう]', script: 'ja', dir: 'h', x: 0.5695, y: 0.66, size: 0.05, ink: 'gold', deco: true },
  { t0: 57.9, t1: 64.0, text: '識[しき]', script: 'ja', dir: 'h', x: 0.6125, y: 0.425, size: 0.05, ink: 'gold', deco: true },

  // Pre-chorus
  { t0: 64.45, t1: 69.6, text: '何[なに]も 失[な]くさず 何[なに]も 得[え]ず', script: 'ja', dir: 'v', x: 0.80, y: 0.12, size: 0.074, ink: 'gold' },
  { t0: 67.6, t1: 75.9, text: 'ただ 満[み]ちて ただ 空[から]っぽで', script: 'ja', dir: 'v', x: 0.20, y: 0.12, size: 0.074, ink: 'gold' },
  { t0: 75.1, t1: 79.2, text: 'रूपं शून्यता', roman: 'ru-pam shun-ya-ta', script: 'sa', x: 0.5, y: 0.8, size: 0.09, ink: 'gold' },

  // Chorus
  { t0: 78.65, t1: 86.2, text: '色[しき]即[そく]是[ぜ]空[くう]', script: 'ja', dir: 'v', x: 0.84, y: 0.12, size: 0.17, ink: 'sumi' },
  { t0: 82.4, t1: 86.4, text: '空[くう]即[そく]是[ぜ]色[しき]', script: 'ja', dir: 'v', x: 0.16, y: 0.12, size: 0.17, ink: 'sumi' },
  { t0: 84.2, t1: 91.3, text: 'रूपं शून्यता शून्यतैव रूपम्', roman: 'ru-pam shun-ya-ta shun-ya-tai-va ru-pam', script: 'sa', x: 0.5, y: 0.86, size: 0.075, ink: 'shu' },
  { t0: 89.1, t1: 96.4, text: 'この てのひらに 宇[う]宙[ちゅう]が 透[す]ける', script: 'ja', dir: 'v', x: 0.86, y: 0.10, size: 0.068, ink: 'sumi' },
  { t0: 94.9, t1: 109.5, text: 'うまれず ほろびず 光[ひかり]は 巡[めぐ]る', script: 'ja', dir: 'ring', x: 0.5, y: 0.5, size: 0.064, ink: 'sumi', radius: 0.36 },

  // Verse 2
  { t0: 135.9, t1: 141.6, text: '恐[おそ]れの 鎖[くさり]も さかさまの 夢[ゆめ]も', script: 'ja', dir: 'v', x: 0.12, y: 0.06, size: 0.062, ink: 'sumi', mirror: 0.62 },
  { t0: 139.5, t1: 145.2, text: 'けいげなき 心[こころ]に 溶[と]けてゆく', script: 'ja', dir: 'v', x: 0.88, y: 0.08, size: 0.066, ink: 'sumi' },
  { t0: 143.05, t1: 149.0, text: '向[む]こう岸[ぎし]で 誰[だれ]かが 呼[よ]んでいる', script: 'ja', dir: 'h', x: 0.5, y: 0.2, size: 0.066, ink: 'sumi' },
  { t0: 147.15, t1: 151.0, text: '名[な]前[まえ]の ない 声[こえ]で', script: 'ja', dir: 'h', x: 0.5, y: 0.8, size: 0.07, ink: 'indigo' },

  // Bridge: call (left, sumi) and response (right, vermilion)
  { t0: 150.35, t1: 154.25, text: '不[ふ]生[しょう] 不[ふ]滅[めつ]', script: 'ja', dir: 'v', x: 0.1, y: 0.1, size: 0.13, ink: 'sumi' },
  { t0: 151.95, t1: 155.4, text: 'अनुत्पन्ना अनिरुद्धा', roman: 'a-nut-pan-na a-ni-rud-dha', script: 'sa', x: 0.74, y: 0.2, size: 0.075, ink: 'shu' },
  { t0: 154.0, t1: 157.6, text: '不[ふ]垢[く] 不[ふ]浄[じょう]', script: 'ja', dir: 'v', x: 0.1, y: 0.1, size: 0.13, ink: 'sumi' },
  { t0: 155.5, t1: 159.0, text: 'अमला अविमला', roman: 'a-ma-la a-vi-ma-la', script: 'sa', x: 0.74, y: 0.2, size: 0.08, ink: 'shu' },
  { t0: 157.4, t1: 161.2, text: '不[ふ]増[ぞう] 不[ふ]減[げん]', script: 'ja', dir: 'v', x: 0.1, y: 0.1, size: 0.13, ink: 'sumi' },
  { t0: 159.1, t1: 161.6, text: 'अनूना अपरिपूर्णाः', roman: 'a-nu-na a-pa-ri-pur-na', script: 'sa', x: 0.74, y: 0.2, size: 0.075, ink: 'shu' },

  // Build
  { t0: 161.05, t1: 168.4, text: '羯[ぎゃ]諦[てい] 羯[ぎゃ]諦[てい]', script: 'ja', dir: 'v', x: 0.82, y: 0.16, size: 0.12, ink: 'sumi' },
  { t0: 162.35, t1: 168.4, text: '波[は]羅[ら]羯[ぎゃ]諦[てい]', script: 'ja', dir: 'v', x: 0.62, y: 0.14, size: 0.13, ink: 'sumi' },
  { t0: 163.65, t1: 168.4, text: '波[は]羅[ら]僧[そう]羯[ぎゃ]諦[てい]', script: 'ja', dir: 'v', x: 0.40, y: 0.10, size: 0.135, ink: 'sumi' },
  { t0: 165.45, t1: 168.6, text: '菩[ぼ]提[じ]薩[そ]婆[わ]訶[か]', script: 'ja', dir: 'v', x: 0.18, y: 0.08, size: 0.15, ink: 'sumi' },

  // Climax
  { t0: 168.2, t1: 175.3, text: 'गते गते पारगते', roman: 'ga-te ga-te pa-ra-ga-te', script: 'sa', x: 0.5, y: 0.2, size: 0.13, ink: 'gold' },
  { t0: 170.35, t1: 177.4, text: 'पारसंगते बोधि स्वाहा', roman: 'pa-ra-sam-ga-te bo-dhi sva-ha', script: 'sa', x: 0.5, y: 0.82, size: 0.12, ink: 'gold' },
  { t0: 175.2, t1: 180.9, text: 'गते गते पारगते', roman: 'ga-te ga-te pa-ra-ga-te', script: 'sa', x: 0.3, y: 0.3, size: 0.075, ink: 'shu', echo: true },
  { t0: 177.45, t1: 182.6, text: 'पारसंगते बोधि स्वाहा', roman: 'pa-ra-sam-ga-te bo-dhi sva-ha', script: 'sa', x: 0.7, y: 0.72, size: 0.075, ink: 'shu', echo: true },

  // Final chorus
  { t0: 182.45, t1: 189.6, text: '色[しき]即[そく]是[ぜ]空[くう]', script: 'ja', dir: 'v', x: 0.84, y: 0.12, size: 0.17, ink: 'sumi' },
  { t0: 185.95, t1: 189.8, text: '空[くう]即[そく]是[ぜ]色[しき]', script: 'ja', dir: 'v', x: 0.16, y: 0.12, size: 0.17, ink: 'sumi' },
  { t0: 187.7, t1: 194.5, text: 'रूपं शून्यता शून्यतैव रूपम्', roman: 'ru-pam shun-ya-ta shun-ya-tai-va ru-pam', script: 'sa', x: 0.5, y: 0.075, size: 0.075, ink: 'shu' },
  { t0: 192.25, t1: 200.0, text: '彼[ひ]岸[がん]の 風[かぜ]に 私[わたし]は ほどける', script: 'ja', dir: 'v', x: 0.85, y: 0.1, size: 0.07, ink: 'sumi', unravel: true },
  { t0: 198.45, t1: 213.2, text: 'うまれず ほろびず 詩[うた]は 巡[めぐ]る', script: 'ja', dir: 'ring', x: 0.5, y: 0.5, size: 0.064, ink: 'sumi', radius: 0.36 },

  // Outro
  { t0: 223.9, t1: 230.5, text: 'बोधि स्वाहा', roman: 'bo-dhi sva-ha', script: 'sa', x: 0.5, y: 0.83, size: 0.068, ink: 'sumi' },
  // not on the lyric sheet: sung three more times at the very end, written
  // one under another beneath the ensō
  { t0: 238.95, t1: 250.6, text: 'प्रज्ञापारमिता', roman: 'praj-nya pa-ra-mi-ta', script: 'sa', x: 0.5, y: 0.775, size: 0.05, ink: 'sumi' },
  { t0: 243.05, t1: 250.9, text: 'प्रज्ञापारमिता', roman: 'praj-nya pa-ra-mi-ta', script: 'sa', x: 0.5, y: 0.845, size: 0.05, ink: 'sumi' },
  { t0: 246.65, t1: 251.2, text: 'प्रज्ञापारमिता', roman: 'praj-nya pa-ra-mi-ta', script: 'sa', x: 0.5, y: 0.915, size: 0.05, ink: 'sumi' },
  { t0: 249.45, t1: 257.8, text: 'ॐ', roman: 'om', script: 'sa', x: 0.78, y: 0.72, size: 0.14, ink: 'shu', seal: true },
];

// Attach the measured timings (alignment.js) to each sung line, matched by
// its sung text and which occurrence of that text it is.
{
  const seen = {};
  for (const c of CUES) {
    const name = c.deco ? `deco:${plain(c.text)}` : c.seal ? `seal:${plain(c.text)}`
      : c.script === 'sa' ? c.roman : parseRuby(c.text).map(g => g.reading || g.ch).join('');
    seen[name] = (seen[name] || 0) + 1;
    c.key = `${name}#${seen[name]}`;
    if (c.deco || c.seal) continue;
    const a = ALIGN[c.key];
    if (!a) continue;
    c.align = a;
    if (a.sylls) c.sylls = a.sylls;
    else c.sing = [a.start, a.end];
  }
}

// Every character the fonts need to cover.
export function charset(script) {
  const s = new Set();
  for (const c of CUES) if (c.script === script) for (const ch of plain(c.text)) if (ch !== ' ') s.add(ch);
  return [...s].join('');
}
