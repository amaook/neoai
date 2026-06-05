#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=============================="
echo "  neo 0.9.0 打包脚本"
echo "=============================="
echo ""

echo ">>> [1/2] 打包 Mac 版本..."
npm run package:mac
echo ">>> Mac 打包完成"
echo ""

echo ">>> [2/2] 打包 Windows 版本..."
npm run package:win
echo ">>> Windows 打包完成"
echo ""

echo "=============================="
echo "  打包完成！文件在 outputs/desktop/"
echo "=============================="
open outputs/desktop
