# AI 神经元训练沙盘 —— 项目指南

> 本文件面向 AI 编程助手。如果你刚接触本项目，请完整阅读此文档后再修改代码。

---

## 1. 项目概述

**项目名称**：`ai-sandbox`（AI 神经元训练沙盘）  
**版本**：1.0.0  
**类型**：纯前端网页应用 —— 一套结合"游戏化演示"与"实时神经网络可视化训练"的交互式教学沙盘。

**核心体验**：
- **🦊 单层感知机演示**（`fox-jump`）：玩家控制一只纯 CSS 绘制的狐狸，在 32 格横版地形中右移或跳跃躲避坑洞。可切换为 AI 控制/AI 训练模式，实时观察一个 4→3 单层神经网络的权重变化。
- **📐 地形实验室**（`terrain-lab`）：监督学习与无监督学习演示。支持地形编辑、带隐藏层的 MLP（多层感知机）动作预测、批量训练、课程学习与可视化（含 Embedding 空间、训练快照、执念曲线）。
- **🧮 MLP 神经网络教学**（`mlp-teaching`）：前向传播与反向传播的可视化教学页面。该页面为独立的单文件 HTML，无 TypeScript 源码，所有逻辑与样式均内联在 `pages/mlp-teaching.html` 中。
- **📊 指标仪表盘**（`metrics-dashboard`）：实时训练监控，展示损失曲线、准确率、动作分布可视化等训练指标。
- **⚖️ 模型对比**（`model-comparison`）：双模型并排对比，支持时间轴播放、双Y轴图表、差异分析。

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
├── index.html                      # 导航入口页（选择五个演示模块）
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
│   ├── mlp-teaching.html           # MLP 教学页（独立内联页面，无 TS 源码）
│   ├── metrics-dashboard.html      # 指标仪表盘页
│   └── model-comparison.html       # 模型对比页
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
│   ├── terrain-lab/                # 地形实验室（监督/无监督学习 + MLP）
│   │   ├── main.ts                 # 地形实验室入口
│   │   ├── state.ts                # 全局状态管理
│   │   ├── constants.ts            # 网络维度、元素类型、动作常量、课程阶段
│   │   ├── types.ts                # 类型定义
│   │   ├── neural-network.ts       # MLP 实现（Embedding + ReLU + Softmax）
│   │   ├── supervised.ts           # 监督学习梯度累积
│   │   ├── unsupervised.ts         # 无监督学习梯度累积与奖励计算
│   │   ├── terrain.ts              # 地形编码、合法性检查、数据集生成
│   │   ├── renderer.ts             # Canvas 绘制（地形网格、Emoji、MLP 图）
│   │   ├── animation.ts            # 狐狸动作动画路径计算
│   │   ├── utils.ts                # 数学工具
│   │   ├── training-engine.ts      # 训练引擎核心
│   │   ├── snapshot-manager.ts     # 训练快照管理
│   │   ├── obsession-manager.ts    # 执念曲线管理
│   │   ├── curriculum-controller.ts # 课程学习控制器
│   │   ├── challenge-controller.ts # 连续挑战控制器
│   │   ├── challenge-ui.ts         # 挑战模式 UI
│   │   ├── predictor.ts            # 预测器
│   │   ├── terrain-validator.ts    # 地形合法性验证
│   │   ├── ui-manager.ts           # UI 管理器
│   │   ├── gradients.ts            # 梯度计算
│   │   ├── clip.test.ts            # 权重裁剪影响测试
│   │   ├── convergence.test.ts     # 收敛性测试
│   │   └── filtered-supervised.test.ts # 过滤式监督学习测试
│   ├── metrics-dashboard/          # 指标仪表盘
│   │   ├── main.ts                 # 入口
│   │   ├── metrics-store.ts        # 指标数据存储
│   │   ├── ui-manager.ts           # UI 管理器
│   │   ├── constants.ts            # 常量配置
│   │   ├── types.ts                # 类型定义
│   │   ├── components/             # UI 组件
│   │   │   ├── MetricCard.ts
│   │   │   └── LoadingButton.ts
│   │   ├── charts/                 # 图表组件
│   │   │   └── line-chart.ts
│   │   └── utils/                  # 工具函数
│   │       └── data-formatter.ts
│   └── model-comparison/           # 模型对比
│       ├── main.ts                 # 入口
│       ├── timeline-controller.ts  # 时间轴控制器
│       └── ui-manager.ts           # UI 管理器
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

