export const SAVE_KEY = 'sunset-city-save-v1';

export function saveGame(state) {
  try {
    const data = {
      cash: typeof state.cash === 'number' ? state.cash : 0,
      missionIndex: typeof state.missionIndex === 'number' ? state.missionIndex : 0,
      health: typeof state.health === 'number' ? state.health : 100,
      playerX: typeof state.playerX === 'number' ? state.playerX : 0,
      playerZ: typeof state.playerZ === 'number' ? state.playerZ : 0,
      driving: !!state.driving
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;

    const cash = typeof data.cash === 'number' && !isNaN(data.cash) ? data.cash : 0;
    const missionIndex = typeof data.missionIndex === 'number' && Number.isInteger(data.missionIndex) && data.missionIndex >= 0 && data.missionIndex <= 4 ? data.missionIndex : 0;
    const health = typeof data.health === 'number' && !isNaN(data.health) ? data.health : 100;
    const playerX = typeof data.playerX === 'number' && !isNaN(data.playerX) ? data.playerX : 0;
    const playerZ = typeof data.playerZ === 'number' && !isNaN(data.playerZ) ? data.playerZ : 0;
    const driving = !!data.driving;

    return { cash, missionIndex, health, playerX, playerZ, driving };
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

export function hasSave() {
  return loadGame() !== null;
}
