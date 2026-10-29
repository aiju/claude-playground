// Reusable room scripts: shutter doors that stay shut until a condition is
// met, and hidden chests that appear when a puzzle is solved.

export function screenKey(g) { return `${g.sx},${g.sy}`; }

export function setShutters(g, closed) {
  const key = screenKey(g);
  for (const e of g.entities) if (e.kind === 'shutter' && e.setClosed && e.screenKey === key) e.setClosed(closed);
}

export function revealChests(g, flag) {
  for (const e of g.entities) if (e.reveal && e.revealFlag === flag) e.reveal();
}

const CONDS = {
  enemies: (g) => {
    const key = screenKey(g);
    return !g.entities.some((e) => !e.dead && e.screenKey === key && ((e.isEnemy && !e.ignoreForClear) || (e.isIce && e.enemy)));
  },
  torches: (g) => {
    const key = screenKey(g);
    const ts = g.entities.filter((e) => e.isTorch && e.screenKey === key);
    return ts.length > 0 && ts.every((t) => t.lit);
  },
  plates: (g) => {
    const key = screenKey(g);
    const ps = g.entities.filter((e) => e.isPlate && e.screenKey === key);
    return ps.length > 0 && ps.every((p) => p.pressed);
  },
};

// A room that is solved once `until` holds. Shutters close while it isn't,
// and hidden chests with revealFlag === flag appear when it is.
export function puzzleRoom({ flag, until = 'enemies', shutters = true, onSolve, onEnter }) {
  const cond = typeof until === 'function' ? until : CONDS[until];
  return {
    enter(g, st) {
      st.solved = g.flag(flag);
      st.t = 0;
      if (!st.solved && shutters) setShutters(g, true);
      if (onEnter) onEnter(g, st);
    },
    update(g, st, dt) {
      st.t += dt;
      if (st.solved || st.t < 0.5) return;
      if (cond(g)) {
        st.solved = true;
        g.setFlag(flag);
        if (shutters) setShutters(g, false);
        revealChests(g, flag);
        g.audio.sfx('secret');
        if (onSolve) onSolve(g, st);
      }
    },
  };
}
