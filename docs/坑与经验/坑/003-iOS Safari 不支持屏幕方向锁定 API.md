# iOS Safari 不支持屏幕方向锁定 API

## 现象
```javascript
screen.orientation.lock("landscape-primary")
```
在 iOS Safari 上直接报错或静默失败。

## 根因
Apple 系统限制，Web 端无法锁定屏幕方向。这是 iOS 本身的行为，不是代码 bug。

## 解决
**无法彻底解决**。可选的降级策略：
1. 检测浏览器，显示提示："请使用 Chrome / 添加到主屏幕"
2. 用 CSS `rotate(-90deg)` 做视觉抵消（需要配合触摸坐标转换）
3. 接受无法锁定的事实，在竖屏时显示"建议横屏"提示层

## 检测代码
```javascript
const supportsOrientationLock = !!screen.orientation?.lock
if (!supportsOrientationLock) {
    // 显示降级提示
}
```
