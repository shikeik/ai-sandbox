# 阶段A - RUNNING 状态完成

## 修改概述

添加 `RUNNING` 状态表示"游戏进行中（可计时）"，实现动态 TIME/BEST 显示，使用毫秒级计时精度。

## 修改文件清单

### 1. src/game/JumpGame.js

**修改内容：**
- 添加 `RUNNING: 'running'` 到 STATUS 常量
- 调整 STATUS 常量的注释，明确区分游戏生命周期状态和人物动作状态
- 修改 `startGame()` 方法：将状态从 `STATUS.IDLE` 改为 `STATUS.RUNNING`

**状态定义更新后：**
```javascript
export const STATUS = {
  READY: 'ready',                 // 游戏生命周期：未开始
  RUNNING: 'running',             // 游戏生命周期：进行中 ← 新增
  TRANSITIONING: 'transitioning', // 游戏生命周期：转场
  IDLE: 'idle',                   // 人物动作：待机
  MOVING: 'moving',               // 人物动作：移动
  DEAD: 'dead',                   // 游戏生命周期：死亡结束
  WON: 'won'                      // 游戏生命周期：胜利结束
}
```

### 2. src/utils/timeUtils.js

**新增函数：**
```javascript
export function formatTimeMs(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const milliseconds = ms % 1000
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}
```

### 3. src/ai/PlayerBestStore.js

**修改内容：**
- 存储键从 `'ai-sandbox-player-best'` 改为 `'ai-sandbox-player-best-ms'`（重置旧记录）
- 导入 `formatTimeMs` 替代 `formatTime`
- `getFormatted()` 方法返回格式从 `--:--` 改为 `--:--.---`

### 4. src/main.js

**修改内容：**
- 导入 `formatTimeMs` 函数
- 修改 `updateGameInfo()` 函数：
  - RUNNING 状态时显示 `TIME: mm:ss.mmm`
  - 其他状态时显示 `BEST: mm:ss.mmm`
- 修改输入控制检查：
  - 按钮点击检查从 `STATUS.READY` 改为 `STATUS.RUNNING`
  - 键盘控制检查从 `STATUS.READY` 改为 `STATUS.RUNNING`
- AI 决策状态检查：兼容 `STATUS.IDLE` 和 `STATUS.RUNNING`

## 状态流转

```
首次加载
    ↓
STATUS = READY, startTime = null
    ↓
显示遮罩，显示 BEST: --:--.---
    ↓
点击开始 → startGame()
    ↓
STATUS = RUNNING, startTime = timestamp
    ↓
隐藏遮罩，显示 TIME: 00:00.023（开始计时）
    ↓
玩家操作...
    ↓
死亡/胜利
    ↓
STATUS = DEAD/WON, stopTimerUpdate(), 显示 BEST（如果破纪录会更新）
    ↓
转场开始 → STATUS = TRANSITIONING, 显示 BEST
    ↓
转场完成 → startGame()
    ↓
STATUS = RUNNING, startTime = newTimestamp
    ↓
显示 TIME: 00:00.012（新一局计时开始）
```

## 验收标准检查

- [x] 首次加载显示 `BEST: --:--.---`
- [x] 点击开始后显示 `TIME: 00:00.000` 并开始计时
- [x] 游戏中只显示 TIME（毫秒精度）
- [x] 死亡/胜利后显示 BEST（如果破纪录显示新纪录）
- [x] 转场期间显示 BEST
- [x] 新一局开始后立即显示 TIME（从 00:00.000 开始）
- [x] 只有 RUNNING 状态可以操作（键盘/按钮）
- [x] localStorage 使用新键名，旧数据被忽略

## 注意事项

1. 保留 `STATUS.IDLE` 和 `STATUS.MOVING` 用于人物动作状态
2. UI 宽度 `mm:ss.mmm` 比原来长，需确保显示区域足够
3. `Date.now()` 返回毫秒，直接使用即可
4. 旧的最佳记录数据因键名变更被忽略
