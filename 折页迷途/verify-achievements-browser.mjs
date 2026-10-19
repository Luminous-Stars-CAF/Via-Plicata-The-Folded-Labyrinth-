// 在隔离浏览器数据中实际三星完成 12 关，检查名牌、致谢、融合和 Boss 过渡。
import { LEVELS } from "./levels.js";

if (!process.env.PLAYWRIGHT_MODULE) throw Error("请设置 PLAYWRIGHT_MODULE");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXE ? { executablePath: process.env.BROWSER_EXE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, reducedMotion: process.env.CAPTURE ? "no-preference" : "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("http://127.0.0.1:8000/", { waitUntil: "networkidle" });
  await page.locator("#modal-close").click();
  await page.waitForFunction(() => window.__foldedPath.audioStatus().contextState === "running" && window.__foldedPath.audioStatus().scheduledBeats > 0);
  if (process.env.CAPTURE) await page.screenshot({ path: "qa-achievements-desktop.png", fullPage: true });
  if (await page.locator("#badge-shelf .achievement-badge").count() !== 12) throw Error("没有显示 12 枚名牌");
  if (await page.locator("#badge-shelf .earned").count() !== 0) throw Error("新存档不该已有名牌");

  for (let index = 0; index < LEVELS.length; index++) {
    const level = LEVELS[index];
    const result = await page.evaluate(({ index, tiles }) => {
      const api = window.__foldedPath;
      api.loadLevel(index, false);
      for (const tile of tiles) {
        if (tile.id === "a" || (index >= 6 && !tile.route)) continue;
        const goal = tile.solutionRotation ?? 0;
        const current = api.getState().tiles.find((item) => item.id === tile.id).rotation;
        const delta = (goal - current + 4) % 4;
        if (delta === 1) api.rotate(tile.id, 1);
        else if (delta === 2) { api.rotate(tile.id, 1); api.rotate(tile.id, 1); }
        else if (delta === 3) api.rotate(tile.id, -1);
      }
      api.startOrPause();
      for (let n = 0; n < 1500 && api.getState().phase === "running"; n++) api.step();
      return { phase: api.getState().phase, stars: api.getRecords()[index + 1]?.stars || 0, badges: document.querySelectorAll("#badge-shelf .earned").length, name: document.querySelector(`#badge-shelf [data-badge="${index + 1}"] .badge-title`)?.textContent };
    }, { index, tiles: level.tiles });
    if (result.phase !== "won" || result.stars !== 3 || result.badges !== index + 1 || result.name !== level.name) throw Error(`第 ${index + 1} 关名牌检查失败：${JSON.stringify(result)}`);
  }

  await page.locator("#finale-screen:not([hidden])").waitFor();
  if (process.env.CAPTURE) { await page.waitForTimeout(3500); await page.screenshot({ path: "qa-finale-credits.png" }); }
  if (await page.locator("#finale-credits .maker-list span").allTextContents().then((a) => a.join("|")) !== "Lyu Yanchen|Li Xinjie|Cong Yilong|Dong Yinzhi") throw Error("制作人署名不正确");
  if (await page.locator(".powered-text").textContent() !== "Powered by GPT-6 Astra") throw Error("Powered by 署名不正确");
  await page.locator("#finale-merge:not([hidden])").waitFor();
  if (process.env.CAPTURE) { await page.waitForTimeout(800); await page.screenshot({ path: "qa-finale-merge.png" }); }
  if (await page.locator("#merge-grid .achievement-badge").count() !== 12) throw Error("融合动画没有 12 枚名牌");
  await page.locator("#boss-screen:not([hidden])").waitFor();
  if (await page.evaluate(() => window.__foldedPath.audioMode()) !== "boss") throw Error("Boss 背景音乐未切换");
  if (await page.locator("#boss-badge-slot .locked").count() !== 1) throw Error("Boss 勋章未显示为待领取");
  await page.locator("#boss-exit").click();
  if (await page.evaluate(() => window.__foldedPath.audioMode()) !== "normal") throw Error("返回旅程后音乐未恢复");
  await page.locator("#sound-button").click();
  if (await page.evaluate(() => window.__foldedPath.audioStatus().enabled)) throw Error("音乐开关无法关闭");
  await page.locator("#sound-button").click();
  if (!await page.evaluate(() => window.__foldedPath.audioStatus().enabled)) throw Error("音乐开关无法重新打开");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#modal-close").click();
  if (await page.locator("#badge-shelf .earned").count() !== 12 || !await page.locator("#finale-replay").isVisible()) throw Error("刷新后名牌或终章重播入口丢失");
  if (await page.locator("#boss-badge-slot .locked").count() !== 1) throw Error("Boss 名牌未保持锁定");
  await page.locator("#finale-replay").click();
  await page.locator("#finale-screen:not([hidden])").waitFor();
  await page.locator("#finale-skip").click();
  await page.locator("#boss-screen:not([hidden])").waitFor();
  if (process.env.CAPTURE) { await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: "qa-achievements-mobile.png", fullPage: true }); }
  if (errors.length) throw Error(`浏览器报错：${errors.join(" | ")}`);
  console.log("12 关实际三星、12 枚名牌、终章署名、融合动画、Boss 过渡、音乐模式与返回均通过");
} finally {
  await browser.close();
}
