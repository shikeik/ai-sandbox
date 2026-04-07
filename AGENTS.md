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
- **🧠 Brain Lab**（`brain-lab`）：有大脑的 AI 演示。AI 具备"想象未来"能力，可推演多步动作结果并选择最优决策。支持按钮-尖刺机关交互、敌人击杀、终点达成等机制，提供 HTTP API 供外部工具调用。
- **🧮 MLP 神经网络教学**（`mlp-teaching`）：前向传播与反向传播的可视化教学页面。该页面为独立的单文件 HTML，无 TypeScript 源码，所有逻辑与样式均内联在 `pages/mlp-teaching.html` 中。
- **🔌 API 桥接**（`api-bridge`）：HTTP + WebSocket 桥接，支持外部 CLI 工具与浏览器页面通信。

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
| **测试框架** | node:test | Node.js 内置测试框架，通过 `tsx` 执行 |

---

## 3. 目录结构

```
├── index.html                      # 导航入口页（选择五个演示模块）
├── package.json                    # npm 配置，脚本定义
├── package-lock.json               # npm 依赖锁定文件
├── configs/                        # 配置文件目录
│   ├── vite.config.ts              # 多页面 Rollup 配置 + 路径别名 + API 插件
│   ├── tsconfig.json               # TypeScript 严格模式、ES2020
│   ├── tsconfig.node.json          # Node 配置引用
│   ├── eslint.config.ts            # ESLint 规则（双引号、无分号、禁止 var）
│   └── brain-lab-plugin.ts         # Brain Lab 开发服务器 API 插件
├── deploy.sh                       # 腾讯云服务器部署脚本
├── scripts/
│   ├── build-single-file.mjs       # 将 Vite 构建产物内联为单文件 HTML
│   ├── test.mjs                    # 测试脚本包装器
│   ├── fix_logs.sh                 # 日志修复脚本
│   ├── test-brain-lab-api.sh       # Brain Lab API 测试脚本
│   └── api-bridge/                 # API 桥接相关脚本
│       ├── formatter.mjs           # 响应格式化工具
│       └── rules.json              # 游戏规则定义
├── pages/                          # 多页面 HTML 入口
│   ├── fox-jump.html               # 狐狸跳跃游戏页
│   ├── terrain-lab.html            # 地形实验室页
│   ├── mlp-teaching.html           # MLP 教学页（独立内联页面，无 TS 源码）
│   ├── api-bridge.html             # API 桥接页
│   └── brain-lab.html              # Brain Lab 页
├── src/
│   ├── types.d.ts                  # 全局类型声明（CSS 导入、Vite HMR）
│   ├── engine/                     # 共享引擎层
│   │   ├── eps.ts                  # EPS 恒竖布局系统
│   │   ├── console/
│   │   │   ├── index.ts            # 控制台面板入口
│   │   │   ├── ConsolePanel.ts     # 可折叠控制台面板
│   │   │   └── console.css         # 控制台样式
│   │   └── utils/
│   │       ├── Logger.ts           # 带标签的日志系统
│   │       ├── canvas.ts           # Canvas 工具函数
│   │       └── assert.ts           # 断言工具
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
│   │   ├── main.ts                 # 地形实验室入口（管理四个 Tab）
│   │   ├── TrainingEntry.ts        # 训练 Tab 入口
│   │   ├── ChallengeEntry.ts       # 连续挑战 Tab 入口
│   │   ├── MapGeneratorEntry.ts    # 地图生成器 Tab 入口
│   │   ├── KimiEntry.ts            # Kimi API 桥接 Tab 入口
│   │   ├── state.ts                # 全局状态管理
│   │   ├── constants.ts            # 网络维度、元素类型、动作常量、课程阶段
│   │   ├── types.ts                # 类型定义
│   │   ├── neural-network.ts       # MLP 实现（Embedding + ReLU + Softmax）
│   │   ├── supervised.ts           # 监督学习梯度累积
│   │   ├── unsupervised.ts         # 无监督学习梯度累积与奖励计算
│   │   ├── terrain.ts              # 地形编码、合法性检查、数据集生成
│   │   ├── renderer.ts             # Canvas 绘制（地形网格、Emoji、MLP 图）
│   │   ├── utils.ts                # 数学工具
│   │   ├── training-engine.ts      # 训练引擎核心
│   │   ├── snapshot-manager.ts     # 训练快照管理
│   │   ├── obsession-manager.ts    # 执念曲线管理
│   │   ├── curriculum-controller.ts # 课程学习控制器
│   │   ├── challenge-controller.ts # 连续挑战控制器
│   │   ├── challenge-ui.ts         # 挑战模式 UI
│   │   ├── predictor.ts            # 预测器
│   │   ├── terrain-validator.ts    # 地形合法性验证
│   │   ├── map-renderer.ts         # 地图渲染器
│   │   ├── ui-manager.ts           # UI 管理器
│   │   ├── gradients.ts            # 梯度计算
│   │   └── grid-world/             # 格子世界系统
│   │       ├── index.ts            # 入口
│   │       ├── GridWorld.ts        # 核心逻辑
│   │       ├── GridWorldEditor.ts  # 编辑器
│   │       ├── GridWorldRenderer.ts # 渲染器
│   │       ├── GridWorldAnimator.ts # 动画器
│   │       └── types.ts            # 类型定义
│   ├── brain-lab/                  # Brain Lab（有大脑的 AI）
│   │   ├── main.ts                 # Brain Lab 入口
│   │   ├── config.ts               # 配置常量（关卡、动画时长、奖励值）
│   │   ├── core/                   # 核心游戏逻辑
│   │   │   ├── index.ts            # 核心模块入口
│   │   │   ├── game-world.ts       # 游戏世界（状态管理、动作执行）
│   │   │   ├── actions.ts          # 动作执行逻辑（移动、跳跃）
│   │   │   ├── level.ts            # 关卡解析与状态创建
│   │   │   ├── physics.ts          # 物理计算（碰撞检测、抛物线）
│   │   │   └── predictor.ts        # 状态预测器（用于 AI 想象）
│   │   ├── ai/                     # AI 大脑
│   │   │   ├── index.ts            # AI 模块入口
│   │   │   └── brain.ts            # 大脑决策（想象 + 规划 + 决策）
│   │   ├── ui/                     # UI 层
│   │   │   ├── index.ts            # UI 入口
│   │   │   ├── ui-manager.ts       # UI 管理器
│   │   │   ├── brain-lab-ui.ts     # Brain Lab 主 UI
│   │   │   └── transition-manager.ts # 转场管理器
│   │   ├── render/                 # 渲染层
│   │   │   ├── index.ts            # 渲染入口
│   │   │   └── dom-renderer.ts     # DOM 渲染器
│   │   └── types/                  # 类型定义
│   │       ├── index.ts            # 类型入口
│   │       ├── world.ts            # 世界相关类型
│   │       ├── action.ts           # 动作相关类型
│   │       ├── ai.ts               # AI 相关类型
│   │       ├── element.ts          # 元素类型
│   │       ├── position.ts         # 位置类型
│   │       └── api.ts              # API 类型
│   └── api-bridge/                 # API 桥接
│       └── main.ts                 # API 桥接入口
├── test/                           # 测试目录
│   ├── unit/                       # 单元测试
│   │   └── map-generator.test.ts   # 地图生成器测试
│   ├── slow/                       # 慢速测试（训练收敛性测试）
│   │   └── terrain-lab/
│   │       ├── clip.test.ts        # 权重裁剪影响测试
│   │       ├── convergence.test.ts # 收敛性测试
│   │       └── filtered-supervised.test.ts # 过滤式监督学习测试
│   └── ts/                         # TypeScript 调试脚本
│       └── terrain-lab/
│           └── debug-generate.ts   # 地形生成调试
├── docs/                           # 文档目录
│   ├── brain-lab-快速开始.md      # Brain Lab 快速开始指南
│   ├── brain-lab-redesign.md       # Brain Lab 设计文档
│   ├── TODO.md                     # 待办事项
│   ├── 坑与经验/                   # 开发经验总结
│   ├── 思维备案/                   # 思维备份
│   ├── 教程/                       # 教程文档
│   ├── 脚本/                       # 脚本说明
│   ├── 规范/                       # 代码规范
│   └── 讨论/                       # 讨论记录
└── dist/                           # Vite 构建输出目录
```

