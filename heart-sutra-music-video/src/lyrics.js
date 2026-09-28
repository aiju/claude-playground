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
// sing:   optional [start, end] of the singing, if it isn't right after t0
//         (see schedule.js for how syllables are spread otherwise).
//
// The sutra quotations (色即是空…, 不生不滅…, 羯諦…) are sung as their
// Japanese readings; they are shown in kanji so the screen carries the
// characters themselves.

import { plain } from './schedule.js';

export const CUES = [
  // Intro
  { t0: 1.0, t1: 10.6, text: 'ॐ', roman: 'om', script: 'sa', x: 0.5, y: 0.5, size: 0.30, ink: 'gold' },
  { t0: 11.2, t1: 20.8, text: 'प्रज्ञापारमिता', roman: 'praj-nya pa-ra-mi-ta', script: 'sa', x: 0.5, y: 0.8, size: 0.085, ink: 'gold' },
  { t0: 22.0, t1: 35.8, text: 'प्रज्ञापारमिता', roman: 'praj-nya pa-ra-mi-ta', script: 'sa', x: 0.66, y: 0.24, size: 0.11, ink: 'gold' },

  // Verse 1
  { t0: 37.0, t1: 43.6, text: '深[ふか]き 智[ち]慧[え]の 海[うみ]の底[そこ]', script: 'ja', dir: 'v', x: 0.84, y: 0.14, size: 0.078, ink: 'gold' },
  { t0: 42.8, t1: 49.4, text: '観[み]る者[もの]は 静[しず]かに 目[め]を開[ひら]く', script: 'ja', dir: 'v', x: 0.14, y: 0.10, size: 0.072, ink: 'gold' },
  { t0: 48.7, t1: 55.6, text: 'かたちも こころも 風[かぜ]の砂[すな]', script: 'ja', dir: 'h', x: 0.5, y: 0.83, size: 0.074, ink: 'gold' },
  { t0: 55.0, t1: 66.8, text: '五[いつ]つの ひかりが ほどけてゆく', script: 'ja', dir: 'v', x: 0.88, y: 0.08, size: 0.070, ink: 'gold' },
  // the five skandhas (五蘊), one inside each light; not sung, they come undone with the lights
  { t0: 55.4, t1: 61.5, text: '色[しき]', script: 'ja', dir: 'h', x: 0.5, y: 0.28, size: 0.05, ink: 'gold', deco: true },
  { t0: 55.8, t1: 62.0, text: '受[じゅ]', script: 'ja', dir: 'h', x: 0.3875, y: 0.425, size: 0.05, ink: 'gold', deco: true },
  { t0: 56.1, t1: 62.5, text: '想[そう]', script: 'ja', dir: 'h', x: 0.4305, y: 0.66, size: 0.05, ink: 'gold', deco: true },
  { t0: 56.5, t1: 63.0, text: '行[ぎょう]', script: 'ja', dir: 'h', x: 0.5695, y: 0.66, size: 0.05, ink: 'gold', deco: true },
  { t0: 56.8, t1: 63.5, text: '識[しき]', script: 'ja', dir: 'h', x: 0.6125, y: 0.425, size: 0.05, ink: 'gold', deco: true },

  // Pre-chorus
  { t0: 68.3, t1: 73.8, text: '何[なに]も 失[な]くさず 何[なに]も 得[え]ず', script: 'ja', dir: 'v', x: 0.80, y: 0.12, size: 0.074, ink: 'gold' },
  { t0: 72.2, t1: 78.0, text: 'ただ 満[み]ちて ただ 空[から]っぽで', script: 'ja', dir: 'v', x: 0.20, y: 0.12, size: 0.074, ink: 'gold' },
  { t0: 75.8, t1: 79.6, text: 'रूपं शून्यता', roman: 'ru-pam shun-ya-ta', script: 'sa', x: 0.5, y: 0.5, size: 0.10, ink: 'gold' },

  // Chorus
  { t0: 79.0, t1: 86.2, text: '色[しき]即[そく]是[ぜ]空[くう]', script: 'ja', dir: 'v', x: 0.84, y: 0.12, size: 0.17, ink: 'sumi' },
  { t0: 82.0, t1: 86.2, text: '空[くう]即[そく]是[ぜ]色[しき]', script: 'ja', dir: 'v', x: 0.16, y: 0.12, size: 0.17, ink: 'sumi' },
  { t0: 85.2, t1: 91.6, text: 'रूपं शून्यता शून्यतैव रूपम्', roman: 'ru-pam shun-ya-ta shun-ya-tai-va ru-pam', script: 'sa', x: 0.5, y: 0.86, size: 0.075, ink: 'shu' },
  { t0: 91.0, t1: 98.2, text: 'この てのひらに 宇[う]宙[ちゅう]が 透[す]ける', script: 'ja', dir: 'v', x: 0.86, y: 0.10, size: 0.068, ink: 'sumi' },
  { t0: 98.0, t1: 106.0, text: 'うまれず ほろびず 光[ひかり]は 巡[めぐ]る', script: 'ja', dir: 'ring', x: 0.5, y: 0.5, size: 0.064, ink: 'sumi', radius: 0.36 },

  // Verse 2
  { t0: 122.6, t1: 130.0, text: '恐[おそ]れの 鎖[くさり]も さかさまの 夢[ゆめ]も', script: 'ja', dir: 'v', x: 0.12, y: 0.06, size: 0.062, ink: 'sumi', mirror: 0.62 },
  { t0: 129.5, t1: 137.0, text: 'けいげなき 心[こころ]に 溶[と]けてゆく', script: 'ja', dir: 'v', x: 0.88, y: 0.08, size: 0.066, ink: 'sumi' },
  { t0: 136.5, t1: 144.0, text: '向[む]こう岸[ぎし]で 誰[だれ]かが 呼[よ]んでいる', script: 'ja', dir: 'h', x: 0.5, y: 0.2, size: 0.066, ink: 'sumi' },
  { t0: 143.5, t1: 150.6, text: '名[な]前[まえ]の ない 声[こえ]で', script: 'ja', dir: 'h', x: 0.5, y: 0.8, size: 0.07, ink: 'indigo' },

  // Bridge: call (left, sumi) and response (right, vermilion)
  { t0: 150.7, t1: 156.6, text: '不[ふ]生[しょう] 不[ふ]滅[めつ]', script: 'ja', dir: 'v', x: 0.1, y: 0.1, size: 0.13, ink: 'sumi' },
  { t0: 153.7, t1: 156.8, text: 'अनुत्पन्ना अनिरुद्धा', roman: 'a-nut-pan-na a-ni-rud-dha', script: 'sa', x: 0.74, y: 0.2, size: 0.075, ink: 'shu' },
  { t0: 156.7, t1: 162.6, text: '不[ふ]垢[く] 不[ふ]浄[じょう]', script: 'ja', dir: 'v', x: 0.1, y: 0.1, size: 0.13, ink: 'sumi' },
  { t0: 159.7, t1: 162.8, text: 'अमला अविमला', roman: 'a-ma-la a-vi-ma-la', script: 'sa', x: 0.74, y: 0.2, size: 0.08, ink: 'shu' },
  { t0: 162.7, t1: 168.8, text: '不[ふ]増[ぞう] 不[ふ]減[げん]', script: 'ja', dir: 'v', x: 0.1, y: 0.1, size: 0.13, ink: 'sumi' },
  { t0: 165.7, t1: 169.0, text: 'अनूना अपरिपूर्णाः', roman: 'a-nu-na a-pa-ri-pur-na', script: 'sa', x: 0.74, y: 0.2, size: 0.075, ink: 'shu' },

  // Build
  { t0: 169.0, t1: 172.6, text: '羯[ぎゃ]諦[てい] 羯[ぎゃ]諦[てい]', script: 'ja', dir: 'v', x: 0.82, y: 0.16, size: 0.12, ink: 'sumi' },
  { t0: 172.4, t1: 175.9, text: '波[は]羅[ら]羯[ぎゃ]諦[てい]', script: 'ja', dir: 'v', x: 0.62, y: 0.14, size: 0.13, ink: 'sumi' },
  { t0: 175.8, t1: 179.3, text: '波[は]羅[ら]僧[そう]羯[ぎゃ]諦[てい]', script: 'ja', dir: 'v', x: 0.40, y: 0.10, size: 0.135, ink: 'sumi' },
  { t0: 179.2, t1: 182.9, text: '菩[ぼ]提[じ]薩[そ]婆[わ]訶[か]', script: 'ja', dir: 'v', x: 0.18, y: 0.08, size: 0.15, ink: 'sumi' },

  // Climax
  { t0: 182.4, t1: 189.2, text: 'गते गते पारगते', roman: 'ga-te ga-te pa-ra-ga-te', script: 'sa', x: 0.5, y: 0.2, size: 0.13, ink: 'gold' },
  { t0: 189.0, t1: 195.6, text: 'पारसंगते बोधि स्वाहा', roman: 'pa-ra-sam-ga-te bo-dhi sva-ha', script: 'sa', x: 0.5, y: 0.82, size: 0.12, ink: 'gold' },
  { t0: 195.5, t1: 201.6, text: 'गते गते पारगते', roman: 'ga-te ga-te pa-ra-ga-te', script: 'sa', x: 0.3, y: 0.3, size: 0.075, ink: 'shu', echo: true },
  { t0: 201.5, t1: 208.0, text: 'पारसंगते बोधि स्वाहा', roman: 'pa-ra-sam-ga-te bo-dhi sva-ha', script: 'sa', x: 0.7, y: 0.72, size: 0.075, ink: 'shu', echo: true },

  // Final chorus
  { t0: 211.5, t1: 218.0, text: '色[しき]即[そく]是[ぜ]空[くう]', script: 'ja', dir: 'v', x: 0.84, y: 0.12, size: 0.17, ink: 'sumi' },
  { t0: 214.5, t1: 218.0, text: '空[くう]即[そく]是[ぜ]色[しき]', script: 'ja', dir: 'v', x: 0.16, y: 0.12, size: 0.17, ink: 'sumi' },
  { t0: 217.6, t1: 223.6, text: 'रूपं शून्यता शून्यतैव रूपम्', roman: 'ru-pam shun-ya-ta shun-ya-tai-va ru-pam', script: 'sa', x: 0.5, y: 0.075, size: 0.075, ink: 'shu' },
  { t0: 223.8, t1: 230.6, text: '彼[ひ]岸[がん]の 風[かぜ]に 私[わたし]は ほどける', script: 'ja', dir: 'v', x: 0.85, y: 0.1, size: 0.07, ink: 'sumi', unravel: true },
  { t0: 230.5, t1: 240.4, text: 'うまれず ほろびず 詩[うた]は 巡[めぐ]る', script: 'ja', dir: 'ring', x: 0.5, y: 0.5, size: 0.064, ink: 'sumi', radius: 0.36 },

  // Outro
  { t0: 241.0, t1: 248.5, text: 'बोधि स्वाहा', roman: 'bo-dhi sva-ha', script: 'sa', x: 0.5, y: 0.78, size: 0.07, ink: 'sumi' },
  { t0: 249.5, t1: 257.8, text: 'ॐ', roman: 'om', script: 'sa', x: 0.78, y: 0.72, size: 0.14, ink: 'shu', seal: true },
];

// Every character the fonts need to cover.
export function charset(script) {
  const s = new Set();
  for (const c of CUES) if (c.script === script) for (const ch of plain(c.text)) if (ch !== ' ') s.add(ch);
  return [...s].join('');
}
