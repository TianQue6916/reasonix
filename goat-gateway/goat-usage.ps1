<#
  goat-usage.ps1 — Command Code GOAT 套餐额度看板（5 小时 / 周 / 月）
  ------------------------------------------------------------------
  数据来源：api.commandcode.ai 的 alpha 端点（用 keys.json 里的 user_ key 直连认证）

    GET /alpha/billing/credits   -> windowLimits.fiveHour / weekly {used, cap, resetAt, exceeded}
                                    credits.monthlyCredits = 本月剩余额度
    GET /alpha/usage/summary     -> 当前计费周期已用额度（totalCredits）

  月度上限 = 本周期已用 + 本月剩余（实测两账号均 ≈ 70）

  用法：
    .\goat-usage.ps1                 # 双账号一览
    .\goat-usage.ps1 -Key 163        # 只看某个账号
    .\goat-usage.ps1 -Watch 30       # 每 30 秒刷新（Ctrl+C 退出）
    .\goat-usage.ps1 -Json           # 输出 JSON（给状态栏/宠物等外部消费）
    .\goat-usage.ps1 -NoColor        # 纯文本
#>
[CmdletBinding()]
param(
  [string]$Key,
  [int]$Watch = 0,
  [switch]$Json,
  [switch]$Brief,
  [switch]$NoColor,
  [int]$CacheSeconds = 60,
  [switch]$Force,
  [string]$KeysFile
)
if (-not $KeysFile) { $KeysFile = Join-Path $PSScriptRoot 'keys.json' }

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$Api = 'https://api.commandcode.ai'

function Get-Usage([string]$bearer) {
  $h = @{ Authorization = "Bearer $bearer" }
  $credits = Invoke-RestMethod -Uri "$Api/alpha/billing/credits" -Headers $h -TimeoutSec 25 -UseBasicParsing
  $summary = Invoke-RestMethod -Uri "$Api/alpha/usage/summary" -Headers $h -TimeoutSec 25 -UseBasicParsing
  [pscustomobject]@{
    fiveHour  = $credits.windowLimits.fiveHour
    weekly    = $credits.windowLimits.weekly
    monthUsed = [double]$summary.totalCredits
    monthLeft = [double]$credits.credits.monthlyCredits
    monthCap  = [double]$summary.totalCredits + [double]$credits.credits.monthlyCredits
    requests  = $summary.totalCount
    tokens    = $summary.totalTokens
    exceeded  = $credits.windowLimits.exceeded
  }
}

function Write-Bar([double]$used, [double]$cap, [int]$width = 30) {
  $f = if ($cap -le 0) { 0 } else { [math]::Min(1.0, $used / $cap) }
  $filled = [int][math]::Round($f * $width)
  ('#' * $filled) + ('.' * ($width - $filled))
}

function Format-Reset($epochMs) {
  $t = [DateTimeOffset]::FromUnixTimeMilliseconds([int64]$epochMs).LocalDateTime
  $d = $t - (Get-Date)
  if ($d.TotalSeconds -le 0) { return "$($t.ToString('MM-dd HH:mm')) (已重置)" }
  if ($d.TotalDays -ge 1) { return ('{0:MM-dd HH:mm}（还有 {1} 天 {2} 小时）' -f $t, [int]$d.TotalDays, $d.Hours) }
  if ($d.TotalHours -ge 1) { return ('{0:HH:mm}（还有 {1} 小时 {2} 分）' -f $t, [int]$d.TotalHours, $d.Minutes) }
  return ('{0:HH:mm}（还有 {1} 分钟）' -f $t, [int]$d.TotalMinutes)
}

function Get-Color([double]$used, [double]$cap) {
  if ($NoColor) { return 'Gray' }
  $f = if ($cap -le 0) { 0 } else { $used / $cap }
  if ($f -ge 0.9) { return 'Red' } elseif ($f -ge 0.7) { return 'Yellow' } else { return 'Green' }
}

