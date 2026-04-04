# HTML5 原生 API 命名冲突

## 现象
给一个按钮绑定 `onclick="checkValidity()"`，点击后没有任何反应，也不报错。

## 根因
`checkValidity()` 是 `HTMLButtonElement` 和 `HTMLFormElement` 的原生方法。当函数名与原生方法重名时，HTML 内联事件处理器会优先调用原生方法，而不是你定义的 JS 函数。

## 解决
**避免使用以下常见词作为全局函数名**：
- `checkValidity()`
- `submit()`
- `reset()`
- `focus()`
- `blur()`
- `click()`

改为更具业务语义的命名，如 `validateTerrain()`、`handleFormSubmit()`。
