# Kimi API Bridge

通过 HTTP API 与浏览器中的 Kimi 挑战页面交互。

## 架构

```
curl/CLI → HTTP POST → Vite Dev Server → WebSocket → Browser → GridWorld
                                                      ↓
                           curl/CLI ← JSON Response ←─┘
```

## 使用

### 1. 启动开发服务器
```bash
npm run dev
```

### 2. 打开测试页面
浏览器访问: `http://localhost:4000/pages/api-bridge.html`

### 3. 发送命令
```bash
# 使用 curl
curl -X POST http://localhost:4000/api/kimi \
  -H "Content-Type: application/json" \
  -d '{"action":"走"}'

# 或使用 CLI 工具（美观输出）
node scripts/api-bridge/kimi-cli.mjs 走
```

## API

### POST /api/kimi

**请求体:**
```json
{
  "action": "走" | "跳" | "远跳" | "走A" | "reset" | "viewport"
}
```

**响应:**
```json
{
  "success": true,
  "viewport": {
    "grid": [["⬛","⬛",...], ...],
    "heroPos": {"col": 0, "row": 1}
  },
  "timestamp": 1234567890
}
```
