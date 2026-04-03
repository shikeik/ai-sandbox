# AI 神经元训练沙盘 —— 项目指南

> 本文件面向 AI 编程助手。如果你刚接触本项目，请完整阅读此文档后再修改代码。

---

## 1. 项目概述

**项目名称**：`ai-sandbox`（AI 神经元训练沙盘）  
**版本**：1.0.0  
**类型**：纯前端网页应用 —— 一套结合"游戏化演示"与"实时神经网络可视化训练"的交互式教学沙盘。

**核心体验**：
- **🦊 单层感知机演示**（`fox-jump`）：玩家控制一只纯 CSS 绘制的狐狸，在 32 格横版地形中右移或跳跃躲避坑洞。可切换为 AI 控制/AI 训练模式，实时观察一个 4→3 单层神经网络的权重变化。
- **📐 地形实验室**（`terrain-lab`）：监督学习演示。支持地形编辑、带隐藏层的 MLP（多层感知机）动作预测、批量训练与可视化。
- **🧮 MLP 神经网络教学**（`mlp-teaching`）：前向传播与反向传播的可视化教学页面。

---

## 2. 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| **语言** | TypeScript 6.0.2 | ES Modules，`"type": "module"` |
| **构建工具** | Vite 5.0.0 | 多页面入口配置，开发服务器端口 4000 |
| **前端框架** | 无 | 手写 Vanilla JS/TS，无 React/Vue 等框架 |
| **样式** | 纯 CSS | 无预处理器，含大量自定义 CSS 动画与 WAAPI |
| **绘图** | Canvas 2D | 神经网络可视化、地形编辑 |
| **持久化** | localStorage | 保存玩家最佳通关纪录 |
| **Node 脚本** | ES Module | 原生 `fs` + `child_process` 实现单文件打包 |

---

## 3. 目录结构

```
├── index.html                      # 导航入口页（选择三个演示模块）
├── package.json                    # npm 配置，脚本定义
├── vite.config.js                  # 多页面 Rollup 配置 + 路径别名
├── tsconfig.json                   # TypeScript 严格模式、ES2020
├── tsconfig.node.json              # Node 配置引用
├── eslint.config.js                # ESLint 规则（双引号、无分号、禁止 var）
├── TODO.md                         # 项目待办与已知问题
├── deploy.sh                       # 腾讯云服务器部署脚本
├── scripts/
│   └── build-single-file.mjs       # 将 Vite 构建产物内联为单文件 HTML
├── pages/                          # 多页面 HTML 入口
│   ├── fox-jump.html               # 狐狸跳跃游戏页
│   ├── terrain-lab.html            # 地形实验室页
│   └── mlp-teaching.html           # MLP 教学页
├── src/
│   ├── types.d.ts                  # 全局类型声明（CSS 导入、Vite HMR）
│   ├── engine/                     # 共享引擎层
│   │   ├── eps.ts                  # EPS 恒竖布局系统
│   │   ├── console/
│   │   │   ├── index.ts            # 控制台面板入口
│   │   │   ├── ConsolePanel.ts     # 可折叠控制台面板
│   │   │   └── console.css         # 控制台样式
│   │   └── utils/
│   │       └── Logger.ts           # 带标签的日志系统
│   ├── fox-jump/                   # 狐狸跳跃游戏
│   │   ├── main.ts                 # 游戏入口
│   │   ├── style.css               # 全局样式、布局、UI 控件
│   │   ├── style-fox.css           # 狐狸纯 CSS 绘制与动画
│   │   ├── game/
│   │   │   ├── JumpGame.ts         # 游戏核心逻辑（地形、碰撞、状态机）
│   │   │   └── TerrainGenerator.ts # 种子化地形生成器（Mulberry32）
│   │   ├── render/
│   │   │   ├── FoxAnimator.ts      # 狐狸动画状态机（CSS + WAAPI）
│   │   │   ├── GameRenderer.ts     # DOM 渲染器 + Tween 补间
│   │   │   └── TransitionManager.ts # 死亡/胜利转场
│   │   ├── ai/
│   │   │   ├── AIController.ts     # AI 控制器（模式/速度/训练循环）
│   │   │   ├── NeuralNetwork.ts    # 单层神经网络（4输入→3输出）+ ε-贪心
│   │   │   └── PlayerBestStore.ts  # 玩家最佳时间记录（localStorage）
│   │   ├── views/
│   │   │   ├── NetworkView.ts      # Canvas 绘制网络拓扑图
│   │   │   └── NeuronAreaManager.ts # 神经元区域菜单
│   │   ├── managers/
│   │   │   ├── GameEventBridge.ts  # 游戏事件桥接器
│   │   │   ├── InputManager.ts     # 键盘、触摸、窗口调整
│   │   │   └── UIManager.ts        # UI 管理器
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
│       └── utils.ts                # 数学工具
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

> 注意：`engine/` 下的模块在页面中通过相对路径 `../engine/...` 导入。

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

# 构建并打包成单文件 dist/fox-jump.html 等
npm run build:single

# 预览构建产物
npm run preview
```

