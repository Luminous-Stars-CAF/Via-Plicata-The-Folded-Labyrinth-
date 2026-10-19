// 第 7–8 关保留原有回廊；第 9–12 关使用双程回廊，
// 同一张 5×5 纸片第一次与第二次分别走不同的道路。
const COLORS = ["mint", "peach", "lavender", "blue", "yellow", "rose"];
const ARROWS = ["^", ">", "v", "<"];
const H = (line) => ["#####", "#####", line, "#####", "#####"];
const WEST_SOUTH = ["#####", "#####", "...##", "##v##", "##.##"];
const NORTH_WEST = ["##.##", "##v##", "...##", "#####", "#####"];
const EAST_NORTH = ["##.##", "##^##", "##...", "#####", "#####"];
const SOUTH_EAST = ["#####", "#####", "##...", "##^##", "##.##"];

function rotatePattern(rows, turns) {
  let grid = rows.map((line) => [...line]);
  for (let turn = 0; turn < ((turns % 4) + 4) % 4; turn++) {
    const next = Array.from({ length: 5 }, () => Array(5).fill("#"));
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const symbol = grid[y][x];
      next[x][4 - y] = ARROWS.includes(symbol) ? ARROWS[(ARROWS.indexOf(symbol) + 1) % 4] : symbol;
    }
    grid = next;
  }
  return grid.map((line) => line.join(""));
}

function tileId(index) {
  return index < 26 ? String.fromCharCode(97 + index) : `a${String.fromCharCode(97 + index - 26)}`;
}

function deadEnd(side, y, branchLevel, dangerous) {
  const grid = Array.from({ length: 5 }, () => Array(5).fill("#"));
  for (let x = side === "left" ? 0 : 1; x <= (side === "left" ? 3 : 4); x++) grid[y][x] = ".";
  if (branchLevel >= 3) {
    const nextY = y === 3 ? 2 : y + 1;
    grid[nextY][2] = ".";
    grid[nextY][3] = ".";
  }
  if (branchLevel >= 4) {
    const otherY = y === 3 ? 4 : 0;
    grid[otherY][1] = ".";
    grid[otherY][2] = ".";
  }
  if (dangerous) grid[y][side === "left" ? 3 : 1] = "!";
  return grid.map((line) => line.join(""));
}

