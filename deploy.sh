#!/bin/bash

# 最新のソースコードを取得
echo "Pulling latest changes from origin main..."
git pull origin main

# 依存関係のインストール
echo "Installing dependencies..."
npm install

# プロジェクトのビルド
echo "Building the Next.js application..."
npm run build

# PM2でアプリケーションを再起動
echo "Restarting application with pm2..."
pm2 restart anki-app

echo "Deployment finished."
