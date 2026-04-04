# AI 交接文档：测试框架迁移与 init 中文化

> 编写时间：2026-04-04（迭代中）
> 当前分支：`main`
> 文档形式：**阶段式记录**（边对话边总结，随时可追加）

---

## 阶段记录

### 阶段 1：/init 提示词中文化

**触发原因**：用户发现 `/init` 指令发给子 Agent 的提示词是纯英文的，每次生成 `AGENTS.md` 时子 Agent 收到的任务描述也是英文，不方便。

**做了什么**：
- 备份：`/data/data/com.termux/files/usr/lib/python3.13/site-packages/kimi_cli/prompts/init.md.bak`
- 修改：将 `init.md` 全文翻译为中文
- 核心改动：任务要求、AGENTS.md 撰写规范、推荐章节等全部中文化

**当前状态**：✅ 已完成。以后用户在此环境中执行 `/init` 时，子 Agent 会收到中文提示词。

---

### 阶段 2：测试框架迁移启动

**触发原因**：项目原本使用自定义轻量测试套件（`src/terrain-lab/__tests__/test-utils.ts` 手写的 `describe`/`it`/`assert`），用户希望改用标准测试框架，方便维护。

**做了什么**：
- 评估了 **Vitest**（与 Vite 同生态，最理想）
- 删除了旧的 `src/terrain-lab/__tests__/` 目录
- 新建 3 个 Vitest 格式测试文件：
  - `src/terrain-lab/convergence.test.ts`
  - `src/terrain-lab/clip.test.ts`
  - `src/terrain-lab/filtered-supervised.test.ts`
- 更新了 `AGENTS.md` 中的测试策略说明

**遇到的阻碍**：Vitest 在原项目目录（`/storage/emulated/0/...`）下启动失败，报 `Could not resolve vite.config.js` / `EACCES` / `dlopen failed`。

**当前状态**：⏳ 卡壳中。需要排查环境权限问题。

---

### 阶段 3：Android 外部存储权限大坑

**排查过程**：
1. 怀疑是 `/storage/emulated/0/`（Android 外部共享存储）的权限问题
2. 尝试全局安装 vitest（装在 `~` 目录），vitest 本体能启动
3. 但 vitest 加载 `vite.config.js` 时内部要调用 **esbuild** 子进程，而 esbuild 的二进制文件位于项目本地的 `node_modules/@esbuild/...` 下
4. 外部存储的 FUSE 文件系统强制 `noexec`，`chmod +x` 不生效，esbuild 子进程无法 spawn
5. 作为对照实验：把项目复制到 `~/ai-sandbox-test`，重新 `npm install` 后再跑 vitest，成功通过所有测试

**核心结论**：
> **所有依赖原生二进制可执行文件的 npm 包（esbuild、rollup、某些原生 `.node` 模块），在 `/storage/emulated/0/` 下的项目里都无法运行。** 这不是 vitest 的特例，而是 Android 外部存储的内核限制。

**当前状态**：✅ 原因已定位。Vitest 方案在原项目位置不可行。

---

### 阶段 4：改用 Node 内置测试器

**决策**：放弃 Vitest，改用 **Node.js 20+ 官方内置的 `node:test`** + **全局 tsx** 来转译 TypeScript。

**做了什么**：
- 全局安装 `tsx`：`npm install -g tsx`
- 将 3 个 `.test.ts` 文件从 `vitest` 语法改为 `node:test` + `node:assert` 语法
- `package.json` 增加脚本：
  ```json
  "test": "tsx --test 'src/**/*.test.ts'"
  ```
- 删除了为 vitest 尝试创建的各种配置文件（`vitest.config.ts` / `vitest.config.mjs` 等）

**验证结果**：
```
▶ 权重裁剪影响测试
  ✔ 无裁剪 / 裁剪±10 / 裁剪±5 / 裁剪±2 / 裁剪±1
▶ 收敛性测试
  ✔ 监督学习应收敛到 70% 以上准确率
  ✔ 无监督学习应收敛到较高合法率
▶ 过滤式监督学习
  ✔ 应达到较高合法率

ℹ tests 8 / suites 3 / pass 8 / fail 0
```

**当前状态**：✅ 全部通过。`npm test` 在原项目位置可稳定运行。

---

## 当前整体状态

| 事项 | 状态 |
|---|---|
| `/init` 中文提示词 | ✅ 完成 |
| 旧自定义测试清理 | ✅ 完成 |
| 测试代码迁移到标准框架 | ✅ 完成（`node:test` + `tsx`） |
| `npm test` 可运行 | ✅ 完成 |
| Vitest 方案 | ❌ 放弃（环境限制） |
| 坑总结更新 | ⏳ 待用户决定是否追加到 `docs/教程/坑总结.md` |

---

## 关键文件变更

| 文件 | 说明 |
|---|---|
| `src/terrain-lab/convergence.test.ts` | 新增：监督/无监督收敛测试（`node:test` 格式） |
| `src/terrain-lab/clip.test.ts` | 新增：权重裁剪影响测试（`node:test` 格式） |
| `src/terrain-lab/filtered-supervised.test.ts` | 新增：过滤式监督学习测试（`node:test` 格式） |
| `src/terrain-lab/__tests__/` | ❌ 删除：旧自定义测试套件 |
| `package.json` | 新增 `"test": "tsx --test 'src/**/*.test.ts'"` |
| `AGENTS.md` | 更新测试策略章节 |

---

## 给下一个 AI 的建议

1. **不要再尝试在原项目位置引入 Vitest/Jest/Playwright 等依赖原生二进制的测试框架**，100% 会卡在 esbuild/rollup 的 `EACCES`
2. 如果必须跑 vitest，只能把项目复制到 `~/` 下重新 `npm install` 再跑
3. `node:test` 对数值型算法测试完全够用，断言用 `node:assert` 的 `ok`/`strictEqual`/`deepStrictEqual` 即可
4. 全局 `tsx` 已安装，可以直接用 `tsx --test xxx.test.ts` 跑单个测试文件
5. 修改测试时如果动了 `package.json` 的 `test` 脚本，注意单引号在部分 shell 里可能需要改成双引号

---

*（本文档为阶段式记录，后续如有相关迭代可直接追加"阶段 5、阶段 6..."）*