---

## 4. 路径别名（Vite resolve.alias）

```js
'@'           -> src
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
npm test                          # 只跑单元测试 (test/unit/)
npm run test:all                  # 跑所有测试 (unit + slow)
npm run test:slow                 # 只跑慢速测试 (test/slow/)
npm run test:ts                   # 跑所有 TS 调试脚本
npm run test:dir <目录名>          # 跑指定目录下的单元测试
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
- `[TRAINING]` — 训练入口
- `[CHALLENGE]` — 挑战模式
- `[MAP-GEN]` — 地图生成器
- `[BRAIN-LAB]` / `[BRAIN]` / `[STEP]` / `[ACTION]` — Brain Lab 相关

---

## 7. 测试策略

本项目使用 **Node.js 内置测试框架** (`node:test`) 进行测试，通过 `tsx` 直接执行 TypeScript 文件。

### 测试文件位置

| 目录 | 用途 |
|------|------|
| `test/unit/` | 单元测试，运行速度快 |
| `test/slow/` | 慢速测试，验证训练收敛性 |
| `test/ts/` | TypeScript 调试脚本，非正式测试 |

### 主要测试文件

| 文件 | 用途 |
|------|------|
| `test/unit/map-generator.test.ts` | 验证 `generateTerrainForAction` 生成的地形结构正确性 |
| `test/slow/terrain-lab/convergence.test.ts` | 验证监督学习与无监督学习在默认地形配置下能否收敛到目标指标 |
| `test/slow/terrain-lab/clip.test.ts` | 验证不同权重裁剪值对无监督学习合法率的影响 |
| `test/slow/terrain-lab/filtered-supervised.test.ts` | 验证"只有选中最优动作时才监督更新"的过滤式策略效果 |

### 运行方式

```bash
# 运行所有单元测试
npm test

