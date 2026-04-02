# AI 神经元训练沙盘 —— 项目指南

> 本文件面向 AI 编程助手。如果你刚接触本项目，请完整阅读此文档后再修改代码。

---

## 1. 项目概述

**项目名称**：`ai-sandbox`（AI 神经元训练沙盘）  
**类型**：纯前端网页应用 —— 一款结合"极简跳跃游戏"与"实时神经网络可视化训练"的交互式沙盘。

**核心体验**：
- 玩家控制一只纯 CSS 绘制的狐狸，在 32 格横版地形中右移或跳跃躲避坑洞
- 可切换为 AI 控制/AI 训练模式，实时观察一个 4→3 单层神经网络的权重变化
- 神经网络采用自定义实现的 ε-贪心策略，支持自动调节探索率

---

## 2. 技术栈

| 技术 | 说明 |
|------|------|
| **语言** | TypeScript（ES Modules，`"type": "module"`） |
| **构建工具** | Vite 5（仅用作打包与开发服务器，**不引入任何前端框架**） |
| **样式** | 纯 CSS（无预处理器），包含大量自定义 CSS 动画与 WAAPI（Web Animations API） |
| **绘图** | Canvas 2D（用于神经网络可视化） |
| **持久化** | `localStorage`（保存玩家最佳通关纪录） |
| **Node 脚本** | 原生 `fs` + `child_process` 实现单文件打包 |

> **重要**：本项目没有使用 React / Vue / Angular 等前端框架。所有逻辑均为手写 Vanilla JS/TS。

---

## 3. 目录结构

```
├── index.html                 # 入口 HTML，内含游戏容器布局
├── package.json               # 仅依赖 vite
├── vite.config.js             # 路径别名、dev server 配置（host: 0.0.0.0, port: 4000）
├── eslint.config.js           # ESLint 规则（强制双引号、无分号、禁止 var）
├── tsconfig.json              # TypeScript 配置（ES2020、严格模式）
├── tsconfig.node.json         # Node 环境 TypeScript 配置
├── deploy.sh                  # 一键部署脚本（腾讯云）
├── scripts/
│   └── build-single-file.mjs  # 将 Vite 构建产物内联为单文件 dist/game.html
├── src/
│   ├── main.ts                # 应用入口：连接游戏逻辑、渲染、AI、视图、事件绑定
│   ├── types.d.ts             # 类型声明（CSS 导入、Vite HMR）
│   ├── eps.ts                 # EPS 恒竖布局系统模块
│   ├── style.css              # 全局样式、布局、UI 控件
│   ├── style-fox.css          # 狐狸纯 CSS 绘制与动画状态
│   ├── game/
│   │   ├── JumpGame.ts        # 游戏核心逻辑（地形生成、碰撞检测、状态机）
│   │   └── TerrainGenerator.ts # 种子化地形生成器（支持权重配置）
│   ├── render/
│   │   ├── FoxAnimator.ts     # 狐狸动画状态机（CSS class + WAAPI 尾巴动画）
│   │   ├── GameRenderer.ts    # DOM 渲染器 + 补间动画(Tween)
│   │   └── TransitionManager.ts # 死亡/胜利后的黑屏转场
│   ├── ai/
│   │   ├── AIController.ts    # AI 控制器（模式切换、速度控制、训练循环）
│   │   ├── NeuralNetwork.ts   # 可配置神经网络（4 输入 → 3 输出）+ ε-贪心 + 训练更新
│   │   └── PlayerBestStore.ts # 玩家最佳通关时间记录（localStorage）
│   ├── views/
│   │   ├── ConsolePanel.ts    # 控制台面板（日志拦截、筛选、下载）
│   │   ├── NetworkView.ts     # Canvas 绘制网络拓扑图
│   │   └── NeuronAreaManager.ts # 神经元区域菜单（模式/速度/探索模式切换、种子控制、权重配置）
│   ├── managers/
│   │   ├── GameEventBridge.ts # 游戏事件桥接器（连接核心与 UI/AI/渲染器的回调）
│   │   ├── InputManager.ts    # 输入管理器（键盘、窗口大小调整）
│   │   └── UIManager.ts       # UI 管理器（控制面板渲染、游戏信息更新）
│   └── utils/
│       ├── SeededRandom.ts    # 种子化随机数生成器（Mulberry32 算法）
│       └── timeUtils.ts       # 时间格式化工具（mm:ss / mm:ss.mmm）
├── docs/                      # 需求文档、AI 对话记录、设计思路
│   ├── ai对话/                # 与 AI 助手的对话记录
│   ├── 需求/                  # 功能需求文档
│   └── 教程/                  # 部署教程等
└── dist/                      # 构建输出目录
```

### 路径别名（Vite resolve.alias）

```js
'@game'     -> src/game
'@render'   -> src/render
'@ai'       -> src/ai
'@views'    -> src/views
'@utils'    -> src/utils
'@managers' -> src/managers
```

---

## 4. 构建与运行命令

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

# 构建并打包成单文件 dist/game.html（可直接双击打开，无需服务器）
npm run build:single

