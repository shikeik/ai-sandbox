# AI 神经元训练沙盘 —— 项目指南

> 本文件面向 AI 编程助手。如果你刚接触本项目，请完整阅读此文档后再修改代码。

---

## 1. 项目概述

**项目名称**：`ai-sandbox`（AI 神经元训练沙盘）  
**类型**：纯前端网页应用 —— 一套结合"游戏化演示"与"实时神经网络可视化训练"的交互式教学沙盘。

**核心体验**：
- **🦊 单层感知机演示**（`fox-jump`）：玩家控制一只纯 CSS 绘制的狐狸，在 32 格横版地形中右移或跳跃躲避坑洞。可切换为 AI 控制/AI 训练模式，实时观察一个 4→3 单层神经网络的权重变化。
- **📐 地形实验室**（`terrain-lab`）：监督学习演示。支持地形编辑、带隐藏层的 MLP（多层感知机）动作预测、批量训练与可视化。
- **🧮 MLP 神经网络教学**（`mlp-teaching`）：前向传播与反向传播的可视化教学页面。

---

## 2. 技术栈

| 技术 | 说明 |
|------|------|
| **语言** | TypeScript（ES Modules，`"type": "module"`） |
| **构建工具** | Vite 5（多页面入口配置） |
| **前端框架** | **无**。所有逻辑均为手写 Vanilla JS/TS |
| **样式** | 纯 CSS（无预处理器），含大量自定义 CSS 动画与 WAAPI（Web Animations API） |
| **绘图** | Canvas 2D（神经网络可视化、地形编辑） |
| **持久化** | `localStorage`（保存玩家最佳通关纪录） |
| **Node 脚本** | 原生 `fs` + `child_process` 实现单文件打包 |

---

## 3. 目录结构

```
├── index.html                      # 导航入口页（选择三个演示模块）
├── package.json
├── vite.config.js                  # 多页面 Rollup 配置 + 路径别名
├── tsconfig.json                   # TypeScript 严格模式、ES2020
├── eslint.config.js                # ESLint 规则（双引号、无分号、禁止 var）
├── tsconfig.node.json
├── deploy.sh                       # 一键部署脚本
├── TODO.md                         # 项目待办与已知问题
├── scripts/
│   └── build-single-file.mjs       # 将 Vite 构建产物中的全部 HTML 页面内联为各自独立的单文件
├── pages/                          # 多页面 HTML 入口
│   ├── fox-jump.html               # 狐狸跳跃游戏页
│   ├── terrain-lab.html            # 地形实验室页
│   └── mlp-teaching.html           # MLP 教学页
├── src/
│   ├── types.d.ts                  # 全局类型声明（CSS 导入、Vite HMR）
│   ├── engine/                     # 共享引擎层（被多个页面复用）
│   │   ├── eps.ts                  # EPS 恒竖布局系统
│   │   ├── utils/
│   │   │   └── Logger.ts           # 带标签的日志系统（支持订阅、下载）
│   │   └── console/
│   │       ├── index.ts
│   │       ├── ConsolePanel.ts     # 可折叠控制台面板（标签筛选、自动滚动）
│   │       └── console.css         # 控制台样式
│   ├── fox-jump/                   # 狐狸跳跃游戏（原主项目）
│   │   ├── main.ts                 # 游戏入口
│   │   ├── style.css               # 全局样式、布局、UI 控件
│   │   ├── style-fox.css           # 狐狸纯 CSS 绘制与动画状态
│   │   ├── game/
│   │   │   ├── JumpGame.ts         # 游戏核心逻辑（地形生成、碰撞检测、状态机）
│   │   │   └── TerrainGenerator.ts # 种子化地形生成器（Mulberry32）
│   │   ├── render/
│   │   │   ├── FoxAnimator.ts      # 狐狸动画状态机（CSS class + WAAPI）
│   │   │   ├── GameRenderer.ts     # DOM 渲染器 + Tween 补间
│   │   │   └── TransitionManager.ts # 死亡/胜利黑屏转场
│   │   ├── ai/
│   │   │   ├── AIController.ts     # AI 控制器（模式切换、速度控制、训练循环）
│   │   │   ├── NeuralNetwork.ts    # 单层神经网络（4 输入 → 3 输出）+ ε-贪心
│   │   │   └── PlayerBestStore.ts  # 玩家最佳时间记录（localStorage）
│   │   ├── views/
│   │   │   ├── NetworkView.ts      # Canvas 绘制网络拓扑图
│   │   │   └── NeuronAreaManager.ts # 神经元区域菜单（模式/速度/探索模式/种子控制）
│   │   ├── managers/
│   │   │   ├── GameEventBridge.ts  # 游戏事件桥接器
│   │   │   ├── InputManager.ts     # 键盘、触摸、窗口调整
│   │   │   └── UIManager.ts        # UI 管理器（控制面板、游戏信息）
│   │   └── utils/
│   │       ├── SeededRandom.ts     # Mulberry32 种子化随机数
│   │       └── timeUtils.ts        # 时间格式化
│   └── terrain-lab/                # 地形实验室（监督学习 + MLP）
│       ├── main.ts                 # 地形实验室入口
│       ├── state.ts                # 全局状态管理
│       ├── constants.ts            # 网络维度、元素类型、动作常量
│       ├── types.ts                # 类型定义
│       ├── neural-network.ts       # MLP 实现（ReLU + Softmax + 反向传播）
│       ├── terrain.ts              # 地形编码、合法性检查、数据集生成
│       ├── renderer.ts             # Canvas 绘制（地形网格、Emoji）
│       ├── animation.ts            # 狐狸动作动画路径计算
│       └── utils.ts                # 数学工具（zeroMat、randn、easeOutQuad）
└── dist/                           # Vite 构建输出目录
```

