#Requires -Version 5.1
<#
.SYNOPSIS
    GalAirport version bump and release script

.PARAMETER Type
    major | minor | patch (default: patch)

.PARAMETER Version
    Specify target version directly, e.g. 2.0.0

.EXAMPLE
    .\scripts\deploy.ps1
    .\scripts\deploy.ps1 -Type minor
    .\scripts\deploy.ps1 -Type major
    .\scripts\deploy.ps1 -Version 2.0.0
#>

param(
    [ValidateSet('major', 'minor', 'patch')]
    [string]$Type = 'patch',
    [string]$Version = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root        = Split-Path $PSScriptRoot -Parent
$PackageJson = Join-Path $Root 'package.json'

if (-not (Test-Path $PackageJson)) {
    Write-Error "Cannot find package.json: $PackageJson"
    exit 1
}

# ---- read current version -----------------------------------------------
$pkg     = Get-Content $PackageJson -Raw | ConvertFrom-Json
$current = $pkg.version

if ($current -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "Invalid version in package.json: $current"
    exit 1
}

$parts = $current -split '\.'
[int]$major = $parts[0]
[int]$minor = $parts[1]
[int]$patch = $parts[2]

# ---- calculate new version -----------------------------------------------
if ($Version -ne '') {
    if ($Version -notmatch '^\d+\.\d+\.\d+$') {
        Write-Error "Invalid version format (expected x.y.z): $Version"
        exit 1
    }
    $newVersion = $Version
} else {
    switch ($Type) {
        'major' { $major++; $minor = 0; $patch = 0 }
        'minor' { $minor++; $patch = 0 }
        'patch' { $patch++ }
    }
    $newVersion = "$major.$minor.$patch"
}

if ($newVersion -eq $current) {
    Write-Host "Already at $current, nothing to do." -ForegroundColor Yellow
    exit 0
}

Write-Host ''
Write-Host "  $current  ->  $newVersion" -ForegroundColor Green
Write-Host ''

# ---- check working tree --------------------------------------------------
Push-Location $Root
try {
    $dirty = git status --porcelain 2>&1
    if ($dirty) {
        Write-Host 'Uncommitted changes detected:' -ForegroundColor Yellow
        Write-Host $dirty -ForegroundColor DarkGray
        $go = Read-Host 'Continue anyway? [y/N]'
        if ($go -notmatch '^[Yy]') {
            Write-Host 'Cancelled.' -ForegroundColor Yellow
            exit 0
        }
    }

    # ---- write package.json ----------------------------------------------
    $pkg.version = $newVersion
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($pkg | ConvertTo-Json -Depth 10) + "`n")
    [System.IO.File]::WriteAllBytes($PackageJson, $bytes)
    Write-Host '  OK  package.json updated' -ForegroundColor Green

    # ---- git operations --------------------------------------------------
    Write-Host ''
    Write-Host 'Running git...' -ForegroundColor Cyan

    git add package.json
    if ($LASTEXITCODE -ne 0) { throw 'git add failed' }
    Write-Host '  OK  git add' -ForegroundColor Green

    git commit -m "v$newVersion"
    if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }
    Write-Host "  OK  git commit v$newVersion" -ForegroundColor Green

    git tag "v$newVersion"
    if ($LASTEXITCODE -ne 0) { throw 'git tag failed' }
    Write-Host "  OK  git tag v$newVersion" -ForegroundColor Green

    Write-Host ''
    Write-Host "Released: v$newVersion" -ForegroundColor Green
    Write-Host ''
    Write-Host 'To push:  git push; git push --tags' -ForegroundColor DarkGray
    Write-Host ''

} finally {
    Pop-Location
}
