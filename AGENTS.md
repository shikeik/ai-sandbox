# AI 神经元训练沙盘 —— 项目指南

> 本文件面向 AI 编程助手。如果你刚接触本项目，请完整阅读此文档后再修改代码。

---

## 1. 项目概述

**项目名称**：`ai-sandbox`（AI 神经元训练沙盘）  
**类型**：纯前端网页应用 —— 一款结合“极简跳跃游戏”与“实时神经网络可视化训练”的交互式沙盘。  
**核心体验**：
- 玩家控制一只纯 CSS 绘制的狐狸，在 32 格横版地形中右移或跳跃躲避坑洞。
- 可切换为 AI 控制/AI 训练模式，实时观察一个 3→2 单层神经网络的权重变化。
- 神经网络采用自定义实现的 ε-贪心策略，支持自动调节探索率。

---

## 2. 技术栈

- **语言**：原生 JavaScript（ES Modules，`"type": "module"`）
- **构建工具**：Vite 5（仅用作打包与开发服务器，**不引入任何前端框架**）
- **样式**：纯 CSS（无预处理器），包含大量自定义 CSS 动画与 WAAPI（Web Animations API）
- **绘图**：Canvas 2D（用于神经网络可视化）
- **持久化**：`localStorage`（保存训练历史与玩家最佳纪录）
- **Node 脚本**：原生 `fs` + `child_process` 实现单文件打包

> **重要**：本项目没有使用 React / Vue / TypeScript / 测试框架。所有逻辑均为手写 Vanilla JS。

---

## 3. 目录结构

```
├── index.html                 # 入口 HTML，内含 EPS 恒竖布局系统（大量内联样式与脚本）
├── package.json               # 仅依赖 vite
├── vite.config.js             # 路径别名、dev server 配置（host: 0.0.0.0, port: 4000）
├── eslint.config.js           # ESLint 规则（tab 缩进、无分号、禁止 var）
├── scripts/
│   └── build-single-file.mjs  # 将 Vite 构建产物内联为单文件 dist/game.html
├── src/
│   ├── main.js                # 应用入口：连接游戏逻辑、渲染、AI、视图、事件绑定
│   ├── game/
│   │   └── JumpGame.js        # 游戏核心逻辑（地形生成、碰撞检测、状态机）
│   ├── render/
│   │   ├── GameRenderer.js    # DOM 渲染器 + 补间动画(Tween) + 狐狸动画状态机
│   │   └── TransitionManager.js # 死亡/胜利后的黑屏转场
│   ├── ai/
│   │   ├── NeuralNetwork.js   # 单层神经网络（3 输入 → 2 输出）+ ε-贪心 + 训练更新
│   │   ├── HistoryStore.js    # localStorage 持久化的训练历史
│   │   └── PlayerBestStore.js # 玩家最佳通关时间记录
│   ├── views/
│   │   ├── NeuronAreaManager.js # 神经元区域视图切换与菜单（网络/矩阵/历史）
│   │   ├── NetworkView.js     # Canvas 绘制网络拓扑图
│   │   ├── MatrixView.js      # Canvas 绘制权重矩阵表格
│   │   └── HistoryView.js     # Canvas 绘制训练历史折线图
│   ├── utils/
│   │   └── timeUtils.js       # 时间格式化工具（mm:ss / mm:ss.mmm）
│   ├── style.css              # 全局样式、布局、UI 控件
│   └── style-fox.css          # 狐狸纯 CSS 绘制与动画状态
└── docs/                      # 需求文档、AI 对话记录、设计思路
```

### 路径别名（Vite resolve.alias）

```js
'@game'    -> src/game
'@render'  -> src/render
'@ai'      -> src/ai
'@views'   -> src/views
'@utils'   -> src/utils
```

---

## 4. 构建与运行命令

```bash
# 开发服务器（http://localhost:4000）
npm run dev

# 标准构建 -> dist/
npm run build

# 构建并打包成单文件 dist/game.html（可直接双击打开，无需服务器）
npm run build:single

# 预览构建产物
npm run preview
```

---

## 5. 代码风格规范

项目使用 ESLint 约束，**修改代码时必须遵守**以下约定：

| 规则 | 说明 |
|------|------|
| **缩进** | **Tab**（非空格），`SwitchCase` 缩进一级 |
| **分号** | **禁止分号** (`semi: never`) |
| **变量声明** | 禁止 `var`，优先 `const`，必要时 `let` |
| **引号** | 未强制，但现有代码多用单引号 |
| **注释语言** | **中文**（函数 JSDoc、模块说明、行内解释均使用中文） |
| **区块分隔** | 常用 `// ========== 标题 ==========` 风格进行大段分隔 |

> 提交前建议运行 `npx eslint src/` 检查风格问题。

---

## 6. 核心架构与关键概念

### 6.1 游戏逻辑（JumpGame.js）
- **世界**：32 格横版地图，随机生成平地(`ground`)与坑(`pit`)。
- **动作**：`RIGHT` (x+1) 或 `JUMP` (x+2)。
- **状态分离**：
  - `GAME_STATUS`：生命周期状态（`READY` / `RUNNING` / `TRANSITIONING` / `FINISHED`）
  - `PLAYER_ACTION`：人物动画状态（`IDLE` / `MOVING` / `JUMPING`）
