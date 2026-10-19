// 浏览器端验收：仅在独立临时浏览器上下文注入十二关三星测试记录。
const playwrightUrl = process.env.PLAYWRIGHT_MODULE;
if (!playwrightUrl) throw Error("请设置 PLAYWRIGHT_MODULE 为 Playwright 的 index.mjs 文件路径");
const { chromium } = await import(playwrightUrl);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXE ? { executablePath: process.env.BROWSER_EXE } : {})
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => {
    const records = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { stars: 3, timeMs: 1000, rotations: 0 }]));
    localStorage.setItem("folded-path-records-v1", JSON.stringify(records));
    localStorage.setItem("folded-path-unlocked", "12");
  });
  await page.goto("http://127.0.0.1:8000/", { waitUntil: "networkidle" });
  if (await page.locator("#modal-close").isVisible()) await page.locator("#modal-close").click();
  if (!await page.locator("#boss-entry").isEnabled()) throw Error("隐藏关入口没有解锁");
  await page.locator("#boss-entry").click();
  await page.locator("#boss-skip-code").fill("furina1st");
  await page.locator("#boss-skip-form button").click();
  if (await page.evaluate(() => window.__foldedPath.boss.getState().phase) === "won") throw Error("错误大小写不应跳关");
  await page.locator("#boss-skip-code").fill("Furina1st");
  await page.locator("#boss-skip-form button").click();
  if (await page.evaluate(() => window.__foldedPath.boss.getState().phase) !== "won") throw Error("正确跳关码没有生效");
  if (!await page.locator("#boss-overlay-title").isVisible()) throw Error("缺少跳关完成提示");
  const result = await page.evaluate(() => ({
    skip: localStorage.getItem("folded-path-boss-skipped-v1"),
    record13: JSON.parse(localStorage.getItem("folded-path-records-v1"))[13] || null
  }));
  if (result.skip !== "1" || result.record13 !== null) throw Error(`跳关记录不正确：${JSON.stringify(result)}`);
  await page.locator("#boss-overlay-restart").click();
  if (await page.evaluate(() => window.__foldedPath.boss.getState().phase) !== "ready") throw Error("跳关后不能重玩");
  const video = await page.locator(".boss-video-card video").evaluate(async (element) => {
    element.muted = true;
    await new Promise((resolve, reject) => {
      if (element.readyState >= 1) return resolve();
      element.addEventListener("loadedmetadata", resolve, { once: true });
      element.addEventListener("error", () => reject(Error("视频加载失败")), { once: true });
      element.load();
    });
    await element.play();
    await new Promise((resolve) => setTimeout(resolve, 650));
    const data = { duration: element.duration, currentTime: element.currentTime, error: element.error?.message || null };
    element.pause();
    return data;
  });
  if (video.error || video.duration < 30 || video.duration > 45 || video.currentTime <= 0) throw Error(`视频无法播放：${JSON.stringify(video)}`);
  await page.reload({ waitUntil: "networkidle" });
  const entryLabel = await page.locator("#boss-entry").textContent();
  if (!entryLabel.includes("已跳过")) throw Error("刷新后跳关状态没有保留");
  if (errors.length) throw Error(`浏览器报错：${errors.join(" | ")}`);
  console.log({ wrongCodeRejected: true, rightCodeSkipped: true, starsUnaffected: true, replayAllowed: true, persistedAfterReload: true, video });
} finally {
  await browser.close();
}
