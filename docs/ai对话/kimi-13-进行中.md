# AI 交接文档：terrain-lab 代码重构（进行中）

> 编写时间：2026-04-04（进行中）
> 当前分支：`refactor/terrain-lab-modular`
> 文档形式：**阶段式记录**（边对话边总结，随时可追加）

---

## 阶段记录

### 阶段 1：重构准备与计划回顾

**触发原因**：基于 `docs/需求/terrain-lab重构/00-重构评估与计划.md` 执行重构，目标是将 `main.ts` 从 1523 行压缩至 <250 行。

**做了什么**：
- 回顾重构计划（7个批次）
- 检查当前代码状态（main.ts 1523行）
- 创建新分支 `refactor/terrain-lab-modular`
- 修复编译错误（tsconfig.json 排除 test 文件）

**当前状态**：✅ 准备完成，开始执行重构

---

### 阶段 2：批次1-2 - Canvas工具与绘制函数提取

**做了什么**：
- 在 `renderer.ts` 添加 `setupCanvas()` 统一处理 DPR
- 迁移 `drawEditorWithState`, `drawMLP`, `drawEmbedding`, `drawObsessionCurve`, `stepAnimation` 到 `renderer.ts`
- main.ts 行数：1523 → 1127（-396行）

**当前状态**：✅ 完成

---

### 阶段 3：批次3 - UI管理器独立化

**做了什么**：
- 新建 `ui-manager.ts`（242行）
- 迁移所有 DOM 更新函数：updateMetrics, updateExam, updateTerrainStatus, updateProbs, updateObsessionStatus, renderBrushes, renderTerrainConfig, updateModeUI, updateCurriculumUI
- main.ts 行数：1127 → 962（-165行）

**当前状态**：✅ 完成

---

### 阶段 4：批次4 - 训练引擎独立化

**做了什么**：
- 新建 `training-engine.ts`（207行）
- 迁移 `trainSupervised`, `trainUnsupervised`, `adjustEpsilon`, `evaluateDataset`
- 训练逻辑与 UI 完全分离，通过回调函数通信
- main.ts 行数：962 → 779（-183行）

**当前状态**：✅ 完成

---

### 阶段 5：批次5 - 快照管理器独立化

**做了什么**：
- 新建 `snapshot-manager.ts`（105行）
- 迁移 `recordSnapshotStats`, `applySnapshot`, 添加快照相关方法
- main.ts 行数：779 → 749（-30行）

**当前状态**：✅ 完成

---

### 阶段 6：批次6 - 课程控制器独立化

**做了什么**：
- 新建 `curriculum-controller.ts`（234行）
- 合并 `runCurriculumSupervised` 和 `runCurriculumUnsupervised`
- 提取重复控制流，通过策略函数区分模式
- main.ts 行数：749 → 582（-167行）

**当前状态**：✅ 完成

---

### 阶段 7：批次7 - 梯度接口合并+硬编码修复

**做了什么**：
- 新建 `gradients.ts` 统一 `GradientBuffer` 接口
- 移除 `supervised.ts` 和 `unsupervised.ts` 中重复的 `GradientBuffer` 定义
- 修复硬编码 `d < 2`，统一使用 `EMBED_DIM` 常量
- main.ts 行数：582 → 582（-0行，但消除代码重复）

**当前状态**：✅ 完成

---

### 阶段 8：批次8 - 验证器+预测器+观察样本管理器

**做了什么**：
- 新建 `terrain-validator.ts`（73行）- 提取 `validateTerrain`
- 新建 `predictor.ts`（88行）- 提取 `predict`
- 新建 `obsession-manager.ts`（55行）- 提取 `setObservedFromTerrain`, `setObservedRandom`
- main.ts 行数：582 → 443（-139行）

**当前状态**：✅ 完成

---

### 阶段 9：批次9 - onConfigChange 简化

**做了什么**：
- 在 `UIManager` 添加 `getConfigFromUI()` 方法
- 简化 `onConfigChange` 函数
- main.ts 行数：443 → 433（-10行）

**当前状态**：✅ 完成

---

### 阶段 10：日志格式统一

**做了什么**：
- 更新 `Logger.ts`，移除 `[TAG]` 格式支持，统一使用 `"TAG"` 格式
- 将项目中所有 `[TAG]` 格式日志改为 `"TAG"` 格式
- 在关键位置添加验证日志

**当前状态**：✅ 完成

---

## 当前整体状态

| 事项 | 状态 |
|---|---|
| 重构批次1-9 | ✅ 全部完成 |
| main.ts 行数 | ✅ 1523行 → 433行（压缩72%）|
| 测试通过 | ✅ 8/8 通过 |
| 构建成功 | ✅ 通过 |
| ESLint | ✅ 无错误 |
| Git 提交 | ✅ 9个批次已提交 |

---

## 新增文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `ui-manager.ts` | 257 | UI 更新收口 |
| `training-engine.ts` | 207 | 训练算法 |
| `curriculum-controller.ts` | 234 | 课程学习控制 |
| `snapshot-manager.ts` | 105 | 快照管理 |
| `predictor.ts` | 88 | AI 预测 |
| `terrain-validator.ts` | 73 | 地形验证 |
| `obsession-manager.ts` | 55 | 观察样本管理 |
| `gradients.ts` | 90 | 统一梯度接口 |

---

## 关键文件变更

| 文件 | 变更 |
|------|------|
| `main.ts` | 1523行 → 433行（-1090行）|
| `renderer.ts` | 扩展绘制函数 |
| `supervised.ts` | 移除重复 GradientBuffer |
| `unsupervised.ts` | 移除重复 GradientBuffer |
| `Logger.ts` | 统一日志格式 |

---

## 验证清单（每批次执行）

```bash
npm run lint      # ✅ 通过
npm test          # ✅ 8/8 通过
npm run build     # ✅ 通过
```

---

## 给下一个 AI 的建议

1. **main.ts 当前 433 行**，距离目标 <250 行还有 183 行差距
2. 剩余主要是：
   - `init()` 95行（页面入口，包含大量全局函数暴露，难以进一步模块化）
   - 约 20 个小型辅助函数（每个 10-20 行）
3. 建议接受当前程度，或继续提取 `init()` 中的事件绑定逻辑到 `initializer.ts`
4. 所有重构代码已充分测试，可直接使用

---

*（本文档为阶段式记录，后续如有相关迭代可直接追加阶段 11、阶段 12...）*
