// 用游戏同一套 bossCell 规则模拟完整正确路线，录制一段注明倍速的 WebM 回放。
// 运行时设置 PLAYWRIGHT_MODULE 为本机 Playwright 的 index.mjs 路径；
// 可选设置 BROWSER_EXE 为 Chromium/Edge 可执行文件。
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BOSS_TILES, BOSS_CELLS, BOSS_COUNT, BOSS_START, BOSS_WALL,
  BOSS_DANGER, BOSS_EXIT, BOSS_KEY, BOSS_LOCK, BOSS_ARROW_BASE, bossCell, bossPar
} from "./boss-level.js";

const root = dirname(fileURLToPath(import.meta.url));
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const routeFrames = 624;
const expectedSteps = 8_223_617;
const sampleEvery = Math.ceil(expectedSteps / routeFrames);
const player = { ...BOSS_START };
const tileOrder = [0];
const snapshots = [];
let steps = 0;
const seenTiles = new Set([0]);
let hasKey = false;
let spinCount = 0;

function snapshot() {
  const crop = [];
  for (let cy = -12; cy <= 12; cy++) for (let cx = -12; cx <= 12; cx++) {
    crop.push(bossCell(player.index, player.x + cx, player.y + cy, 0));
  }
  snapshots.push({ index: player.index, x: player.x, y: player.y, steps, visited: seenTiles.size, crossings: tileOrder.length - 1, hasKey, crop });
}

snapshot();
while (steps < 10_000_000) {
  let x = player.x + directions[player.direction][0];
  let y = player.y + directions[player.direction][1];
  let col = player.index % BOSS_TILES;
  let row = Math.floor(player.index / BOSS_TILES);
  if (x < 0) { col--; x = BOSS_CELLS - 1; }
  else if (x >= BOSS_CELLS) { col++; x = 0; }
  if (y < 0) { row--; y = BOSS_CELLS - 1; }
  else if (y >= BOSS_CELLS) { row++; y = 0; }
  steps++;
  if (col < 0 || col >= BOSS_TILES || row < 0 || row >= BOSS_TILES) throw Error("回放路线走出地图");
  const index = row * BOSS_TILES + col;
  const cell = bossCell(index, x, y, 0);
  if (cell === BOSS_WALL || (cell === BOSS_LOCK && !hasKey) || (cell >= BOSS_ARROW_BASE && cell < BOSS_ARROW_BASE + 4 && cell - BOSS_ARROW_BASE !== player.direction)) {
    player.direction = (player.direction + 1) % 4;
    if (++spinCount >= 4) throw Error("回放路线原地转圈");
  } else {
    if (cell === BOSS_DANGER) throw Error("回放路线走入危险格");
    if (cell === BOSS_KEY) hasKey = true;
    if (index !== player.index) { tileOrder.push(index); seenTiles.add(index); }
    player.index = index;
    player.x = x;
    player.y = y;
    spinCount = 0;
    if (cell === BOSS_EXIT) { snapshot(); break; }
  }
  if (steps % sampleEvery === 0) snapshot();
}
if (steps !== expectedSteps || seenTiles.size !== BOSS_COUNT || tileOrder.length !== 2 * BOSS_COUNT - 1 || snapshots.at(-1).index !== 0 || !hasKey) {
  throw Error(`回放验证失败：${steps} 步，${seenTiles.size} 张纸片`);
}
console.log(`已模拟完整往返路线：${steps.toLocaleString()} 步，${seenTiles.size} 张纸片，${bossPar()} 次最少旋转。`);

