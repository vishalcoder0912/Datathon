param(
    [string]$Suite = "all",
    [int]$VUs = 50,
    [string]$Duration = "30s",
    [string]$BaseUrl = "http://localhost:3001"
)

$ReportsDir = Join-Path $PSScriptRoot "..\reports"
New-Item -ItemType Directory -Path $ReportsDir -Force | Out-Null

$K6 = if ($IsWindows -or $env:OS -match "Windows") { "k6.exe" } else { "k6" }

$Suites = @(
    @{ Name = "health-check"; Script = "health-check.js" }
    @{ Name = "auth-flow"; Script = "auth-flow.js" }
    @{ Name = "api-endpoints"; Script = "api-endpoints.js" }
    @{ Name = "ai-endpoints"; Script = "ai-endpoints.js" }
    @{ Name = "file-upload"; Script = "file-upload.js" }
)

function Run-Suite {
    param($Suite)
    $cmd = "$K6 run -e VU=$VUs -e DURATION=$Duration -e BASE_URL=$BaseUrl --summary-trend-stats=`"avg,min,med,max,p(90),p(95),p(99)`" `"$($Suite.Script)`""
    Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Running: $($Suite.Name) (VUs=$VUs, Duration=$Duration)" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

    $start = Get-Date
    try {
        $output = Invoke-Expression $cmd 2>&1
        $elapsed = (Get-Date) - $start
        Write-Host "`n✅ $($Suite.Name): PASS (${elapsed.TotalSeconds}s)" -ForegroundColor Green
        return @{ Name = $Suite.Name; Status = "PASS"; Duration = $elapsed.TotalSeconds }
    } catch {
        Write-Host "`n❌ $($Suite.Name): FAIL - $_" -ForegroundColor Red
        return @{ Name = $Suite.Name; Status = "FAIL"; Error = $_ }
    }
}

if ($Suite -eq "all") {
    $Results = @()
    foreach ($s in $Suites) {
        $Results += Run-Suite $s
    }

    Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  K6 LOAD TEST SUMMARY" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

    $passed = ($Results | Where-Object { $_.Status -eq "PASS" }).Count
    $failed = ($Results | Where-Object { $_.Status -eq "FAIL" }).Count

    $Results | ForEach-Object {
        $icon = if ($_.Status -eq "PASS") { "✅" } else { "❌" }
        Write-Host "  $icon $($_.Name): $($_.Status)"
    }

    $summary = @{
        timestamp = (Get-Date -Format "o")
        total = $Results.Count
        passed = $passed
        failed = $failed
        results = $Results
    }

    $summary | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $ReportsDir "k6-summary.json")
    Write-Host "`n📊 Report saved to reports/k6-summary.json" -ForegroundColor Yellow
    Write-Host "`n✅ Passed: $passed/$($Results.Count)" -ForegroundColor Green
    if ($failed -gt 0) { Write-Host "❌ Failed: $failed/$($Results.Count)" -ForegroundColor Red; exit 1 }
} else {
    $target = $Suites | Where-Object { $_.Name -eq $Suite }
    if ($target) {
        $env:VU = $VUs
        $env:DURATION = $Duration
        $env:BASE_URL = $BaseUrl
        Run-Suite $target
    } else {
        Write-Host "❌ Unknown suite: $Suite. Available: $($Suites.Name -join ', ')" -ForegroundColor Red
        exit 1
    }
}
