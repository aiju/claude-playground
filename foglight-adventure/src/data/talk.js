// What the people of Foglight have to say. Each function returns the pages
// to show, depending on how far the story has got.

const has = (g, id) => !!g.save.items[id];

export const talk = {
  nan(g) {
    if (g.flag('lighthouseLit')) return ['Look at that sunshine pouring in! I knew you could do it, Pip.', 'I\'ve put the kettle on. Bring Hoot round for tea sometime.'];
    if (has(g, 'sunstone')) return ['Oh, it\'s warm as a hearth, that stone!', 'Gull Point is north-east, past the ruins. Off you go, and mind the stairs.'];
    if (!g.flag('metElder')) return ['Elder Moss is waiting for you by the well, dear.', 'And remember: {sword} swings your sword. Hold it down, then let go, for a spin!'];
    return ['Be careful out there, Pip. If you get tired, Tansy\'s seaweed tea perks anybody up.', 'Press {menu} to look in your satchel and choose which items go on {item1} and {item2}.'];
  },

  elder(g, self) {
    if (!g.flag('metElder')) {
      g.setFlag('metElder');
      return [
        'Ah... young Pip. Come closer. My eyes aren\'t what they were... ...nor are my ears... ...what was I saying?',
        'Ah yes. The LIGHTHOUSE on Gull Point has burned for a hundred years, lit by the SUNSTONE.',
        'Three nights ago a shadow called the GLOOM crept up the tower and swallowed its light. Hoot, the keeper, barely got away.',
        'Without the light the fog rolls in thicker every night... ...and monsters come with it.',
        'The old stories say a second Sunstone sleeps in the DROWNED SHRINE, out in Mirror Lake beyond the river.',
        'The way there is long. Start with the WHISPERING GROTTO in the woods to the north-west. Something useful grows down there, I\'m told.',
        '...Off you go then. I\'ll just... ...rest my eyes...',
      ];
    }
    if (g.flag('lighthouseLit')) return ['The fog is gone! I can see all the way to the mainland... ...or is that a cloud?', 'Splendid work, Pip. Splendid.'];
    if (has(g, 'sunstone')) return ['The Sunstone! Take it up the lighthouse, Pip. You\'ll need a way across the water at Gull Point... ...something cold, perhaps?'];
    if (has(g, 'frost')) return ['A FROST WAND! Water won\'t stop you now... ...and the Shrine\'s heart lies beyond the great sealed door.'];
    if (has(g, 'bombs')) return ['The Drowned Shrine sits in Mirror Lake, south of the river. A boulder blocks its causeway... ...but I suspect you know what to do with boulders now.'];
    if (g.flag('bridgeDown')) return ['Across the river, north, are the OLD RUINS. The shrine-keepers of old kept their puffball bombs there.', 'Keep your shield up. ...Oh. You don\'t have a shield. Keep your ears up, then.'];
    if (has(g, 'boomerang')) return ['A leaf that flies and comes back! Hmm... ...the DRAWBRIDGE east of the village is lowered by a lever on the far bank.', 'Something that flies out and returns might reach it...'];
    return ['The WHISPERING GROTTO is in the woods to the north-west. Go west, then north.', '...Mind the bats. Dreadful manners, bats.'];
  },

  dot(g) {
    if (g.flag('lighthouseLit')) return ['The sky is BLUE! I forgot it could do that!'];
    const lines = [
      ['Did you know Bramble catches fish on the south shore? He says the lake fish have gone all grumpy since the fog came.'],
      ['Tansy says if you hit a bush with your sword, sometimes shells fall out! Shells! From bushes!'],
      ['I saw a little light dancing in the meadow up north. Nan says it\'s a fairy, and fairies make you feel all better!'],
      ['If a monster has a shield, don\'t hit the shield, silly. Hit it where the shield isn\'t!'],
    ];
    return lines[Math.floor(g.time / 7) % lines.length];
  },

  mill(g) {
    if (g.flag('millReward')) return ['My lucky shell is back where it belongs. Thank you, Pip!'];
    if (has(g, 'luckyShell')) {
      g.setFlag('millReward');
      delete g.save.items.luckyShell;
      g.after(0.1, () => g.giveItem('heartPiece'));
      return ['My LUCKY SHELL! You found it! Where was it? ...Under a rock in Sunny Cove? Of course it was.', 'Here, I want you to have this. I found it in my cheese drawer. Don\'t ask.'];
    }
    return ['I lost my LUCKY SHELL! I was paddling in Sunny Cove, way over in the south-east, and a crab chased me and I dropped it.', 'It\'s all swirly and shiny. If you find it, I\'ll give you something nice!'];
  },

  bramble(g) {
    if (g.flag('lighthouseLit')) return ['...', 'Fish are biting again.', '...', 'Good job, kid.'];
    if (g.flag('shrineBoss')) return ['...You came out of that shrine smelling of eel.', '...Respect.'];
    return ['...', 'See that temple, out on the lake? The Drowned Shrine.', 'Something big lives under it. Coils round and round. Scares the fish.', '...Can\'t get there from here, mind. Lake\'s in the way. And the river.'];
  },

  hoot(g) {
    if (g.flag('lighthouseLit')) return ['WHOO-HOO! My light! My beautiful light! Pip, you\'re a marvel!'];
    if (has(g, 'sunstone') && has(g, 'frost')) return ['Is that... the SUNSTONE? Hoo! And a frost wand!', 'Freeze the water, cross to the tower and climb to the top. The Gloom is still up there. Be brave!'];
    if (has(g, 'sunstone')) return ['The SUNSTONE! Hoo hoo! But how to reach the tower... the Gloom smashed my boat to splinters.'];
    return [
      'Hoo... HOOO... Oh! A visitor. Forgive me, I\'m Hoot, keeper of the Gull Point light.',
      'Three nights ago the GLOOM came up out of the fog and swallowed the Sunstone\'s light whole. I only just flew out of the window.',
      'Without a Sunstone that tower is just a very tall stick. And I can\'t get back across. It smashed my boat, you see.',
    ];
  },

  tansy(g) {
    if (g.flag('lighthouseLit')) return ['Business is booming now the fog\'s gone! Well. Business is... present.'];
    return ['Welcome to Tansy\'s! If it\'s on the counter, it\'s for sale. If it\'s not on the counter, it\'s probably also for sale.', 'Just walk up to whatever you fancy and have a look.'];
  },

  elderHouse(g) {
    return ['(A diary lies open on the desk.)', '"Day 40 of the fog. Planted turnips. They were not turnips. They were bats."'];
  },
};
