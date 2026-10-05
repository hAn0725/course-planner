Option Explicit
Dim fso, shell, base, exe, code
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName)
exe = base & "\dist\server.cjs"

' 检查 Node.js
code = shell.Run("cmd /c where node >nul 2>nul", 0, True)
If code <> 0 Then
  MsgBox "没有找到 Node.js，请先到 https://nodejs.org 下载安装 LTS 版本后再试。", 48, "课程表"
  WScript.Quit
End If

' 首次运行：没有构建产物时先构建一次（会短暂显示进度窗口，仅一次）
If Not fso.FileExists(exe) Then
  shell.Run "cmd /c cd /d """ & base & """ && npm install --no-audit --no-fund >nul 2>&1 && npm run build", 1, True
End If

' 启动生产服务（0 = 隐藏控制台窗口，不留黑窗口）
shell.Run "cmd /c set NODE_ENV=production&& node """ & exe & """", 0, False
