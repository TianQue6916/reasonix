#Requires -Version 5.1
<#
  dsh 3081 launcher  —  自定义实例（对标 Codex 的工作台）

  【为什么需要它】
    3080 是默认端口。再直接起一个 dsh 会去抢 3080，打断正在跑的 session /
    batch 任务。本脚本固定用 3081，两个实例各占各的端口、互不干扰。

  【和 3080 的关系：配置相同、信息同步 —— 而且是天然的】
    * 同一个 profile（web）      → 插件 / persona / skill-search / memory 全一样
    * 同一个 DSH_HOME（~/.dsh）  → 会话存储、skill 用量账本、
      reasonix 记忆语料（~/.reasonix/memory）全部共享
    * 所以在任一边新建的会话，另一边打开同一工作区就能看到

  【重复点击】
    若 3081 已在运行：不报端口占用，而是重开上次记下的「带 token 的 URL」。
    token 是必需的（不带会 401）。

  【NODE_OPTIONS=--use-system-ca（关键）】
    本机 dev-sidecar 做 MITM，用自己生成的根 CA 签发证书；Node 默认只信任
    内置 CA，于是 fetch 抛 "unable to verify the first certificate"。
    实际后果已在插件里看到：Mimir 启动即报
        [mimir] venue deadline refresh failed: TypeError: fetch failed
    加上该 flag 后 Node 改读 Windows 证书库（dev-sidecar 的根 CA 已在
    CurrentUser\Root 里）。实测对照：
        不加 → 证书失败
        加了 → https://github.com HTTP 200 / 576183 bytes

  【两个已知的 PowerShell 坑（本脚本已绕开）】
    1) Start-Process 在本机会直接崩：
         "Item has already been added. Key in dictionary: 'NO_PROXY'"
       因为环境里同时存在 NO_PROXY 和 no_proxy，而 Start-Process 会去构建一个
       大小写不敏感的环境字典。→ 改用 System.Diagnostics.ProcessStartInfo。
    2) 用 Start-Job 去读子进程 stdout 也不行：Process 对象跨 runspace 会被
       序列化，$p.StandardOutput 不可用。→ 改用 cmd /c 做文件重定向，
       父进程只轮询文件，不碰管道。
#>

$Port      = 3081
$Workspace = "C:\Users\27063"                     # ← 想换工作区改这一行
$LogDir    = Join-Path $env:USERPROFILE ".dsh\logs"
$UrlFile   = Join-Path $LogDir "dsh-web-$Port.url"
$LogFile   = Join-Path $LogDir "dsh-web-$Port.out.log"

$null = New-Item -ItemType Directory -Force -Path $LogDir

function Test-PortBusy {
  param([int]$P)
  $null -ne (Get-NetTCPConnection -LocalPort $P -State Listen -ErrorAction SilentlyContinue)
}

# ---------- 已在运行：重开原 URL ----------
if (Test-PortBusy $Port) {
  if (Test-Path $UrlFile) {
    $url = ((Get-Content $UrlFile -Raw) -replace "`0", "").Trim()
    if ($url) {
      Write-Host "dsh 已在 $Port 运行，重新打开既有会话：" -ForegroundColor Yellow
      Write-Host "  $url" -ForegroundColor Cyan
      Start-Process $url
      exit 0
    }
  }
  Write-Host "$Port 已被占用，但没找到保存的 URL，请切到已打开的标签页。" -ForegroundColor Yellow
  exit 1
}

# ---------- 启动 ----------
$env:NODE_OPTIONS = "--use-system-ca"
Remove-Item $LogFile -ErrorAction SilentlyContinue
Remove-Item $UrlFile -ErrorAction SilentlyContinue

Write-Host "启动 dsh web   port=$Port   workspace=$Workspace" -ForegroundColor Green

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName        = "$env:ComSpec"
$psi.Arguments       = '/c dsh --profile web --port ' + $Port + ' > "' + $LogFile + '" 2>&1'
$psi.WorkingDirectory = $Workspace
$psi.UseShellExecute  = $false
$psi.CreateNoWindow   = $true
$psi.WindowStyle      = 'Hidden'

$proc = [System.Diagnostics.Process]::Start($psi)

# dsh 自己会打开浏览器；这里只是把带 token 的 URL 存档，供重复点击复用。
$saved = $false
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-Path $LogFile) {
    $txt = Get-Content $LogFile -Raw -ErrorAction SilentlyContinue
    if ($txt) {
      $txt = $txt -replace "`0", ""
      $m = [regex]::Match($txt, "https?://[^\s]*token=[^\s]+")
      if ($m.Success) {
        [System.IO.File]::WriteAllText($UrlFile, $m.Value)
        Write-Host "已记录 URL：$($m.Value)" -ForegroundColor Cyan
        $saved = $true
        break
      }
    }
  }
  if ($proc.HasExited) { break }
}

if (Test-PortBusy $Port) {
  Write-Host "已在 $Port 运行。浏览器应已自动打开。" -ForegroundColor Green
  if (-not $saved) { Write-Host "（URL 未抓到，可看日志 $LogFile）" -ForegroundColor DarkGray }
  exit 0
}

Write-Host "启动失败或超时。日志：" -ForegroundColor Red
if (Test-Path $LogFile) { Get-Content $LogFile -Tail 15 }
exit 1