function Render {
  $cacheFile = Join-Path $env:TEMP 'goat-usage-cache.json'
  $cached = $null
  if (-not $Force -and $Watch -eq 0 -and $CacheSeconds -gt 0 -and (Test-Path $cacheFile)) {
    try {
      $c = Get-Content $cacheFile -Raw | ConvertFrom-Json
      if (((Get-Date) - [datetime]$c.ts).TotalSeconds -lt $CacheSeconds) { $cached = @($c.rows) }
    } catch {}
  }

  $all = Get-Content $KeysFile -Raw | ConvertFrom-Json
  $list = $all.keys | Where-Object { $_.enabled -ne $false }
  if ($Key) { $list = $list | Where-Object { $_.name -eq $Key } }
  if (-not $list) { throw "keys.json 里找不到账号 '$Key'" }

  if ($cached) {
    $rows = @($cached | Where-Object { -not $Key -or $_.name -eq $Key })
  } else {
  $rows = @()
  foreach ($k in $list) {
    try {
      $u = Get-Usage $k.key
      $rows += [pscustomobject]@{
        name = $k.name; error = $null; plan = 'individual-goat'
        fiveHourUsed = $u.fiveHour.used; fiveHourCap = $u.fiveHour.cap; fiveHourReset = $u.fiveHour.resetAt; fiveHourExceeded = $u.fiveHour.exceeded
        weeklyUsed = $u.weekly.used; weeklyCap = $u.weekly.cap; weeklyReset = $u.weekly.resetAt; weeklyExceeded = $u.weekly.exceeded
        monthUsed = $u.monthUsed; monthLeft = $u.monthLeft; monthCap = $u.monthCap
        requests = $u.requests; tokens = $u.tokens
        fetchedAt = (Get-Date).ToString('s')
      }
    } catch {
      $rows += [pscustomobject]@{ name = $k.name; error = $_.Exception.Message; fetchedAt = (Get-Date).ToString('s') }
    }
  }
    try { (@{ ts = (Get-Date).ToString('s'); rows = $rows } | ConvertTo-Json -Depth 6) | Set-Content -Path $cacheFile -Encoding UTF8 } catch {}
  }

  if ($Json) { return ($rows | ConvertTo-Json -Depth 6) }

  if ($Brief) {
    $parts = foreach ($r in $rows) {
      if ($r.error) { "[$($r.name)] 查询失败"; continue }
      $p5 = [math]::Round(100 * $r.fiveHourUsed / $r.fiveHourCap)
      $pw = [math]::Round(100 * $r.weeklyUsed / $r.weeklyCap)
      $pm = [math]::Round(100 * $r.monthUsed / $r.monthCap)
      "[$($r.name)] 5h $p5% · 周 $pw% · 月 $pm%（月剩 $([math]::Round($r.monthLeft,1)))"
    }
    return ($parts -join '    ')
  }

  $out = @()
  $out += "Command Code GOAT 额度 — $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  foreach ($r in $rows) {
    $out += ''
    if ($r.error) { $out += "[$($r.name)] 查询失败: $($r.error)"; continue }
    $out += "[$($r.name)]  $($r.plan)"
    foreach ($w in @(
        @{ n = '5小时'; used = $r.fiveHourUsed; cap = $r.fiveHourCap; reset = $r.fiveHourReset; ex = $r.fiveHourExceeded },
        @{ n = '本周 '; used = $r.weeklyUsed; cap = $r.weeklyCap; reset = $r.weeklyReset; ex = $r.weeklyExceeded },
        @{ n = '本月 '; used = $r.monthUsed; cap = $r.monthCap; reset = $null; ex = $null }
      )) {
      $pct = if ($w.cap -le 0) { 0 } else { [math]::Round(100 * $w.used / $w.cap, 1) }
      $line = '  {0} [{1}] {2,5}%  {3,7:N2} / {4,-7:N2}' -f $w.n, (Write-Bar $w.used $w.cap), $pct, $w.used, $w.cap
      if ($w.reset) { $line += '  重置 ' + (Format-Reset $w.reset) }
      if ($w.n -eq '本月 ') { $line += ('  剩余 {0:N2}' -f $r.monthLeft) }
      if ($w.ex) { $line += '  [已超限]' }
      $out += $line
    }
    $out += ('  本周期合计 {0} 次请求 / {1:N0} tokens' -f $r.requests, $r.tokens)
  }
  $out
}

if ($Watch -gt 0) {
  while ($true) {
    Clear-Host
    Render | ForEach-Object { Write-Host $_ }
    Write-Host ''
    Write-Host "每 $Watch 秒刷新，Ctrl+C 退出" -ForegroundColor DarkGray
    Start-Sleep -Seconds $Watch
  }
} else {
  Render
}