# 运行单个单元测试文件
npm test -- map-generator

# 运行所有测试（包括慢速测试）
npm run test:all

# 只运行慢速测试
npm run test:slow
```

测试使用 `tsx` 直接执行 TypeScript 文件，无需预编译。路径别名 `@/` 通过 `tsx` 的自定义加载器支持。

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

**四个 Tab 入口**：
- `TrainingEntry`：监督学习/无监督学习训练页
- `ChallengeEntry`：连续地图挑战页
- `MapGeneratorEntry`：地图生成器页
- `KimiEntry`：Kimi API 桥接页

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

**格子世界系统**（`grid-world/`）：
- `GridWorld`：核心逻辑，管理地形网格、狐狸位置、动作执行
- `GridWorldEditor`：编辑器，支持画笔绘制、层限制
- `GridWorldRenderer`：渲染器，绘制网格、元素 Emoji、动画
- `GridWorldAnimator`：动画器，处理狐狸移动/跳跃/远跳动画

### 8.4 Brain Lab（`brain-lab`）

**游戏世界**：基于物理的平台跳跃世界，采用左下坐标系。

**元素类型**：
- 空气（0）：可通过
- 狐狸（1）：玩家角色
- 平台（2）：可站立
- 敌人（3）：可被尖刺击杀
- 终点（4）：通关目标
- 尖刺（5）：危险物，下落会击杀敌人
- 按钮（6）：触发机关，使对应颜色的尖刺下落

**动作空间**（6 种）：
- `LEFT`：向左移动一格
- `RIGHT`：向右移动一格
- `JUMP_LEFT`：向左跳跃（x-1, y+2）
- `JUMP_RIGHT`：向右跳跃（x+1, y+2）
- `JUMP_LEFT_FAR`：向左远跳（x-2, y+2）
- `JUMP_RIGHT_FAR`：向右远跳（x+2, y+2）

**AI 大脑**（`Brain`）：
- **想象（Imagine）**：对每个可能的动作，推演未来状态
- **预测（Predict）**：使用物理引擎预测动作执行后的世界状态
- **评估（Evaluate）**：计算预测状态的奖励值（距离终点、击杀敌人、避免死亡）
- **规划（Planning）**：支持多步想象（可配置深度 1-10）
- **决策（Decide）**：选择预测奖励最高的动作

**奖励设计**：
- 到达终点：`+1000`
- 击杀敌人：`+50`
- 每向右一步：`+10`
- 死亡：`-100`

**关卡系统**：
- 默认关卡（10×5）：单按钮单尖刺设计，教学性质
- 进阶关卡（12×8）：双按钮双尖刺设计，需要策略规划

**HTTP API**（开发服务器）：
Brain Lab 提供 REST API 供外部工具调用：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/brain-lab/state` | GET | 获取当前世界状态 |
| `/api/brain-lab/step` | POST | 执行 AI 单步决策并移动 |
| `/api/brain-lab/move` | POST | 手动执行动作（action 参数） |
| `/api/brain-lab/reset` | POST | 重置游戏 |
| `/api/brain-lab/think` | GET | AI 思考但不执行（返回决策分析） |
| `/api/brain-lab/set-depth` | POST | 设置 AI 想象深度（1-10） |
| `/api/brain-lab/set-level` | POST | 切换关卡（default/advanced） |
| `/api/brain-lab/logs` | GET | 获取最近 200 条日志 |
| `/api/brain-lab/clear-logs` | POST | 清空日志 |

