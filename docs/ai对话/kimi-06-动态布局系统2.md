# 交接文档：AI Sandbox 布局系统重构

**交接时间**: 2026-03-31 18:06  
**当前文件**: `layout-lab-final.html` (47,279 bytes)  
**状态**: 核心功能完成，待最终验收

---

## 1. 项目目标

重构 AI 神经网络训练沙盘的布局系统，实现"虚拟手机"架构：
- **统一竖屏逻辑**: 业务代码始终面对 9:16 竖屏比例
- **物理屏幕适配**: 布局引擎自动处理手机竖屏/横屏/PC桌面
- **坐标自动转换**: 触摸/鼠标坐标自动映射到虚拟手机逻辑坐标
- **强制横屏方案**: 横屏时 CSS rotate(-90°) 抵消，保持视觉竖屏

---

## 2. 已完成工作

### 2.1 核心架构实现
| 组件 | 状态 | 说明 |
|------|------|------|
| `CONFIG` 全局配置 | ✓ | `initialMargin` 统一控制初始边距 |
| `EventBus` 事件总线 | ✓ | 跨组件通信机制 |
| `LayoutService` | ✓ | 布局计算、坐标转换、模式切换 |
| `FullscreenService` | ✓ | 跨浏览器全屏 API 封装 |
| `OrientationService` | ✓ | 屏幕方向锁定/解锁 |
| `Drawer` 抽屉组件 | ✓ | 可滚动布局实验室面板 |
| `VirtualPhone` | ✓ | 虚拟手机容器、动态尺寸 |
| `GameController` | ✓ | 狐狸移动逻辑（修复坐标统一） |

### 2.2 关键功能修复

**✓ 精致化优化**
- 卡片字体: 24px → 14px
- 卡片内边距: 20px → 8px
- 按钮尺寸: 固定 100px → 响应式 `min(44px, 12vw)`
- 狐狸尺寸: 80px → 28px
- 卡片高度: 百分比溢出 → flex 权重 (4:4:2)

**✓ 抽屉滚动**
- `max-height: 80vh` + `overflow-y: auto`
- 自定义细滚动条 (4px)

**✓ 安全边距滑条**
- 范围: 0-20%
- 实现: 通过 `scale = 1.0 - margin*2` 等比例缩放
- 配置: 单一 `CONFIG.initialMargin` 变量控制

**✓ 模式切换**
- `auto`: 自动检测方向
- `portrait`: 强制竖屏 (rotation: 0)
- `landscape`: 强制横屏 (rotation: -90°)
- `desktop`: PC 模式 (固定比例居中)

**✓ 坐标转换修复**
- 横屏 rotate(-90°) 后触摸坐标映射:
  ```javascript
  logicX = virtualWidth - (vy / scale)
  logicY = vx / scale
  ```

**✓ 返回键退出全屏**
- 退出全屏时:
  1. 解锁方向 (`orientationService.unlock()`)
  2. 重置模式为 `'auto'`
  3. 延迟 100ms 强制更新布局

**✓ 手柄颜色修复**
- 默认: `var(--color-surface)` (黑色)
- Hover: `#1a1a2e` (深黑)

**✓ 狐狸坐标统一**
- `moveTo()` 使用动态 `virtualWidth/Height` (非硬编码 384x853)

---

## 3. 遇到的坑（重要！）

### 坑 1: iOS Safari 不支持方向锁定
- **现象**: `screen.orientation.lock()` 调用失败
- **解决**: 无法解决，提示用户"添加到主屏幕"或使用 Chrome

### 坑 2: Via/夸克浏览器不支持 API
- **现象**: 方向锁定无效
- **解决**: 检测浏览器，不支持时提示换用 Chrome/Edge/Samsung

### 坑 3: Edge 浏览器强制保留安全区域
- **现象**: 横屏时刘海区域有黑边（Web 限制）
- **状态**: 已放弃完美适配，使用"铺满"方案

### 坑 4: 抽屉 transform 语义问题
- **现象**: `translateX(100%)` 无法完全隐藏
- **解决**: 引入 wrapper 结构，外层定位，内层 transform

### 坑 5: CSS 旋转后触摸坐标错乱
- **现象**: 手指向上滑，狐狸往左走
- **解决**: 坐标转换加入逆旋转矩阵（已修复）

### 坑 6: 全屏和方向锁定顺序
- **现象**: 顺序错误导致 API 报错
- **解决**: 先 `lock()` 再 `fullscreen`，或反过来（不同浏览器）

