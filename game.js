import { LEVELS, CELL_SIZE } from "./levels.js";
import { loadRecords, saveRecord, allCleared, clearedCount, allPerfect, perfectCount, bossWasSkipped, markBossSkipped } from "./progress.js";
import { createBossGame } from "./boss-game.js";
import { badgeMarkup, renderBadges } from "./badges.js";
import { createFinale } from "./finale.js";
import { createSoundtrack } from "./audio.js";

const $ = (selector) => document.querySelector(selector);
const board = $("#board");
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const arrows = ["^", ">", "v", "<"];
const glyphs = { X: "✦", K: "◆", D: "▣", T: "●", B: "≋", C: "◌", "!": "×", "^": "↑", ">": "→", v: "↓", "<": "←" };
const names = { X: "出口", K: "钥匙", D: "锁门", T: "开关", B: "纸桥", C: "一次性道路", "!": "危险格", "^": "单向道路", ">": "单向道路", v: "单向道路", "<": "单向道路" };
const isPortal = (type) => /^[0-9]$/.test(type);

let levelIndex = 0;
let state;
let timer = null;
let clock = null;
let toastTimer = null;
let finaleTimer = null;
let swapTimer = null;
let unlocked = Math.max(1, Math.min(LEVELS.length, Number(localStorage.getItem("folded-path-unlocked")) || 1));
const records = loadRecords();
const sound = createSoundtrack();
const boss = createBossGame({
  onExit: () => { sound.setMode("normal"); $("#normal-game").hidden = false; drawBoard(); drawProgress(); },
  onWin: (result) => { const newBadge = records[13]?.stars !== 3 && result.stars === 3; saveRecord(records, 13, result); drawProgress(); if (newBadge) sound.cue("award"); },
  onSkip: () => { markBossSkipped(); drawProgress(); }
});
const finale = createFinale({
  onEnterBoss: openBoss,
  onCredits: () => { sound.setMode("normal"); sound.cue("award"); },
  onMerge: () => { sound.setMode("boss"); sound.cue("merge"); }
});

function cloneState(value) { return JSON.parse(JSON.stringify(value)); }
function currentLevel() { return LEVELS[levelIndex]; }
function tileById(id) { return state.tiles.find((tile) => tile.id === id); }
function tileAt(col, row) { return state.tiles.find((tile) => tile.col === col && tile.row === row); }
function normalize(value) { return (value + 4) % 4; }

function baseCoordinate(x, y, rotation) {
  for (let n = 0; n < rotation; n++) [x, y] = [y, CELL_SIZE - 1 - x];
  return { x, y };
}

function cellAt(tile, x, y) {
  const base = baseCoordinate(x, y, tile.rotation);
  const key = `${tile.id}:${base.x}:${base.y}`;
  if (state.crumble.includes(key)) return { type: " ", key };
  const raw = tile.cells[base.y][base.x];
  return { type: arrows.includes(raw) ? arrows[normalize(arrows.indexOf(raw) + tile.rotation)] : raw, key };
}