function makeLevel(config) {
  const builders = new Map();
  const roles = new Map();
  const place = (row, col, pattern, role = null) => {
    const builder = { row, col, route: role !== null, cells: pattern.map((line) => [...line]) };
    builders.set(`${row}:${col}`, builder);
    if (role) roles.set(role, builder);
    return builder;
  };

  for (let band = 0; band < config.bands; band++) {
    const top = band * 2;
    const bottom = top + 1;
    const first = band === 0;
    const last = band === config.bands - 1;
    const connected = config.branchLevel >= 1;
    const twoBranches = config.branchLevel >= 2;
    if (band % 2 === 0) {
      const entry = place(top, 0, H(first ? ".S>.." : `.${band - 1}>..`), `${band}:entry`);
      const turn1 = place(top, 1, WEST_SOUTH, `${band}:turn1`);
      const turn2 = place(bottom, 1, NORTH_WEST, `${band}:turn2`);
      const out = place(bottom, 0, H(last ? ".X<.." : `.${band}<..`), `${band}:out`);
      if (connected) {
        for (let x = 1; x < 5; x++) turn1.cells[1][x] = ".";
      }
      if (twoBranches) {
        turn2.cells[1][3] = ".";
        turn2.cells[1][4] = ".";
      }
      place(top, 2, deadEnd("left", 1, config.branchLevel, config.branchLevel >= 3 && band % 2 === 0));
      place(bottom, 2, deadEnd("left", 1, config.branchLevel, config.branchLevel >= 4 || (config.branchLevel >= 3 && band % 2 === 1)));
      void entry; void out;
    } else {
      const entry = place(bottom, 2, H(`..<${band - 1}.`), `${band}:entry`);
      const turn1 = place(bottom, 1, EAST_NORTH, `${band}:turn1`);
      const turn2 = place(top, 1, SOUTH_EAST, `${band}:turn2`);
      const out = place(top, 2, H(last ? "..>X." : `..>${band}.`), `${band}:out`);
      if (connected) {
        turn1.cells[1][0] = ".";
        turn1.cells[1][1] = ".";
      }
      if (twoBranches) {
        turn2.cells[3][0] = ".";
        turn2.cells[3][1] = ".";
      }
      place(top, 0, deadEnd("right", 3, config.branchLevel, config.branchLevel >= 4 || (config.branchLevel >= 3 && band % 2 === 1)));
      place(bottom, 0, deadEnd("right", 1, config.branchLevel, config.branchLevel >= 3 && band % 2 === 0));
      void entry; void out;
    }
  }

  for (const [band, role, x, y, symbol] of config.effects) {
    roles.get(`${band}:${role}`).cells[y][x] = symbol;
  }

  const tiles = [];
  for (let row = 0; row < config.bands * 2; row++) for (let col = 0; col < 3; col++) {
    const index = row * 3 + col;
    const builder = builders.get(`${row}:${col}`);
    const frame = (config.id + index * 3) % 4;
    const offset = !builder.route || index === 0
      ? builder.route || config.branchLevel >= 3 ? 0 : index % 2 ? 1 : 3
      : config.twice.includes(index) ? 2 : index % 2 ? 1 : 3;
    tiles.push({
      id: tileId(index), col, row, color: COLORS[(index + row) % COLORS.length],
      rotation: (frame + offset) % 4, solutionRotation: frame, route: builder.route,
      cells: rotatePattern(builder.cells.map((line) => line.join("")), -frame)
    });
  }
  const par = tiles.filter((tile) => tile.route).reduce((sum, tile) => {
    const distance = (tile.rotation - tile.solutionRotation + 4) % 4;
    return sum + Math.min(distance, 4 - distance);
  }, 0);
  return {
    id: config.id, name: config.name, goal: config.goal, tag: config.tag,
    cols: 3, rows: config.bands * 2, limit: par + 1, par, starTime: config.starTime,
    start: { tile: "a", x: 1, y: 2, direction: 1 }, tiles
  };
}

// 第 9–12 关：每个双行回廊绕两圈。六张纸片各有互不相交的两条路，
// 第一圈从上方通过，绕回起点纸片后，第二圈改走另一组入口和出口。
// 只在离开纸片后才能调整它的朝向；跨层传送发生在第二圈末端。
const REVISIT_PATTERNS = {
  entry: ["#####", "#@>>>", "#####", "#^>>>", "#^###"],
  east: ["#####", ".....", "#####", ".....", "#####"],
  down: ["#####", ">>>>#", "###v#", ">>#v#", "#v#v#"],
  west: ["#v#v#", "<v#v#", "###v#", "<<<v#", "#####"],
  back: ["#####", "<<<<<", "#####", "<<<<<", "#####"],
  return: ["#^###", "#^@<<", "#^###", "#<<<<", "#####"]
};

const REVISIT_EFFECTS = {
  9: [[0, "east", 2, 1, "K"], [0, "return", 3, 3, "D"], [0, "down", 3, 2, "C"], [1, "west", 3, 2, "T"], [1, "back", 2, 3, "D"], [2, "east", 2, 3, "B"]],
  10: [[0, "east", 2, 1, "K"], [0, "return", 3, 3, "D"], [0, "west", 3, 2, "C"], [1, "down", 3, 2, "T"], [1, "back", 2, 3, "D"], [2, "west", 1, 1, "B"], [2, "back", 2, 1, "C"]],
  11: [[0, "east", 2, 1, "K"], [0, "return", 3, 3, "D"], [0, "down", 3, 2, "C"], [1, "west", 3, 2, "T"], [1, "back", 2, 3, "D"], [2, "east", 2, 3, "B"], [2, "return", 3, 3, "C"], [3, "back", 2, 1, "D"]],
  12: [[0, "east", 2, 1, "K"], [0, "return", 3, 3, "D"], [0, "west", 3, 2, "C"], [1, "down", 3, 2, "T"], [1, "back", 2, 3, "D"], [2, "east", 2, 3, "B"], [2, "return", 3, 3, "C"], [3, "west", 1, 1, "D"], [3, "back", 2, 1, "C"], [4, "east", 2, 1, "K"], [4, "back", 2, 3, "B"]]
};

