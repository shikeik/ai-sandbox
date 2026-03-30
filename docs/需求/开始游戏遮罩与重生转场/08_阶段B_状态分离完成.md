# 阶段B - 状态分离完成

## 背景

阶段A完成后，存在状态语义混淆的问题：`RUNNING` 状态既表示"游戏进行中"又承担了"人物待机"的职责，导致代码可读性差，容易产生逻辑错误。

## 目标

彻底分离游戏生命周期状态和人物动作状态，使状态系统清晰明确。

## 状态设计说明

### 分离的状态定义

```javascript
// 游戏生命周期状态（控制能否操作、计时、显示）
GAME_STATUS = {
  READY: 'ready',           // 准备中，未开始
  RUNNING: 'running',       // 游戏进行中，计时中
  TRANSITIONING: 'transitioning', // 转场中
  FINISHED: 'finished'      // 已结束（死亡或胜利）
}

// 人物动作状态（控制动画表现）
PLAYER_ACTION = {
  IDLE: 'idle',             // 待机，可接受操作
  MOVING: 'moving',         // 地面移动中
  JUMPING: 'jumping'        // 跳跃中
}
```

### 职责分离

| 状态类型 | 字段 | 控制内容 |
|---------|------|---------|
| 游戏生命周期 | `game.gameStatus` | 能否操作、计时器、显示 TIME/BEST |
| 人物动作 | `player.action` | 动画表现、是否可接受新操作 |

## 修改的文件清单

1. **src/game/JumpGame.js** - 核心状态定义和逻辑修改
2. **src/main.js** - 使用新的状态系统
3. **src/render/GameRenderer.js** - 兼容 player.action

## 关键改动点

### 1. JumpGame.js

#### 新增状态常量导出
```javascript
export const GAME_STATUS = { ... }
export const PLAYER_ACTION = { ... }
// 兼容旧代码
export const STATUS = { ... }
```

#### 修改 player 结构
```javascript
this.player = {
  x: 0,
  y: 0,
  grid: 0,
  action: PLAYER_ACTION.IDLE,  // ← 替代 status
  isJump: false,
  direction: 0
}
```

#### 修改 execute() 方法
```javascript
execute(action) {
  // 检查游戏状态
  if (this.gameStatus !== GAME_STATUS.RUNNING) return null
  
  // 检查人物动作状态（防止连续操作）
  if (this.player.action !== PLAYER_ACTION.IDLE) return null
  
  // ... 执行逻辑 ...
  
  // 设置人物动作状态（不影响 gameStatus）
  this.player.action = isJump ? PLAYER_ACTION.JUMPING : PLAYER_ACTION.MOVING
}
```

#### 修改 notifyVisualComplete()
```javascript
notifyVisualComplete() {
  // 正常完成，人物回到待机状态
  if (this.player.action === PLAYER_ACTION.MOVING || 
      this.player.action === PLAYER_ACTION.JUMPING) {
    this.player.action = PLAYER_ACTION.IDLE
    // ...
  }
}
```

#### 修改 _checkResult()
```javascript
_checkResult(finalX) {
  if (this._isInPit(finalX)) {
    this.gameStatus = GAME_STATUS.FINISHED  // 游戏结束
    this.player.action = PLAYER_ACTION.IDLE
    // ...
  } else if (this.player.grid >= CONFIG.WORLD_LENGTH - 1) {
    this.gameStatus = GAME_STATUS.FINISHED  // 游戏结束
    this.player.action = PLAYER_ACTION.IDLE
    // ...
  }
}
```

### 2. main.js

#### 导入新的状态常量
```javascript
import { JumpGame, ACTION, CONFIG, GAME_STATUS, PLAYER_ACTION } from '@game/JumpGame.js'
```

#### 修改输入控制
```javascript
function handleKeyDown(e) {
  // 检查游戏状态
  if (game.gameStatus !== GAME_STATUS.RUNNING) return
  
  // 检查人物动作（防止连续操作）
  if (game.player.action !== PLAYER_ACTION.IDLE) return
  
  // ... 按键处理 ...
}
```

#### 修改显示逻辑
```javascript
const isRunning = game.gameStatus === GAME_STATUS.RUNNING
```

#### 修改 AI 决策逻辑
```javascript
const canDecide = game.gameStatus === GAME_STATUS.RUNNING && 
                  player.action === PLAYER_ACTION.IDLE
if (isAIMode && canDecide && !aiInterval) {
  makeAIDecision()
}
```

### 3. GameRenderer.js

将 `player.status` 检查改为 `player.action` 检查：
```javascript
// 旧代码
if (player.status === 'dead') { ... }

// 新代码  
if (player.action === 'dead') { ... }
```

## 状态流转图

```
游戏生命周期状态 (gameStatus)          人物动作状态 (player.action)
        
READY ──点击开始──► RUNNING ──execute──► ?
                                          │
                                          ▼
                              RUNNING ◄──完成── MOVING/JUMPING
                                          │
                    ◄──死亡/胜利──────────┘
                        
FINISHED ◄─────── 转场 ───────► TRANSITIONING
    │                              │
    └── 显示 BEST                  └── 显示 BEST
        
TRANSITIONING ◄──转场完成──► 调用 onTransitionEnd
                              │
                              └── startGame()
                                    │
                                    ▼
                              RUNNING + IDLE
                                    │
                                    └── 显示 TIME，可操作
```

## 验收标准检查结果

- [x] `GAME_STATUS` 和 `PLAYER_ACTION` 分离定义
- [x] `game.gameStatus` 控制游戏生命周期
- [x] `player.action` 控制人物动作和动画
- [x] 输入控制检查 `gameStatus === RUNNING` 和 `action === IDLE`
- [x] 动作执行期间 `gameStatus` 保持 `RUNNING` 不变
- [x] 动作完成后 `action` 回到 `IDLE`，可以执行下一个动作
- [x] 死亡/胜利后 `gameStatus = FINISHED`
- [x] 显示逻辑基于 `gameStatus`（RUNNING=TIME，其他=BEST）
- [x] 游戏功能完全正常（开始、操作、死亡、转场、重生）

## 向后兼容说明

`STATUS` 常量仍然导出以保持向后兼容：
```javascript
export const STATUS = {
  READY: GAME_STATUS.READY,
  RUNNING: GAME_STATUS.RUNNING,
  TRANSITIONING: GAME_STATUS.TRANSITIONING,
  IDLE: PLAYER_ACTION.IDLE,
  MOVING: PLAYER_ACTION.MOVING,
  DEAD: 'dead',
  WON: 'won'
}
```

如果其他文件仍使用 `STATUS` 导入，功能仍然正常，但建议逐步迁移到新的 `GAME_STATUS` 和 `PLAYER_ACTION`。

## 注意事项

1. **状态字段变更**：`player.status` 已改为 `player.action`，如需访问旧字段请更新代码
2. **gameStatus 位置**：游戏状态现在位于 `game.gameStatus` 而非 `game.player.status`
3. **getState() 返回**：现在返回的对象包含 `gameStatus` 字段