# 运行测试
npm test
```

### 部署

项目包含 `deploy.sh` 脚本用于部署到腾讯云服务器：

```bash
./deploy.sh
```

部署流程：
1. 本地执行 `npm run build`
2. 打包 `dist/` 目录并通过 SSH 上传到服务器 `/home/ubuntu/ai-sandbox`
3. 重启服务器 Nginx

服务器地址：`http://162.14.79.120:4000`

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
- `[SUP]` / `[UNS]` / `[PREDICT]` — terrain-lab 训练与预测
- `[METRICS]` — 指标仪表盘
- `[MODEL-COMP]` — 模型对比

---

## 7. 测试策略

本项目使用 **Node.js 内置测试框架** (`node:test`) 进行测试。

### 测试文件位置

`src/terrain-lab/` 下以 `.test.ts` 结尾的文件：

| 文件 | 用途 |
|------|------|
| `convergence.test.ts` | 验证监督学习与无监督学习在默认地形配置下能否收敛到目标指标 |
| `clip.test.ts` | 验证不同权重裁剪值对无监督学习合法率的影响 |
| `filtered-supervised.test.ts` | 验证"只有选中最优动作时才监督更新"的过滤式策略效果 |

### 运行方式

```bash
# 运行所有测试
npm test
```

测试使用 `tsx` 直接执行 TypeScript 文件，无需预编译。

---

## 8. 核心架构

### 8.1 共享引擎层（`src/engine/`）

**EPS 恒竖布局系统**（`eps.ts`）：
- 当设备物理横屏时，通过 CSS `transform: rotate(-90deg)` 强制内容竖屏显示
- 计算硬件安全区域（`env(safe-area-inset-*)`）与软件 UI 内边距
- 动态更新 CSS 变量 `--ep-avail-width` / `--ep-avail-height`
- 提供坐标转换方法（屏幕坐标 ↔ 逻辑坐标）与事件包装器 `EPS.on()`

**Logger + ConsolePanel**：
- `Logger` 支持按命名空间存储带标签日志，可订阅、清空、下载
- `ConsolePanel` 提供可折叠面板、标签筛选、自动滚动、日志下载
- 各页面独立实例化自己的 `Logger` 与 `ConsolePanel`

### 8.2 狐狸跳跃（`fox-jump`）

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

### 8.3 地形实验室（`terrain-lab`）

**监督学习 + 无监督学习演示页面**：
- **地形编辑器**：5 列 × 3 层网格，支持放置空气、狐狸、平地、史莱姆、恶魔、金币
- **MLP 网络结构**：30 维输入（5×3×2 Embedding）→ 32 维隐藏层（ReLU）→ 4 维输出（Softmax）
- **动作空间**：走、跳、远跳、走A（共 4 种）
- **训练流程**：
  1. 自动生成 6000 条合法训练数据
  2. 批量训练：32 条/批次，交叉熵损失 + 反向传播
  3. 实时更新 Loss、准确率、合法率、Embedding 可视化
  4. 支持训练快照滑块与执念曲线（单样本概率演变）
- **课程学习**：5 阶段渐进解锁（平地大道→坑洞→史莱姆→恶魔→金币），每阶段 6000 条数据，支持监督/无监督两种模式
- **连续挑战**：扩展的地图挑战模式，支持动画播放

