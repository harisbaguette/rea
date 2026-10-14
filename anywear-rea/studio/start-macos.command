#!/bin/bash
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.12 이상을 설치한 뒤 다시 실행하세요."
  exit 1
fi
if [ ! -f node_modules/vite/package.json ]; then
  npm ci
fi
npm run dev