- **速通机制**：逻辑位置立即改变，渲染层通过 Tween 补间平滑过渡；动画可被打断，允许玩家在动画期间连续输入。

### 6.2 渲染层（GameRenderer.js）
- `Tween` 类使用 `requestAnimationFrame` + `easeInOutQuad` 缓动。
- 狐狸动画状态通过 CSS class 切换（`state-idle` / `state-run` / `state-jump-up` / `state-jump-down` / `state-land` / `state-dead`）。
- 尾巴动画单独使用 **WAAPI** (`Element.animate`)，避免与 CSS transition 冲突。

### 6.3 AI 系统（NeuralNetwork.js）
- **结构**：单层，3 个输入神经元（前方第 1/2/3 格是否为坑）→ 2 个输出神经元（移动 / 跳跃）。
- **决策**：ε-贪心（`epsilon` 默认 0.3）。
  - 探索时随机二选一；
  - 利用时直接比较输出分数，选高分动作（无 Softmax）。
- **训练**：
  - 存活每步奖励 `+0.02`
  - 死亡惩罚 `-1`
  - 胜利奖励 `+1`
  - 权重更新公式：`w += learningRate * input`（奖励为正）或 `w -= learningRate * input`（奖励为负），并对错误动作的替代动作给予一半奖励。
- **动态 ε**：默认开启 `autoAdjustEpsilon`。根据最近 5 局的滑动平均分自动增减探索率（±0.05），范围锁定在 `[0.1, 0.4]`。

### 6.4 EPS 恒竖布局系统
- 位于 `index.html` 内联 `<script>` 中，是一个自包含的 `EPS` 对象。
- 功能：当设备物理横屏时，通过 CSS `rotate(-90deg)` 将游戏容器强制显示为竖屏。
- 同时计算硬件安全区域（`env(safe-area-inset-*)`）与软件 UI 内边距（`visualViewport`），动态更新 CSS 变量 `--ep-avail-width` / `--ep-avail-height`。
- 注意：该逻辑与 `src/main.js` 中的 `handleResize` 存在联动，修改尺寸相关代码时需两边同时考虑。

### 6.5 三种运行模式（main.js）
| 模式 | 说明 |
|------|------|
| `player` | 玩家手动操作，底部显示移动/跳跃按钮，计时并记录最佳时间 |
| `ai` | AI 控制狐狸自动闯关，只观察不训练 |
| `train` | AI 自动闯关并实时更新权重，支持 5 档速度（单步 / 慢速 / 中速 / 快速 / 极速） |

---

## 7. 热更新与调试

- Vite HMR 在 `main.js` 中注册了 `import.meta.hot.dispose`，用于清理 `aiInterval`、`fastLoopId`、Tween 等实例，防止热更新后产生重复定时器或内存泄漏。
- 全局调试接口挂载在 `window.aiSandbox`，可直接在浏览器控制台访问 `game`、`renderer`、`network`、`history`、`viewManager` 等实例。
- 网络实例也单独暴露为 `window.network`，方便视图层菜单直接操作 `epsilon` 与 `autoAdjustEpsilon`。

---

## 8. 测试说明

**本项目目前没有单元测试或 E2E 测试框架。**  
验证改动的常见方式：
1. `npm run dev` 启动后，在浏览器中手动游玩玩家模式。
2. 切换到 AI 训练模式，观察多局后历史折线是否上升、权重矩阵颜色是否变化。
3. 旋转设备或调整窗口大小，验证 EPS 布局与狐狸位置是否正常。
4. 运行 `npm run build:single` 后，用浏览器直接打开 `dist/game.html`，确认单文件无资源加载错误。

---

## 9. 安全与注意事项

- **不要**在 `localStorage` 中存储敏感信息；现有存储仅用于本地训练历史与最佳时间。
- 修改 `index.html` 中的 EPS 脚本时，注意保持与 `src/main.js` 中 `handleResize` 的兼容性，否则横屏旋转后可能出现坐标或相机偏移错误。
- 狐狸动画同时涉及 CSS 动画、CSS transition 和 WAAPI；修改尾巴或肢体动画时，留意 `transition: none !important` 的覆盖规则，防止动画冲突。
- 权重更新逻辑非常精简，若改动 `NeuralNetwork.train()`，务必在 AI 训练模式下观察多局，确认学习行为未退化。

---

## 10. 待办事项（来自 `TODO.md`）

- 规范日志输出文件名：统一使用 `game-log-*.txt`。
- Log 系统升级：支持结构化数据、分级、JSON 导出。
- 清理重复 skill：删除所有子目录 `.kimi/skills/` 中的通用技能，统一移到 `html` 根目录管理。
- EPS 完善：检测刘海屏、顶部导航栏、底部菜单栏、软输入法区域，避免浏览器 UI 侵入。

---

*最后更新：2026-04-02*
