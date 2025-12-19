/**
 * MapManager - 管理瓦片地圖系統
 * 負責地圖渲染、路徑提取、可建造區域檢測
 */

// 瓦片類型定義
export const TileTypes = {
    G: 'grass',      // 草皮（可建造）
    E: 'entrance',   // 入口（怪物出生點）
    X: 'exit',       // 出口（怪物終點）
    H: 'horizontal', // 水平路徑
    V: 'vertical',   // 垂直路徑
    TR: 'turnRight', // 轉角：從左→下 或 從上→右
    TL: 'turnLeft',  // 轉角：從右→下 或 從上→左
    BR: 'bottomRight', // 轉角：從左→上 或 從下→右
    BL: 'bottomLeft'   // 轉角：從右→上 或 從下→左
};

// 瓦片顏色配置（可愛粉彩風格）
const TileColors = {
    grass: { fill: 0x98E876, stroke: 0x7CD65A, light: 0xB8F898, flower: 0xFFB6D9 },
    path: { fill: 0xFFE4C4, stroke: 0xE8C9A8, inner: 0xFFF0DC, dots: 0xFFD4A8 },
    entrance: { fill: 0xFFB6C1, stroke: 0xFF6B8A, highlight: 0xFFD1DC },
    exit: { fill: 0xB6FFB6, stroke: 0x6BFF6B, highlight: 0xD1FFD1 }
};

export default class MapManager {
    constructor(scene) {
        this.scene = scene;
        this.TILE_SIZE = 50; // 與 TowerManager 的 GRID_SIZE 一致
        this.tiles = [];     // 2D 瓦片數據
        this.tileGraphics = null;
        this.pathWaypoints = [];
        this.entrancePos = null;
        this.exitPos = null;

        // 地圖偏移（UI 區域佔用 220px）
        this.offsetX = 225;
        this.offsetY = 25;
    }

    /**
     * 解析並創建地圖
     * @param {string[][]} mapData - 2D 瓦片類型陣列
     */
    createMap(mapData) {
        this.tiles = mapData;
        this.tileGraphics = this.scene.add.graphics();
        this.tileGraphics.setDepth(2);

        // 渲染每個瓦片
        for (let row = 0; row < mapData.length; row++) {
            for (let col = 0; col < mapData[row].length; col++) {
                const tileType = mapData[row][col];
                const worldX = this.offsetX + col * this.TILE_SIZE;
                const worldY = this.offsetY + row * this.TILE_SIZE;

                this.renderTile(worldX, worldY, tileType, row, col);

                // 記錄入口和出口位置
                if (tileType === 'E') {
                    this.entrancePos = { row, col, x: worldX + this.TILE_SIZE / 2, y: worldY + this.TILE_SIZE / 2 };
                } else if (tileType === 'X') {
                    this.exitPos = { row, col, x: worldX + this.TILE_SIZE / 2, y: worldY + this.TILE_SIZE / 2 };
                }
            }
        }

        // 從瓦片數據提取路徑
        this.extractPath();

        // 繪製入口和出口標記
        this.drawEntranceExitMarkers();

        return this.pathWaypoints;
    }

    /**
     * 渲染單個瓦片
     */
    renderTile(x, y, tileType, row, col) {
        const size = this.TILE_SIZE;
        const g = this.tileGraphics;

        if (tileType === 'G') {
            // 草皮瓦片 - 像素風格
            this.drawGrassTile(g, x, y, size);
        } else {
            // 路徑瓦片
            this.drawPathTile(g, x, y, size, tileType);
        }
    }