### 坑 7: JS 括号不匹配导致黑屏
- **现象**: 文件多了1个 `}`，页面全黑
- **解决**: 修复返回键退出全屏时的括号错误

### 坑 8: 硬编码尺寸 vs 动态尺寸
- **现象**: 狐狸坐标与点击位置偏移
- **解决**: 统一使用 `window.__APP_STATE__.layout.virtualWidth/Height`

---

## 4. 当前进度

### 文件状态
- `layout-lab-final.html`: 最终实验室版本 ✓
- `layout-lab-base.html`: 原始备份

### 已验证功能
- [x] 动态铺满（取短边做宽）
- [x] 横屏旋转-90°抵消
- [x] 触摸坐标转换（旋转后正确映射）
- [x] 抽屉展开/收起（带把手，黑色）
- [x] 全屏进入/退出（按钮+返回键）
- [x] 方向锁定/解锁
- [x] 模式切换（auto/portrait/landscape/desktop）
- [x] 边距滑条（0-20%，实时缩放）
- [x] 抽屉滚动
- [x] 狐狸移动（按钮+点击）
- [ ] 刘海屏统一适配（已放弃）

### 已知问题
- Edge 浏览器横屏仍有刘海黑边（Web 限制，无法解决）
- iOS 无法锁定方向（系统限制）

---

## 5. 下一步建议

### 优先级 1: 迁移到主项目
将 `layout-lab-final.html` 中的核心类迁移到原项目 `ai-sandbox`:

```
src/
  core/
    EventBus.js
    LayoutService.js
    FullscreenService.js
    OrientationService.js
    Drawer.js
    VirtualPhone.js
  components/
    ...
```

**迁移步骤**:
1. 提取 `CONFIG` 对象到配置文件
2. 提取各 Service/Component 类到独立文件
3. 修改主项目的 `index.html` 引入新布局系统
4. 确保 `JumpGame.js` 和 `GameRenderer.js` 通过事件总线通信

### 优先级 2: 真机测试矩阵
- **Android Chrome**: 应该完美（测试重点）
- **Android Edge**: 有黑边（可接受）
- **iOS Safari**: 无方向锁定（提示用户）
- **PC Chrome**: 手机壳模式（测试窗口缩放）

### 优先级 3: 优化细节
- 控制按钮点击反馈（视觉/声音）
- 狐狸移动边界限制（当前可能移出卡片）
- 神经元可视化数据绑定（当前是静态 N1/N2/N3）
- 卡片内容区域滚动（如果内容超出）

### 优先级 4: 浏览器检测与降级
添加浏览器检测逻辑，对不支持的浏览器显示提示：
```javascript
const isEdge = /Edg/.test(navigator.userAgent);
const supportsOrientationLock = !!screen.orientation?.lock;

if (isEdge || !supportsOrientationLock) {
    // 显示提示条：建议使用 Chrome
}
```

---

## 6. 关键代码位置

**`layout-lab-final.html` 结构**:
- CSS 变量: 第 1-100 行
- `CONFIG`: 约第 630 行
- `EventBus`: 约第 640 行
- `LayoutService`: 约第 680 行（calculate、坐标转换）
- `FullscreenService`: 约第 800 行
- `OrientationService`: 约第 850 行
- `Drawer`: 约第 900 行
- `VirtualPhone`: 约第 1050 行
- `GameController`: 约第 1150 行
- `App`: 约第 1200 行

**重要常量**:
- 虚拟比例: `ASPECT_RATIO = 1080/1920 = 0.5625`
- 初始边距: `CONFIG.initialMargin = 0.00`
- 旋转角度: `rotation: -90` (横屏)

---

## 7. 快速验证清单

打开 `layout-lab-final.html`，检查：
1. 页面正常显示（非黑屏）
2. 点击"进入全屏" → 画面旋转/铺满
3. 点击"退出全屏" → 恢复正常
4. 按手机返回键退出全屏 → 画面恢复正常
5. 拖动"安全边距"滑条 → 手机壳等比例缩放
6. 点击"强制横屏(旋转)" → 画面强制旋转
7. 点击游戏区域移动狐狸 → 位置正确

---

**备注**: 当前版本经过多轮修复，括号平衡，功能完整。建议下一个 Kimi 先完整测试所有功能后再进行迁移工作。

**文件下载**: [layout-lab-final.html](sandbox:///mnt/kimi/output/layout-lab-final.html)
