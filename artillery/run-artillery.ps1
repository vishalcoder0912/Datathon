param(
    [string]$Suite = "all",
    [string]$BaseUrl = "http://localhost:3001",
    [string]$OutputDir = "reports"
)

$Artillery = if ($IsWindows -or $env:OS -match "Windows") { "artillery.cmd" } else { "artillery" }
$ReportsDir = Join-Path $PSScriptRoot "..\$OutputDir"
New-Item -ItemType Directory -Path $ReportsDir -Force | Out-Null

$env:BASE_URL = $BaseUrl

$Suites = @(
    @{ Name = "stress-auth"; Config = "stress-auth.yml" }
    @{ Name = "stress-api"; Config = "stress-api.yml" }
    @{ Name = "stress-ai"; Config = "stress-ai.yml" }
)

function Run-Suite {
    param($Name, $Config)
    $reportPath = Join-Path $ReportsDir "artillery-$Name.json"
    $cmd = "$Artillery run --output `"$reportPath`" `"$(Join-Path $PSScriptRoot $Config)`""
    Write-Host "`n═══════════════════════════════════════" -ForegroundColor Magenta
    Write-Host "  Running Artillery: $Name" -ForegroundColor Magenta
    Write-Host "═══════════════════════════════════════`n" -ForegroundColor Magenta

    try {
        Invoke-Expression $cmd 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✅ $Name: PASS" -ForegroundColor Green
            return @{ Name = $Name; Status = "PASS" }
        } else {
            Write-Host "`n❌ $Name: FAIL (exit code: $LASTEXITCODE)" -ForegroundColor Red
            return @{ Name = $Name; Status = "FAIL" }
        }
    } catch {
        Write-Host "`n❌ $Name: FAIL - $_" -ForegroundColor Red
        return @{ Name = $Name; Status = "FAIL" }
    }
}

if ($Suite -eq "all") {
    $Results = @()
    foreach ($s in $Suites) {
        $Results += Run-Suite -Name $s.Name -Config $s.Config
    }
    Write-Host "`n═══════════════════════════════════════" -ForegroundColor Magenta
    Write-Host "  ARTILLERY STRESS TEST SUMMARY" -ForegroundColor Magenta
    Write-Host "═══════════════════════════════════════`n" -ForegroundColor Magenta
    $passed = ($Results | Where-Object { $_.Status -eq "PASS" }).Count
    $failed = ($Results | Where-Object { $_.Status -eq "FAIL" }).Count
    $Results | ForEach-Object {
        $icon = if ($_.Status -eq "PASS") { "✅" } else { "❌" }
        Write-Host "  $icon $($_.Name): $($_.Status)"
    }
    ($Results | ConvertTo-Json) | Set-Content (Join-Path $ReportsDir "artillery-summary.json")
    Write-Host "`n📊 Reports saved to $ReportsDir" -ForegroundColor Yellow
    Write-Host "`n✅ Passed: $passed/$($Results.Count)" -ForegroundColor Green
    if ($failed -gt 0) { Write-Host "❌ Failed: $failed/$($Results.Count)" -ForegroundColor Red; exit 1 }
} else {
    $target = $Suites | Where-Object { $_.Name -eq $Suite }
    if ($target) {
        Run-Suite -Name $target.Name -Config $target.Config
    } else {
        Write-Host "❌ Unknown suite: $Suite. Available: $($Suites.Name -join ', ')" -ForegroundColor Red
        exit 1
    }
}
