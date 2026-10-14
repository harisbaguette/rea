@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.12 이상을 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)
if not exist node_modules\vite\package.json (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm run dev
pause