function setClock() {
  const seconds = Math.floor(state.elapsed / 1000);
  $("#time-value").textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function drawStats() {
  const level = currentLevel();
  $("#turn-value").textContent = state.used;
  $("#turn-limit").textContent = level.limit;
  $("#remaining-value").textContent = Math.max(0, level.limit - state.used);
  $("#budget-pips").innerHTML = Array.from({ length: level.limit }, (_, i) => `<span class="budget-pip ${i < level.limit - state.used ? "available" : "spent"}"></span>`).join("");
  const hasKeyMechanic = level.tiles.some((t) => t.cells.join("").includes("K"));
  const hasBridgeMechanic = level.tiles.some((t) => t.cells.join("").includes("B"));
  $("#key-status").style.display = hasKeyMechanic ? "" : "none";
  $("#bridge-status").style.display = hasBridgeMechanic ? "" : "none";
  $("#key-status").textContent = state.hasKey ? "◆ 钥匙已取得" : "◇ 尚未取得钥匙";
  $("#bridge-status").textContent = state.bridgeOn ? "⌁ 纸桥已升起" : "⌁ 纸桥尚未升起";
  $(".inventory").style.display = hasKeyMechanic || hasBridgeMechanic ? "" : "none";
  $("#selected-label").textContent = `已选：${state.selected ? `${state.selected.toUpperCase()} 号纸片` : "暂无"}`;
  const canRotate = !!state.selected && state.selected !== state.player.tile && state.phase !== "won" && state.phase !== "failed";
  $("#rotate-left").disabled = !canRotate;
  $("#rotate-right").disabled = !canRotate;
  $("#undo-button").disabled = state.history.length === 0;
  $("#play-button").disabled = ["won", "failed"].includes(state.phase);
  $("#play-icon").textContent = state.phase === "running" ? "Ⅱ" : "▶";
  $("#play-label").textContent = state.phase === "running" ? "暂停行走" : state.phase === "paused" ? "继续行走" : "开始行走";
  $("#next-button").disabled = state.phase !== "won" || levelIndex === LEVELS.length - 1;
  setClock();
}

function cellMarkup(tile, x, y) {
  const { type } = cellAt(tile, x, y);
  const occupant = state.player.tile === tile.id && state.player.x === x && state.player.y === y;
  const cellClass = type === "#" ? "wall" : type === " " ? "void" : type === "X" ? "exit" : type === "K" ? "key" : type === "D" ? (state.hasKey ? "door open" : "door") : type === "T" ? (state.bridgeOn ? "switch active" : "switch") : type === "B" ? (state.bridgeOn ? "bridge active" : "bridge") : type === "C" ? "crumble" : type === "!" ? "danger" : isPortal(type) ? "portal" : arrows.includes(type) ? "oneway" : "road";
  const avatar = occupant ? `<span class="paper-person face-${state.player.direction}" aria-label="纸片人"><i class="person-head"></i><i class="person-body"></i><i class="person-feet"></i></span>` : "";
  const title = names[type] || (isPortal(type) ? `${type} 号传送门` : "");
  return `<div class="cell ${cellClass}" ${title ? `title="${title}"` : ""}><span class="cell-glyph">${isPortal(type) ? "◎" : glyphs[type] || ""}</span>${avatar}</div>`;
}

function drawBoard(spin = null) {
  const level = currentLevel();
  board.style.setProperty("--columns", level.cols);
  board.style.setProperty("--rows", level.rows);
  const expanded = level.cols > 2 || level.rows > 3;
  board.classList.toggle("long-board", expanded);
  board.parentElement.classList.toggle("advanced-stage", expanded);
  board.innerHTML = state.tiles.map((tile) => {
    const isCurrent = state.player.tile === tile.id;
    const cells = Array.from({ length: CELL_SIZE * CELL_SIZE }, (_, i) => cellMarkup(tile, i % CELL_SIZE, Math.floor(i / CELL_SIZE))).join("");
    return `<div class="tile ${tile.color} ${state.selected === tile.id ? "selected" : ""} ${isCurrent ? "occupied" : ""}" data-tile="${tile.id}" style="grid-column:${tile.col + 1};grid-row:${tile.row + 1}" role="button" tabindex="0" aria-label="${tile.id.toUpperCase()} 号纸片${isCurrent ? "，纸片人在此，无法旋转" : "，点击选中"}"><div class="tile-content"><div class="cell-grid">${cells}</div><span class="tile-label">${tile.id.toUpperCase()}</span></div><div class="tile-actions"><button class="tile-turn" type="button" data-turn="-1" title="逆时针旋转纸片" aria-label="逆时针旋转 ${tile.id.toUpperCase()} 号纸片" ${isCurrent ? "disabled" : ""}>↶</button><button class="tile-turn" type="button" data-turn="1" title="顺时针旋转纸片" aria-label="顺时针旋转 ${tile.id.toUpperCase()} 号纸片" ${isCurrent ? "disabled" : ""}>↷</button></div></div>`;
  }).join("");
  if (spin) {
    const content = board.querySelector(`[data-tile="${spin.id}"] .tile-content`);
    content?.animate([{ transform: `rotate(${spin.delta > 0 ? -90 : 90}deg)`, opacity: .83 }, { transform: "rotate(0deg)", opacity: 1 }], { duration: 340, easing: "cubic-bezier(.22,.8,.24,1)" });
  }
  drawStats();
}

function drawProgress() {
  $("#level-dots").innerHTML = LEVELS.map((level, i) => {
    const rating = records[level.id]?.stars || 0;
    return `<button type="button" class="level-dot ${i === levelIndex ? "current" : ""} ${i < unlocked ? "unlocked" : ""}" data-level="${i}" title="第 ${level.id} 关：${level.name} · ${rating ? `${rating} 星` : "尚未通关"}" aria-label="第 ${level.id} 关：${level.name}" ${i >= unlocked ? "disabled" : ""}>${i < unlocked ? String(level.id).padStart(2, "0") : "·"}<span class="level-rating" aria-hidden="true">${"✦".repeat(rating)}</span></button>`;
  }).join("");
  const count = perfectCount(records);
  const cleared = allCleared(records);
  const ready = allPerfect(records);
  $("#clear-status").textContent = `已通关 ${clearedCount(records)} / 12${cleared ? " · 通关视频已解锁" : ""}`;
  $("#perfect-status").textContent = `三星完成 ${count} / 12${ready ? " · 隐藏关已解锁" : ""}`;
  $("#video-entry").disabled = !cleared;
  $("#video-entry").textContent = cleared ? "▶ 观看第 13 关通关视频" : "▶ 通关视频 · 全部通关后解锁";
  $("#video-entry").title = cleared ? "观看第 13 关加速通关回放；不要求三星，也不会解锁 Boss" : "前十二关全部通关后即可观看，不要求三星";
  $("#boss-entry").disabled = !ready;
  $("#boss-entry").textContent = ready ? records[13]?.stars ? `✦ 隐藏第 13 关 · ${records[13].stars} 星` : bossWasSkipped() ? "✦ 隐藏第 13 关 · 已跳过（可重玩）" : "✦ 隐藏第 13 关 · 万页迷宫" : "隐藏第 13 关 · 需 12 枚三星名牌";
  $("#boss-entry").title = ready ? "进入隐藏 Boss 关卡" : "前十二关全部获得三星名牌后解锁";
  renderBadges(records);
}

function stopTimers() {
  if (timer) clearInterval(timer);
  if (clock) clearInterval(clock);
  timer = null;
  clock = null;
}

function loadLevel(index, showIntro = true) {
  const changingLevel = !!state && index !== levelIndex;
  clearTimeout(finaleTimer);
  stopTimers();
  clearTimeout(toastTimer);
  $("#toast").classList.remove("visible");
  $("#toast").textContent = "";
  levelIndex = index;
  const level = currentLevel();
  state = { tiles: cloneState(level.tiles), player: cloneState(level.start), selected: null, used: 0, hasKey: false, bridgeOn: false, crumble: [], spinCount: 0, lockBlocked: false, elapsed: 0, startedAt: null, phase: "ready", history: [] };
  $("#level-number").textContent = `第 ${String(level.id).padStart(2, "0")} 关 / 共 ${String(LEVELS.length).padStart(2, "0")} 关`;
  $("#level-title").textContent = level.name;
  $("#level-description").textContent = level.goal;
  $("#level-tag").textContent = level.tag;
  drawBoard();
  drawProgress();
  if (changingLevel) {
    sound.cue("level");
    const screen = $("#normal-game");
    screen.classList.remove("level-swapping");
    void screen.offsetWidth;
    screen.classList.add("level-swapping");
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => screen.classList.remove("level-swapping"), 520);
  }
  if (showIntro) showModal({ kicker: `第 ${String(level.id).padStart(2, "0")} 关`, title: level.name, message: level.goal, actions: [{ label: "开始折页", primary: true, callback: hideModal }] });
  else hideModal();
}

