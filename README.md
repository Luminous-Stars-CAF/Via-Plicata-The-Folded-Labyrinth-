# 折页迷途 · Via Plicata: The Folded Labyrinth

## 项目简介 / Project Overview

**中文：**《折页迷途》是一款浏览器端纸片拼贴解谜游戏。小纸片人会自动前进，玩家不能直接操控它，只能旋转地图块、接通道路，在有限的旋转次数内避开危险并找到出口。游戏包含 12 个逐步引入机关的关卡，以及集齐 12 枚三星名牌后解锁的隐藏 Boss 关。项目使用原生 HTML、CSS 和 JavaScript 开发，无需后端；音乐与音效在浏览器中生成，游玩进度保存在本地。

**English:** *Via Plicata: The Folded Labyrinth* is a browser-based paper-collage puzzle game. A tiny paper traveler moves on its own; instead of steering it, players rotate map tiles to connect paths, avoid hazards, and reach the exit within a limited number of turns. The game features 12 progressively challenging levels and a hidden boss level unlocked by earning three stars in all 12. Built with vanilla HTML, CSS, and JavaScript, it requires no backend. Music and sound effects are generated in the browser, and progress is saved locally.

## 启动

在本目录运行（需要 Node.js）：

```powershell
node server.mjs
```

然后打开 `http://127.0.0.1:8000/`。也可以使用其他静态服务器。因为游戏使用 ES 模块，建议通过 HTTP 打开，不要直接双击 `index.html`。

## 操作与规则

- 点击纸片上的 `↶` / `↷` 按钮旋转；选中纸片后可按 `Q` / `E` 逆时针／顺时针旋转。手机直接点击按钮。
- 点击「开始行走」后，纸片人约每 0.45 秒前进一步；空格键可暂停或继续。撞墙顺时针转向。
- 相邻纸片的边缘道路对齐才能跨越。走出地图、踏进悬崖、危险格或未升起的桥会失败。纸片人所在纸片不能旋转。
- 每关旋转次数有限；用尽后未通关会失败。可撤销上一次旋转或重开本关。
- 单向道路只能沿箭头前进；钥匙可打开锁门；开关会升起纸桥；一次性道路离开后消失；传送门会把纸片人送到另一端。
- 抵达出口后显示用时、旋转次数和星级，并解锁下一关。进度保存在浏览器本地。
- 「旅程 · 星级记录」会保存每关历史最高星级；重玩得到较低星级不会覆盖最佳记录。前十二关**全部通关（任意星级）**即可在旅程面板观看第十三关的加速通关视频；**全部三星、集齐 12 枚名牌**才能进入隐藏 Boss。看视频本身不会解锁 Boss。旧版仅保存的关卡解锁进度不会被当成通关记录。
- 每关首次三星会获得一枚与关卡名称对应的卡通纸片名牌。右侧「纸上勋章」陈列 12 枚普通名牌；Boss 三星还有额外的第 13 枚隐藏勋章。跳关码不会发放 Boss 勋章。
- 集齐前 12 枚会自动播放制作人致谢和名牌融合动画，然后进入 Boss。动画可跳过；集齐后也可在勋章栏点击「重看集章终章」。旧存档已有 12 个三星时，可用这个按钮观看。
- 音乐与音效完全由浏览器本地合成：前 12 关共享柔和旋律，Boss 使用相近主题的紧张变奏。首次点击或按键后音乐才会启动（浏览器自动播放限制）；右上角 `♪` 可随时开关，偏好保存在本地。系统开启「减少动态效果」时，动画会缩短。

## 隐藏 Boss：万页迷宫

第十三关有 **100 × 100 张纸片**，每张纸片是 **100 × 100 格**。同一张纸片通常有两条不相交的绕路：正程穿过全图，到了远端再从另一条路折返，9,999 张纸片会被第二次进入。错误旋转可能在相当长的路程后才显露问题：已验证的一条假解能穿过 100 张纸片，却因错过钥匙而在远处被锁门挡住。正确解需 8,223,617 步、19,998 次跨纸片；旋转预算只比理论最少次数多 3 次，目标是极难而非无解。

