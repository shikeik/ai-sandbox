# Android 外部存储无法执行原生二进制

## 现象
在 `/storage/emulated/0/`（手机存储/Sdcard）下的前端项目里：
- `npm install -D vitest` 失败，或安装后 `vitest run` 报 `EACCES` / `dlopen failed` / `spawnSync ... EACCES`
- `esbuild`、`rollup`、`@swc/core` 等带原生 `.node` 模块或独立二进制文件的包无法运行
- 即使 `chmod +x` 也不生效

## 根因
Android 外部存储挂载的是 **FUSE 文件系统**，内核强制 `noexec`：
- 不能创建软链接
- 不能执行任何二进制文件（包括 `.node` 动态库和独立二进制）

## 影响范围
所有依赖以下原生二进制的工具链：
- Vitest、Jest、Playwright
- esbuild、rollup（原生 binding 版）、swc
- 任何带 `postinstall` 脚本且要执行二进制的 npm 包

## 解决
**方案 A（推荐）**：改用纯 Node.js 方案
- 测试用 `node --test` + 全局 `tsx`
- 构建直接用全局 `vite`（全局 vite 装在 `~` 目录，自身 esbuild 可执行）

**方案 B**：把项目复制到 Termux home 目录（`/data/data/...`）再跑
```bash
cp -r /storage/emulated/0/Projects/my-app ~/my-app
cd ~/my-app
npm install -D vitest
npx vitest run
```

## 经验
在 Termux + 外部存储组合下做前端开发，**选型第一步就要确认工具链有没有原生二进制依赖**。有的话要么换工具，要么移到 home 目录跑。
