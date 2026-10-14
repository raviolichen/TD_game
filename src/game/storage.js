// localStorage 可能被封鎖（無痕模式等），所有存取都包在 try/catch 中
const SAVE_KEY = 'td-rewrite-save';
const BEST_KEY = 'td-rewrite-best';

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 忽略：儲存失敗不影響遊戲
  }
}

export const storage = {
  loadGame: () => read(SAVE_KEY),
  saveGame: (data) => write(SAVE_KEY, data),
  clearGame: () => write(SAVE_KEY, null),
  bestWave: () => read(BEST_KEY)?.wave ?? 0,
  recordBest(wave) {
    if (wave > this.bestWave()) write(BEST_KEY, { wave });
  }
};
