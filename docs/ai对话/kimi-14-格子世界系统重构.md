# AI 交接文档：格子世界系统重构

> 编写时间：2026-04-05
> 当前分支：`dev/challenge-animation`（建议合并到 main）
> 关联文档：`kimi-13-进行中.md`（之前的重构工作）

---

## 重构背景

**问题**：terrain-lab 三个 Tab（训练/挑战/生成器）各自实现了独立的格子世界渲染系统

- `renderer.ts` - 训练页绘制（519行）
- `map-renderer.ts` - 生成器绘制（607行）
- `challenge-ui.ts` - 挑战页绘制（约150行嵌入代码）
- `animation.ts` - 独立动画系统（108行）

**重复代码**：3套地形网格绘制、3套动画系统、不一致的坐标计算

---

## 重构目标

创建统一的 **GridWorldSystem**，取代所有分散实现：

```
src/terrain-lab/grid-world/
├── types.ts              # 统一类型定义
├── GridWorld.ts          # 核心：地形数据+游戏逻辑+渲染协调
├── GridWorldRenderer.ts  # 统一渲染：支持任意尺寸、视野、动画
├── GridWorldAnimator.ts  # 统一动画：走/跳/远跳/走A
├── GridWorldEditor.ts    # 编辑功能：画笔、层限制
└── index.ts              # 统一导出
```

---

## 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `grid-world/types.ts` | 140 | 类型定义（ElementDef, GridWorldConfig, AnimationState等） |
| `grid-world/GridWorld.ts` | 450 | 核心类：地形数据、动作执行、动画播放 |
| `grid-world/GridWorldRenderer.ts` | 350 | Canvas绘制：网格、Emoji、标签、动画帧 |
| `grid-world/GridWorldAnimator.ts` | 220 | 动画调度：缓动函数、帧回调 |
| `grid-world/GridWorldEditor.ts` | 150 | 编辑功能：画笔、点击检测、层限制 |
| `grid-world/index.ts` | 50 | 统一导出+兼容性函数 |

---

## 重写/精简文件

| 文件 | 变更 |
|------|------|
| `TrainingEntry.ts` | 使用 GridWorld 替代独立绘制，简化约 50% 代码 |
| `ChallengeEntry.ts` | 使用 GridWorld 替代 MapRenderer，移除 90 行动画代码 |
| `MapGeneratorEntry.ts` | 使用 GridWorld 统一相机和动画 |
| `challenge-ui.ts` | 移除 drawViewport()，仅保留 DOM 操作 |
| `renderer.ts` | 精简为仅保留 MLP/Embedding/执念曲线绘制 |
| `state.ts` | 更新导入路径，使用 grid-world 的 createAnimationState |

---

## 删除文件

| 文件 | 功能迁移 |
|------|----------|
| `animation.ts` | 功能合并到 GridWorldAnimator |
| `map-renderer.ts` | 功能合并到 GridWorldRenderer |

---

## 代码量减少

| 项目 | 行数 |
|------|------|
| 新增代码 | ~1,350 行 |
| 删除代码 | ~715 行（animation + map-renderer） |
| 净减少 | **约 1,000 行重复代码** |

---

## 关键 Bug 修复

### Bug 1：编辑器绘制后图像不更新
**原因**：`state.terrain` 和 `GridWorld.state.grid` 不同步
**修复**：`onCellPainted` 回调中添加 `syncTerrainToGridWorld()`

### Bug 2：点击检测错误
**原因**：`getCellAtPosition` 中 `localY` 计算错误，用了 `col` 而不是 `row`
**修复**：`const localY = y - row * (cellH + gapY)`

### Bug 3：动画首次渲染失败
**原因**：`renderAnimation` 在没有 `lastLayout` 时直接返回
**修复**：如果没有 layout，先计算一个再渲染

### Bug 4：地图生成器动画不播放
**原因**：`playAction` 调用时缺少 `onFrame` 回调
**修复**：添加 `onFrame: (progress, slimeKilled) => renderAnimation(...)`

### Bug 5：日志标签混乱
**原因**：sed 替换导致 `console.log("message")` 失去 TAG
**修复**：统一使用 `console.log("TAG", "message")` 格式

---

## 验证结果

```bash
npm run type-check   # ✅ 通过
npm run lint         # ✅ 通过（43警告，0错误）
npm run build        # ✅ 通过
npm test             # ✅ 8/8 通过
```

---

## 数据流向（关键）

### 编辑模式
```
用户点击 -> GridWorldEditor.paintAt() 
         -> onCellPainted 回调
         -> setTerrainCell(state, row, col, element)  // 修改 state.terrain
         -> syncTerrainToGridWorld()                   // 同步到 GridWorld
         -> drawEditor()                               // GridWorld.render()
```

### 动画模式
```
playAction(action, { onFrame })
  -> GridWorldAnimator.play(action, onFrame)
  -> 每帧回调 onFrame(progress, slimeKilled)
  -> renderAnimation(options, action, progress, slimeKilled)
  -> renderer.renderAnimation(...)  // 绘制动画帧
  -> 动画完成 -> executeAction(action)  // 执行游戏逻辑
```

---

## 三个 Entry 的配置差异

```typescript
// 训练页：5×3，固定视野，启用编辑
this.gridWorld = createGridWorld({
    width: 5, height: 3, elements: DEFAULT_ELEMENTS
})
this.gridWorld.enableEditor()

// 挑战页：32×3，5列视野，相机跟随
this.gridWorld = createGridWorld({
    width: 32, height: 3, elements: DEFAULT_ELEMENTS,
    viewportWidth: 5
})

// 生成器：32×3，7列视野，相机跟随
this.gridWorld = createGridWorld({
    width: 32, height: 3, elements: DEFAULT_ELEMENTS,
    viewportWidth: 7
})
```

---

## 给下一个 AI 的建议

### 1. 如果动画仍有问题
检查 `GridWorldAnimator.step()` 中的 `onFrame` 回调是否正常触发
检查 `renderAnimation` 的坐标计算是否正确

### 2. 如果编辑仍有问题
检查 `onCellPainted` 回调是否被正确设置
检查 `syncTerrainToGridWorld()` 是否在绘制后被调用

### 3. 如果需要添加新元素类型
修改 `DEFAULT_ELEMENTS` 数组，在 `grid-world/GridWorld.ts` 中

### 4. 如果需要修改动画参数
修改 `ANIMATION_CONFIGS` 对象，在 `grid-world/GridWorldAnimator.ts` 中

---

## 提交记录

```
2715714 fix: 修复编辑器绘制后图像不更新问题
35961cb fix: 统一日志标签，修复动画回调
e0eba60 fix: 地图生成器单步生成时播放动画
8ccb8bc fix: 修复编辑和动画问题
0e8d877 chore: 删除废弃的 animation.ts 和 map-renderer.ts
69cdbd3 refactor: 精简 renderer.ts 移除重复绘制逻辑
f23466c refactor: 重写 Entry 类使用 GridWorld 统一渲染
8b65dfc feat: 新增格子世界系统核心模块
```

---

*本文档完结，可直接合并到 main 分支*