    /**
     * 繪製草皮瓦片（可愛粉彩風格）
     */
    drawGrassTile(g, x, y, size) {
        const colors = TileColors.grass;
        const padding = 2;

        // 基底綠色（圓角效果用填充模擬）
        g.fillStyle(colors.fill, 1);
        g.fillRoundedRect(x + padding, y + padding, size - padding * 2, size - padding * 2, 6);

        // 柔和高光
        g.fillStyle(colors.light, 0.4);
        g.fillRoundedRect(x + padding + 3, y + padding + 3, size / 2 - 6, size / 3 - 4, 4);

        // 可愛小草紋理（更軟萌的形狀）
        g.fillStyle(0xA8F088, 0.7);
        const grassPatterns = [
            { dx: 10, dy: 20 }, { dx: 25, dy: 12 }, { dx: 38, dy: 28 },
            { dx: 15, dy: 36 }, { dx: 32, dy: 40 }
        ];
        grassPatterns.forEach(p => {
            // 小草用圓形看起來更可愛
            g.fillCircle(x + p.dx, y + p.dy, 3);
            g.fillCircle(x + p.dx + 2, y + p.dy - 4, 2);
        });

        // 隨機小花朵裝飾（可愛度UP）
        if ((x + y) % 150 < 50) {
            g.fillStyle(colors.flower, 0.8);
            const flowerX = x + 20 + (x % 15);
            const flowerY = y + 25 + (y % 10);
            // 花瓣
            g.fillCircle(flowerX - 3, flowerY, 3);
            g.fillCircle(flowerX + 3, flowerY, 3);
            g.fillCircle(flowerX, flowerY - 3, 3);
            g.fillCircle(flowerX, flowerY + 3, 3);
            // 花心
            g.fillStyle(0xFFFF88, 1);
            g.fillCircle(flowerX, flowerY, 2);
        }
    }

    /**
     * 繪製路徑瓦片（可愛粉彩風格）
     */
    drawPathTile(g, x, y, size, tileType) {
        const colors = TileColors.path;
        const isEntrance = tileType === 'E';
        const isExit = tileType === 'X';
        const padding = 2;

        // 路徑基底色（圓角）
        const baseColor = isEntrance ? TileColors.entrance.fill :
            isExit ? TileColors.exit.fill : colors.fill;
        g.fillStyle(baseColor, 1);
        g.fillRoundedRect(x + padding, y + padding, size - padding * 2, size - padding * 2, 8);

        // 可愛圓點紋理
        g.fillStyle(colors.dots, 0.5);
        const dotPositions = [
            { dx: 12, dy: 12 }, { dx: 28, dy: 12 }, { dx: 40, dy: 12 },
            { dx: 8, dy: 25 }, { dx: 25, dy: 25 }, { dx: 42, dy: 25 },
            { dx: 12, dy: 38 }, { dx: 28, dy: 38 }, { dx: 40, dy: 38 }
        ];
        dotPositions.forEach(p => {
            g.fillCircle(x + p.dx, y + p.dy, 4);
        });

        // 柔和邊框 - 入口粉紅，出口薄荷綠，一般奶油色
        const strokeColor = isEntrance ? TileColors.entrance.stroke :
            isExit ? TileColors.exit.stroke : colors.stroke;
        const strokeWidth = (isEntrance || isExit) ? 3 : 2;

        g.lineStyle(strokeWidth, strokeColor, 0.7);
        g.strokeRoundedRect(x + padding, y + padding, size - padding * 2, size - padding * 2, 8);

        // 根據路徑類型繪製連接指示
        this.drawPathConnections(g, x, y, size, tileType);
    }

    /**
     * 繪製路徑連接方向指示
     */
    drawPathConnections(g, x, y, size, tileType) {
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const halfSize = size / 2;

        g.fillStyle(0xB8956A, 0.6);

        switch (tileType) {
            case 'H':
            case 'E':
            case 'X':  // 出口在此地圖中是水平連接
                // 水平路 - 左右開口
                g.fillRect(x, centerY - 8, size, 16);
                break;
            case 'V':
                // 垂直路 - 上下開口
                g.fillRect(centerX - 8, y, 16, size);
                break;
            case 'TR':
                // 轉角：從左來→向下去 或 從上來→向右去
                g.fillRect(x, centerY - 8, halfSize + 8, 16);
                g.fillRect(centerX - 8, centerY, 16, halfSize);
                break;
            case 'TL':
                // 轉角：從右來→向下去 或 從上來→向左去
                g.fillRect(centerX - 8, centerY - 8, halfSize + 8, 16);
                g.fillRect(centerX - 8, centerY, 16, halfSize);
                break;
            case 'BR':
                // 轉角：從左來→向上去 或 從下來→向右去
                g.fillRect(x, centerY - 8, halfSize + 8, 16);
                g.fillRect(centerX - 8, y, 16, halfSize + 8);
                break;
            case 'BL':
                // 轉角：從右來→向上去 或 從下來→向左去
                g.fillRect(centerX - 8, centerY - 8, halfSize + 8, 16);
                g.fillRect(centerX - 8, y, 16, halfSize + 8);
                break;
        }
    }

