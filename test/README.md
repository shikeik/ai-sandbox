# 测试目录说明

> 本目录存放各类测试文件，按用途分为三个子目录。

---

## 目录结构

```
test/
├── README.md           # 本文件
├── unit/               # 单元测试（快速）
├── slow/               # 慢速测试（需要时间的单元测试）
└── ts/                 # 手动运行的 TypeScript 调试脚本
```

---

## 1. unit/ - 单元测试

**用途**：运行速度快的单元测试，验证核心逻辑正确性。

**命名规范**：`*.test.ts`

**运行方式**：
```bash
npm test              # 运行所有单元测试
npm test -- <name>    # 运行匹配的测试
```

**示例**：
- `test/unit/map-generator.test.ts` - 地图生成器测试

---

## 2. slow/ - 慢速测试

**用途**：需要较长时间的单元测试，如训练收敛性测试、性能测试等。

**命名规范**：`*.test.ts`

**运行方式**：
```bash
npm run test:slow     # 只运行慢速测试
npm run test:all      # 运行所有测试（unit + slow）
```

**示例**：
- `test/slow/terrain-lab/convergence.test.ts` - 收敛性测试
- `test/slow/terrain-lab/clip.test.ts` - 权重裁剪测试

---

## 3. ts/ - 手动调试脚本

**用途**：非自动运行的 TypeScript 脚本，用于手动验证、调试想法、探索性测试。

**命名规范**：`*.ts`（**不要用 .test.ts 后缀**）

**运行方式**：
```bash
# 直接运行指定脚本
npx tsx test/ts/causal-ai/debug.ts
npx tsx test/ts/terrain-lab/debug-generate.ts
```

**特点**：
- 不参与自动化测试流程
- 通常包含 `console.log` 输出
- 用于开发阶段的问题排查

**示例**：
- `test/ts/causal-ai/debug.ts` - 因果链 AI 功能验证
- `test/ts/terrain-lab/debug-generate.ts` - 地形生成调试

---

## 命名规范总结

| 目录 | 文件后缀 | 用途 |
|------|----------|------|
| `test/unit/` | `.test.ts` | 自动化单元测试（快） |
| `test/slow/` | `.test.ts` | 自动化单元测试（慢） |
| `test/ts/` | `.ts` | 手动调试脚本 |

---

## 添加新测试的流程

1. **确定测试类型**：
   - 快速验证核心逻辑 → `test/unit/`
   - 长时间运行/收敛性 → `test/slow/`
   - 手动调试/探索 → `test/ts/`

2. **按模块划分子目录**：
   ```
   test/unit/my-feature/my-test.test.ts
   test/ts/my-feature/debug.ts
   ```

3. **运行验证**：
   ```bash
   # 单元测试
   npm test
   
   # 慢速测试
   npm run test:slow
   
   # 手动脚本
   npx tsx test/ts/my-feature/debug.ts
   ```
