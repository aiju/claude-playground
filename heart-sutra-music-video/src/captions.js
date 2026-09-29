// Caption tracks for YouTube (tools/youtube-extras.mjs writes them). For
// every sung line: its romanization (Hepburn for the Japanese, IAST for the
// Sanskrit) and an English translation. Keyed by the line's key in lyrics.js
// without the occurrence number, so a line sung twice is translated once.
//
// The Japanese track shows the lyrics as written, with the Sanskrit
// romanized; `ja` overrides the text where the screen had to differ. The
// English track shows the romanization above each translation.

export const CAPTIONS = {
  'om': { roman: 'oṃ', en: 'Om' },
  'praj-nya pa-ra-mi-ta': { roman: 'prajñāpāramitā', en: 'The perfection of wisdom' },

  'ふかき ちえの うみのそこ': { roman: 'fukaki chie no umi no soko', en: 'At the bottom of the sea of deep wisdom' },
  'みるものは しずかに めをひらく': { roman: 'miru mono wa shizuka ni me o hiraku', en: 'The beholder quietly opens their eyes' },
  'かたちも こころも かぜのすな': { roman: 'katachi mo kokoro mo kaze no suna', en: 'Form and mind alike, sand on the wind' },
  'いつつの ひかりが ほどけてゆく': { roman: 'itsutsu no hikari ga hodokete yuku', en: 'The five lights come undone' },

  'なにも なくさず なにも えず': { roman: 'nani mo nakusazu nani mo ezu', en: 'Losing nothing, gaining nothing' },
  'ただ みちて ただ からっぽで': { roman: 'tada michite tada karappo de', en: 'Simply full, simply empty' },
  'ru-pam shun-ya-ta': { roman: 'rūpaṃ śūnyatā', en: 'Form is emptiness' },

  'しきそくぜくう': { roman: 'shiki soku ze kū', en: 'Form is emptiness' },
  'くうそくぜしき': { roman: 'kū soku ze shiki', en: 'Emptiness is form' },
  'shun-ya-tai-va ru-pam': { roman: 'śūnyataiva rūpam', en: 'Emptiness itself is form' },
  'この てのひらに うちゅうが すける': { roman: 'kono tenohira ni uchū ga sukeru', en: 'In this palm, the universe shows through' },
  'うまれず ほろびず ひかりは めぐる': { roman: 'umarezu horobizu hikari wa meguru', en: 'Unborn, undying, the light goes round' },

  'おそれの くさりも さかさまの ゆめも': { roman: 'osore no kusari mo sakasama no yume mo', en: 'The chains of fear, the upside-down dreams,' },
  // 罣礙 is the usual spelling; the screen shows 挂礙 as the brush font has no 罣
  'けいげなき こころに とけてゆく': { roman: 'keige naki kokoro ni tokete yuku', en: 'Melt into a mind without obstruction', ja: '罣礙なき 心に 溶けてゆく' },
  'むこうぎしで だれかが よんでいる': { roman: 'mukōgishi de dareka ga yonde iru', en: 'On the far shore, someone is calling' },
  'なまえの ない こえで': { roman: 'namae no nai koe de', en: 'With a voice that has no name' },

  'ふしょう ふめつ': { roman: 'fushō fumetsu', en: 'Neither arising nor ceasing' },
  'a-nut-pan-na a-ni-rud-dha': { roman: 'anutpannā aniruddhā', en: 'Unarisen, unceasing' },
  'ふく ふじょう': { roman: 'fuku fujō', en: 'Neither defiled nor pure' },
  'a-ma-la a-vi-ma-la': { roman: 'amalā avimalā', en: 'Not stained, not stainless' },
  'ふぞう ふげん': { roman: 'fuzō fugen', en: 'Neither increasing nor decreasing' },
  'a-nu-na a-pa-ri-pur-na': { roman: 'anūnā aparipūrṇāḥ', en: 'Not lacking, not complete' },

  'ぎゃてい ぎゃてい': { roman: 'gyatei gyatei', en: 'Gone, gone' },
  'はらぎゃてい': { roman: 'haragyatei', en: 'Gone beyond' },
  'はらそうぎゃてい': { roman: 'harasōgyatei', en: 'Gone altogether beyond' },
  'ぼじそわか': { roman: 'boji sowaka', en: 'Awakening, hail!' },
  'ga-te ga-te pa-ra-ga-te': { roman: 'gate gate pāragate', en: 'Gone, gone, gone beyond' },
  'pa-ra-sam-ga-te bo-dhi sva-ha': { roman: 'pārasaṃgate bodhi svāhā', en: 'Gone altogether beyond: awakening, hail!' },

  'ひがんの かぜに わたしは ほどける': { roman: 'higan no kaze ni watashi wa hodokeru', en: 'In the wind from the other shore, I come undone' },
  'うまれず ほろびず うたは めぐる': { roman: 'umarezu horobizu uta wa meguru', en: 'Unborn, undying, the song goes round' },
  'bo-dhi sva-ha': { roman: 'bodhi svāhā', en: 'Awakening, hail!' },
};
