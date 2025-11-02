# Pixel Tower Defense - 像素塔防遊戲

[English Version](#english-version) | [中文版](#中文版)

---

## English Version

A cute pixel-art style tower defense game built with the Phaser 3 game engine and Vite. Players need to strategically build, upgrade, and craft various towers to defend against waves of enemies.

### Features

- **🗼 Rich Tower System**
  - **4 Base Towers**: Arrow, Fire, Ice, and Magic.
  - **5 Tier-2 Crafted Towers**: Including the high-speed Machine Gun Tower, the AoE Rocket Tower, and more.
  - **3 Ultimate Crafted Towers**: The devastating Ultimate Cannon, Frost Fortress, and Chaos Array.
  - **1 Super Ultimate Aura Tower**: Requires 3 ultimate towers to craft. Provides global buffs to all your towers. Multiple aura towers stack!

- **🔄 Tower Crafting & Upgrading**
  - **Crafting**: Combine two or three specific towers to create a more powerful, high-tier tower.
  - **Upgrading**: Spend gold to level up individual towers, enhancing their damage and range.

- **👾 Diverse Enemy Waves**
  - Normal waves get progressively stronger.
  - A powerful **BOSS** appears every 10 waves, granting special rewards upon defeat.
  - After wave 11, minions gain random abilities (speed boost, leap, defense, freeze towers).
  - After wave 100, enemy health doubles every wave (exponential growth)!

- **✨ Gorgeous Visual Effects**
  - Each tower has unique attack, hit, and upgrade effects.
  - Utilizes Phaser's particle system for explosions, chain lightning, freezes, and more.

- **🎮 Intuitive UI & Interaction**
  - A clear information panel displays your gold, lives, score, and other statuses.
  - Simple click-based controls for building, selecting, and crafting towers.

### How to Play

1.  **Build Base Towers**: Select a base tower from the left UI panel and click on a non-path area on the map to build it.
2.  **Defend Against Enemies**: Towers automatically attack enemies within their range. Defeating enemies earns you gold.
3.  **Upgrade Towers**: Click on a built tower, then click the "Upgrade" button in the pop-up panel to enhance it. Upgrades are capped by the current wave number.
4.  **Craft Towers**:
    - Click the "Craft Tower" button in the UI to enter crafting mode.
    - Sequentially click on the 2 or 3 towers on the map you wish to combine.
    - If the combination is valid, they will automatically merge into a new, stronger tower.
5.  **Challenge the BOSS**: Prepare your defenses for the BOSS challenge that occurs every 10 waves!
6.  **Goal**: Survive as many waves as possible and achieve the highest score!

### Installation and Running

Make sure you have [Node.js](https://nodejs.org/) installed (version 18.x or higher is recommended).

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/pixel-tower-defense.git
    cd pixel-tower-defense
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start the development server**
    ```bash
    npm run dev
    ```
    The game will automatically open in your browser at `http://localhost:3000`.

4.  **Build for production**
    ```bash
    npm run build
    ```
    The bundled files will be generated in the `dist` folder.

### Tech Stack

- **Game Engine**: [Phaser 3](https://phaser.io/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: JavaScript (ES6+)

### Project Structure

```
/
├── src/
│   ├── config/
│   │   └── towerConfig.js      # Tower configurations (all tower stats, recipes)
│   ├── entities/
│   │   ├── Enemy.js            # Enemy entity class
│   │   └── Tower.js            # Tower entity class
│   ├── scenes/
│   │   └── GameScene.js        # Core game scene (main logic)
│   └── main.js                 # Game entry point, Phaser initialization
├── index.html                  # HTML entry file
├── package.json                # Project dependencies and scripts
└── vite.config.js              # Vite configuration file
```

---

## 中文版

這是一款使用 Phaser 3 遊戲引擎和 Vite 開發的可愛像素風格塔防遊戲。玩家需要策略性地建造、升級和合成各種功能的防禦塔，以抵禦一波又一波的敵人。

### 功能特色

- **🗼 豐富的塔防系統**
  - **4種基礎塔**: 箭塔、火焰塔、冰霜塔、魔法塔。
  - **5種中階合成塔**: 如高射速的機槍塔、範圍傷害的火箭塔等。
  - **3種終極合成塔**: 擁有毀滅性力量的終極炮塔、極寒要塞、混沌法陣。
  - **1種超終極光環塔**: 需3座終極塔合成。為全地圖的塔提供增益效果。多座光環塔效果可疊加！

- **🔄 塔的合成與升級**
  - **合成**: 將兩座或三座指定的塔合成為更強大的高階塔。
  - **升級**: 消耗金幣提升單座塔的等級，增強其傷害和射程。

- **👾 多樣的敵人波次**
  - 普通波次隨時間增強。
  - 每10波會出現強大的 **BOSS**，擊敗後有特殊獎勵。
  - 第11波起，小怪開始獲得隨機技能（加速、跳躍、防禦、凍結塔）。
  - 第100波後，怪物血量每波翻倍（指數成長）！

- **✨ 華麗的視覺特效**
  - 每種塔都有獨特的攻擊、命中和升級特效。
  - 使用 Phaser 的粒子系統實現爆炸、閃電鏈、冰凍等多種效果。

- **🎮 直觀的UI與互動**
  - 清晰的資訊面板顯示金幣、生命、分數等狀態。
  - 簡單的點擊操作即可完成塔的建造、選擇和合成。

### 玩法說明

1.  **建造基礎塔**: 從左側UI欄選擇一種基礎塔，點擊地圖上的非路徑區域進行建造。
2.  **抵禦敵人**: 塔會自動攻擊進入其射程的敵人。消滅敵人可以獲得金幣。
3.  **升級塔**: 點擊已建造的塔，在彈出的面板中點擊「升級」按鈕來強化它。升級受當前波數限制。
4.  **合成塔**:
    - 點擊左側UI欄的「合成塔」按鈕進入合成模式。
    - 依次點擊地圖上2至3座想要合成的塔。
    - 如果組合正確，它們會自動合成為一座更強大的新塔。
5.  **挑戰BOSS**: 準備好你的防線，迎接每10波一次的BOSS挑戰！
6.  **目標**: 盡可能存活更長的波次，獲得更高的分數！

### 安裝與執行

請確保你的電腦已安裝 [Node.js](https://nodejs.org/) (建議版本 18.x 或更高)。

1.  **clone專案**
    ```bash
    git clone https://github.com/your-username/pixel-tower-defense.git
    cd pixel-tower-defense
    ```

2.  **安裝依賴**
    ```bash
    npm install
    ```

3.  **啟動開發伺服器**
    ```bash
    npm run dev
    ```
    遊戲將在瀏覽器的 `http://localhost:3000` 上自動開啟。

4.  **打包專案**
    ```bash
    npm run build
    ```
    打包後的檔案會生成在 `dist` 資料夾中。

### 技術棧

- **遊戲引擎**: [Phaser 3](https://phaser.io/)
- **開發工具**: [Vite](https://vitejs.dev/)
- **語言**: JavaScript (ES6+)

### 專案結構

```
/
├── src/
│   ├── config/
│   │   └── towerConfig.js      # 塔的設定檔 (所有塔的屬性、合成配方)
│   ├── entities/
│   │   ├── Enemy.js            # 敵人實體類
│   │   └── Tower.js            # 塔的實體類
│   ├── scenes/
│   │   └── GameScene.js        # 核心遊戲場景 (主要邏輯)
│   └── main.js                 # 遊戲入口，Phaser實例化
├── index.html                  # HTML 入口檔案
├── package.json                # 專案依賴與腳本
└── vite.config.js              # Vite 設定檔
```