function snapshot() {
  const { history, startedAt, ...rest } = state;
  return cloneState(rest);
}

function rotate(id, delta) {
  const tile = tileById(id);
  if (!tile || ["won", "failed"].includes(state.phase)) return;
  if (state.player.tile === id) return showToast("纸片人所在的纸片不能旋转");
  state.selected = id;
  state.history.push(snapshot());
  tile.rotation = normalize(tile.rotation + delta);
  state.used++;
  sound.cue("rotate");
  drawBoard({ id, delta });
  if (state.used >= currentLevel().limit) fail("折叠次数用完了，试着撤销或重开这一关。");
}

function undo() {
  if (!state.history.length) return showToast("还没有可以撤销的旋转");
  stopTimers();
  const previous = state.history.pop();
  const history = state.history;
  state = { ...previous, history, startedAt: null };
  if (state.phase === "running") state.phase = "paused";
  hideModal();
  drawBoard();
  showToast("已撤销上一步旋转");
}

function startOrPause() {
  if (state.phase === "running") {
    state.elapsed += Date.now() - state.startedAt;
    state.startedAt = null;
    state.phase = "paused";
    stopTimers();
    drawStats();
    return;
  }
  if (!["ready", "paused"].includes(state.phase)) return;
  hideModal();
  state.phase = "running";
  state.startedAt = Date.now();
  timer = setInterval(step, 450);
  clock = setInterval(() => { state.elapsed += Date.now() - state.startedAt; state.startedAt = Date.now(); setClock(); }, 100);
  drawStats();
}