const playwrightUrl = process.env.PLAYWRIGHT_MODULE;
if (!playwrightUrl) throw Error("请设置 PLAYWRIGHT_MODULE 为 Playwright 的 index.mjs 文件路径");
const { chromium } = await import(playwrightUrl);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXE ? { executablePath: process.env.BROWSER_EXE } : {})
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.setContent('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>html,body{margin:0;background:#eee8dc}canvas{display:block}</style><canvas width="1280" height="720"></canvas></html>');
  const result = await page.evaluate(async ({ snapshots, tileOrder, par, totalSteps }) => {
    const canvas = document.querySelector("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    const ink = "#3d5e4c", muted = "#7c8d7e", pale = "#f8f3e9";
    const fps = 24, totalFrames = 36 * fps;
    const prepFrames = 6 * fps, travelFrames = 26 * fps;
    const mapX = 93, mapY = 169, cellSize = 4.45;
    let lastVisited = 0;
    const routeLayer = document.createElement("canvas");
    routeLayer.width = 445; routeLayer.height = 445;
    const routeContext = routeLayer.getContext("2d");
    const fmt = (number) => number.toLocaleString("zh-CN");

    function rounded(x, y, w, h, r, color) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    }
    function line(text, x, y, size, color = ink, weight = 600) {
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`;
      ctx.fillText(text, x, y);
    }
    function render(frame) {
      const prep = frame < prepFrames;
      const travel = frame >= prepFrames && frame < prepFrames + travelFrames;
      const progress = Math.min(1, Math.max(0, (frame - prepFrames) / travelFrames));
      const sample = snapshots[Math.min(snapshots.length - 1, Math.floor(progress * (snapshots.length - 1)))];
      const shownVisited = prep ? 1 : travel ? sample.visited : 10000;
      const shownCrossings = prep ? 1 : travel ? sample.crossings + 1 : tileOrder.length;

      ctx.fillStyle = "#f0eadf"; ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = "#e5dfd2"; ctx.fillRect(0, 0, 1280, 9);
      rounded(35, 26, 1210, 668, 21, "#fffbf2");
      ctx.strokeStyle = "#dfd8cb"; ctx.lineWidth = 1.5; ctx.strokeRect(35, 26, 1210, 668);
      line("折页迷途", 61, 80, 30, ink, 800);
      line("第 13 关 · 万页迷宫", 258, 78, 21, "#748e7c", 700);
      rounded(1005, 49, 207, 34, 17, "#e8eee4");
      line("模拟回放 · 倍速压缩", 1020, 72, 15, "#557760", 700);
      line(prep ? "第一幕  ·  把折痕归零" : travel ? sample.crossings < 9999 ? "第二幕  ·  正程穿过万页" : "第三幕  ·  换一条路折返回起点" : "终章  ·  抵达出口", 62, 130, 19, ink, 700);
      line("100 × 100 张纸片，每张 100 × 100 格", 62, 155, 14, muted, 500);

      rounded(62, 176, 511, 486, 14, "#e8e5d9");
      ctx.fillStyle = "#d9e7d9"; ctx.fillRect(mapX, mapY + 18, 445, 445);
      for (let row = 0; row < 100; row++) for (let col = 0; col < 100; col++) {
        const index = row * 100 + col;
        ctx.fillStyle = (row + col) % 2 ? "#e9e3d5" : "#f0e9dc";
        ctx.fillRect(mapX + col * cellSize, mapY + 18 + row * cellSize, 3.9, 3.9);
        if (prep && index > 0 && (index * 17) % 20 < 7 && index > frame / prepFrames * 10000) {
          ctx.fillStyle = "#d9a17f";
          ctx.fillRect(mapX + col * cellSize, mapY + 18 + row * cellSize, 3.9, 3.9);
        }
      }
      while (lastVisited < shownCrossings) {
        const index = tileOrder[lastVisited++];
        const col = index % 100, row = Math.floor(index / 100);
        routeContext.fillStyle = lastVisited <= 10000 ? "#78a080" : "#d6aa69";
        routeContext.fillRect(col * cellSize, row * cellSize, 4.2, 4.2);
      }
      if (!prep) ctx.drawImage(routeLayer, mapX, mapY + 18);
      const currentIndex = prep ? 0 : sample.index;
      const dotX = mapX + (currentIndex % 100 + .5) * cellSize;
      const dotY = mapY + 18 + (Math.floor(currentIndex / 100) + .5) * cellSize;
      ctx.beginPath(); ctx.arc(dotX, dotY, 8, 0, Math.PI * 2); ctx.fillStyle = "#c2634d"; ctx.fill();
      ctx.beginPath(); ctx.arc(dotX, dotY, 11, 0, Math.PI * 2); ctx.strokeStyle = "#fffaf0"; ctx.lineWidth = 3; ctx.stroke();
      line("绿色正程 · 金色返程", 83, 642, 14, muted, 600);
      line("起点 / 出口", 421, 642, 13, muted, 500);

      rounded(593, 176, 620, 486, 14, "#f6f1e8");
      if (prep) {
        line("旋转准备", 625, 222, 23, ink, 800);
        line("解法：把其余纸片转回 0°，再放行纸片人。", 625, 258, 18, "#607969", 600);
        line("每一次转动都改变这一张纸里的道路与边缘出口。", 625, 290, 15, muted, 500);
        const done = Math.floor(par * frame / prepFrames);
        line(`${fmt(done)} / ${fmt(par)}`, 625, 370, 38, ink, 800);
        line("理论最少旋转", 625, 399, 14, muted, 500);
        rounded(625, 426, 541, 15, 8, "#dedfd3");
        rounded(625, 426, Math.max(5, 541 * frame / prepFrames), 15, 8, "#88aa8d");
        line("画面将数千次旋转压缩呈现", 625, 488, 15, muted, 500);
      } else if (travel) {
        line(sample.crossings < 9999 ? "正在穿越 · 正程" : "正在穿越 · 返程", 625, 222, 23, ink, 800);
        line(`${fmt(sample.crossings)} / 19,998`, 625, 269, 36, ink, 800);
        line(`累计跨页 · 已见 ${fmt(shownVisited)} 张不同纸片`, 625, 292, 14, muted, 500);
        line(`${fmt(sample.steps)} / ${fmt(totalSteps)} 步`, 625, 331, 18, "#607969", 700);
        rounded(625, 352, 540, 9, 5, "#dedfd3");
        rounded(625, 352, Math.max(4, 540 * progress), 9, 5, "#88aa8d");
        line(`当前：第 ${Math.floor(sample.index / 100) + 1} 行 · 第 ${sample.index % 100 + 1} 列`, 625, 402, 16, muted, 600);
        const size = 9.2, startX = 626, startY = 421;
        for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) {
          const type = sample.crop[y * 25 + x];
          ctx.fillStyle = type === 0 ? "#9eae9c" : type === 2 ? "#cf8472" : type === 4 || type === 9 ? "#dbb76b" : type === 10 ? "#a194ae" : type >= 5 ? "#fff9e9" : "#e2e9d5";
          ctx.fillRect(startX + x * size, startY + y * size, size - .7, size - .7);
        }
        ctx.beginPath(); ctx.arc(startX + 12.5 * size, startY + 12.5 * size, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#bd664f"; ctx.fill();
        line("当前纸片的 25 × 25 格局部", 876, 449, 13, muted, 500);
        line("浅色道路  ·  深色墙壁", 876, 477, 13, muted, 500);
        line("红色危险岔路  ·  圆点纸片人", 876, 505, 13, muted, 500);
        line(sample.hasKey ? "已取得钥匙 · 可穿过行末锁门" : "寻找钥匙 · 错过后无法通过锁门", 876, 566, 13, "#607969", 600);
      } else {
        line("万页迷宫 · 正确路线已抵达出口", 625, 228, 25, ink, 800);
        line("10,000 / 10,000", 625, 315, 43, "#5f8c6b", 800);
        line("张纸片全部经过，几乎每张走了两次", 625, 347, 16, muted, 600);
        line(`${fmt(totalSteps)} 步`, 625, 415, 29, ink, 700);
        line(`${fmt(par)} 次理论最少旋转`, 625, 459, 22, ink, 700);
        line("这是一段加速模拟回放，不是实时手玩录像。", 625, 562, 14, muted, 500);
      }
      line("真实路线模拟  ·  画面按进度抽帧  ·  完整逻辑由 verify-boss.mjs 验证", 63, 679, 12, "#88978a", 500);
    }

    const stream = canvas.captureStream(fps);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm;codecs=vp8";
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_800_000 });
    const pieces = [];
    recorder.ondataavailable = (event) => { if (event.data.size) pieces.push(event.data); };
    const finished = new Promise((resolve, reject) => {
      recorder.onerror = (event) => reject(event.error || Error("视频编码失败"));
      recorder.onstop = async () => {
        const blob = new Blob(pieces, { type: mime });
        const dataUrl = await new Promise((done, fail) => {
          const reader = new FileReader();
          reader.onload = () => done(reader.result);
          reader.onerror = fail;
          reader.readAsDataURL(blob);
        });
        resolve({ dataUrl, bytes: blob.size, mime });
      };
    });
    render(0);
    recorder.start();
    await new Promise((resolve) => {
      let frame = 1;
      const timer = setInterval(() => {
        render(frame++);
        if (frame > totalFrames) { clearInterval(timer); resolve(); }
      }, 1000 / fps);
    });
    recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
    return finished;
  }, { snapshots, tileOrder, par: bossPar(), totalSteps: steps });
  if (result.bytes < 50_000) throw Error(`视频文件异常小：${result.bytes} 字节`);
  await writeFile(join(root, "boss-clear.webm"), Buffer.from(result.dataUrl.split(",")[1], "base64"));
  await page.locator("canvas").screenshot({ path: join(root, "boss-video-poster.png") });
  console.log(`已生成 boss-clear.webm（${(result.bytes / 1024 / 1024).toFixed(2)} MiB，${result.mime}）。`);
} finally {
  await browser.close();
}
