#!/bin/sh
# すべての検証をまとめて走らせる。
#   sh tools/check.sh
#
# 1. 移行の忠実性（news.html / cv.html と data/*.json の一致）
# 2. 純粋関数の単体テスト
set -e
cd "$(dirname "$0")/.."

echo "=== 移行の忠実性 ==="
PYTHONIOENCODING=utf-8 python tools/verify_migration.py

echo
echo "=== 単体テスト ==="
node --test tools/tests/format.test.mjs tools/tests/i18n.test.mjs

echo
echo "すべての検証が通りました。"
