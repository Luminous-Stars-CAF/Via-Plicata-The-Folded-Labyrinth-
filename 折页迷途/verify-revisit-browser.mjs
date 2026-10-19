// 用真正的浏览器游戏逻辑验证双程关、假路失败与记录，不修改用户浏览器数据。
import { LEVELS } from "./levels.js";

const playwrightUrl = process.env.PLAYWRIGHT_MODULE;
if (!playwrightUrl) throw Error("请设置 PLAYWRIGHT_MODULE 为 Playwright 的 index.mjs 文件路径");
const { chromium } = await import(playwrightUrl);
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXE ? { executablePath: process.env.BROWSER_EXE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(120_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("http://127.0.0.1:8000/", { waitUntil: "networkidle" });
  for (const [id, decoy] of [[9, false], [9, true], [10, false], [10, true], [11, false], [11, true], [12, false], [12, true]]) {
    const level = LEVELS[id - 1];
    const result = await page.evaluate(({ index, tiles, decoy }) => {
      const api = window.__foldedPath;
      api.loadLevel(index, false);
      for (const tile of tiles) {
        if (tile.id === "a") continue;
        const goal = (tile.solutionRotation + (decoy && tile.id === "b" ? 2 : 0)) % 4;
        const current = api.getState().tiles.find((item) => item.id === tile.id).rotation;
        const clockwise = (goal - current + 4) % 4;
        if (clockwise === 1) api.rotate(tile.id, 1);
        else if (clockwise === 2) { api.rotate(tile.id, 1); api.rotate(tile.id, 1); }
        else if (clockwise === 3) api.rotate(tile.id, -1);
      }
      api.startOrPause();
      for (let step = 0; step < 1000 && api.getState().phase === "running"; step++) api.step();
      const state = api.getState();
      return { phase: state.phase, used: state.used, hasKey: state.hasKey, message: document.querySelector("#modal-message").textContent, rating: api.getRecords()[index + 1]?.stars || 0 };
    }, { index: id - 1, tiles: level.tiles, decoy });
    if (decoy) {
      if (result.phase !== "failed" || result.hasKey || !result.message.includes("钥匙")) throw Error(`第 ${id} 关假路没有在远端失败：${JSON.stringify(result)}`);
    } else if (result.phase !== "won" || result.used !== level.par || result.rating !== 3) {
      throw Error(`第 ${id} 关浏览器实际通关失败：${JSON.stringify(result)}`);
    }
    console.log({ level: id, decoy, ...result });
  }
  if (errors.length) throw Error(`浏览器控制台报错：${errors.join(" | ")}`);
} finally {
  await browser.close();
}
