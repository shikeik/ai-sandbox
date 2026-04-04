# WAAPI commitStyles 会污染内联样式

## 现象
用 Web Animations API (WAAPI) 控制元素动画，切换状态后新动画不生效，或元素样式异常。

## 根因
`animation.commitStyles()` 会将动画结束状态写入元素的 `style` 属性（内联样式）。后续新动画或 CSS 类切换可能被这些内联样式覆盖/干扰。

## 解决
**方案 A**：不用 `commitStyles()`，改用 `animation.fill = "none"` + 在 `onfinish` 里手动设置需要的 CSS 类。

**方案 B**：切换状态前显式清空内联样式：
```javascript
element.style.cssText = ""
```

**方案 C（最简）**：如果动画状态是离散的（奔跑/待机/跳跃），直接取消 `transition`，用 CSS 类硬切，彻底放弃 `commitStyles()`。
