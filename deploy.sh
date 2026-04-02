#!/bin/bash
# Star-Fighter 一键部署脚本（本地执行）

set -e

SERVER_IP="162.14.79.120"
PORT="4000"
SERVER_USER="ubuntu"
NAME="ai-sandbox"
SSH_KEY="$HOME/.ssh/id_autologin"
REMOTE_DIR="/home/ubuntu/$NAME"

echo "=== $NAME 部署脚本 ==="

# 1. 停止 Nginx
echo "[1/4] 停止 Nginx..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "sudo systemctl stop nginx"

# 2. 删除云端旧项目
echo "[2/4] 删除云端旧项目..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "rm -rf $REMOTE_DIR/*"

# 3. 上传新版项目
echo "[3/4] 上传新版项目..."
scp -i "$SSH_KEY" -r ./* "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

# 4. 启动 Nginx
echo "[4/4] 启动 Nginx..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "sudo systemctl start nginx"

echo ""
echo "=== 部署完成！访问 http://$SERVER_IP:$PORT ==="
