# Edge 浏览器强制保留刘海安全区域

## 现象
Android Edge 横屏时，即使设置了：
```html
<meta name="viewport" content="viewport-fit=cover">
```
刘海/挖孔区域仍然显示黑边，无法真正铺满。

## 根因
Edge 浏览器强制保留安全区域，Web 端无法突破。原生 App 可以用 `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES`，但 WebView/浏览器不会给网页这个权限。

## 解决
已尝试多种 CSS 方案（`contain`、`calc(100vw - env(...))`）均无法完全消除。

**结论**：接受黑边存在，或在检测到 Edge 时提示用户换用 Chrome/Samsung Internet。

## 检测
```javascript
const isEdge = /Edg/.test(navigator.userAgent)
```