---

## 4. 路径别名（Vite resolve.alias）

```js
'@engine'     -> src/engine
'@fox-jump'   -> src/fox-jump
'@game'       -> src/fox-jump/game
'@render'     -> src/fox-jump/render
'@ai'         -> src/fox-jump/ai
'@views'      -> src/fox-jump/views
'@utils'      -> src/fox-jump/utils
'@managers'   -> src/fox-jump/managers
```

> 注意：`engine/` 下的模块目前在 `fox-jump` 和 `terrain-lab` 中通过相对路径 `../engine/...` 导入，未配置独立别名。

---

## 5. 构建与运行命令

```bash
# 开发服务器（http://localhost:4000）
npm run dev

# 类型检查
npm run type-check

# ESLint 检查
npm run lint

# ESLint 自动修复
npm run lint:fix

# 标准构建 -> dist/
npm run build

# 构建并打包成单文件 dist/game.html
npm run build:single

# 预览构建产物
npm run preview
```

### 部署

项目包含 `deploy.sh` 脚本用于部署到腾讯云服务器：

```bash
./deploy.sh
```

---

## 6. 代码风格规范

项目使用 ESLint 约束，**修改代码时必须遵守**以下约定：

| 规则 | 说明 |
|------|------|
| **缩进** | **Tab**（非空格） |
| **分号** | **禁止分号** (`semi: never`) |
| **引号** | **强制双引号** (`quotes: double`) |
| **变量声明** | 禁止 `var`，优先 `const`，必要时 `let` |
| **注释语言** | **中文**（函数 JSDoc、模块说明、行内解释均使用中文）|
| **区块分隔** | 常用 `// ========== 标题 ==========` 风格进行大段分隔 |

> 提交前建议运行 `npx eslint src/` 检查风格问题。

### 常用日志标签

- `[GAME]` / `[TERRAIN]` — 游戏核心逻辑
- `[AI]` — AI 决策和训练
- `[UI]` / `[CONTROLS]` / `[NEURON_UI]` — UI 相关
- `[RENDER]` — 渲染器
- `[INPUT]` — 输入处理
- `[EVENT_BRIDGE]` — 事件桥接
- `[CONSOLE]` — 控制台面板
- `[EPS]` — 恒竖布局系统
- `[MAIN]` — 主入口
- `[HMR]` — 热更新
- `fox-jump` / `terrain-lab` — Logger 实例命名空间

---

## 7. 核心架构

### 7.1 共享引擎层（`src/engine/`）

**EPS 恒竖布局系统**（`eps.ts`）：
- 当设备物理横屏时，通过 CSS `transform: rotate(-90deg)` 将游戏容器强制显示为竖屏。
- 计算硬件安全区域（`env(safe-area-inset-*)`）与软件 UI 内边距（`visualViewport`）。
- 动态更新 CSS 变量 `--ep-avail-width` / `--ep-avail-height`。
- 提供坐标转换方法（屏幕坐标 ↔ 逻辑坐标）与事件包装器 `EPS.on()`。

**Logger + ConsolePanel**（`utils/Logger.ts`、`console/`）：
- `Logger` 支持按命名空间存储带标签日志，可订阅、清空、下载。
- `ConsolePanel` 挂载到指定 DOM 节点，提供可折叠面板、标签筛选、自动滚动、清空、下载日志功能。
- 各页面（`fox-jump`、`terrain-lab`）均独立实例化自己的 `Logger` 与 `ConsolePanel`。

### 7.2 狐狸跳跃（`fox-jump`）

**世界**：32 格横版地图，随机生成平地(`ground`)与坑(`pit`)。起点固定为 2 格地面。

**动作**：
- `RIGHT` (x+1)：向右移动一格，耗时 400ms
- `JUMP` (x+2)：跳跃两格，耗时 600ms，跳跃高度 1.0 格
- `LONG_JUMP` (x+3)：远跳三格，耗时 600ms

