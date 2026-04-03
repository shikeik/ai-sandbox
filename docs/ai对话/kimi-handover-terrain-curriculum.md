# AI 交接文档：terrain-lab 课程学习阶段

> 编写时间：2026-04-04  
> 当前分支：已合并回 `main`  
> 最后提交：`7ecff36`（embedding 区域宽度 90%，高度 80vw）

---

## 一、这一段我们做了什么

### 核心目标
把 `terrain-lab` 从"简单监督学习 Demo"升级为"带课程学习（Curriculum Learning）的向量化参数训练沙盘"。

### 已落地的功能清单

1. **输入层从 One-Hot 改回 2D Embedding**
   - `INPUT_DIM` 从 90 降为 30（5×3×2）
   - `NetParams` 增加 `embed` 矩阵（6 个元素 × 2 维）
   - 前向/反向传播完整支持 embedding 梯度回传
   - 新增 `embedding-canvas` 实时显示 6 个元素在 2D 向量空间的聚类变化

2. **训练快照 + 执念曲线**
   - 训练时自动保存网络参数快照（每 20 步或每 100 步 batch 结束）
   - 快照全局累积，支持拖动滑块回退到任意历史训练步
   - 回退时同步恢复当时的 `acc` / `loss` / `step-count`
   - 新增"执念曲线"：追踪单样本的 4 个动作概率演变，直观复现"坚信错误 → 突然开窍"现象

3. **地形生成器支持元素开关 + 课程阶段**
   - `TerrainConfig` 定义 4 个开关：地面只有平地（无坑）/ 史莱姆 / 恶魔 / 金币
   - 5 个课程阶段：平地大道 → 小心坑洞 → 史莱姆出没 → 天降恶魔 → 金币干扰
   - 左栏 UI：标签按钮组选择阶段 + 4 个复选框自定义
   - 画笔栏与地形配置联动：未开启的元素不会出现在画笔中，也无法绘制

4. **课程学习自动训练流程**
   - 右栏"课程学习"面板：显示当前阶段 +「开始课程训练」+「进入下一阶段」
   - 点击训练后自动：切配置 → 生成 6000 条数据 → 循环训练 → 检查准确率 ≥ 90%
   - 达标后提示可进下一阶段，不达标提示建议重置再试
   - 网络权重跨阶段保留（迁移学习）

5. **验收逻辑修正**
   - `predict()` 与 `validateTerrain()` 使用同一数据源 `isActionValidByChecks()`
   - 合法但非最优的动作不再标"❌ 错误"，而是标"✅ 合法（但非最优）"
   - 预测结果拆为三行显示：预测 / 规则答案 / 评价

6. **Embedding 画布优化（最新）**
   - 动态缩放：根据最远元素的 `maxAbs` 自动调整 scale，防止点跑出画布
   - 方形虚线边界框：以最远元素为半径绘制
   - 右上角标注 `R=xx` 半径数值
   - 元素点大小由全局 R 值统一缩放（变化率可调，见 `EMBED_SIZE_*` 常量）
   - 画布尺寸：宽度 90%，高度 80vw（max-height 240px）

---

## 二、关键文件变更

| 文件 | 说明 |
|---|---|
| `src/terrain-lab/constants.ts` | 新增 `TerrainConfig`、`DEFAULT_TERRAIN_CONFIG`、`CURRICULUM_STAGES`、`EMBED_SIZE_*` 可视化常量 |
| `src/terrain-lab/types.ts` | `DatasetItem` 改用 `indices`（元素 ID 序列） |
| `src/terrain-lab/neural-network.ts` | 增加 `embed` 矩阵、`cloneNet`、embedding 梯度回传 |
| `src/terrain-lab/terrain.ts` | `randElem` → `getLayerPool` + `randElemFromPool`；生成器支持 `config`；新增 `isActionValidByChecks` |
| `src/terrain-lab/state.ts` | 增加 `snapshots`、`selectedSnapshotIndex`、`observedSample`、`terrainConfig` |
| `src/terrain-lab/main.ts` | 大改：训练快照、执念曲线、课程学习、UI 绑定、embedding 动态绘制全部在此 |
| `pages/terrain-lab.html` | 新增 embedding-canvas、快照滑块、执念曲线、地形配置、课程学习面板 |
| `src/engine/console/ConsolePanel.ts` | 修复 `.console-panel` class 未正确添加导致高度为 0 的 bug |

---

## 三、踩过的坑（非常重要）

### 坑 1：走 A 概率永远为 0
**根因**：`generateTerrainData` 和 `generateRandomTerrain` 里地上层原来是 `Array(NUM_COLS).fill(ELEM_AIR)`，**史莱姆永远不会出现**。没有史莱姆时 `canWalk` 永远优先于 `canWalkAttack` 被满足，导致走A标签在训练集中出现率为 0。
**修复**：让地上层按 `randElem(1)` 正确随机生成，并过滤掉多余的狐狸。