function makeRevisitLevel(config) {
  const slots = [
    [0, 0, "entry"], [1, 0, "east"], [2, 0, "down"],
    [0, 1, "return"], [1, 1, "back"], [2, 1, "west"]
  ];
  const tiles = [];
  for (let band = 0; band < config.bands; band++) {
    for (const [col, rowOffset, role] of slots) {
      const row = band * 2 + rowOffset;
      const index = row * 3 + col;
      const cells = REVISIT_PATTERNS[role].map((line) => [...line]);
      if (role === "entry") cells[1][1] = band === 0 ? "S" : String(band - 1);
      if (role === "return") cells[1][2] = band === config.bands - 1 ? "X" : String(band);
      for (const [effectBand, effectRole, x, y, symbol] of REVISIT_EFFECTS[config.id]) {
        if (effectBand === band && effectRole === role) cells[y][x] = symbol;
      }
      const frame = (config.id + index * 3) % 4;
      const offset = index === 0 ? 0 : config.twice.includes(index) ? 2 : index % 2 ? 1 : 3;
      tiles.push({
        id: tileId(index), col, row, color: COLORS[(index + row) % COLORS.length],
        rotation: (frame + offset) % 4, solutionRotation: frame,
        route: true, revisit: true,
        cells: rotatePattern(cells.map((line) => line.join("")), -frame)
      });
    }
  }
  tiles.sort((a, b) => a.row - b.row || a.col - b.col);
  const par = tiles.reduce((sum, tile) => {
    const distance = (tile.rotation - tile.solutionRotation + 4) % 4;
    return sum + Math.min(distance, 4 - distance);
  }, 0);
  return {
    id: config.id, name: config.name, goal: config.goal, tag: config.tag,
    cols: 3, rows: config.bands * 2, limit: par + 1, par,
    starTime: config.bands * 35_000,
    start: { tile: "a", x: 1, y: 1, direction: 1 }, tiles
  };
}

const CONFIGS = [
  {
    id: 7, name: "双层回廊", goal: "绕过四个拐角，拿钥匙走出双层折页。", tag: "转角接力",
    bands: 2, branchLevel: 1, twice: [],
    effects: [[0, "entry", 3, 2, "K"], [0, "turn2", 1, 2, "C"], [1, "turn1", 3, 2, "T"], [1, "turn2", 3, 2, "B"], [1, "out", 1, 2, "D"]]
  },
  {
    id: 8, name: "岔路回声", goal: "辨认岔路，踩下开关跨过纸桥。", tag: "双层岔路",
    bands: 2, branchLevel: 2, twice: [1, 4, 10],
    effects: [[0, "entry", 3, 2, "K"], [0, "out", 3, 2, "D"], [1, "turn1", 3, 2, "T"], [1, "turn2", 3, 2, "B"], [1, "out", 1, 2, "C"]]
  },
  {
    id: 9, name: "三层错页", goal: "同一张纸要走两次，找对第二圈的传送顺序。", tag: "双回廊",
    bands: 3, twice: [1, 4, 10]
  },
  {
    id: 10, name: "暗线绕行", goal: "第一圈不是终点；回来时改走另一条暗线。", tag: "重复折返",
    bands: 3, twice: [1, 3, 4, 7, 10, 13]
  },
  {
    id: 11, name: "五岔纸林", goal: "四层纸片需要反复使用，假路线也能走过一段。", tag: "双程迷途",
    bands: 4, twice: [1, 3, 4, 7, 8, 10, 13, 16]
  },
  {
    id: 12, name: "终稿迷途", goal: "五层回廊各绕两次，别让早期的选择堵住返程。", tag: "终章 · 万重折返",
    bands: 5, twice: [1, 3, 4, 7, 8, 10, 13, 15, 16, 19, 22, 25]
  }
];

export const ADVANCED_LEVELS = CONFIGS.map((config) => config.id < 9 ? makeLevel(config) : makeRevisitLevel(config));