    /**
     * 繪製入口和出口標記（可愛風格）
     */
    drawEntranceExitMarkers() {
        if (this.entrancePos) {
            const { x, y } = this.entrancePos;
            // 可愛入口圖標
            this.scene.add.text(x, y - 5, '🚪', {
                fontSize: '28px',
                padding: { x: 2, y: 2 }
            }).setOrigin(0.5).setDepth(10);

            // 入口標籤（粉紅色系）
            this.scene.add.text(x, y + 22, '入口 ♡', {
                fontSize: '11px',
                color: '#FF6B8A',
                fontStyle: 'bold',
                stroke: '#FFFFFF',
                strokeThickness: 3,
                padding: { x: 2, y: 2 }
            }).setOrigin(0.5).setDepth(10);
        }

        if (this.exitPos) {
            const { x, y } = this.exitPos;
            // 可愛出口圖標
            this.scene.add.text(x, y - 5, '🏠', {
                fontSize: '28px',
                padding: { x: 2, y: 2 }
            }).setOrigin(0.5).setDepth(10);

            // 出口標籤（薄荷綠色系）
            this.scene.add.text(x, y + 22, '終點 ★', {
                fontSize: '11px',
                color: '#4CAF50',
                fontStyle: 'bold',
                stroke: '#FFFFFF',
                strokeThickness: 3,
                padding: { x: 2, y: 2 }
            }).setOrigin(0.5).setDepth(10);
        }
    }

    /**
     * 從瓦片數據提取敵人行進路徑
     */
    extractPath() {
        if (!this.entrancePos) {
            console.error('找不到入口瓦片！');
            return;
        }

        this.pathWaypoints = [];
        const visited = new Set();

        let current = { row: this.entrancePos.row, col: this.entrancePos.col };
        let prevDir = 'right'; // 入口初始方向

        // 添加入口作為起點
        this.pathWaypoints.push({
            x: this.getTileCenter(current.col, 'x'),
            y: this.getTileCenter(current.row, 'y')
        });
        visited.add(`${current.row},${current.col}`);

        // 沿著路徑找到出口
        let iterations = 0;
        const maxIterations = 500;

        while (iterations < maxIterations) {
            iterations++;

            const tileType = this.tiles[current.row]?.[current.col];
            if (!tileType) break;

            // 找到下一個路徑瓦片
            const nextDir = this.getNextDirection(current, prevDir, tileType);
            if (!nextDir) break;

            const next = this.getNextTile(current, nextDir);
            if (!next) break;

            const nextTileType = this.tiles[next.row]?.[next.col];
            if (!nextTileType || nextTileType === 'G') break;

            const key = `${next.row},${next.col}`;
            if (visited.has(key)) {
                console.warn('路徑循環檢測到，停止提取');
                break;
            }
            visited.add(key);

            // 添加路點
            this.pathWaypoints.push({
                x: this.getTileCenter(next.col, 'x'),
                y: this.getTileCenter(next.row, 'y')
            });

            // 到達出口？
            if (nextTileType === 'X') {
                break;
            }

            current = next;
            prevDir = nextDir;
        }

        console.log(`路徑提取完成，共 ${this.pathWaypoints.length} 個路點`);
    }

