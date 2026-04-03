#!/bin/bash

# 配置：查找 console.log("[XXX]" 替换为 console.log("XXX"
SEARCH_STR='\["\['
REPLACE_STR='["'

FILE_PATTERN="*.ts"
EXCLUDE_PATTERN="/\.git|node_modules|dist"

echo "查找: console.log(\"[TAG]\" 替换为 console.log(\"TAG\")"

# 处理 fox-jump 目录
echo "处理 fox-jump..."
find src/fox-jump -name "$FILE_PATTERN" -type f | while read file; do
    if grep -q '\("\[' "$file"; then
        sed -i 's/\("\[/"/g' "$file"
        echo "[已修复] $file"
    fi
done

# 处理 engine 目录
echo "处理 engine..."
find src/engine -name "$FILE_PATTERN" -type f | while read file; do
    if grep -q '\("\[' "$file"; then
        sed -i 's/\("\[/"/g' "$file"
        echo "[已修复] $file"
    fi
done

echo "✅ 完成!"
