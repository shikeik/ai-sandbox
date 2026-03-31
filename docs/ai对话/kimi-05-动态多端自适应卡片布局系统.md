**交接文档：AI Sandbox 布局重构项目**

---

## 1. 项目目标

**核心需求**：为 AI 神经网络训练沙盘重构布局系统，实现"虚拟手机"架构，统一处理三种场景：
- **手机竖屏**：正常竖屏全屏
- **手机横屏**：强制横屏 + CSS旋转-90°抵消，保持竖屏视觉
- **PC桌面**：手机壳模拟或特殊布局

**设计原则**：
- 业务代码（游戏/神经网络）永远面对固定 9:16 竖屏比例（后来改为动态铺满）
- 布局引擎负责将物理屏幕适配到虚拟手机
- 触摸坐标自动转换，业务层无感知

---

## 2. 已完成工作

### 2.1 原项目分析
- 读取了 `ProjectCode.txt`（97KB，3951行，17个文件）
- 识别出核心模块：`JumpGame.js`（游戏逻辑）、`NeuralNetwork.js`（神经网络）、`GameRenderer.js`（渲染）
- 原项目使用 1080×1920 固定虚拟分辨率，在移动端缩放显得很小

### 2.2 布局实验室（layout-lab.html）
创建了完整的重构版本，包含：
- **组件化架构**：`EventBus`（事件总线）、`LayoutService`（布局计算）、`Drawer`（抽屉）、`VirtualPhone`（虚拟手机）
- **坐标转换系统**：`toVirtualCoordinates()` 方法处理旋转后的触摸映射
- **全屏管理**：`FullscreenService` 封装跨浏览器 API
- **方向锁定**：`OrientationService` 支持 `portrait-primary` 和 `landscape-primary`

### 2.3 关键实现
- **动态铺满算法**：取屏幕短边作为虚拟手机宽度，按比例 9:16 计算高度，scale=1.0 无缩放
- **抽屉组件**：带把手拉出/收起，使用 wrapper 结构解决 transform 语义问题
- **强制横屏方案**：先 `lock('landscape-primary')` 再进全屏，然后 CSS `rotate(-90deg)` 抵消

---

## 3. 遇到的坑（重要！）

### 坑 1：iOS Safari 不支持方向锁定 API
- **现象**：`screen.orientation.lock()` 调用失败
- **原因**：iOS 系统限制，Web 端无法锁定方向 
- **解决**：提示用户使用"添加到主屏幕"，或接受无法锁定的事实

### 坑 2：Via/夸克等国产浏览器不支持 API
- **现象**：方向锁定无效，重力翻转依旧
- **原因**：这些浏览器未实现 Screen Orientation API
- **解决**：需检测浏览器，不支持时提示换用 Chrome/Edge/Samsung Internet 

### 坑 3：Edge 浏览器强制保留安全区域（刘海黑边）
- **现象**：即使 `viewport-fit=cover` + 全屏，横屏时刘海区域仍有黑边
- **原因**：Edge 强制保留安全区域，Web 端无法突破（原生 App 可以用 `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES`）
- **尝试**：`viewport-fit=contain`、`calc(100vw - env(safe-area-inset-*))` 均无法完全消除
- **当前状态**：用户已撤销，回到"铺满"方案，接受刘海黑边存在

### 坑 4：抽屉组件 transform 语义问题
- **现象**：`translateX(100%)` 无法完全隐藏，因为 `right: 10px` 边距不属于自身尺寸
- **解决**：引入 wrapper 结构，外层负责定位（right:10px），内层负责 transform（100% = 自身宽度）

### 坑 5：CSS 旋转后触摸坐标错乱
- **现象**：横屏旋转后，手指向上滑，狐狸往左走
- **原因**：CSS `rotate(-90deg)` 后，视觉坐标系和逻辑坐标系不一致
- **解决**：`toVirtualCoordinates()` 方法中加入逆旋转矩阵计算（rotation 从 90 改为 -90，逆变换对应调整）

### 坑 6：全屏和方向锁定顺序
- **现象**：先锁定方向再进全屏，有时 API 报错
- **解决**：必须先调用 `requestFullscreen()`，在 fullscreenchange 回调里再 `lock()`，或反过来（不同浏览器要求不同，当前代码是先 lock 再 fullscreen）

