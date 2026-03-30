# 代码质量优化清单

> 生成日期：2026-03-30
> 项目：ai-sandbox（Vite + JavaScript 跳跃游戏）

---

## 🔴 高优先级问题

### 1. 重复代码：时间格式化函数（DRY 原则）

**位置：**
- `src/game/JumpGame.js` 第 154-159 行
- `src/ai/PlayerBestStore.js` 第 60-65 行

**问题描述：**
两个完全相同的 `formatTime(ms)` 函数，用于将毫秒格式化为 `mm:ss`。

**代码示例：**
```javascript
// JumpGame.js
formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

// PlayerBestStore.js（完全相同的代码）
formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}
```

**建议修复：**
1. 在 `src/utils/` 目录创建 `timeUtils.js`，导出 `formatTime` 函数
2. 两个类都导入并使用该工具函数

---

### 2. 重复代码：视图初始化逻辑

**位置：**
- `src/views/NetworkView.js` 第 14-31 行
- `src/views/HistoryView.js` 第 14-31 行

**问题描述：**
两个视图的 `init()` 和 `resize()` 方法几乎完全相同。

**建议修复：**
1. 创建基类 `BaseView`，封装共同的初始化逻辑
2. 两个视图继承基类，只实现各自的 `render()` 方法

---

### 3. 内存泄漏：未清理的事件监听器

**位置：**
- `src/views/NetworkView.js` 第 31 行
- `src/views/HistoryView.js` 第 30 行

**问题描述：**
```javascript
window.addEventListener('resize', () => this.resize())
```
每次创建视图都会添加新的监听器，但从未移除。

**建议修复：**
1. 将 resize 处理函数保存为实例方法
2. 在 `destroy()` 方法中移除监听器

```javascript
destroy() {
  window.removeEventListener('resize', this._resizeHandler)
}
```

---

## 🟡 中优先级问题

### 4. 逻辑不一致：输入锁定重复设置

**位置：**
- `src/game/JumpGame.js` 第 280、284、295、306 行

**问题描述：**
`_inputLocked` 在 `_checkResult()` 中设置为 `true`，在 `triggerDeath()` 和 `triggerWin()` 中又重复设置。

**代码示例：**
```javascript
// _checkResult 中已设置
_checkResult(finalX) {
  if (this._isInPit(finalX)) {
    this._inputLocked = true  // 第一次设置
    ...
  }
}

// triggerDeath 中又设置一次
triggerDeath() {
  this._inputLocked = true  // 重复设置，无意义
  ...
}
```

**建议修复：**
移除 `triggerDeath()` 和 `triggerWin()` 中的重复设置。

---

### 5. 魔法数字：滑动检测阈值

**位置：**
- `src/views/NeuronAreaManager.js` 第 56 行

**问题描述：**
```javascript
if (Math.abs(deltaX) > 50 && deltaTime < 500) {
```
其中 `50`（像素）和 `500`（毫秒）是魔法数字。

**建议修复：**
```javascript
const SWIPE_THRESHOLD = 50  // 像素
const SWIPE_TIMEOUT = 500   // 毫秒

if (Math.abs(deltaX) > SWIPE_THRESHOLD && deltaTime < SWIPE_TIMEOUT) {
```

---

### 6. 魔法数字：采样点数默认值

**位置：**
- `src/views/HistoryView.js` 第 47 行

**问题描述：**
```javascript
render(history, maxPoints = 100) {
```
`100` 是魔法数字。

**建议修复：**
```javascript
const DEFAULT_MAX_POINTS = 100

render(history, maxPoints = DEFAULT_MAX_POINTS) {
```

---

### 7. 硬编码配置：网络层名称

**位置：**
- `src/views/NetworkView.js` 第 138-139 行

**问题描述：**
```javascript
const layerNames = ['输入', '输出']
const actionNames = ['移动', '跳跃']
```
这些名称硬编码在视图层，如果网络结构变化会出问题。

**建议修复：**
1. 从 `NeuralNetwork` 类提供名称配置
2. 或通过参数传入视图

---

## 🟢 低优先级问题

### 8. 样式管理：内联样式过多

**位置：**
- `src/views/NeuronAreaManager.js` 第 76-94、104-116、119-126、141-161 行

