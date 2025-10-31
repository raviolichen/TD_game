# Pixel Tower Defense - 像素塔防遊戲

這是一款使用 Phaser 3 遊戲引擎和 Vite 開發的可愛像素風格塔防遊戲。玩家需要策略性地建造、升級和合成各種功能的防禦塔，以抵禦一波又一波的敵人。

This is a cute pixel-art style tower defense game built with the Phaser 3 game engine and Vite. Players need to strategically build, upgrade, and craft various towers to defend against waves of enemies.


---

## 目錄 (Table of Contents)
- [功能特色 (Features)](#功能特色-features)
- [玩法說明 (How to Play)](#玩法說明-how-to-play)
- [安裝與執行 (Installation and Running)](#安裝與執行-installation-and-running)
- [技術棧 (Tech Stack)](#技術棧-tech-stack)
- [專案結構 (Project Structure)](#專案結構-project-structure)

---

## 功能特色 (Features)

- **🗼 豐富的塔防系統 (Rich Tower System)**
  - **4種基礎塔**: 箭塔、火焰塔、冰霜塔、魔法塔。
  - **5種中階合成塔**: 如高射速的機槍塔、範圍傷害的火箭塔等。
  - **3種終極合成塔**: 擁有毀滅性力量的終極炮塔、極寒要塞、混沌法陣。
  - **1種超終極光環塔**: 為全地圖的塔提供增益效果。

- **🔄 塔的合成與升級 (Tower Crafting & Upgrading)**
  - **合成**: 將兩座或三座指定的塔拖曳合成為更強大的高階塔。
  - **升級**: 消耗金幣提升單座塔的等級，增強其傷害和射程。

- **👾 多樣的敵人波次 (Diverse Enemy Waves)**
  - 普通波次隨時間增強。
  - 每10波會出現強大的 **BOSS**，擊敗後有特殊獎勵。

- **✨ 華麗的視覺特效 (Gorgeous Visual Effects)**
  - 每種塔都有獨特的攻擊、命中和升級特效。
  - 使用 Phaser 的粒子系統實現爆炸、閃電鏈、冰凍等多種效果。

- **🎮 直觀的UI與互動 (Intuitive UI & Interaction)**
  - 清晰的資訊面板顯示金幣、生命、分數等狀態。
  - 簡單的點擊操作即可完成塔的建造、選擇和合成。

---

## 玩法說明 (How to Play)

1.  **建造基礎塔**: 從左側UI欄選擇一種基礎塔，點擊地圖上的非路徑區域進行建造。
2.  **抵禦敵人**: 塔會自動攻擊進入其射程的敵人。消滅敵人可以獲得金幣。
3.  **升級塔**: 點擊已建造的塔，在彈出的面板中點擊「升級」按鈕來強化它。升級受當前波數限制。
4.  **合成塔**:
    - 點擊左側UI欄的「合成塔」按鈕進入合成模式。
    - 依次點擊地圖上2至3座想要合成的塔。
    - 如果組合正確，它們會自動合成為一座更強大的新塔。
5.  **挑戰BOSS**: 準備好你的防線，迎接每10波一次的BOSS挑戰！
6.  **目標**: 盡可能存活更長的波次，獲得更高的分數！

---

## 安裝與執行 (Installation and Running)

請確保你的電腦已安裝 [Node.js](https://nodejs.org/) (建議版本 18.x 或更高)。

Make sure you have [Node.js](https://nodejs.org/) installed (version 18.x or higher is recommended).

1.  **克隆專案 (Clone the repository)**
    ```bash
    git clone https://github.com/your-username/pixel-tower-defense.git
    cd pixel-tower-defense
    ```

2.  **安裝依賴 (Install dependencies)**
    ```bash
    npm install
    ```

3.  **啟動開發伺服器 (Start the development server)**
    ```bash
    npm run dev
    ```
    遊戲將在瀏覽器的 `http://localhost:3000` 上自動開啟。

4.  **打包專案 (Build for production)**
    ```bash
    npm run build
    ```
    打包後的檔案會生成在 `dist` 資料夾中。

---

## 技術棧 (Tech Stack)

- **遊戲引擎 (Game Engine)**: [Phaser 3](https://phaser.io/)
- **開發工具 (Build Tool)**: [Vite](https://vitejs.dev/)
- **語言 (Language)**: JavaScript (ES6+)

---

## 專案結構 (Project Structure)

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