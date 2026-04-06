#!/bin/sh

# ============================
# 1. 设置要包含的文件后缀 (使用正则表达式)
# ============================
# 写法说明：
#   \.java$  表示以 .java 结尾
#   |        表示 "或者"
#   .*       表示所有文件
#
# 例子 A: 只想要 java 和 xml 和 txt
# INCLUDE_PATTERN="\.java$|\.xml$|\.txt$"
#
# 例子 B: 想要所有文件 (慎用！会包含图片和二进制文件)
# INCLUDE_PATTERN=".*"

INCLUDE_PATTERN="\.md$"

# ============================
# 2. 设置排除的目录关键词 (使用正则表达式)
# ============================
# 这里的配置和之前一样：
#   /build/  表示排除包含 /build/ 的路径
EXCLUDE_PATTERN="\.sh|Project.*\.txt$|/SandTank/|/build/|/bin/|/\.git/|/target/|/\.idea/|/out/|/assets/|/javadoc/|\.png$|\.jpg$|changelog\.json$"

# ============================
# 3.0. 执行源相对路径 ./ 为当前
# ============================
CHILD_DIR="docs/engine_docs/"

# ============================
# 3. 输出文件名
# ============================
# 使用 $(pwd) 锁定当前脚本所在的绝对路径
# 这样无论后面 cd 到哪里，文件都会生成在脚本旁边，而不是子目录里
OUTPUT_FILE="$(pwd)/ProjectDocsCode.txt"

# ============================
# 4. 执行逻辑
# ============================
echo "正在搜索..."
echo "包含规则: $INCLUDE_PATTERN"
echo "排除规则: $EXCLUDE_PATTERN"

# 获取当前脚本的文件名，用于排除自身
SCRIPT_NAME=$(basename "$0")

# cd到docs目录
cd $CHILD_DIR

# 逻辑解释：
# 1. find ...             -> 找文件
# 2. grep ...             -> 筛选后缀
# 3. grep -vE ...         -> 排除目录/文件
# 4. grep -v "$OUTPUT..." -> 【新增】排除输出文件本身
# 5. grep -v "$SCRIPT..." -> 【新增】排除脚本文件本身
# 6. while ...            -> 循环处理

find . -type f | grep -E "$INCLUDE_PATTERN" | grep -vE "$EXCLUDE_PATTERN" | grep -v "$OUTPUT_FILE" | grep -v "$SCRIPT_NAME" | while read -r file; do
    echo "文件: $file"
    # 如果系统支持，可以加 -I 参数忽略二进制文件： grep -I "" "$file" 2>/dev/null
    cat -- "$file"
    echo ""
done > "$OUTPUT_FILE"

echo "完成！已保存至 $OUTPUT_FILE"