**问题描述：**
菜单按钮、下拉菜单等样式全部内联在 JavaScript 中，难以维护。

**建议修复：**
1. 在 `style.css` 中添加对应的 CSS 类
2. JavaScript 中只添加/切换类名

---

### 9. DOM 操作冗余

**位置：**
- `src/render/GameRenderer.js` 第 263 行

**问题描述：**
```javascript
this.foxContainer.classList.remove('state-idle', 'state-run', 'state-jump-up', 'state-jump-down', 'state-land')
```
每次都要列出所有状态类。

**建议修复：**
```javascript
// 定义常量数组
const FOX_STATES = ['idle', 'run', 'jump-up', 'jump-down', 'land', 'dead']

// 使用辅助方法
_setFoxState(newState) {
  FOX_STATES.forEach(state => {
    this.foxContainer.classList.remove(`state-${state}`)
  })
  this.foxContainer.classList.add(`state-${newState}`)
}
```

---

### 10. 属性访问不一致

**位置：**
- `src/main.js` 第 253、256 行

**问题描述：**
```javascript
historyStore.add({
  generation: game.generation,  // 直接访问属性
  steps: player.grid,
  ...
})
```

与 `game.getState().generation` 混用。

**建议修复：**
统一使用 `getState()` 方法访问，保持代码一致性。

---

### 11. 缺少 JSDoc 类型注释

**位置：**
多个文件

**问题描述：**
部分公共方法缺少完整的 JSDoc 注释，如 `NeuralNetwork.train()` 的参数类型。

**建议修复：**
补充完整的类型注释，如：
```javascript
/**
 * 训练更新（每步调用）
 * @param {number} reward - 奖励（存活+0.02，死亡-1，胜利+1）
 * @param {number} action - 实际执行的动作（0=右移, 1=跳跃）
 * @returns {void}
 */
train(reward, action) { ... }
```

---

## 📊 优化优先级汇总

| 优先级 | 问题 | 文件 | 行号 |
|--------|------|------|------|
| 🔴 高 | 时间格式化函数重复 | JumpGame.js, PlayerBestStore.js | 154-159, 60-65 |
| 🔴 高 | 视图初始化逻辑重复 | NetworkView.js, HistoryView.js | 14-31 |
| 🔴 高 | 内存泄漏（resize监听器） | NetworkView.js, HistoryView.js | 31, 30 |
| 🟡 中 | 输入锁定重复设置 | JumpGame.js | 280, 284, 295, 306 |
| 🟡 中 | 滑动检测魔法数字 | NeuronAreaManager.js | 56 |
| 🟡 中 | 采样点数魔法数字 | HistoryView.js | 47 |
| 🟡 中 | 网络层名称硬编码 | NetworkView.js | 138-139 |
| 🟢 低 | 内联样式过多 | NeuronAreaManager.js | 多处 |
| 🟢 低 | DOM操作冗余 | GameRenderer.js | 263 |
| 🟢 低 | 属性访问不一致 | main.js | 253, 256 |
| 🟢 低 | 缺少JSDoc注释 | 多个文件 | 多处 |

---

## ✅ 已修复问题

### 问题：游戏信息初始化显示不完整

**修复位置：** `src/main.js` 第 106-108 行

**修复内容：**
在 `init()` 函数末尾添加 `updateGameInfo()` 调用，确保游戏加载时正确显示 POS、GEN、TIME、BEST 所有信息。

```javascript
// 初始渲染网络图
renderNetworkView()

// 初始化游戏信息显示（POS、GEN、TIME、BEST）
updateGameInfo()

console.log('🎮 AI 训练沙盘已初始化')
```

---

## 🎯 重构建议路线图

### 第一阶段（快速修复）
1. ✅ 修复初始化显示问题
2. 🔴 提取工具函数（formatTime）
3. 🔴 修复内存泄漏（resize监听器）

### 第二阶段（代码结构优化）
4. 🟡 创建 BaseView 基类
5. 🟡 消除魔法数字
6. 🟡 统一属性访问方式

### 第三阶段（完善文档）
7. 🟢 补充 JSDoc 注释
8. 🟢 优化样式管理方式
9. 🟢 提取常量配置

---

*本清单基于 DRY、SRP 原则和代码异味检测生成*
