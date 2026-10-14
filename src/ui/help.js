import { MAX_LEVEL, MAX_STAR, POWER_TILE_BONUS, RECIPE_MIN_STAR, SELL_RATIO, WAVES_PER_MAP, VICTORY_WAVE, RELOCATE_BONUS } from '../config/constants.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { BASIC_TOWERS, RECIPES, TOWER_TYPES } from '../config/towers.js';

const swatch = (def) => `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${def.color};margin-right:4px"></span>`;

export function renderHelp() {
  const basics = BASIC_TOWERS.map((k) => {
    const d = TOWER_TYPES[k];
    return `<tr><td>${swatch(d)}${d.name} <kbd>${d.hotkey}</kbd></td><td>${d.cost}</td><td>${d.desc}</td></tr>`;
  }).join('');
  const recipes = RECIPES.map((r) => {
    const d = TOWER_TYPES[r.result];
    return `<tr><td>${TOWER_TYPES[r.a].name} + ${TOWER_TYPES[r.b].name}</td><td>${swatch(d)}<b>${d.name}</b></td><td>${d.desc}</td></tr>`;
  }).join('');
  const enemies = Object.values(ENEMY_TYPES).map((d) => `<tr><td>${swatch(d)}${d.name}</td><td>第 ${d.unlock} 波起</td><td>${[
    d.armor && `護甲 ${Math.round(d.armor * 100)}%`,
    d.mr && `魔抗 ${Math.round(d.mr * 100)}%`,
    d.flying && '飛行：直線飛向終點，砲塔與毒霧塔打不到',
    d.heal && '治療周圍敵人',
    d.splitInto && '死亡時分裂成蟲群',
    d.boss && `每 10 波出現，漏掉扣 ${d.lives} 命`,
    d.speed >= 1.5 && '移動速度快'
  ].filter(Boolean).join('，') || '一般單位'}</td></tr>`).join('');

  return `
    <h3>目標</h3>
    <p>阻止敵人走到出口。每漏掉一隻敵人會扣生命，生命歸零遊戲結束。撐過第 ${VICTORY_WAVE} 波即獲勝，之後可繼續無盡模式。</p>
    <h3>地圖變遷 🌍</h3>
    <p>每 ${WAVES_PER_MAP} 波地圖會變化一次（地形、路徑、能量格都不同）。變遷時所有塔會收進<b>倉庫</b>，並獲得 ${RELOCATE_BONUS} 金遷移補助。
    點選倉庫中的塔，再點擊新地圖上的空地即可<b>免費</b>重新部署；也可以直接賣掉，或把倉庫的塔合成到地圖上的塔。</p>
    <h3>升級與合成</h3>
    <ul>
      <li><b>升級</b>：花金幣提升等級（最高 Lv${MAX_LEVEL}），提升傷害、射程與攻速。</li>
      <li><b>同種合成</b>：兩座同種、同星的塔合成為星等 +1（最高 ${'★'.repeat(MAX_STAR)}），等級取兩者較高者。每顆星傷害 ×1.8。</li>
      <li><b>配方合成</b>：兩座不同種、皆 ≥ ${'★'.repeat(RECIPE_MIN_STAR)} 的塔可依配方合成強力的特殊塔。</li>
      <li>操作：選取塔後按「合成」再點目標，或直接把塔<b>拖曳</b>到另一座塔上。</li>
      <li><b>賣出</b>：退還 ${Math.round(SELL_RATIO * 100)}% 投入的金幣。</li>
      <li>金色 ✦ <b>能量格</b>：蓋在上面的塔傷害 +${Math.round(POWER_TILE_BONUS * 100)}%。</li>
    </ul>
    <h3>經濟</h3>
    <p>擊殺敵人獲得金幣；每波結束有過關獎勵，並依持有金幣給 3% 利息（上限 30）。</p>
    <h3>基本塔</h3>
    <table><tr><th>塔</th><th>價格</th><th>特性</th></tr>${basics}</table>
    <h3>合成配方</h3>
    <table><tr><th>材料（皆需 ≥ ${'★'.repeat(RECIPE_MIN_STAR)}）</th><th>結果</th><th>特性</th></tr>${recipes}</table>
    <h3>敵人</h3>
    <table><tr><th>敵人</th><th>出現</th><th>特性</th></tr>${enemies}</table>
    <h3>快捷鍵</h3>
    <p><kbd>1</kbd>–<kbd>6</kbd> 建塔　<kbd>空白</kbd> 開始下一波　<kbd>U</kbd> 升級　<kbd>M</kbd> 合成　<kbd>S</kbd> 賣出　<kbd>T</kbd> 切換目標
    <kbd>P</kbd> 暫停　<kbd>F</kbd> 速度　<kbd>H</kbd> 說明　<kbd>Esc</kbd>/右鍵 取消</p>`;
}