function elapsedNow() {
  if (state.startedAt) state.elapsed += Date.now() - state.startedAt;
  state.startedAt = null;
}

function transitionTarget() {
  let tile = tileById(state.player.tile);
  let x = state.player.x + directions[state.player.direction][0];
  let y = state.player.y + directions[state.player.direction][1];
  let col = tile.col;
  let row = tile.row;
  if (x < 0) { col--; x = CELL_SIZE - 1; }
  if (x >= CELL_SIZE) { col++; x = 0; }
  if (y < 0) { row--; y = CELL_SIZE - 1; }
  if (y >= CELL_SIZE) { row++; y = 0; }
  return { tile: tileAt(col, row), x, y };
}

function findPortalPair(portalType, fromKey) {
  for (const tile of state.tiles) for (let y = 0; y < CELL_SIZE; y++) for (let x = 0; x < CELL_SIZE; x++) {
    const cell = cellAt(tile, x, y);
    if (cell.type === portalType && cell.key !== fromKey) return { tile, x, y };
  }
  return null;
}

function step() {
  if (state.phase !== "running") return;
  const originTile = tileById(state.player.tile);
  const origin = cellAt(originTile, state.player.x, state.player.y);
  const target = transitionTarget();
  if (!target.tile) return fail("纸片人走出了地图边缘。");
  const cell = cellAt(target.tile, target.x, target.y);
  if (cell.type === "#" || (cell.type === "D" && !state.hasKey) || (arrows.includes(cell.type) && arrows.indexOf(cell.type) !== state.player.direction)) {
    state.player.direction = normalize(state.player.direction + 1);
    if (cell.type === "D" && !state.hasKey) state.lockBlocked = true;
    state.spinCount++;
    if (state.spinCount >= 4) return fail(state.lockBlocked ? "先前的路线错过了钥匙，锁门无法通过。" : "四面都无法接通，纸片人在原地打转。");
    playTone(230, .035);
    drawBoard();
    return;
  }
  if (cell.type === " " || cell.type === "!" || (cell.type === "B" && !state.bridgeOn)) return fail(cell.type === "B" ? "纸桥还没有升起。" : cell.type === "!" ? "纸片人踩到了危险格。" : "纸片人跌进了悬崖。");
  if (origin.type === "C") state.crumble.push(origin.key);
  state.player.tile = target.tile.id;
  state.player.x = target.x;
  state.player.y = target.y;
  state.spinCount = 0;
  state.lockBlocked = false;
  if (cell.type === "K") { state.hasKey = true; playTone(760, .09); showToast("找到钥匙了！"); }
  if (cell.type === "T") { state.bridgeOn = true; playTone(650, .09); showToast("纸桥升起来了！"); }
  if (isPortal(cell.type)) {
    const pair = findPortalPair(cell.type, cell.key);
    if (pair) { state.player.tile = pair.tile.id; state.player.x = pair.x; state.player.y = pair.y; playTone(880, .12); }
  }
  if (cell.type === "X") return win();
  drawBoard();
}

function stars() {
  const overPar = state.used - currentLevel().par;
  const threeStarTime = currentLevel().starTime || 45000;
  return overPar <= 0 && state.elapsed < threeStarTime ? 3 : overPar <= 1 && state.elapsed < Math.max(90000, threeStarTime * 2) ? 2 : 1;
}

