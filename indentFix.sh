#!/bin/bash
# 预设的后缀名
EXTENSIONS="js html css"

# 遍历每个后缀名
for ext in $EXTENSIONS; do
    echo "🔍 查找 .$ext 文件..."
    
    # 查找当前目录下所有该后缀的文件
    find . -name "*.$ext" -type f | while read file; do
        echo "  正在处理: $file"

        # 1. 【循环】将行首所有的 4个空格 替换为 1个Tab
        sed -i ':a; s/^\(\t*\)    /\1\t/; t a' "$file"

        # 2. 【循环】将行首剩余的 3个空格 替换为 1个Tab
        sed -i ':a; s/^\(\t*\)   /\1\t/; t a' "$file"

        # 3. 【循环】将行首剩余的 2个空格 替换为 1个Tab
        sed -i ':a; s/^\(\t*\)  /\1\t/; t a' "$file"
    done
done

echo "✅ 所有 JS/HTML/CSS 文件缩进已转换为 Tab！"
