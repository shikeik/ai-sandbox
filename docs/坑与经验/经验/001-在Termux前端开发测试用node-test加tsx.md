# 在 Termux 前端开发，测试用 `node:test` + `tsx`

## 场景
Android 手机 Termux 环境，项目放在 `/storage/emulated/0/`（外部存储），无法运行 Vitest/Jest 等依赖原生二进制的测试框架。

## 方案
Node.js 20+ 自带 `node:test`，配合全局安装的 `tsx` 可以直接跑 TypeScript 测试文件，无需任何原生二进制。

## 安装
```bash
npm install -g tsx
```

## package.json 脚本
```json
{
  "scripts": {
    "test": "tsx --test 'src/**/*.test.ts'"
  }
}
```

## 测试文件示例
```typescript
import { describe, it } from "node:test"
import { strict as assert } from "node:assert"

describe("示例", () => {
  it("1+1=2", () => {
    assert.strictEqual(1 + 1, 2)
  })
})
```

## 优势
- 零原生二进制依赖
- 断言 API 与 Vitest/Jest 非常接近（`assert.ok`、`assert.strictEqual`）
- 支持 `describe` / `it` / `beforeEach` / `afterEach`
- 对数值型算法测试完全够用
