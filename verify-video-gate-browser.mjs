// 隔离浏览器记录，验证视频只需全通关，而 Boss 仍需全部三星名牌。
if (!process.env.PLAYWRIGHT_MODULE) throw Error("请设置 PLAYWRIGHT_MODULE");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXE ? { executablePath: process.env.BROWSER_EXE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const url = "http://127.0.0.1:8000/";
  const records = (count, stars) => Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, { stars, timeMs: 1000, rotations: 0 }]));
  async function showWith(recordData) {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate((data) => localStorage.setItem("folded-path-records-v1", JSON.stringify(data)), recordData);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#modal-close").click();
  }

  await showWith({});
  if (await page.locator("#video-entry").isEnabled() || await page.locator("#boss-entry").isEnabled()) throw Error("空记录不应解锁视频或 Boss");
  await showWith(records(11, 1));
  if (await page.locator("#video-entry").isEnabled() || await page.locator("#boss-entry").isEnabled()) throw Error("只通关 11 关仍应双锁定");

  await showWith(records(12, 1));
  if (!await page.locator("#video-entry").isEnabled()) throw Error("12 关一星通关后视频没有解锁");
  if (await page.locator("#boss-entry").isEnabled()) throw Error("12 关一星通关不应解锁 Boss");
  if (await page.locator("#badge-shelf .earned").count() !== 0) throw Error("一星记录不应获得三星名牌");
  await page.locator("#video-entry").click();
  await page.locator("#video-overlay:not([hidden])").waitFor();
  await page.waitForFunction(() => document.querySelector("#reward-video").currentTime > .2, null, { timeout: 15_000 });
  const duration = await page.locator("#reward-video").evaluate((video) => video.duration);
  if (duration < 30 || duration > 45) throw Error(`视频长度异常：${duration}`);
  await page.locator("#video-close").click();
  if (!await page.locator("#video-overlay").evaluate((overlay) => overlay.hidden)) throw Error("视频窗口无法关闭");
  if (!await page.locator("#reward-video").evaluate((video) => video.paused)) throw Error("关闭视频后未暂停播放");

  await showWith(records(12, 3));
  if (!await page.locator("#video-entry").isEnabled() || !await page.locator("#boss-entry").isEnabled()) throw Error("12 关全三星应同时解锁视频与 Boss");
  await page.locator("#boss-entry").click();
  await page.locator("#boss-screen:not([hidden])").waitFor();
  if (errors.length) throw Error(`控制台报错：${errors.join(" | ")}`);
  console.log("空记录、11 关、12 关一星、12 关三星的分级解锁及视频播放均通过");
} finally { await browser.close(); }
