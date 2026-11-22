// v9 final: the save-cap fix lets a save carry all 8 story missions.
// save.js — localStorage save / load for Surya Bay. Only plain numbers
// and strings are stored; nothing the game needs at boot depends on a
// save being present.
const KEY = "suryabay-save-v3";

export function saveGame(S) {
  try {
    const snapshot = {
      cash: Math.round(S.player.cash),
      missionIndex: S.missions.index,
      health: Math.round(S.player.health),
      armor: Math.round(S.player.armor),
      px: +S.player.pos.x.toFixed(1),
      pz: +S.player.pos.z.toFixed(1),
      carColor: S.player.carColor || 0xc0392b,
      muted: !!S.audio.muted,
      racesWon: S.player.racesWon || 0,
      hasShotgun: !!S.player.hasShotgun,
      shells: S.player.shells || 0,
      shellReserve: S.player.shellReserve || 0,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (!stored) return null;
    const data = JSON.parse(stored);
    if (typeof data.cash !== "number" || typeof data.missionIndex !== "number") return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (err) {
    // Storage may be unavailable; the game plays on without it.
  }
}
