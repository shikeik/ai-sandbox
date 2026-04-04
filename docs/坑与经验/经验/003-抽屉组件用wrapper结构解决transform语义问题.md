# 抽屉组件用 wrapper 结构解决 transform 语义问题

## 场景
实现侧滑抽屉（Drawer），需要 `translateX(100%)` 完全隐藏在屏幕外。

## 问题
如果直接给抽屉本身加 `right: 10px` 边距，`translateX(100%)` 会基于自身宽度翻译，但 `right: 10px` 不属于自身尺寸，导致抽屉无法完全隐藏，会露出一条边。

## 方案：wrapper 结构
```html
<div class="drawer-wrapper" style="position:fixed; right:10px; top:0;">
  <div class="drawer" style="transform: translateX(100%);">
    <!-- 内容 -->
  </div>
</div>
```

**外层负责定位**（`right: 10px`）
**内层负责 transform**（`translateX(100%)` = 自身宽度）

这样抽屉能完全隐藏，拉出时也不会受边距影响。
