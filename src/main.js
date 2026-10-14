import './style.css';
import { App } from './ui/App.js';

const app = new App();
// 開發模式下可在 console 透過 window.td 檢查遊戲狀態
if (import.meta.env.DEV) window.td = app;
