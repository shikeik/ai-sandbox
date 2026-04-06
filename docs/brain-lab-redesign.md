# Brain Lab 重设计文档

## 一、地图设计重构

### 1.1 机关机制重新设计

**原设计问题**：
- 尖刺在按钮上方，看起来是悬停而不是坠落
- 没有垂直落差，机关效果不明显

**新设计**：

```
y=4 (天空层):  🔺        ← 尖刺悬挂在空中（离地3格）
y=3:           空空空空
y=2 (中层):    空空台钮台  ← 按钮平台
y=1:           空👿空空空  ← 敌人（在按钮正下方2格）
y=0 (地面):    台台台台台台
```

**机关触发流程**：
1. 狐狸跳上中层平台(y=2, x=4)踩按钮
2. 尖刺(y=4, x=4)失去支撑，开始坠落动画
3. 尖刺下落到y=1，击杀敌人
4. 尖刺继续下落到地面或消失

### 1.2 平台视觉改进

**原问题**：绿色方块像填充

**新设计**：
- 平台用"边缘高亮"样式，看起来像可以站上去的台面
- 格子之间有间隙，不是紧密相连
- 使用emoji+CSS边框，营造立体感

```css
.cell-platform {
    background: #2ecc71;
    border-top: 3px solid #4ade80;    /* 顶部高光 */
    border-bottom: 3px solid #166534; /* 底部阴影 */
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
```

## 二、动画系统重构

### 2.1 核心需求

虽然是离散格子世界，但移动过程需要补间动画：
- 狐狸从A格到B格，不是闪现，而是平滑移动
- 跳跃要有抛物线轨迹
- 下落要有重力加速感
- 机关触发要有延迟和动画

### 2.2 动画状态机

```typescript
interface AnimationState {
    isPlaying: boolean
    type: 'MOVE' | 'JUMP' | 'FALL' | 'SPIKE_FALL'
    startPos: {x, y}      // 起点（格子坐标）
    endPos: {x, y}        // 终点（格子坐标）
    startTime: number     // 开始时间戳
    duration: number      // 总时长(ms)
    
    // 插值函数
    easing: (t: number) => number
}
```

### 2.3 渲染分离

**逻辑层**：格子坐标（离散）
**渲染层**：像素坐标（连续）

```typescript
// 逻辑位置 → 渲染位置
function getRenderPos(logicX: number, logicY: number, animOffset?: Offset): PixelPos {
    const baseX = logicX * CELL_SIZE
    const baseY = (MAX_Y - logicY) * CELL_SIZE  // 翻转Y轴
    
    if (animOffset) {
        return {
            x: baseX + animOffset.x,
            y: baseY + animOffset.y
        }
    }
    return {x: baseX, y: baseY}
}
```

### 2.4 动画类型

#### 1. 普通移动 (MOVE)
- 时长: 300ms
- 缓动: ease-out
- 轨迹: 直线水平移动

#### 2. 跳跃 (JUMP)
- 时长: 500ms
- 轨迹: 抛物线
- 水平移动 + 垂直上升再下降

```typescript
function jumpOffset(progress: number): {x, y} {
    // progress: 0 → 1
    const x = progress * JUMP_DISTANCE * CELL_SIZE
    const jumpHeight = Math.sin(progress * Math.PI) * MAX_JUMP_HEIGHT
    const y = -jumpHeight  // 向上为负
    return {x, y}
}
```
#### 3. 坠落 (FALL)
- 时长: 根据距离计算（重力加速）
- 缓动: ease-in（越来越快）

#### 4. 尖刺坠落 (SPIKE_FALL)
- 触发后延迟: 200ms
- 坠落时长: 600ms
- 撞击效果: 屏幕震动或粒子

## 三、视觉层次改进

### 3.1 深度感

```
z-index 层级:
- 背景格子: z=0
- 平台: z=10
- 敌人: z=20
- 狐狸: z=30
- 尖刺: z=40 (坠落时)
- 特效粒子: z=50
```

### 3.2 颜色系统

| 元素 | 主色 | 高光 | 阴影 |
|------|------|------|------|
| 平台 | #2ecc71 | #4ade80 | #166534 |
| 按钮 | #9b59b6 | #b779d6 | #6b2c91 |
| 尖刺 | #e74c3c | #ff6b6b | #922b21 |
| 敌人 | #e74c3c | - | - |
| 狐狸 | #3498db | - | - |

### 3.3 特效

- **踩踏按钮**: 按钮下沉动画 + 波纹扩散
- **尖刺坠落**: 轨迹线 + 撞击粒子
- **敌人死亡**: 闪烁消失 + 烟雾效果
- **狐狸移动**: 轻微弹跳（走路）/ 弧线（跳跃）

## 四、API 调整

动画系统需要前端控制，API 返回动画指令：

```typescript
interface StepResult {
    type: 'AI_STEP'
    step: number
    decision: {...}
    animations: Animation[]  // 新增：动画指令列表
    result: {...}
}

interface Animation {
    type: 'HERO_MOVE' | 'HERO_JUMP' | 'HERO_FALL' | 'SPIKE_FALL' | 'ENEMY_DIE'
    target: string          // 作用对象
    from: {x, y}            // 起点（格子坐标）
    to: {x, y}              // 终点（格子坐标）
    duration: number        // 时长
    delay?: number          // 延迟
}
```

## 五、实现计划

### 阶段1: 视觉重设计 (1-2小时)
- [ ] 重写地图生成，拉开尖刺与敌人距离
- [ ] 改进CSS，添加立体感和层次
- [ ] 调整颜色系统

### 阶段2: 动画系统 (3-4小时)
- [ ] 分离逻辑坐标与渲染坐标
- [ ] 实现动画状态机
- [ ] 添加移动/跳跃/坠落动画

### 阶段3: 机关动画 (2小时)
- [ ] 尖刺坠落动画
- [ ] 按钮触发效果
- [ ] 敌人死亡动画

### 阶段4: 整合测试 (1小时)
- [ ] API返回动画指令
- [ ] 前端按顺序执行动画
- [ ] 测试整体流程