API 插件位于 `configs/brain-lab-plugin.ts`，仅在开发服务器启用。

### 8.5 MLP 教学（`mlp-teaching`）

独立 HTML 页面（`pages/mlp-teaching.html`），**无构建步骤**，所有 CSS 与 JavaScript 均内联：
- 网络结构：2 输入 → 2 隐藏（ReLU）→ 1 输出
- 可交互设置输入值、目标输出、学习率
- 实时显示计算过程与权重更新

### 8.6 API 桥接（`api-bridge`）

HTTP + WebSocket 桥接页面（`pages/api-bridge.html`）：
- 接收外部 HTTP POST 请求（如 CLI、curl）
- 通过 WebSocket 转发给浏览器页面处理
- 支持请求/响应模式，超时 30 秒
- 用于外部工具与浏览器页面的双向通信

Vite 开发服务器配置中的 `apiBridgePlugin` 提供 `/api/kimi` 端点。

---

## 9. 多页面入口与导航

Vite 配置中通过 `rollupOptions.input` 定义 5 个入口：

| 入口 | HTML | 说明 |
|------|------|------|
| `index` | `index.html` | 导航首页 |
| `fox-jump` | `pages/fox-jump.html` | 单层感知机演示 |
| `terrain-lab` | `pages/terrain-lab.html` | 地形实验室 |
| `mlp-teaching` | `pages/mlp-teaching.html` | MLP 教学 |
| `api-bridge` | `pages/api-bridge.html` | API 桥接 |
| `brain-lab` | `pages/brain-lab.html` | Brain Lab |

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
| `dist/api-bridge.html` | API 桥接页面 |
| `dist/brain-lab.html` | Brain Lab 页面 |

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

测试文件使用 `.test.ts` 后缀，被 `tsconfig.json` 明确排除（`"exclude": ["src/**/*.test.ts"]`）。测试使用 Node.js 内置的 `node:test` 模块，通过 `tsx` 执行。

### 11.7 地形实验室 Tab 结构

`terrain-lab` 采用多入口类架构：
- `main.ts` 管理 Tab 切换和全局状态
- `TrainingEntry` / `ChallengeEntry` / `MapGeneratorEntry` / `KimiEntry` 各自独立管理对应 Tab 的生命周期
- 网络参数更新通过回调 `onNetworkUpdated` 同步

### 11.8 配置文件位置

所有配置文件已移至 `configs/` 目录，包括：
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.node.json`
- `eslint.config.ts`
- `brain-lab-plugin.ts`

npm 脚本已更新以指向新位置。

### 11.9 神经元区域抽屉切换

顶部工具栏的 🧠 按钮可切换神经元区域（`#neuron-area`）的显隐：
- 显示时：占据 `flex: 1` 空间，展示网络可视化和控制菜单
- 隐藏时：`flex: 0 0 0`，游戏区域自动扩展，获得更大画面
- 状态会同步到按钮的 `active` class（绿色高亮表示显示中）

相关代码：
- `NeuronAreaManager.toggle()` / `show()` / `hide()` / `getVisible()`
- 样式：`#neuron-area` 和 `#neuron-area.collapsed`
- 按钮绑定：`main.ts` 中的 `bindToolbarButtons()`

### 11.10 Brain Lab 关卡地图定义

关卡使用全角字符定义（`src/brain-lab/config.ts`）：
- `．`（全角句点）：空气
- `＃`（全角井号）：平台
- `！`（全角叹号）：按钮
- `￡`（全角英镑）：终点
- `＾`（全角脱字符）：尖刺
- `￠`（全角分币）：敌人（下方需要平台支撑）
- `＠`（全角 at）：玩家起点

地图数组在代码中会反转（视觉第 0 行对应代码最后一行），以符合直觉的"从上到下"编辑体验。

---

*最后更新：2026-04-07*
