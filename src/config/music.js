// 背景音樂設定：每張地圖主題一組調性與和弦進行（以音階級數表示，0 = 主音）
export const MUSIC_THEMES = [
  { root: 57, scale: [0, 2, 3, 5, 7, 8, 10], progression: [0, 5, 2, 6], arp: [0, 2, 4, 2, 4, 7, 4, 2] }, // 草原 A 小調
  { root: 50, scale: [0, 1, 4, 5, 7, 8, 10], progression: [0, 1, 0, 6], arp: [0, 2, 4, 5, 4, 2, 1, 2] }, // 沙漠 D 弗里吉亞屬
  { root: 52, scale: [0, 2, 3, 5, 7, 9, 10], progression: [0, 3, 5, 4], arp: [0, 4, 7, 9, 7, 4, 2, 4] }, // 雪原 E 多利安
  { root: 48, scale: [0, 2, 3, 5, 7, 8, 11], progression: [0, 5, 3, 4], arp: [0, 2, 0, 4, 0, 5, 0, 4] }, // 熔岩 C 和聲小調
  { root: 54, scale: [0, 1, 3, 5, 6, 8, 10], progression: [0, 6, 5, 1], arp: [0, 3, 6, 3, 1, 4, 6, 4] } // 虛空 F# 洛克利安
];

export const MUSIC_TEMPO = { calm: 92, battle: 124, boss: 140 };
