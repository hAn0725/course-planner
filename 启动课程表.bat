@echo off
title 课程表 - 本地服务窗口
cd /d "%~dp0"

rem ------------------------------------------------------------
rem  一键启动课程表：浏览器会自动打开 http://localhost:3000
rem  关闭课程表网页后，服务会自动停止，本窗口也会自动关闭。
rem  （也可以随时直接关闭本窗口来停止课程表）
rem ------------------------------------------------------------

rem --- 检查 Node.js 是否可用 ---
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [错误] 没有找到 Node.js。请先安装 Node.js，再重新双击桌面图标。
  echo.
  pause
  exit /b 1
)

rem --- 首次运行：自动安装依赖 ---
if not exist "node_modules" (
  echo.
  echo  首次启动：正在安装运行依赖，只需一次，大约 1-3 分钟，请耐心等待...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [错误] 依赖安装失败，多半是网络问题。请检查网络后重新双击桌面图标。
    echo.
    pause
    exit /b 1
  )
)

rem --- 启动服务（服务就绪后会自动打开浏览器） ---
echo.
echo  正在启动课程表服务，浏览器会自动打开 http://localhost:3000
echo  提示：关闭课程表网页后，本服务会自动停止，窗口自动关闭。
echo.
call npm run dev

echo.
echo  课程表服务已停止，本窗口将在 5 秒后自动关闭...
timeout /t 5 /nobreak >nul
exit /b 0