### 部署

项目包含 `deploy.sh` 脚本用于部署到腾讯云服务器：

```bash
./deploy.sh
```

部署流程：
1. 本地执行 `npm run build`
2. 打包 `dist/` 目录并通过 SSH 上传到服务器
3. 重启服务器 Nginx

---

## 6. 代码风格规范

项目使用 ESLint 约束，**修改代码时必须遵守**以下约定：

| 规则 | 配置 |
|------|------|
| **缩进** | **Tab**（非空格） |
| **分号** | **禁止分号** (`semi: "never"`) |
| **引号** | **强制双引号** (`quotes: "double"`) |
| **变量声明** | 禁止 `var`，优先 `const`，必要时 `let` |
| **未使用变量** | 警告级别，支持 `_` 前缀忽略 |
| **console** | 允许（游戏需要大量日志） |
| **注释语言** | **中文**（函数 JSDoc、模块说明、行内解释） |
| **区块分隔** | 常用 `// ========== 标题 ==========` 风格 |

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

---

## 7. 核心架构

### 7.1 共享引擎层（`src/engine/`）

**EPS 恒竖布局系统**（`eps.ts`）：
- 当设备物理横屏时，通过 CSS `transform: rotate(-90deg)` 强制内容竖屏显示
- 计算硬件安全区域（`env(safe-area-inset-*)`）与软件 UI 内边距
- 动态更新 CSS 变量 `--ep-avail-width` / `--ep-avail-height`
- 提供坐标转换方法（屏幕坐标 ↔ 逻辑坐标）与事件包装器 `EPS.on()`

**Logger + ConsolePanel**：
- `Logger` 支持按命名空间存储带标签日志，可订阅、清空、下载
- `ConsolePanel` 提供可折叠面板、标签筛选、自动滚动、日志下载
- 各页面独立实例化自己的 `Logger` 与 `ConsolePanel`

### 7.2 狐狸跳跃（`fox-jump`）

**世界**：32 格横版地图，随机生成平地(`ground`)与坑(`pit`)。起点固定为 2 格地面。

**动作**：
- `RIGHT` (x+1)：向右移动一格，耗时 400ms
- `JUMP` (x+2)：跳跃两格，耗时 600ms，跳跃高度 1.0 格
- `LONG_JUMP` (x+3)：远跳三格，耗时 600ms

**状态分离**：
- `GAME_STATUS`：生命周期状态（`READY` / `RUNNING` / `TRANSITIONING` / `FINISHED`）
- `PLAYER_ACTION`：人物动画状态（`IDLE` / `MOVING` / `JUMPING`）

**AI 系统**：单层 4→3 神经网络 + ε-贪心策略
- 输入：前方第 1/2/3/4 格是否为坑
- 输出：移动 / 跳跃 / 远跳
- 探索模式：`none`（默认）、`fixed`（50%）、`dynamic`（动态调整）
- 训练奖励：存活 +0.02/步，死亡 -1，胜利 +1

