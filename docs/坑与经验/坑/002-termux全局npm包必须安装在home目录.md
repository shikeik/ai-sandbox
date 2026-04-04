# Termux 全局 npm 包必须安装在 home 目录

## 现象
```bash
cd /storage/emulated/0/Projects
npm install -g vite
# 报错：EACCES: permission denied, symlink
```

## 根因
`/storage/emulated/0/` 不允许创建软链接。npm 全局安装时会在 `node_modules/.bin/` 里建 symlink，直接失败。

## 解决
```bash
cd ~
npm install -g vite vitest tsx
```

## 注意
即使全局包装好了，如果项目本身还在 `/storage/emulated/0/` 里，某些工具（如 vitest）加载项目本地的 `node_modules/esbuild` 时仍可能因 `noexec` 失败。全局包能解决"命令找不到"问题，但解决不了项目本地原生二进制无法执行的问题。
