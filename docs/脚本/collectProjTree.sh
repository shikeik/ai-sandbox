#!/system/bin/sh

# 注意：Android 默认 shell 通常位于 /system/bin/sh
# 如果是在 Termux 中，可以使用 #!/data/data/com.termux/files/usr/bin/sh

# ================= 配置区域 =================

# 1. 输出文件名
OUTPUT_FILE="ProjectTree.txt"

# 2. 要排除的关键词 (用空格分隔的字符串，不要用括号)
EXCLUDE_KEYWORDS=".git dist node_modules build .git .idea .gradle .run"

# ===========================================

# 获取脚本自身文件名
SCRIPT_NAME="${0##*/}"

echo "正在生成目录结构..."
echo "排除关键词: $EXCLUDE_KEYWORDS"
echo "输出文件: $OUTPUT_FILE"
echo ""

# 判断是否需要跳过的辅助函数
# 返回 0 (true) 表示需要跳过，返回 1 (false) 表示保留
should_skip() {
    _name="$1"
    
    # 1. 排除 . 和 ..
    if [ "$_name" = "." ] || [ "$_name" = ".." ]; then return 0; fi
    
    # 2. 排除脚本自身和输出文件
    if [ "$_name" = "$SCRIPT_NAME" ]; then return 0; fi
    if [ "$_name" = "$OUTPUT_FILE" ]; then return 0; fi
    
    # 3. 关键词匹配 (模拟 Windows findstr / Bash [[ string == *kw* ]])
    # 使用 case 语句进行通配符匹配，兼容所有 sh
    for kw in $EXCLUDE_KEYWORDS; do
        case "$_name" in 
            *"$kw"*) return 0 ;;
        esac
    done
    
    return 1
}

# 遍历函数
traverse_dir() {
    local current_path="$1"
    local indent="$2"
    
    # 获取当前目录下的文件列表（包含隐藏文件）
    # 在 sh 中处理 glob 比较繁琐，这里采用两遍扫描法
    # 第一遍：计算有效文件总数，为了画出正确的树形线 (└──)
    local total_valid=0
    
    # 遍历普通文件 (*) 和隐藏文件 (.*)
    for file in "$current_path"/* "$current_path"/.*; do
        # 检查文件是否存在（处理空目录的情况）
        [ -e "$file" ] || continue
        
        # 获取文件名
        local name="${file##*/}"
        
        # 检查是否排除
        if should_skip "$name"; then continue; fi
        
        total_valid=$((total_valid + 1))
    done

    # 如果没有有效文件，直接返回
    if [ "$total_valid" -eq 0 ]; then return; fi

    # 第二遍：实际输出
    local count=0
    for file in "$current_path"/* "$current_path"/.*; do
        [ -e "$file" ] || continue
        local name="${file##*/}"
        
        if should_skip "$name"; then continue; fi
        
        count=$((count + 1))
        
        local prefix=""
        local sub_indent=""
        
        # 判断是否是最后一个元素
        if [ "$count" -eq "$total_valid" ]; then
            prefix="└── "
            sub_indent="${indent}    "
        else
            prefix="├── "
            sub_indent="${indent}│   "
        fi
        
        # 输出
        echo "${indent}${prefix}${name}"
        
        # 递归 (如果是目录且不是符号链接，避免死循环)
        if [ -d "$file" ] && [ ! -L "$file" ]; then
            traverse_dir "$file" "$sub_indent"
        fi
    done
}

# 主程序
(
    echo "项目目录结构: $(pwd)"
    echo ""
    traverse_dir "." ""
) > "$OUTPUT_FILE"

echo ""
echo "=========================================="
echo "生成完成!"
echo "代码已导出到: $OUTPUT_FILE"
echo "=========================================="