    /**
     * 根據當前瓦片類型和來向，決定下一個方向
     */
    getNextDirection(pos, fromDir, tileType) {
        // 定義每種瓦片類型的連接方向
        const connections = {
            'E': ['right'],
            'X': ['right'],  // 出口可從右邊進入（水平連接）
            'H': ['left', 'right'],
            'V': ['up', 'down'],
            'TR': ['left', 'down'],   // 從左來→向下走，或從下來→向左走（但我們是單向）
            'TL': ['right', 'down'],  // 從右來→向下走
            'BR': ['left', 'up'],     // 從左來→向上走
            'BL': ['right', 'up']     // 從右來→向上走
        };

        const dirs = connections[tileType] || [];

        // 反轉來向，找出離開方向
        const oppositeDir = { 'up': 'down', 'down': 'up', 'left': 'right', 'right': 'left' };
        const entryDir = oppositeDir[fromDir]; // 我們從哪個方向進入

        // 找到不是進入方向的那個出口
        for (const dir of dirs) {
            if (dir !== entryDir) {
                return dir;
            }
        }

        // 入口特殊處理
        if (tileType === 'E') return 'right';

        return null;
    }

    /**
     * 根據方向取得下一個瓦片座標
     */
    getNextTile(current, direction) {
        const moves = {
            'up': { row: -1, col: 0 },
            'down': { row: 1, col: 0 },
            'left': { row: 0, col: -1 },
            'right': { row: 0, col: 1 }
        };

        const move = moves[direction];
        if (!move) return null;

        return {
            row: current.row + move.row,
            col: current.col + move.col
        };
    }

    /**
     * 取得瓦片中心座標
     */
    getTileCenter(index, axis) {
        if (axis === 'x') {
            return this.offsetX + index * this.TILE_SIZE + this.TILE_SIZE / 2;
        } else {
            return this.offsetY + index * this.TILE_SIZE + this.TILE_SIZE / 2;
        }
    }

    /**
     * 檢查世界座標是否可建造
     */
    isBuildable(worldX, worldY) {
        const tile = this.getTileAtWorld(worldX, worldY);
        return tile === 'G';
    }

    /**
     * 取得世界座標對應的瓦片類型
     */
    getTileAtWorld(worldX, worldY) {
        const col = Math.floor((worldX - this.offsetX) / this.TILE_SIZE);
        const row = Math.floor((worldY - this.offsetY) / this.TILE_SIZE);

        if (row < 0 || row >= this.tiles.length) return null;
        if (col < 0 || col >= (this.tiles[row]?.length || 0)) return null;

        return this.tiles[row][col];
    }

    /**
     * 取得路徑點陣列（供敵人使用）
     */
    getPathWaypoints() {
        return this.pathWaypoints;
    }

    /**
     * 取得地圖邊界
     */
    getMapBounds() {
        const width = (this.tiles[0]?.length || 0) * this.TILE_SIZE;
        const height = this.tiles.length * this.TILE_SIZE;

        return {
            left: this.offsetX,
            right: this.offsetX + width,
            top: this.offsetY,
            bottom: this.offsetY + height
        };
    }

    /**
     * 清理資源
     */
    cleanup() {
        if (this.tileGraphics) {
            this.tileGraphics.destroy();
            this.tileGraphics = null;
        }
        this.tiles = [];
        this.pathWaypoints = [];
    }
}

// 預設地圖數據（用戶提供的螺旋形設計 - 已修正轉角）
export const DEFAULT_MAP = [
    ['G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G'],
    ['E', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'TR', 'G'],
    ['G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'V', 'G'],
    ['G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'V', 'G'],
    ['G', 'TL', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'TR', 'G', 'G', 'V', 'G'],
    ['G', 'V', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'V', 'G', 'G', 'V', 'G'],
    ['G', 'V', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'V', 'G', 'G', 'V', 'G'],
    ['G', 'V', 'G', 'G', 'X', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'BR', 'G', 'G', 'V', 'G'],
    ['G', 'V', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'V', 'G'],
    ['G', 'V', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'V', 'G'],
    ['G', 'BL', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'BR', 'G'],
    ['G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G']
];