全图导航可拖动平移、滚轮或滑块缩放，也可输入行列跳转；右侧显示选中纸片的内部道路。点击纸片后用按钮或 `Q` / `E` 旋转，不能旋转纸片人当前所在的纸片。Boss 提供行走倍率以免等待数小时，倍率只改变播放速度，不改变路线或旋转预算。手机可通过行列跳转和地图拖动操作。未完成的尝试会定期保存在浏览器本地，刷新或返回旅程后可继续；重开本关会清除该尝试。

本次重制后的 Boss 存档使用新版本；旧地图的未完成尝试不会续接到新地图，但旧数据并未删除。前十二关的星级记录不受影响。

地图按固定种子生成并按需绘制，不会一次创建一亿个 DOM 格子，也不需要联网。

### 加速通关回放与跳关码

前十二关全部通关后，旅程面板的「观看第 13 关通关视频」按钮会解锁，无需三星；进入 Boss 后也可在页面底部播放 `boss-clear.webm`（约 36 秒）。视频由 `make-boss-video.mjs` 调用实际关卡规则模拟全部 8,223,617 步，再按进度抽帧录制；旋转准备和行走都作倍速压缩，**不是实时手玩录像**。`boss-video-poster.png` 是视频封面。

Boss 右侧有「跳关代码」输入框；输入区分大小写的 `Furina1st` 并点击「使用」即可跳过第十三关。跳过状态保存在浏览器本地，但不产生三星或其他手动通关星级记录；重开本关后仍可正常挑战。第十三关的入口仍须先拿到前十二关全部三星。

## 项目结构

- `index.html`：页面结构与控制按钮。
- `styles.css`：纸张拼贴视觉和响应式布局。
- `badges.js`、`achievements.css`：13 枚 SVG 卡通名牌、成就陈列与动画样式。
- `finale.js`：十二枚集齐后的致谢、融合、跳过与 Boss 过渡。
- `audio.js`：离线 Web Audio 背景旋律、Boss 变奏及交互音效。
- `levels.js`：前六关的结构化教程数据。
- `advanced-levels.js`：第 7–12 关的结构化数据配方；第 9–12 关每层六张纸都会在第二圈再次使用另一条道路。
- `advanced.css`：进阶大地图与十二关入口的适配样式。
- `verify-levels.mjs`：逐步模拟十二关的正确朝向，检查通关、传送门配对、重复经过纸片与三星时间；运行 `node verify-levels.mjs`。`verify-decoys.mjs` 检查第 9–12 关的错误朝向确实能推进多张纸片但最终被挡住。
- `verify-revisit-browser.mjs`：在独立浏览器上下文中实际游玩第 9–12 关，检查正确解三星、错误路线失败和控制台错误；需要本机 Chromium/Edge 与 Playwright。
- `progress.js`：独立的逐关星级记录、全通关视频门槛与全三星 Boss 门槛；`verify-progress.mjs` 检查记录逻辑。
- `boss-level.js`：第十三关的可复现地图生成器；`verify-boss.mjs` 逐步验证完整正确路线。
- `boss-game.js`、`boss.css`：Boss 的 Canvas 局部绘制、导航、旋转、自动行走和适配界面。
- `boss-clear.webm`、`boss-video-poster.png`：第十三关的加速通关回放和封面；`make-boss-video.mjs` 可按同一关卡规则重新生成，需要本机 Chromium/Edge 与 Playwright。
- `game.js`：旋转坐标、自动行走、机关、界面和关卡状态。
- `verify-achievements-browser.mjs`：使用隔离浏览器数据实际完成 12 关三星并检查名牌、终章和 Boss 过渡；需要本机 Chromium/Edge 与 Playwright。设置 `CAPTURE=1` 可在本目录输出桌面、手机与终章截图。
- `verify-video-gate-browser.mjs`：隔离检查空记录、11 关通关、12 关低星通关及 12 关全三星时的视频／Boss 两套门槛，并实际播放视频。
- `server.mjs`：仅用于本地预览的静态服务器，无依赖、无游戏后端。

前十二关的每个地图块为固定 5×5 字符网格：`#` 墙、`.` 道路、空格悬崖、`S` 起点、`X` 出口、`K` 钥匙、`D` 门、`T` 开关、`B` 桥、`C` 一次性道路、`0`–`9` 同号配对传送门、`!` 危险格、`^ > v <` 单向道路。新增常规关卡时指定地图块的位置与初始旋转角度即可。进阶关卡的数据配方还可设置倒置纸片、每层机关以及岔路密度。隐藏关另用 `boss-level.js` 的 100×100 按需生成模型。
