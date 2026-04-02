#!/bin/bash
# ai-sandbox 一键部署脚本（本地执行）

set -e

SERVER_IP="162.14.79.120"
PORT="4000"
SERVER_USER="ubuntu"
NAME="ai-sandbox"
SSH_KEY="$HOME/.ssh/id_autologin"
REMOTE_DIR="/home/ubuntu/$NAME"

echo "=== $NAME 部署脚本 ==="

# 前置检查
if [ ! -f "$SSH_KEY" ]; then
	echo "错误：SSH 密钥不存在: $SSH_KEY"
	exit 1
fi

# 1. 本地构建
echo "[1/3] 本地构建..."
npm run build

# 2. 上传 dist 到服务器
echo "[2/3] 上传 dist 到服务器..."
tar czf - dist/ | ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "cd $REMOTE_DIR && rm -rf dist && tar xzf -"

# 3. 重启 Nginx
echo "[3/3] 重启 Nginx..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "sudo systemctl restart nginx"

echo ""
echo "=== 部署完成！访问 http://$SERVER_IP:$PORT ==="