**状态分离**：
- `GAME_STATUS`：生命周期状态（`READY` / `RUNNING` / `TRANSITIONING` / `FINISHED`）
- `PLAYER_ACTION`：人物动画状态（`IDLE` / `MOVING` / `JUMPING`）

**AI 系统**：单层 4→3 神经网络 + ε-贪心策略。
- 输入：前方第 1/2/3/4 格是否为坑（`terrainAhead` 数组）
- 输出：移动 / 跳跃 / 远跳
- 探索模式：`none`（默认纯利用）、`fixed`（固定 50%）、`dynamic`（动态调整）
- 训练奖励：存活 +0.02/步，死亡 -1，胜利 +1

**三种运行模式**：
- `player`：玩家手动操作，底部显示按钮，计时并记录最佳时间
- `ai`：AI 自动闯关，只观察不训练
- `train`：AI 自动闯关并实时更新权重，支持 5 档速度

### 7.3 地形实验室（`terrain-lab`）

这是一个独立的**监督学习**演示页面：
- **地形编辑器**：5 列 × 3 层网格，支持放置空气、狐狸、平地、史莱姆、恶魔、金币。
- **MLP 网络结构**：90 维输入（5×3×6 One-Hot 编码）→ 16 维隐藏层（ReLU）→ 4 维输出（Softmax）。
- **动作空间**：走、跳、远跳、走A（共 4 种）。
- **训练流程**：
  1. 自动生成 6000 条合法训练数据（`generateTerrainData`）
  2. 批量训练：32 条/批次，100 步，使用交叉熵损失 + 反向传播
  3. 实时更新 Loss 与准确率，并绘制 MLP 权重连线与激活值
- **动画演示**：根据 AI 预测的动作，在编辑器中播放狐狸移动/跳跃的动画。

### 7.4 MLP 教学（`mlp-teaching`）

独立 HTML 页面，专注于**前向传播与反向传播的可视化教学**，不依赖 `fox-jump` 或 `terrain-lab` 的逻辑。

---

## 8. 多页面入口与导航

Vite 配置中通过 `rollupOptions.input` 定义了 4 个入口：

| 入口 | 对应 HTML | 说明 |
|------|-----------|------|
| `index` | `index.html` | 导航首页 |
| `fox-jump` | `pages/fox-jump.html` | 单层感知机演示 |
| `terrain-lab` | `pages/terrain-lab.html` | 地形实验室 |
| `mlp-teaching` | `pages/mlp-teaching.html` | MLP 教学 |

`npm run build` 会在 `dist/` 中生成对应的多页面资源。

---

## 9. 已知问题与注意事项

### 9.1 `build:single` 已支持多页面单文件打包

`scripts/build-single-file.mjs` 已重写，现在会递归处理 `dist/` 下所有 HTML 文件，将各自引用的 CSS 和 JS 内联为独立的单文件：

| 输出文件 | 大小 | 说明 |
|---|---|---|
| `dist/index.html` | ~2.82 KB | 导航首页（本身无外部资源） |
| `dist/fox-jump.html` | ~80 KB | 狐狸跳跃游戏（可直接双击打开） |
| `dist/game.html` | ~80 KB | `fox-jump.html` 的兼容别名 |
| `dist/terrain-lab.html` | ~30 KB | 地形实验室（可直接双击打开） |
| `dist/mlp-teaching.html` | ~25 KB | MLP 教学演示（可直接双击打开） |

### 9.2 修改 `eps.ts` 时的兼容性

`eps.ts` 与 `fox-jump/managers/InputManager.ts` 存在联动。修改尺寸/坐标相关代码时，需两边同时考虑，否则横屏旋转后可能出现坐标或相机偏移错误。

### 9.3 AI 训练逻辑精简

`fox-jump/ai/NeuralNetwork.ts` 中的权重更新逻辑非常精简。若改动 `train()`，务必在 AI 训练模式下观察多局，确认学习行为未退化。

### 9.4 狐狸动画冲突

狐狸动画同时涉及 CSS 动画、CSS transition 和 WAAPI。修改尾巴或肢体动画时，留意 `transition: none !important` 的覆盖规则，防止动画冲突。

### 9.5 `localStorage` 仅用于本地数据

现有存储仅用于本地玩家最佳时间（`PlayerBestStore`），**不要**在其中存储敏感信息。

---

## 10. 待办事项（来自 `TODO.md`）

- [x] `npm run build:single` 已修复为支持多页面内联（fox-jump ~80k / terrain-lab ~30k / mlp-teaching ~25k）
- [x] 代码完全 TypeScript 化来获得完整编译检查
- [ ] AI 增加中间隐藏层，让 AI 获得组合信息的学习能力
- [ ] AI 环境信息从二元化转为多元化，输入信息向量化来使 AI 获得对不同元素的辨认能力

> 后两项在 `terrain-lab` 中已经部分实现（MLP + One-Hot 输入），`fox-jump` 仍为单层感知机 + 二元输入。

---

*最后更新：2026-04-03*
