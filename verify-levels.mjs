import { LEVELS, CELL_SIZE } from "./levels.js";

const arrows = ["^", ">", "v", "<"];
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const isPortal = (symbol) => /^[0-9]$/.test(symbol);

function checkLevel(level) {
  const tiles = level.tiles.map((tile) => ({ ...tile, rotation: tile.solutionRotation ?? 0 }));
  const byPlace = new Map(tiles.map((tile) => [`${tile.col}:${tile.row}`, tile]));
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  const portals = new Map();
  for (const tile of tiles) {
    if (tile.cells.length !== CELL_SIZE || tile.cells.some((row) => row.length !== CELL_SIZE)) throw Error(`第 ${level.id} 关有非 5×5 纸片`);
    for (const symbol of tile.cells.join("")) if (isPortal(symbol)) portals.set(symbol, (portals.get(symbol) || 0) + 1);
  }
  for (const [symbol, count] of portals) if (count !== 2) throw Error(`第 ${level.id} 关 ${symbol} 号传送门出现 ${count} 次`);
  if (level.limit <= level.par) throw Error(`第 ${level.id} 关的旋转预算不足`);

  const crumble = new Set();
  const player = { ...level.start };
  const entries = new Map([[player.tile, 1]]);
  let hasKey = false;
  let bridgeOn = false;
  let turns = 0;
  const seen = new Set();
  const cellAt = (tile, displayX, displayY) => {
    let x = displayX, y = displayY;
    for (let i = 0; i < tile.rotation; i++) [x, y] = [y, CELL_SIZE - 1 - x];
    const key = `${tile.id}:${x}:${y}`;
    const raw = crumble.has(key) ? " " : tile.cells[y][x];
    return { key, type: arrows.includes(raw) ? arrows[(arrows.indexOf(raw) + tile.rotation) % 4] : raw };
  };
  let branches = 0;
  const passable = (type) => !["#", " ", "!"].includes(type);
  for (const tile of tiles) for (const [dc, dr] of [[1, 0], [0, 1]]) {
    const neighbor = byPlace.get(`${tile.col + dc}:${tile.row + dr}`);
    if (!neighbor || tile.route === neighbor.route) continue;
    for (let offset = 0; offset < CELL_SIZE; offset++) {
      const first = cellAt(tile, dc ? 4 : offset, dr ? 4 : offset).type;
      const second = cellAt(neighbor, dc ? 0 : offset, dr ? 0 : offset).type;
      if (passable(first) && passable(second)) branches++;
    }
  }
  for (let step = 0; step < 1000; step++) {
    if (Number(process.env.TRACE_LEVEL) === level.id) console.log("trace", level.id, step, player.tile, player.x, player.y, player.direction);
    const fingerprint = `${player.tile}:${player.x}:${player.y}:${player.direction}:${hasKey}:${bridgeOn}:${crumble.size}`;
    if (seen.has(fingerprint)) throw Error(`第 ${level.id} 关在第 ${step} 步进入循环`);
    seen.add(fingerprint);
    const origin = cellAt(byId.get(player.tile), player.x, player.y);
    let x = player.x + directions[player.direction][0];
    let y = player.y + directions[player.direction][1];
    let col = byId.get(player.tile).col;
    let row = byId.get(player.tile).row;
    if (x < 0) { x = 4; col--; } else if (x > 4) { x = 0; col++; }
    if (y < 0) { y = 4; row--; } else if (y > 4) { y = 0; row++; }
    const tile = byPlace.get(`${col}:${row}`);
    if (!tile) throw Error(`第 ${level.id} 关在第 ${step} 步走出地图`);
    const target = cellAt(tile, x, y);
    if (target.type === "#" || (target.type === "D" && !hasKey) || (arrows.includes(target.type) && arrows.indexOf(target.type) !== player.direction)) {
      player.direction = (player.direction + 1) % 4;
      turns++;
      continue;
    }
    if (target.type === " " || target.type === "!" || (target.type === "B" && !bridgeOn)) throw Error(`第 ${level.id} 关在第 ${step} 步踩到 ${target.type}`);
    if (origin.type === "C") crumble.add(origin.key);
    if (tile.id !== player.tile) entries.set(tile.id, (entries.get(tile.id) || 0) + 1);
    player.tile = tile.id; player.x = x; player.y = y;
    if (target.type === "K") hasKey = true;
    if (target.type === "T") bridgeOn = true;
    if (isPortal(target.type)) {
      const pair = tiles.flatMap((candidate) => {
        const matches = [];
        for (let py = 0; py < 5; py++) for (let px = 0; px < 5; px++) {
          const cell = cellAt(candidate, px, py);
          if (cell.type === target.type && cell.key !== target.key) matches.push({ tile: candidate, x: px, y: py });
        }
        return matches;
      })[0];
      if (!pair) throw Error(`第 ${level.id} 关的传送门缺少配对`);
        if (pair.tile.id !== player.tile) entries.set(pair.tile.id, (entries.get(pair.tile.id) || 0) + 1);
        player.tile = pair.tile.id; player.x = pair.x; player.y = pair.y;
    }
    if (target.type === "X") {
      if (level.id >= 7 && turns < level.rows) throw Error(`第 ${level.id} 关的实际路线弯道太少`);
      const revisitedTiles = [...entries.values()].filter((count) => count >= 2).length;
      if (level.id >= 9 && revisitedTiles < level.tiles.length - 1) throw Error(`第 ${level.id} 关只有 ${revisitedTiles} 张纸片被重复使用`);
      if (level.id >= 9 && (step + 1) * 450 >= level.starTime) throw Error(`第 ${level.id} 关正常行走也无法三星`);
      return { level: level.id, cells: level.tiles.length, steps: step + 1, turns, branches, revisitedTiles, par: level.par };
    }
  }
  throw Error(`第 ${level.id} 关超过 1000 步仍未抵达出口`);
}

for (const level of LEVELS) console.log(checkLevel(level));
