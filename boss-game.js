import {
  BOSS_TILES, BOSS_CELLS, BOSS_COUNT, BOSS_START, BOSS_WALL, BOSS_ROAD,
  BOSS_DANGER, BOSS_START_CELL, BOSS_EXIT, BOSS_ARROW_BASE, BOSS_KEY, BOSS_LOCK,
  bossCell, bossType, bossPar, createBossRotations
} from "./boss-level.js";
import { badgeMarkup } from "./badges.js";

const $ = (selector) => document.querySelector(selector);
const compass = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const colors = ["#d9eadf", "#f0ddd1", "#e7e1ee", "#d8e8ec", "#f2e9c9", "#eddae0"];
const ports = { east: [1, 3], west: [1, 3], ws: [3, 2], nw: [0, 3], es: [1, 2], ne: [0, 1] };
const SAVE_KEY = "folded-path-boss-attempt-v2";
const par = bossPar();
const limit = par + 3;

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function paperCoordinates(index) { return { row: Math.floor(index / BOSS_TILES), col: index % BOSS_TILES }; }

export function createBossGame({ onExit, onWin, onSkip }) {
  const screen = $("#boss-screen");
  const atlas = $("#boss-atlas");
  const minimap = $("#boss-minimap");
  const detail = $("#boss-detail");
  const atlasContext = atlas.getContext("2d");
  const miniContext = minimap.getContext("2d");
  const detailContext = detail.getContext("2d");
  const overlay = $("#boss-overlay");
  let state = null;
  let viewCol = 0, viewRow = 0, viewSize = 20;
  let frameId = 0, lastFrame = 0, lastPaint = 0, accumulated = 0;
  let lastSave = 0;
  let drag = null;

  function saveAttempt() {
    if (!state || state.phase === "won" || (state.phase === "failed" && state.failure !== "budget")) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        rotations: Array.from(state.rotations).join(""),
        visited: Array.from(state.visited).join(""),
        player: state.player, selected: state.selected, used: state.used,
        steps: state.steps, elapsed: Math.floor(state.elapsed), hasKey: state.hasKey, history: state.history
      }));
      lastSave = performance.now();
    } catch { hint("浏览器无法保存本次 Boss 尝试；请保持页面打开。"); }
  }

  function restoreAttempt() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (!saved || typeof saved.rotations !== "string" || !/^[0-3]{10000}$/.test(saved.rotations) ||
        typeof saved.visited !== "string" || !/^[01]{10000}$/.test(saved.visited) ||
        !Number.isInteger(saved.player?.index) || saved.player.index < 0 || saved.player.index >= BOSS_COUNT ||
        !Number.isInteger(saved.player.x) || saved.player.x < 0 || saved.player.x >= BOSS_CELLS ||
        !Number.isInteger(saved.player.y) || saved.player.y < 0 || saved.player.y >= BOSS_CELLS ||
        !Number.isInteger(saved.player.direction) || saved.player.direction < 0 || saved.player.direction > 3 ||
        !Number.isInteger(saved.selected) || saved.selected < 0 || saved.selected >= BOSS_COUNT ||
        !Number.isInteger(saved.used) || saved.used < 0 || saved.used > limit ||
        !Number.isInteger(saved.steps) || saved.steps < 0 ||
        typeof saved.hasKey !== "boolean" ||
        !Number.isFinite(saved.elapsed) || saved.elapsed < 0 ||
        !Array.isArray(saved.history) || saved.history.length > limit ||
        saved.history.some((item) => !Number.isInteger(item.index) || item.index < 0 || item.index >= BOSS_COUNT || !Number.isInteger(item.rotation) || item.rotation < 0 || item.rotation > 3)) return false;
      const visited = Uint8Array.from(saved.visited, Number);
      visited[saved.player.index] = 1;
      state = {
        rotations: Uint8Array.from(saved.rotations, Number), visited,
        visitedCount: visited.reduce((sum, value) => sum + value, 0),
        player: saved.player, selected: saved.selected, used: saved.used,
        steps: saved.steps, elapsed: saved.elapsed, hasKey: saved.hasKey, phase: "paused",
        history: saved.history, failure: "", spinCount: 0, lockBlocked: false
      };
      hint("已恢复上次未完成的 Boss 尝试。");
      return true;
    } catch { return false; }
  }

  function newState() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* 私密模式可能禁用存储 */ }
    state = {
      rotations: createBossRotations(), player: { ...BOSS_START }, selected: 1,
      visited: new Uint8Array(BOSS_COUNT), visitedCount: 1,
      used: 0, steps: 0, elapsed: 0, hasKey: false, lockBlocked: false, phase: "ready", history: [], failure: "", spinCount: 0
    };
    state.visited[0] = 1;
    viewCol = 0; viewRow = 0; viewSize = 20;
    $("#boss-zoom").value = 20;
    $("#boss-speed").value = "4096";
    accumulated = 0;
    hideOverlay();
    render();
  }

  function hideOverlay() { overlay.hidden = true; }
  function showOverlay(title, message) {
    $("#boss-overlay-title").textContent = title;
    $("#boss-overlay-message").textContent = message;
    $("#boss-award").hidden = true;
    $("#boss-award").innerHTML = "";
    overlay.hidden = false;
  }
  function hint(message) { $("#boss-hint").textContent = message; }

  function drawAtlas() {
    const ctx = atlasContext;
    const side = atlas.width / viewSize;
    ctx.clearRect(0, 0, atlas.width, atlas.height);
    ctx.fillStyle = "#e8e4d8";
    ctx.fillRect(0, 0, atlas.width, atlas.height);
    for (let row = 0; row < viewSize; row++) for (let col = 0; col < viewSize; col++) {
      const gridRow = viewRow + row, gridCol = viewCol + col;
      if (gridRow >= BOSS_TILES || gridCol >= BOSS_TILES) continue;
      const index = gridRow * BOSS_TILES + gridCol;
      const x = col * side, y = row * side;
      ctx.fillStyle = colors[(gridCol + gridRow * 3) % colors.length];
      ctx.fillRect(x + 1, y + 1, side - 2, side - 2);
      if (state.visited[index]) {
        ctx.fillStyle = "#789b7830";
        ctx.fillRect(x + 1, y + 1, side - 2, side - 2);
      }
      const heading = ports[bossType(index)].map((port) => (port + state.rotations[index]) % 4);
      ctx.strokeStyle = "#fefdf7";
      ctx.lineWidth = Math.max(2, side * .16);
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const port of heading) {
        ctx.moveTo(x + side / 2, y + side / 2);
        ctx.lineTo(x + side / 2 + compass[port][0] * side / 2, y + side / 2 + compass[port][1] * side / 2);
      }
      ctx.stroke();
      if (state.selected === index) {
        ctx.strokeStyle = "#496e57"; ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, side - 3, side - 3);
      }
      if (state.player.index === index) {
        ctx.fillStyle = "#cf765c";
        ctx.beginPath(); ctx.arc(x + side / 2, y + side / 2, Math.max(3, side * .19), 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawMinimap() {
    const ctx = miniContext;
    ctx.clearRect(0, 0, 200, 200);
    ctx.fillStyle = "#dce7d8"; ctx.fillRect(0, 0, 200, 200);
    for (let index = 0; index < BOSS_COUNT; index++) {
      if (!state.visited[index]) continue;
      const { row, col } = paperCoordinates(index);
      ctx.fillStyle = "#849d81"; ctx.fillRect(col * 2, row * 2, 2, 2);
    }
    const player = paperCoordinates(state.player.index);
    ctx.fillStyle = "#bd674e"; ctx.fillRect(player.col * 2 - 2, player.row * 2 - 2, 6, 6);
    ctx.strokeStyle = "#4e6852"; ctx.lineWidth = 2;
    ctx.strokeRect(viewCol * 2, viewRow * 2, viewSize * 2, viewSize * 2);
  }

  function drawDetail() {
    const ctx = detailContext;
    const index = state.selected;
    const cellPixels = detail.width / BOSS_CELLS;
    ctx.fillStyle = colors[paperCoordinates(index).col % colors.length];
    ctx.fillRect(0, 0, detail.width, detail.height);
    ctx.font = "4px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 0; y < BOSS_CELLS; y++) for (let x = 0; x < BOSS_CELLS; x++) {
      const type = bossCell(index, x, y, state.rotations[index]);
      ctx.fillStyle = type === BOSS_WALL ? "#899b8b" : type === BOSS_DANGER ? "#ce836f" : type === BOSS_EXIT ? "#e7be6b" : type === BOSS_KEY ? "#e6c874" : type === BOSS_LOCK ? "#9c91aa" : type === BOSS_START_CELL ? "#b6d0ae" : type >= BOSS_ARROW_BASE ? "#fffdf5" : "#faf5e9";
      ctx.fillRect(x * cellPixels + .3, y * cellPixels + .3, cellPixels - .5, cellPixels - .5);
      if (type >= BOSS_ARROW_BASE && type < BOSS_ARROW_BASE + 4) {
        ctx.fillStyle = "#648274";
        ctx.fillText("↑→↓←"[type - BOSS_ARROW_BASE], (x + .5) * cellPixels, (y + .54) * cellPixels);
      }
    }
    if (state.player.index === index) {
      ctx.fillStyle = "#bd664f";
      ctx.beginPath();
      ctx.arc((state.player.x + .5) * cellPixels, (state.player.y + .5) * cellPixels, Math.max(3, cellPixels * 1.1), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawText() {
    const player = paperCoordinates(state.player.index);
    const selected = paperCoordinates(state.selected);
    $("#boss-player-position").textContent = `${player.row + 1} 行 ${player.col + 1} 列`;
    $("#boss-selected-label").textContent = `第 ${selected.row + 1} 行 · 第 ${selected.col + 1} 列 · ${state.rotations[state.selected] * 90}°`;
    $("#boss-steps").textContent = `${state.steps.toLocaleString("zh-CN")} 步`;
    $("#boss-visited").textContent = `${state.visitedCount.toLocaleString("zh-CN")} / 10000`;
    $("#boss-time").textContent = formatTime(state.elapsed);
    $("#boss-turns").textContent = `${state.used} / ${limit}`;
    $("#boss-key-status").textContent = state.hasKey ? "◆ 回程钥匙已取得" : "◇ 回程钥匙未取得";
    const canTurn = state.selected !== state.player.index && !["won", "failed"].includes(state.phase);
    $("#boss-left").disabled = !canTurn;
    $("#boss-right").disabled = !canTurn;
    $("#boss-undo").disabled = state.history.length === 0 || state.phase === "won" || (state.phase === "failed" && state.failure !== "budget");
    $("#boss-play").disabled = ["won", "failed"].includes(state.phase);
    $("#boss-play").textContent = state.phase === "running" ? "Ⅱ 暂停行走" : state.phase === "paused" ? "▶ 继续行走" : "▶ 开始行走";
    $("#boss-row").value = selected.row + 1;
    $("#boss-col").value = selected.col + 1;
  }
  function render() { if (!state || screen.hidden) return; drawAtlas(); drawMinimap(); drawDetail(); drawText(); }

  function moveView(col, row) {
    viewCol = clamp(Math.round(col), 0, BOSS_TILES - viewSize);
    viewRow = clamp(Math.round(row), 0, BOSS_TILES - viewSize);
    render();
  }
  function select(index) {
    if (index < 0 || index >= BOSS_COUNT) return;
    state.selected = index;
    const { row, col } = paperCoordinates(index);
    if (col < viewCol || col >= viewCol + viewSize || row < viewRow || row >= viewRow + viewSize) moveView(col - viewSize / 2, row - viewSize / 2);
    else render();
  }
  function follow() {
    const { row, col } = paperCoordinates(state.player.index);
    state.selected = state.player.index;
    moveView(col - viewSize / 2, row - viewSize / 2);
  }

  function rotate(delta) {
    if (!state || ["won", "failed"].includes(state.phase)) return;
    if (state.selected === state.player.index) { hint("纸片人所在纸片不能旋转。"); return; }
    if (state.used >= limit) { hint("旋转次数已经用尽，请先撤销上一步。"); return; }
    const index = state.selected;
    state.history.push({ index, rotation: state.rotations[index] });
    state.rotations[index] = (state.rotations[index] + delta + 4) % 4;
    state.used++;
    if (state.used >= limit) finish(false, "旋转次数用尽。撤销上一步，或重新规划万页地图。");
    else saveAttempt();
    render();
  }
  function undo() {
    if (state.phase === "won" || (state.phase === "failed" && state.failure !== "budget")) return;
    const item = state.history.pop();
    if (!item) return;
    state.rotations[item.index] = item.rotation;
    state.used--;
    state.selected = item.index;
    if (state.phase === "failed" && state.failure === "budget") { state.phase = "paused"; state.failure = ""; hideOverlay(); }
    hint("已撤销上一步旋转；已经走过的路线不会倒退。");
    saveAttempt();
    render();
  }

  function step() {
    const from = paperCoordinates(state.player.index);
    let x = state.player.x + compass[state.player.direction][0];
    let y = state.player.y + compass[state.player.direction][1];
    let col = from.col, row = from.row;
    if (x < 0) { col--; x = BOSS_CELLS - 1; }
    else if (x >= BOSS_CELLS) { col++; x = 0; }
    if (y < 0) { row--; y = BOSS_CELLS - 1; }
    else if (y >= BOSS_CELLS) { row++; y = 0; }
    state.steps++;
    if (col < 0 || col >= BOSS_TILES || row < 0 || row >= BOSS_TILES) return finish(false, "纸片人走出了万页迷宫。"), false;
    const index = row * BOSS_TILES + col;
    const target = bossCell(index, x, y, state.rotations[index]);
    if (target === BOSS_LOCK && !state.hasKey) state.lockBlocked = true;
    if (target === BOSS_WALL || (target === BOSS_LOCK && !state.hasKey) || (target >= BOSS_ARROW_BASE && target < BOSS_ARROW_BASE + 4 && target - BOSS_ARROW_BASE !== state.player.direction)) {
      state.player.direction = (state.player.direction + 1) % 4;
      state.spinCount++;
      if (state.spinCount >= 4) return finish(false, state.lockBlocked ? "之前错过了回程钥匙，锁门无法通过。" : "道路没有接通，纸片人在原地打转。"), false;
      return true;
    }
    if (target === BOSS_DANGER) return finish(false, "纸片人走进了危险岔路。"), false;
    state.player.index = index; state.player.x = x; state.player.y = y;
    if (target === BOSS_KEY && !state.hasKey) { state.hasKey = true; hint("拿到回程钥匙；行末锁门现在可以通过。"); }
    state.spinCount = 0;
    state.lockBlocked = false;
    if (!state.visited[index]) { state.visited[index] = 1; state.visitedCount++; }
    if (target === BOSS_EXIT) return finish(true), false;
    return true;
  }

  function finish(won, message = "") {
    state.phase = won ? "won" : "failed";
    state.failure = message.startsWith("旋转次数") ? "budget" : "route";
    cancelAnimationFrame(frameId); frameId = 0;
    if (won || state.failure !== "budget") { try { localStorage.removeItem(SAVE_KEY); } catch { /* 忽略存储限制 */ } }
    else saveAttempt();
    if (won) {
      const rating = state.used <= par && state.elapsed < 30 * 60_000 ? 3 : state.used <= par + 1 ? 2 : 1;
      onWin({ stars: rating, timeMs: state.elapsed, rotations: state.used });
      showOverlay("万页迷宫已破解！", `走过 ${state.visitedCount.toLocaleString("zh-CN")} 张纸片、${state.steps.toLocaleString("zh-CN")} 步。用时 ${formatTime(state.elapsed)}，旋转 ${state.used} 次，获得 ${rating} 星。`);
      if (rating === 3) { $("#boss-award").innerHTML = `${badgeMarkup(13, true)}<span>隐藏名牌已获得</span>`; $("#boss-award").hidden = false; }
    } else showOverlay("折痕断了", message);
    render();
  }

  function skipWithCode(code) {
    if (code !== "Furina1st") { hint("跳关码不正确，请检查大小写。"); return false; }
    if (!state || state.phase === "won") { hint("本次尝试已经结束；需要重玩时请点「重开本关」。"); return false; }
    cancelAnimationFrame(frameId); frameId = 0;
    state.phase = "won";
    state.failure = "";
    try { localStorage.removeItem(SAVE_KEY); } catch { /* 忽略存储限制 */ }
    onSkip();
    showOverlay("已跳过万页迷宫", "跳关码已生效：本关视为跳过，但不计入手动通关的星级记录。你仍可以重开本关挑战。");
    hint("已使用跳关码完成本关；这次不计星级。");
    render();
    return true;
  }

  function frame(timestamp) {
    if (!state || state.phase !== "running" || screen.hidden) return;
    const realDelta = Math.max(0, timestamp - lastFrame);
    const delta = Math.min(100, realDelta);
    lastFrame = timestamp;
    state.elapsed += realDelta;
    accumulated += delta * Number($("#boss-speed").value) / 450;
    let count = Math.min(20_000, Math.floor(accumulated));
    accumulated -= count;
    while (count-- > 0 && state.phase === "running") step();
    if (state.phase === "running" && timestamp - lastSave > 1000) saveAttempt();
    if (timestamp - lastPaint > 80 || state.phase !== "running") { render(); lastPaint = timestamp; }
    if (state.phase === "running") frameId = requestAnimationFrame(frame);
  }
  function playOrPause() {
    if (state.phase === "running") { state.phase = "paused"; cancelAnimationFrame(frameId); frameId = 0; saveAttempt(); render(); return; }
    if (!["ready", "paused"].includes(state.phase)) return;
    hideOverlay(); state.phase = "running"; lastFrame = performance.now(); lastPaint = 0;
    frameId = requestAnimationFrame(frame); render();
  }

  function enter() {
    screen.hidden = false;
    if (!state) { if (!restoreAttempt()) newState(); else render(); }
    else render();
  }
  function exit() {
    if (state.phase === "running") { state.phase = "paused"; cancelAnimationFrame(frameId); frameId = 0; }
    saveAttempt();
    screen.hidden = true; hideOverlay(); onExit();
  }

  atlas.addEventListener("pointerdown", (event) => {
    atlas.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY, col: viewCol, row: viewRow, moved: false };
  });
  atlas.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const rect = atlas.getBoundingClientRect();
    const cell = rect.width / viewSize;
    if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 6) drag.moved = true;
    if (drag.moved) moveView(drag.col - (event.clientX - drag.x) / cell, drag.row - (event.clientY - drag.y) / cell);
  });
  atlas.addEventListener("pointerup", (event) => {
    if (!drag) return;
    if (!drag.moved) {
      const rect = atlas.getBoundingClientRect();
      const col = viewCol + Math.floor((event.clientX - rect.left) / rect.width * viewSize);
      const row = viewRow + Math.floor((event.clientY - rect.top) / rect.height * viewSize);
      if (col >= 0 && col < BOSS_TILES && row >= 0 && row < BOSS_TILES) select(row * BOSS_TILES + col);
    }
    drag = null;
  });
  atlas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const centerCol = viewCol + viewSize / 2, centerRow = viewRow + viewSize / 2;
    viewSize = clamp(viewSize + Math.sign(event.deltaY) * 2, 8, 40);
    $("#boss-zoom").value = viewSize;
    moveView(centerCol - viewSize / 2, centerRow - viewSize / 2);
  }, { passive: false });
  minimap.addEventListener("click", (event) => {
    const rect = minimap.getBoundingClientRect();
    const col = (event.clientX - rect.left) / rect.width * BOSS_TILES;
    const row = (event.clientY - rect.top) / rect.height * BOSS_TILES;
    moveView(col - viewSize / 2, row - viewSize / 2);
  });
  $("#boss-zoom").addEventListener("input", (event) => {
    const centerCol = viewCol + viewSize / 2, centerRow = viewRow + viewSize / 2;
    viewSize = Number(event.target.value);
    moveView(centerCol - viewSize / 2, centerRow - viewSize / 2);
  });
  $("#boss-jump").addEventListener("click", () => {
    const row = clamp(Number($("#boss-row").value) || 1, 1, BOSS_TILES);
    const col = clamp(Number($("#boss-col").value) || 1, 1, BOSS_TILES);
    select((row - 1) * BOSS_TILES + col - 1);
  });
  $("#boss-follow").addEventListener("click", follow);
  $("#boss-left").addEventListener("click", () => rotate(-1));
  $("#boss-right").addEventListener("click", () => rotate(1));
  $("#boss-undo").addEventListener("click", undo);
  $("#boss-restart").addEventListener("click", newState);
  $("#boss-play").addEventListener("click", playOrPause);
  $("#boss-exit").addEventListener("click", exit);
  $("#boss-overlay-back").addEventListener("click", hideOverlay);
  $("#boss-overlay-restart").addEventListener("click", newState);
  $("#boss-skip-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (skipWithCode($("#boss-skip-code").value)) $("#boss-skip-code").value = "";
  });
  document.addEventListener("keydown", (event) => {
    if (screen.hidden || !overlay.hidden || event.altKey || event.ctrlKey || event.metaKey || event.target.matches("input,select,textarea")) return;
    if (event.key.toLowerCase() === "q") rotate(-1);
    if (event.key.toLowerCase() === "e") rotate(1);
    if (event.code === "Space") { event.preventDefault(); playOrPause(); }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state?.phase === "running") playOrPause(); });

  return { enter, exit, getState: () => state && { ...state, rotations: Uint8Array.from(state.rotations), visited: Uint8Array.from(state.visited) }, select, rotate, step, restart: newState, skipWithCode };
}
