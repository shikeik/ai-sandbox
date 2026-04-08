#!/bin/bash
# Git 进程监控脚本 - 检测并清理失控的 git 进程
# 用法: ./git-watchdog.sh [interval_seconds]

INTERVAL=${1:-5}  # 默认每 5 秒检查一次
MAX_CPU=${2:-50}  # CPU 超过 50% 视为异常
MAX_COUNT=${3:-3} # 同时存在 3 个以上 git 进程视为异常

echo "=== Git 进程监控启动 ==="
echo "检查间隔: ${INTERVAL}秒"
echo "CPU 阈值: ${MAX_CPU}%"
echo "进程数阈值: ${MAX_COUNT}个"
echo "按 Ctrl+C 停止"
echo ""

while true; do
	# 统计 git 进程数量和 CPU 占用
	GIT_COUNT=$(ps aux | grep -E "git (diff|status)" | grep -v grep | wc -l)
	
	if [ "$GIT_COUNT" -gt 0 ]; then
		# 计算总 CPU 占用
		TOTAL_CPU=$(ps aux | grep -E "git (diff|status)" | grep -v grep | awk '{sum+=$3} END {printf "%.1f", sum}')
		
		# 获取详情
		DETAILS=$(ps aux | grep -E "git (diff|status)" | grep -v grep | awk '{printf "  PID %s: %s%% CPU\n", $2, $3}')
		
		TIME=$(date '+%H:%M:%S')
		echo "[$TIME] 发现 $GIT_COUNT 个 git 进程, 总 CPU: ${TOTAL_CPU}%"
		
		# 判断是否异常
		if [ "$GIT_COUNT" -gt "$MAX_COUNT" ] || [ "${TOTAL_CPU%.*}" -gt "$MAX_CPU" ]; then
			echo "⚠️  检测到异常！正在清理..."
			echo "$DETAILS"
			killall -9 git 2>/dev/null
			echo "✅ 已清理"
		fi
	fi
	
	sleep "$INTERVAL"
done