### 坑 7：虚拟手机分辨率选择困境
- **选项 A**：固定 1080×1920 → 在手机上 CSS 像素只有 384px 宽，显得极小（scale 0.36）
- **选项 B**：动态取短边 → 铺满但内部元素（按钮、文字）可能显得大或小，需要精细调整
- **当前**：采用选项 B，取 `Math.min(physWidth, physHeight)` 作为虚拟宽度

---

## 4. 当前进度（截至 2026-03-31 16:11）

### 文件状态
- `layout-lab.html`：已完成，可运行，包含所有重构代码
- `orientation-test.html`：测试页面，用于验证浏览器 API 支持
- 原项目 `ai-sandbox`：未修改，重构代码尚未迁移回主项目

### 已验证功能
- [x] 抽屉展开/收起（带把手）
- [x] 全屏进入/退出
- [x] 方向锁定（在支持的浏览器如 Chrome/Edge/Samsung）
- [x] 动态铺满（取短边做宽）
- [x] 横屏旋转-90°抵消
- [x] 触摸坐标转换（旋转后正确映射）
- [ ] 刘海屏统一适配（已尝试但撤销，回到铺满方案）

### 已知问题
- Edge 浏览器横屏仍有刘海黑边（无法解决，Web 限制）
- 控制按钮在小屏幕上可能显得小（需要调整卡片高度比例或按钮尺寸）

---

## 5. 下一步建议

### 优先级 1：浏览器检测与降级策略
```javascript
// 需要添加的检测逻辑
const isEdge = /Edg/.test(navigator.userAgent);
const supportsOrientationLock = !!screen.orientation?.lock;

if (isEdge || !supportsOrientationLock) {
    // 显示提示：建议使用 Chrome 或 Samsung Internet 浏览器
    // 或接受黑边存在，统一使用保守布局
}
```

### 优先级 2：迁移到主项目
1. 将 `layout-lab.html` 中的 `LayoutService`, `EventBus`, `Drawer`, `VirtualPhone` 类迁移到 `src/core/`
2. 修改 `index.html` 引入新布局系统
3. 确保 `JumpGame.js` 和 `GameRenderer.js` 通过事件总线与布局系统通信

### 优先级 3：移动端体验优化
- 调整 `.c-card--debug/game/control` 的高度比例（当前 100%/60%/30%，可能需要更均衡）
- 控制按钮在小屏幕上放大（`c-control-btn` 的 width/height 从 100px 改为 `min(100px, 20vw)`）
- 文字大小使用 `clamp()` 响应式缩放

### 优先级 4：测试矩阵
- 测试设备：Android Chrome（应该完美）、Android Edge（有黑边）、iOS Safari（无方向锁定）、PC Chrome（手机壳模式）
- 测试场景：竖屏全屏、横屏全屏（旋转）、退出全屏恢复、抽屉操作、游戏触摸

---

## 6. 关键代码位置参考

**layout-lab.html 结构：**
- 第 1-600 行：CSS（变量、布局、组件样式）
- 第 600-700 行：EventBus 类
- 第 700-900 行：LayoutService（第 700 行附近 calculate 方法需关注）
- 第 900-1100 行：组件类（Drawer 在第 950 行左右，VirtualPhone 在第 1050 行左右）
- 第 1100-1200 行：App 主控制器（全屏逻辑在第 1140 行左右）

**重要常量：**
- 虚拟手机比例：`ASPECT_RATIO = 1080/1920 = 0.5625`（9:16）
- 旋转角度：横屏时 `rotation: -90`
- 安全区域：`env(safe-area-inset-*)`

---

**备注**：用户刚才（16:11）尝试将虚拟手机改为 `calc(100vw - env(...))` 动态计算，但觉得"太乱"已撤销，回到之前的铺满方案（取短边做宽）。当前代码状态是**可用但 Edge 有黑边**，用户接受此现状或准备换浏览器测试。

**建议下一个 AI**：先确认用户当前代码状态（是否已应用动态铺满），再决定是继续优化刘海适配，还是迁移到主项目。