### 8.4 MLP 教学（`mlp-teaching`）

独立 HTML 页面（`pages/mlp-teaching.html`），**无构建步骤**，所有 CSS 与 JavaScript 均内联：
- 网络结构：2 输入 → 2 隐藏（ReLU）→ 1 输出
- 可交互设置输入值、目标输出、学习率
- 实时显示计算过程与权重更新

### 8.5 指标仪表盘（`metrics-dashboard`）

- 实时展示训练指标：Loss、准确率、合法率、Epsilon
- 支持时间范围切换（1/10/100 步）
- 折线图可视化
- 模拟数据生成功能

### 8.6 模型对比（`model-comparison`）

- 双模型（Model A / Model B）并排对比
- 时间轴播放控制（播放/暂停/步进/重置）
- 双Y轴图表展示
- 差异分析面板

---

## 9. 多页面入口与导航

Vite 配置中通过 `rollupOptions.input` 定义 6 个入口：

| 入口 | HTML | 说明 |
|------|------|------|
| `index` | `index.html` | 导航首页 |
| `fox-jump` | `pages/fox-jump.html` | 单层感知机演示 |
| `terrain-lab` | `pages/terrain-lab.html` | 地形实验室 |
| `mlp-teaching` | `pages/mlp-teaching.html` | MLP 教学 |
| `metrics-dashboard` | `pages/metrics-dashboard.html` | 指标仪表盘 |
| `model-comparison` | `pages/model-comparison.html` | 模型对比 |

`npm run build` 在 `dist/` 中生成对应的多页面资源。

---

## 10. 单文件打包

`scripts/build-single-file.mjs` 功能：
1. 先执行标准 Vite 构建
2. 递归查找 `dist/` 下所有 HTML 文件
3. 将 CSS 和 JS 内联到 HTML 中
4. 移除 modulepreload 链接
5. 输出到 `dist/` 根目录（去除 `pages/` 前缀）

输出文件：

| 文件 | 说明 |
|------|------|
| `dist/index.html` | 导航首页 |
| `dist/fox-jump.html` | 狐狸跳跃游戏 |
| `dist/game.html` | fox-jump 兼容别名 |
| `dist/terrain-lab.html` | 地形实验室 |
| `dist/mlp-teaching.html` | MLP 教学（本身已是单文件，再次复制）|
| `dist/metrics-dashboard.html` | 指标仪表盘 |
| `dist/model-comparison.html` | 模型对比 |

---

## 11. 已知问题与注意事项

### 11.1 修改 `eps.ts` 时的兼容性

`eps.ts` 与 `fox-jump/managers/InputManager.ts` 存在联动。修改尺寸/坐标相关代码时，需两边同时考虑。

### 11.2 AI 训练逻辑

`fox-jump/ai/NeuralNetwork.ts` 中的权重更新逻辑精简。改动后需在 AI 训练模式下观察多局，确认学习行为未退化。

### 11.3 狐狸动画冲突

狐狸动画同时涉及 CSS 动画、CSS transition 和 WAAPI。修改时留意 `transition: none !important` 的覆盖规则。

### 11.4 localStorage 使用

仅用于本地玩家最佳时间（`PlayerBestStore`），**不要**存储敏感信息。

### 11.5 `mlp-teaching.html` 的特殊性

该页面没有对应的 `src/` 源码，所有修改直接在 `pages/mlp-teaching.html` 中进行。构建时无需额外处理。

### 11.6 测试文件的特殊性

测试文件使用 `.test.ts` 后缀，被 `tsconfig.json` 明确排除（`"exclude": ["src/**/*.test.ts"]`）。测试直接使用 Node.js 内置的 `node:test` 模块，通过 `tsx` 执行。

---

## 12. 待办事项

详见 `TODO.md`，主要方向：
- terrain-lab Tab 拆分：监督学习页 + 连续挑战页（已完成）

---

*最后更新：2026-04-04*