# 预览构建产物
npm run preview
```

### 部署

项目包含 `deploy.sh` 脚本用于部署到腾讯云服务器：

```bash
# 一键部署（需要配置好 SSH 密钥）
./deploy.sh
```

部署流程：
1. 本地执行 `npm run build` 构建
2. 打包 `dist/` 目录并通过 SSH 上传到服务器
3. 远程重启 Nginx 服务

---

## 5. 代码风格规范

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

代码中使用统一的日志标签格式：`[TAG]` 开头

- `[GAME]` - 游戏核心逻辑
- `[AI]` - AI 决策和训练
- `[UI]` / `[CONTROLS]` / `[NEURON_UI]` - UI 相关
- `[RENDER]` - 渲染器
- `[INPUT]` - 输入处理
- `[EVENT_BRIDGE]` - 事件桥接
- `[CONSOLE]` - 控制台面板
- `[EPS]` - 恒竖布局系统
- `[TERRAIN]` - 地形生成
- `[MAIN]` - 主入口
- `[HMR]` - 热更新

---

## 6. 核心架构与关键概念

### 6.1 游戏逻辑（JumpGame.ts）

**世界**：32格横版地图（`WORLD_LENGTH: 32`），随机生成平地(`ground`)与坑(`pit`)。起点固定为2格地面。

**动作**：
- `RIGHT` (x+1)：向右移动一格，耗时 400ms
- `JUMP` (x+2)：跳跃两格（抛物线），耗时 600ms，跳跃高度 1.0 格
- `LONG_JUMP` (x+3)：远跳三格，耗时 600ms

**状态分离**：
- `GAME_STATUS`：生命周期状态（`READY` / `RUNNING` / `TRANSITIONING` / `FINISHED`）
- `PLAYER_ACTION`：人物动画状态（`IDLE` / `MOVING` / `JUMPING`）

**速通机制**：逻辑位置立即改变，渲染层通过 Tween 补间平滑过渡；动画可被打断，允许玩家在动画期间连续输入。

**胜利条件**：到达或超过第 31 格（`grid >= WORLD_LENGTH - 1`）

### 6.2 渲染层（GameRenderer.ts）

- `Tween` 类使用 `requestAnimationFrame` + 自定义缓动函数（类似 easeInOutQuad 的贝塞尔曲线）
- 狐狸动画状态通过 CSS class 切换（`state-idle` / `state-run` / `state-jump-up` / `state-jump-down` / `state-land` / `state-dead`）
- 尾巴动画单独使用 **WAAPI** (`Element.animate`)，避免与 CSS transition 冲突

### 6.3 AI 系统（NeuralNetwork.ts + AIController.ts）

**网络结构**：单层，4 个输入神经元 → 3 个输出神经元（移动 / 跳跃 / 远跳）。
- 输入：前方第 1/2/3 格是否为坑（对应 terrainAhead[0/1/2]），第 4 个输入当前固定为 0（预留扩展）
- 注意：`getStateForAI()` 目前只返回 3 格地形信息，第 4 个输入位待未来扩展

**决策**：ε-贪心策略（`epsilon` 默认 0，当前为纯利用模式）。
- 探索时随机选择动作
- 利用时直接比较输出分数，选高分动作（无 Softmax）
- 冲突处理：当探索随机出的动作与贪心动作不一致时，会记录日志提示冲突修复

**探索模式**：
- `none`（默认）：无探索，纯利用
- `fixed`：固定探索率（默认 50%）
- `dynamic`：动态调整探索率

**训练**：
- 存活每步奖励 `+0.02`
- 死亡惩罚 `-1`
- 胜利奖励 `+1`
- 权重更新公式：`w += learningRate * input`（奖励为正）或 `w -= learningRate * input`（奖励为负），并对错误动作的替代动作给予一半奖励

**动态 ε**：在 `dynamic` 模式下，根据最近 5 局的滑动平均分自动调整探索率：
- 本局步数 > 平均：降低探索率（-0.05，最低 0.1）
- 本局步数 < 平均：增加探索率（+0.05，最高 0.4）
- 本局步数 = 平均：轻微降低探索率（-0.01，最低 0.1）

**速度档位**：
- `STEP`：单步模式，需手动触发
- `SLOW`：1000ms 间隔
- `NORMAL`：200ms 间隔
- `FAST`：50ms 间隔
- `MAX`：极速（requestAnimationFrame，约 1 帧完成动画）

### 6.4 EPS 恒竖布局系统（eps.ts + style.css）

- 当设备物理横屏时，通过 CSS `transform: rotate(-90deg)` 将游戏容器强制显示为竖屏
- 计算硬件安全区域（`env(safe-area-inset-*)`）与软件 UI 内边距（`visualViewport`）
- 动态更新 CSS 变量 `--ep-avail-width` / `--ep-avail-height`
- 提供坐标转换方法（屏幕坐标 ↔ 逻辑坐标）
- 提供事件包装器 `EPS.on()`，自动转换触摸/鼠标坐标到逻辑坐标系
- 与 `main.ts` 中的 `InputManager` 存在联动，修改尺寸相关代码时需两边同时考虑

### 6.5 三种运行模式（main.ts）

| 模式 | 说明 |
|------|------|
| `player` | 玩家手动操作，底部显示移动/跳跃/远跳按钮，计时并记录最佳时间 |
| `ai` | AI 控制狐狸自动闯关，只观察不训练 |
| `train` | AI 自动闯关并实时更新权重，支持 5 档速度 |

### 6.6 控制台面板（ConsolePanel.ts）

- 位于顶部区域，可折叠展开（通过工具栏 🖥️ 按钮切换）
- 拦截 `console.log/warn/error/info`，按标签分类显示
- 支持标签筛选（显示/隐藏特定标签）、自动滚动开关、清空、下载日志
- 日志标签格式：`[TAG]` 开头，如 `[AI]`, `[GAME]`, `[UI]`
- 全局错误监听（`error` / `unhandledrejection`）
- 提供全局辅助对象 `window.gameLog`，支持 `gameLog.log(tag, ...args)` 等带标签日志方法

### 6.7 管理器架构

项目采用多管理器分工架构：
- `UIManager`：控制面板渲染（玩家/单步/自动模式）、游戏信息更新、AI 视图渲染
- `InputManager`：键盘输入（空格单步、方向键/ASWD控制）、触摸坐标转换、窗口大小调整
- `GameEventBridge`：桥接游戏核心事件与 UI/AI/渲染器的回调
- `TransitionManager`：死亡/胜利后的黑屏转场动画

### 6.8 地形生成（TerrainGenerator.ts）

- 支持种子化随机生成（Mulberry32 算法），确保可复现的地形
- 可配置元素权重：平地(ground) / 单坑(singlePit) / 双坑(doublePit)
- 支持元素开关控制（启用/禁用特定元素）
- 地形生成规则：
  - 起点固定 2 格地面
  - 坑后必须接地面（避免连续坑）
  - 终点后延伸 5 格地面
- 地形配置可在神经元区域菜单中实时调整
- 种子锁定功能：锁定后每局使用相同种子，解锁后每局随机生成

---

## 7. 热更新与调试

- Vite HMR 在 `main.ts` 中注册了 `import.meta.hot.dispose`，用于清理 `aiInterval`、`fastLoopId`、Tween 等实例，防止热更新后产生重复定时器或内存泄漏
- 全局调试接口挂载在 `window.aiSandbox`，可直接在浏览器控制台访问：
  - `game` - 游戏核心实例
  - `renderer` - 渲染器实例
  - `network` - 神经网络实例（同 `window.network`）
  - `viewManager` - 神经元区域管理器
  - `ACTION` - 动作常量
  - `toggleAI()` - 快速切换 AI 模式
- 网络实例也单独暴露为 `window.network`，方便视图层菜单直接操作 `epsilon` 与 `exploreMode`
- AI 配置对象暴露为 `window.AI_CONFIG`，可查看/修改速度、奖励等常量

---

## 8. 测试说明

**本项目目前没有单元测试或 E2E 测试框架。**

验证改动的常见方式：
1. `npm run dev` 启动后，在浏览器中手动游玩玩家模式
2. 切换到 AI 训练模式，观察多局后权重矩阵颜色是否变化
3. 旋转设备或调整窗口大小，验证 EPS 布局与狐狸位置是否正常
4. 运行 `npm run build:single` 后，用浏览器直接打开 `dist/game.html`，确认单文件无资源加载错误
5. 测试地形种子锁定功能，确保相同种子生成相同地形
6. 验证控制台面板功能：日志筛选、自动滚动、下载

---

## 9. 安全与注意事项

- **不要**在 `localStorage` 中存储敏感信息；现有存储仅用于本地玩家最佳时间（`PlayerBestStore`）
- 修改 `eps.ts` 或 `InputManager` 中的尺寸相关代码时，注意保持两者的兼容性，否则横屏旋转后可能出现坐标或相机偏移错误
- 狐狸动画同时涉及 CSS 动画、CSS transition 和 WAAPI；修改尾巴或肢体动画时，留意 `transition: none !important` 的覆盖规则，防止动画冲突
- 权重更新逻辑非常精简，若改动 `NeuralNetwork.train()`，务必在 AI 训练模式下观察多局，确认学习行为未退化
- 地形生成器使用种子化随机（Mulberry32），修改权重配置或生成逻辑时，注意保持向后兼容
- **已知问题**：AI 输入当前只有 3 格有效（第 4 个输入恒为 0），如需完整 4 格输入需修改 `JumpGame.getStateForAI()`

---

## 10. 待办事项（来自 `TODO.md`）

- [x] 代码完全 TypeScript 化来获得完整编译检查
- [ ] AI 增加中间隐藏层，让 AI 获得组合信息的学习能力
- [ ] AI 环境信息从二元化转为多元化，输入信息向量化来使 AI 获得对不同元素的辨认能力

---

*最后更新：2026-04-02*
