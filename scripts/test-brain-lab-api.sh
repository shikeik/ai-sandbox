#!/bin/bash
# Brain Lab API 测试脚本

BASE_URL="http://localhost:4000/api/brain-lab"

echo "========== Brain Lab API 测试 =========="
echo ""

# 1. 获取初始状态
echo "1. 获取初始状态:"
curl -s -X POST "$BASE_URL/state" | jq '.'
echo ""

# 2. AI思考一步
echo "2. AI思考并执行:"
curl -s -X POST "$BASE_URL/step" | jq '.'
echo ""

# 3. 只思考不执行
echo "3. 只思考（查看AI会选什么）:"
curl -s -X POST "$BASE_URL/think" | jq '.'
echo ""

# 4. 手动移动
echo "4. 手动向右移动:"
curl -s -X POST "$BASE_URL/move" \
  -H "Content-Type: application/json" \
  -d '{"action":"RIGHT"}' | jq '.'
echo ""

# 5. 设置深度
echo "5. 设置想象深度为5:"
curl -s -X POST "$BASE_URL/set-depth" \
  -H "Content-Type: application/json" \
  -d '{"depth":5}' | jq '.'
echo ""

# 6. 重置
echo "6. 重置游戏:"
curl -s -X POST "$BASE_URL/reset" | jq '.'
echo ""

echo "========== 测试完成 =========="
echo ""
echo "可用命令:"
echo "  curl -X POST $BASE_URL/state"
echo "  curl -X POST $BASE_URL/step"
echo "  curl -X POST $BASE_URL/think"
echo "  curl -X POST $BASE_URL/move -H 'Content-Type: application/json' -d '{\"action\":\"JUMP\"}'"
echo "  curl -X POST $BASE_URL/reset"