function win() {
  elapsedNow();
  stopTimers();
  state.phase = "won";
  sound.cue("award");
  if (levelIndex + 2 > unlocked) { unlocked = Math.min(LEVELS.length, levelIndex + 2); localStorage.setItem("folded-path-unlocked", String(unlocked)); }
  const rating = stars();
  const wasPerfect = allPerfect(records);
  const newBadge = rating === 3 && records[currentLevel().id]?.stars !== 3;
  saveRecord(records, currentLevel().id, { stars: rating, timeMs: state.elapsed, rotations: state.used });
  drawBoard();
  drawProgress();
  if (newBadge) $("#badge-shelf").querySelector(`[data-badge="${currentLevel().id}"]`)?.classList.add("just-earned");
  const final = levelIndex === LEVELS.length - 1;
  const justCompletedCollection = !wasPerfect && allPerfect(records);
  const award = newBadge ? `<div class="award-detail">${badgeMarkup(currentLevel().id, true)}<span><strong>新名牌已获得</strong><small>三星珍藏 · ${currentLevel().name}</small></span></div>` : "";
  if (justCompletedCollection) {
    showModal({ kicker: "十二枚名牌 · 全部收集", title: "终章即将展开", message: "谢谢你走完每一道折痕。", details: `${award}<div>用时 ${$("#time-value").textContent} · 旋转 ${state.used} 次</div>`, actions: [{ label: "立即开启终章 →", primary: true, callback: () => { clearTimeout(finaleTimer); hideModal(); finale.start(); } }] });
    finaleTimer = setTimeout(() => { hideModal(); finale.start(); }, 2600);
    return;
  }
  const finalActions = allPerfect(records)
    ? [{ label: "重玩本关", callback: () => loadLevel(levelIndex, false) }, { label: "进入隐藏关 →", primary: true, callback: openBoss }]
    : [{ label: "重玩本关", callback: () => loadLevel(levelIndex, false) }];
  showModal({ kicker: "路线接通", title: final ? "所有折页已走通！" : "抵达出口！", message: currentLevel().goal, details: `<div class="result-stars">${"✦".repeat(rating)}<span>${"✦".repeat(3 - rating)}</span></div>${award}<div>用时 ${$("#time-value").textContent} · 旋转 ${state.used} 次</div>${final && !allPerfect(records) ? `<div>距离隐藏关还差 ${12 - perfectCount(records)} 个三星记录</div>` : ""}`, actions: final ? finalActions : [{ label: "再玩一次", callback: () => loadLevel(levelIndex, false) }, { label: "下一关 →", primary: true, callback: () => loadLevel(levelIndex + 1) }] });
}

function openBoss() {
  if (!allPerfect(records)) return showToast("前十二关全部三星后，隐藏关才会出现。");
  if (state.phase === "running") { elapsedNow(); state.phase = "paused"; }
  stopTimers();
  hideModal();
  $("#normal-game").hidden = true;
  sound.setMode("boss");
  boss.enter();
}

function openVideo() {
  if (!allCleared(records)) return showToast("前十二关全部通关后，才能观看通关视频。");
  if (state.phase === "running") startOrPause();
  hideModal();
  $("#video-overlay").hidden = false;
  $("#video-close").focus();
  void $("#reward-video").play().catch(() => { /* 浏览器不允许自动播放时仍可用视频控件播放 */ });
}

function closeVideo() {
  $("#reward-video").pause();
  $("#video-overlay").hidden = true;
  $("#video-entry").focus();
}

function fail(message) {
  elapsedNow();
  stopTimers();
  state.phase = "failed";
  sound.cue("fail");
  drawBoard();
  showModal({ kicker: "这条路暂时断了", title: "再折一次吧", message, actions: [{ label: "撤销旋转", callback: undo, disabled: state.history.length === 0 }, { label: "重开本关", primary: true, callback: () => loadLevel(levelIndex, false) }] });
}

function showModal({ kicker = "", title, message, details = "", actions = [] }) {
  $("#modal-kicker").textContent = kicker;
  $("#modal-title").textContent = title;
  $("#modal-message").textContent = message;
  $("#modal-details").innerHTML = details;
  $("#modal-actions").innerHTML = "";
  for (const action of actions) {
    const button = document.createElement("button");
    button.className = action.primary ? "primary-button" : "outline-button";
    button.textContent = action.label;
    button.disabled = !!action.disabled;
    button.addEventListener("click", action.callback);
    $("#modal-actions").append(button);
  }
  $("#modal").classList.remove("hidden");
}
function hideModal() { $("#modal").classList.add("hidden"); }
function showToast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2200);
}

