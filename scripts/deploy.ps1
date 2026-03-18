#Requires -Version 5.1
<#
.SYNOPSIS
    GalAirport 版本升级 & 发布脚本

.PARAMETER Type
    升级类型：major | minor | patch（默认 patch）

.PARAMETER Version
    直接指定目标版本号，格式 x.y.z

.EXAMPLE
    .\scripts\deploy.ps1
    .\scripts\deploy.ps1 -Type minor
    .\scripts\deploy.ps1 -Type major
    .\scripts\deploy.ps1 -Version 2.0.0
#>

param(
    [ValidateSet("major", "minor", "patch")]
    [string]$Type = "patch",
    [string]$Version = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root        = Split-Path $PSScriptRoot -Parent
$PackageJson = Join-Path $Root "package.json"

if (-not (Test-Path $PackageJson)) {
    Write-Error "找不到 package.json: $PackageJson"
    exit 1
}

# ── 读取当前版本 ──────────────────────────────────────────────
$pkg     = Get-Content $PackageJson -Raw | ConvertFrom-Json
$current = $pkg.version

if ($current -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "版本号格式不合法: $current"
    exit 1
}

$parts = $current -split '\.'
[int]$major = $parts[0]
[int]$minor = $parts[1]
[int]$patch = $parts[2]

# ── 计算新版本 ────────────────────────────────────────────────
if ($Version -ne "") {
    if ($Version -notmatch '^\d+\.\d+\.\d+$') {
        Write-Error "版本号格式不合法，应为 x.y.z，得到: $Version"
        exit 1
    }
    $newVersion = $Version
} else {
    switch ($Type) {
        "major" { $major++; $minor = 0; $patch = 0 }
        "minor" { $minor++; $patch = 0 }
        "patch" { $patch++ }
    }
    $newVersion = "$major.$minor.$patch"
}

if ($newVersion -eq $current) {
    Write-Host "当前版本已是 $current，无需升级。" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "  $current  →  $newVersion" -ForegroundColor Green
Write-Host ""

# ── 检查工作区是否干净 ────────────────────────────────────────
Push-Location $Root
try {
    $dirty = git status --porcelain 2>&1
    if ($dirty) {
        Write-Host "工作区有未提交的改动：" -ForegroundColor Yellow
        Write-Host $dirty -ForegroundColor DarkGray
        $go = Read-Host "仍然继续？[y/N]"
        if ($go -notmatch '^[Yy]') {
            Write-Host "已取消。" -ForegroundColor Yellow
            exit 0
        }
    }

    # ── 写入 package.json ─────────────────────────────────────
    $pkg.version = $newVersion
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($pkg | ConvertTo-Json -Depth 10) + "`n")
    [System.IO.File]::WriteAllBytes($PackageJson, $bytes)
    Write-Host "  ✓ package.json 已更新" -ForegroundColor Green

    # ── Git 操作 ──────────────────────────────────────────────
    Write-Host ""
    Write-Host "执行 Git 操作..." -ForegroundColor Cyan

    git add package.json
    if ($LASTEXITCODE -ne 0) { throw "git add 失败" }
    Write-Host "  ✓ git add" -ForegroundColor Green

    git commit -m "v$newVersion"
    if ($LASTEXITCODE -ne 0) { throw "git commit 失败" }
    Write-Host "  ✓ git commit `"v$newVersion`"" -ForegroundColor Green

    git tag "v$newVersion"
    if ($LASTEXITCODE -ne 0) { throw "git tag 失败" }
    Write-Host "  ✓ git tag v$newVersion" -ForegroundColor Green

    Write-Host ""
    Write-Host "发布完成：v$newVersion" -ForegroundColor Green
    Write-Host ""
    Write-Host "推送到远端：" -ForegroundColor DarkGray
    Write-Host "  git push && git push --tags" -ForegroundColor DarkGray
    Write-Host ""

} finally {
    Pop-Location
}