**三种运行模式**：
- `player`：玩家手动操作，计时并记录最佳时间
- `ai`：AI 自动闯关，只观察不训练
- `train`：AI 自动闯关并实时更新权重，支持 5 档速度

### 7.3 地形实验室（`terrain-lab`）

**监督学习演示页面**：
- **地形编辑器**：5 列 × 3 层网格，支持放置空气、狐狸、平地、史莱姆、恶魔、金币
- **MLP 网络结构**：30 维输入（5×3×2 Embedding）→ 16 维隐藏层（ReLU）→ 4 维输出（Softmax）
- **动作空间**：走、跳、远跳、走A（共 4 种）
- **训练流程**：
  1. 自动生成 6000 条合法训练数据
  2. 批量训练：32 条/批次，交叉熵损失 + 反向传播
  3. 实时更新 Loss、准确率、Embedding 可视化
  4. 支持训练快照与执念曲线（单样本概率演变）
- **课程学习**：5 阶段渐进解锁（平地大道→坑洞→史莱姆→恶魔→金币）

### 7.4 MLP 教学（`mlp-teaching`）

独立 HTML 页面，专注于**前向传播与反向传播的可视化教学**：
- 网络结构：2 输入 → 2 隐藏（ReLU）→ 1 输出
- 可交互设置输入值、目标输出、学习率
- 实时显示计算过程与权重更新

---

## 8. 多页面入口与导航

Vite 配置中通过 `rollupOptions.input` 定义 4 个入口：

| 入口 | HTML | 说明 |
|------|------|------|
| `index` | `index.html` | 导航首页 |
| `fox-jump` | `pages/fox-jump.html` | 单层感知机演示 |
| `terrain-lab` | `pages/terrain-lab.html` | 地形实验室 |
| `mlp-teaching` | `pages/mlp-teaching.html` | MLP 教学 |

`npm run build` 在 `dist/` 中生成对应的多页面资源。

---

## 9. 单文件打包

`scripts/build-single-file.mjs` 功能：
1. 先执行标准 Vite 构建
2. 递归查找 `dist/` 下所有 HTML 文件
3. 将 CSS 和 JS 内联到 HTML 中
4. 移除 modulepreload 链接
5. 输出到 `dist/` 根目录（去除 `pages/` 前缀）

输出文件：

| 文件 | 大小 | 说明 |
|------|------|------|
| `dist/index.html` | ~3 KB | 导航首页 |
| `dist/fox-jump.html` | ~80 KB | 狐狸跳跃游戏 |
| `dist/game.html` | ~80 KB | fox-jump 兼容别名 |
| `dist/terrain-lab.html` | ~30 KB | 地形实验室 |
| `dist/mlp-teaching.html` | ~25 KB | MLP 教学 |

---

## 10. 已知问题与注意事项

### 10.1 修改 `eps.ts` 时的兼容性

`eps.ts` 与 `fox-jump/managers/InputManager.ts` 存在联动。修改尺寸/坐标相关代码时，需两边同时考虑。

### 10.2 AI 训练逻辑

`fox-jump/ai/NeuralNetwork.ts` 中的权重更新逻辑精简。改动后需在 AI 训练模式下观察多局，确认学习行为未退化。

### 10.3 狐狸动画冲突

狐狸动画同时涉及 CSS 动画、CSS transition 和 WAAPI。修改时留意 `transition: none !important` 的覆盖规则。

### 10.4 localStorage 使用

仅用于本地玩家最佳时间（`PlayerBestStore`），**不要**存储敏感信息。

---

## 11. 待办事项

详见 `TODO.md`，主要方向：
- terrain-lab Tab 拆分
- 课程学习自动递进
- 验证 Embedding 监督学习收敛表现

---

*最后更新：2026-04-04*