function playTone(frequency, duration) {
  sound.tone(frequency, duration);
}

board.addEventListener("click", (event) => {
  const tileElement = event.target.closest(".tile");
  if (!tileElement) return;
  const id = tileElement.dataset.tile;
  const turnButton = event.target.closest("[data-turn]");
  if (turnButton) return rotate(id, Number(turnButton.dataset.turn));
  state.selected = id;
  drawBoard();
});
board.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    const tileElement = event.target.closest(".tile");
    if (tileElement && event.target === tileElement) { event.preventDefault(); state.selected = tileElement.dataset.tile; drawBoard(); }
  }
});
document.addEventListener("keydown", (event) => {
  if ($("#normal-game").hidden || !$("#finale-screen").hidden || !$("#video-overlay").hidden) return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.matches("input,textarea")) return;
  if (event.key.toLowerCase() === "q" && state.selected) rotate(state.selected, -1);
  if (event.key.toLowerCase() === "e" && state.selected) rotate(state.selected, 1);
  if (event.code === "Space" && $("#modal").classList.contains("hidden")) { event.preventDefault(); startOrPause(); }
});
$("#play-button").addEventListener("click", startOrPause);
$("#restart-button").addEventListener("click", () => loadLevel(levelIndex, false));
$("#undo-button").addEventListener("click", undo);
$("#rotate-left").addEventListener("click", () => rotate(state.selected, -1));
$("#rotate-right").addEventListener("click", () => rotate(state.selected, 1));
$("#next-button").addEventListener("click", () => { if (state.phase === "won" && levelIndex < LEVELS.length - 1) loadLevel(levelIndex + 1); });
$("#level-dots").addEventListener("click", (event) => { const button = event.target.closest("[data-level]"); if (button && Number(button.dataset.level) < unlocked) loadLevel(Number(button.dataset.level)); });
$("#boss-entry").addEventListener("click", openBoss);
$("#video-entry").addEventListener("click", openVideo);
$("#video-close").addEventListener("click", closeVideo);
$("#video-overlay").addEventListener("click", (event) => { if (event.target === $("#video-overlay")) closeVideo(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("#video-overlay").hidden) closeVideo(); });
$("#finale-replay").addEventListener("click", () => { if (allPerfect(records)) { hideModal(); finale.start(); } });
$("#sound-button").classList.toggle("active", sound.isEnabled());
$("#sound-button").setAttribute("aria-pressed", String(sound.isEnabled()));
$("#sound-button").title = sound.isEnabled() ? "关闭音乐与音效" : "打开音乐与音效";
$("#sound-button").addEventListener("click", () => { const enabled = sound.setEnabled(!sound.isEnabled()); $("#sound-button").classList.toggle("active", enabled); $("#sound-button").setAttribute("aria-pressed", String(enabled)); $("#sound-button").title = enabled ? "关闭音乐与音效" : "打开音乐与音效"; showToast(enabled ? "音乐与音效已打开" : "音乐与音效已关闭"); });
document.addEventListener("click", (event) => { if (event.target.closest("button") && !event.target.closest("#sound-button")) sound.cue("click"); }, { capture: true });
$("#help-button").addEventListener("click", () => showModal({ kicker: "折页图例", title: "每格都有它的脾气", message: "纸片人每 0.45 秒走一格，撞墙顺时针转向。道路边缘对齐才可跨纸片；未接通的边缘会挡路。", details: "✦ 出口　◆ 钥匙　▣ 锁门　● 开关　≋ 纸桥<br>→ 单向路　◌ 一次性路　◎ 同号传送门　× 危险格", actions: [{ label: "知道了", primary: true, callback: hideModal }] }));
$("#modal-close").addEventListener("click", hideModal);
$("#modal").addEventListener("click", (event) => { if (event.target === $("#modal")) hideModal(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && state.phase === "running") startOrPause(); });

loadLevel(0);

// 小型只读调试接口，便于浏览器中的验证脚本检查路线与状态。
window.__foldedPath = { getState: () => cloneState(state), getRecords: () => cloneState(records), loadLevel, rotate, step, startOrPause, undo, cellAt: (id, x, y) => cellAt(tileById(id), x, y), boss, finale, audioMode: () => sound.mode(), audioStatus: () => sound.status() };
