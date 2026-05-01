# Verification Gates — BatallaProject
# This script runs all quality gates. None are blocking.
# All tests execute completely and report individual results.
# Usage: .\rules\verify.ps1

param(
    [switch]$SkipLint,
    [switch]$SkipSmoke,
    [switch]$SafetyCommit,
    [string]$SafetyMessage = "safety: before major change"
)

$ErrorActionPreference = "Continue"
$rootDir = Split-Path -Parent $PSScriptRoot
$results = @()
$totalFailed = 0

function Write-Gate {
    param([string]$Name, [string]$Status, [string]$Details)
    $icon = if ($Status -eq "PASS") { "✅" } elseif ($Status -eq "FAIL") { "❌" } else { "⚠️" }
    Write-Host ""
    Write-Host "$icon GATE: $Name — $Status" -ForegroundColor $(if ($Status -eq "PASS") { "Green" } elseif ($Status -eq "FAIL") { "Red" } else { "Yellow" })
    if ($Details) { Write-Host "   $Details" -ForegroundColor Gray }
    $script:results += [PSCustomObject]@{ Gate = $Name; Status = $Status; Details = $Details }
    if ($Status -eq "FAIL") { $script:totalFailed++ }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  BatallaProject — Verification Gates" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan

# ─── GATE S: Safety Commit ───
if ($SafetyCommit) {
    Write-Host "`n--- GATE S: Safety Commit ---" -ForegroundColor Yellow
    Push-Location $rootDir
    try {
        git add -A 2>$null
        $hasChanges = git diff --cached --quiet 2>$null; $LASTEXITCODE -ne 0
        if ($hasChanges) {
            git commit -m $SafetyMessage 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Gate "Safety Commit" "PASS" "Committed: $SafetyMessage"
            } else {
                Write-Gate "Safety Commit" "FAIL" "Git commit failed"
            }
        } else {
            Write-Gate "Safety Commit" "SKIP" "No changes to commit"
        }
    } finally {
        Pop-Location
    }
}

# ─── GATE 0: Lint ───
if (-not $SkipLint) {
    Write-Host "`n--- GATE 0: ESLint (frontend) ---" -ForegroundColor Yellow
    Push-Location "$rootDir\frontend"
    try {
        $lintOutput = npx eslint . --max-warnings=999 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Gate "Lint (frontend)" "PASS" "No errors"
        } else {
            $errorCount = ($lintOutput | Select-String -Pattern "error" | Measure-Object).Count
            Write-Gate "Lint (frontend)" "FAIL" "$errorCount error(s) found"
            $lintOutput | Select-Object -Last 10 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkRed }
        }
    } catch {
        Write-Gate "Lint (frontend)" "SKIP" "ESLint not available: $_"
    } finally {
        Pop-Location
    }
} else {
    Write-Gate "Lint (frontend)" "SKIP" "Skipped via -SkipLint"
}

# ─── GATE 1: TypeCheck ───
Write-Host "`n--- GATE 1: TypeCheck (backend) ---" -ForegroundColor Yellow
Push-Location "$rootDir\backend"
try {
    npx tsc --noEmit 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Gate "TypeCheck (backend)" "PASS" "No type errors"
    } else {
        $tsErrors = npx tsc --noEmit 2>&1
        $errorCount = ($tsErrors | Select-String -Pattern "error TS" | Measure-Object).Count
        Write-Gate "TypeCheck (backend)" "FAIL" "$errorCount type error(s)"
        $tsErrors | Select-Object -First 5 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkRed }
    }
} catch {
    Write-Gate "TypeCheck (backend)" "SKIP" "tsc not available"
} finally {
    Pop-Location
}

Write-Host "`n--- GATE 1: TypeCheck (frontend) ---" -ForegroundColor Yellow
Push-Location "$rootDir\frontend"
try {
    npx tsc --noEmit 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Gate "TypeCheck (frontend)" "PASS" "No type errors"
    } else {
        $tsErrors = npx tsc --noEmit 2>&1
        $errorCount = ($tsErrors | Select-String -Pattern "error TS" | Measure-Object).Count
        Write-Gate "TypeCheck (frontend)" "FAIL" "$errorCount type error(s)"
        $tsErrors | Select-Object -First 5 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkRed }
    }
} catch {
    Write-Gate "TypeCheck (frontend)" "SKIP" "tsc not available"
} finally {
    Pop-Location
}

# ─── GATE 2: Tests ───
Write-Host "`n--- GATE 2: Jest Tests (backend) ---" -ForegroundColor Yellow
Push-Location "$rootDir\backend"
try {
    $jestOutput = npx jest --forceExit --passWithNoTests 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Gate "Jest Tests (backend)" "PASS" "All tests passed"
    } else {
        Write-Gate "Jest Tests (backend)" "FAIL" "Some tests failed"
        $jestOutput | Select-Object -Last 15 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkRed }
    }
} catch {
    Write-Gate "Jest Tests (backend)" "SKIP" "Jest not available"
} finally {
    Pop-Location
}

if (-not $SkipSmoke) {
    Write-Host "`n--- GATE 2: Smoke Tests ---" -ForegroundColor Yellow
    Push-Location "$rootDir\tests"
    try {
        # Check if backend is running
        $healthCheck = $null
        try {
            $healthCheck = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 3 -ErrorAction SilentlyContinue
        } catch {}

        if ($healthCheck) {
            $env:USERNAME = "Javier"
            $env:PASSWORD = "123456"
            $smokeOutput = npx ts-node -r tsconfig-paths/register runner.ts 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Gate "Smoke Tests" "PASS" "All smoke tests passed"
            } else {
                Write-Gate "Smoke Tests" "FAIL" "Some smoke tests failed"
                $smokeOutput | Select-Object -Last 15 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkRed }
            }
        } else {
            Write-Gate "Smoke Tests" "SKIP" "Backend not running on localhost:3000"
        }
    } catch {
        Write-Gate "Smoke Tests" "SKIP" "Error: $_"
    } finally {
        Pop-Location
    }
} else {
    Write-Gate "Smoke Tests" "SKIP" "Skipped via -SkipSmoke"
}

# ─── GATE 3: Health Check ───
Write-Host "`n--- GATE 3: Health Check ---" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Gate "Health Check" "PASS" "Backend responding: $($health | ConvertTo-Json -Compress)"
} catch {
    Write-Gate "Health Check" "SKIP" "Backend not running on localhost:3000"
}

# ─── Summary ───
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan

foreach ($r in $results) {
    $icon = if ($r.Status -eq "PASS") { "✅" } elseif ($r.Status -eq "FAIL") { "❌" } else { "⏭️" }
    Write-Host "  $icon $($r.Gate): $($r.Status)"
}

$passed = ($results | Where-Object { $_.Status -eq "PASS" } | Measure-Object).Count
$failed = ($results | Where-Object { $_.Status -eq "FAIL" } | Measure-Object).Count
$skipped = ($results | Where-Object { $_.Status -eq "SKIP" } | Measure-Object).Count

Write-Host ""
Write-Host "  Passed: $passed | Failed: $failed | Skipped: $skipped" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host ""

exit $totalFailed