### 坑 2：验收预测和合法性检查数据源不一致
**根因**：`predict()` 早期直接拿 `getLabel()` 做唯一标准，而 `validateTerrain()` 调用的是 `getActionChecks()`。导致某些合法动作被误判为错误。
**修复**：`predict()` 改用 `isActionValidByChecks()`，与 `validateTerrain()` 共享同一判定逻辑。

### 坑 3：Embedding 点跑出画布
**根因**：`drawEmbedding()` 的 `scale` 是固定值 `Math.min(W,H)/4`，训练后期某些 embedding 会越跑越远。
**修复**：动态计算所有元素向量的最大绝对值 `maxAbs`，再算 `scale = min(availW/2/maxAbs, availH/2/maxAbs)`，始终把所有点圈在视野内。

### 坑 4：控制台不可见
**根因**：`ConsolePanel.init()` 忘了给挂载点加 `.console-panel` class，CSS 的 `height: 0` 和 `overflow: hidden` 直接把面板压没了。
**修复**：在 `init()` 里补了 `this.container.classList.add("console-panel")`，并在 `terrain-lab.html` 的 `#console-mount` 上加显式 `height: 240px` 兜底。

### 坑 5：快照滑块回退时指标不更新
**根因**：快照只存了网络参数，没存当时的准确率和损失。
**修复**：快照增加 `acc` 和 `loss` 字段，`applySnapshot()` 时同步恢复 `acc-display` 和 `loss-display`。

### 坑 6：执念曲线 X 轴越走越短
**根因**：早期 `trainBatch` 每次都会 `state.snapshots = []` 清空旧快照。
**修复**：改为全局累积，只在 `resetNet()` 时清空。

---

## 四、当前架构要点

### 训练流程
```
generateData(6000, config) → dataset
for each batch (100 steps):
    mini-batch SGD (batchSize=32)
    save snapshot every 20 steps
    evaluate acc/loss
    if acc >= 90%: break
```

### 课程学习流程
```
for stage in [1..5]:
    apply stage config
    generateData(6000, stageConfig)
    train until acc >= 90% or maxSteps=3000
    unlock next stage button
```

### 为什么训练仍然只用"最优答案"而不是"所有合法答案"？
- Softmax 分类器在多个正标签时会互相抑制，收敛变慢
- "小脑反射"阶段的目标是最快做出正确反应，不是收益优化
- 验收时放宽到"合法即对"已足够教学

---

## 五、还没做的事（下一步）

### 高优先级
1. **terrain-lab 内部 Tab 拆分**
   - Tab 1：当前页面（编辑器 + 监督学习训练）
   - Tab 2：连续挑战模式（类似 fox-jump 的实时闯关，但用 terrain-lab 的多元元素规则）
   
2. **课程学习的自动递进**
   - 当前需要用户手动点「进入下一阶段」
   - 可以做成自动判断达标后无缝进入下一阶段的「全自动课程」

### 中优先级
3. **把完整机制反向移植到 fox-jump**
   - 把 terrain-lab 的 3 层地形、元素、血量/计分规则搬回主游戏
   - 这是文档里写的最终目标

4. **计分系统（远期）**
   - 目前被搁置，因为小脑反射阶段二元反馈足够
   - 如果后续增加强化学习 RL Tab，可以再讨论

### 低优先级 / 优化
5. **AGENTS.md 增加 git commit hash 标识**
6. **执念曲线支持多样本同时对比**
7. **把课程学习状态持久化到 localStorage**

---

## 六、给下一个 AI 的建议

1. **改地形生成或合法性检查前，务必同时改 `terrain.ts` 和 `main.ts` 的 `predict()`**，确保数据源一致。
2. **任何涉及 canvas 尺寸的改动**，要检查 `ResizeObserver` 是否注册了对应的 canvas。
3. **新增 UI 控件时**，要在 `init()` 里绑定事件，并暴露到 `(window as any)`，因为 HTML 内联 `onclick` 需要全局函数。
4. **ConsolePanel 相关的 bug** 优先检查 `console-panel` class 是否正确挂载。
5. **运行验证**：`npm run dev` → 打开 `/pages/terrain-lab.html`，重点测：生成数据 → 训练 → 拖动快照 → 切换课程阶段 → 开始课程训练。
6. **想调 embedding 点大小变化率**：去 `src/terrain-lab/constants.ts` 改 `EMBED_SIZE_BASE / SENSITIVITY / OFFSET / MIN / MAX`。
