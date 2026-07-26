# OWASP ZAP CI Runner - InsightFlow
# Requires: Docker Desktop or ZAP installed at $env:ZAP_PATH
param(
    [string]$TargetUrl = "http://localhost:3001",
    [string]$ZapHome = "$env:USERPROFILE\.ZAP",
    [string]$ReportDir = "$PSScriptRoot\..\reports\zap",
    [string]$ZapImage = "ghcr.io/zaproxy/zaproxy:stable",
    [switch]$ActiveScan,
    [switch]$ApiScan,
    [switch]$FullScan
)

$ErrorActionPreference = "Stop"

# Ensure report directory exists
New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportFile = "$ReportDir\zap-report-$timestamp.json"

function Run-DockerZap {
    param([string]$Mode)

    $cmdArgs = @(
        "run", "--rm", "-v", "${ZapHome}:/zap/wrk/:rw"
        "-v", "${PSScriptRoot}:/zap/config/:ro"
        "$ZapImage"
    )

    switch ($Mode) {
        "baseline" {
            Write-Host "[ZAP] Running baseline scan against $TargetUrl"
            $cmdArgs += @(
                "zap-baseline.py", "-t", $TargetUrl,
                "-c", "/zap/config/zap.conf",
                "-r", "zap-report-$timestamp.json",
                "-w", "zap-warnings-$timestamp.md",
                "-J", "zap-alerts-$timestamp.json",
                "-d"
            )
        }
        "active" {
            Write-Host "[ZAP] Running active scan against $TargetUrl"
            $cmdArgs += @(
                "zap-full-scan.py", "-t", $TargetUrl,
                "-c", "/zap/config/zap.conf",
                "-r", "zap-report-$timestamp.json",
                "-w", "zap-warnings-$timestamp.md",
                "-J", "zap-alerts-$timestamp.json",
                "-d", "-m", "5"
            )
        }
        "api" {
            Write-Host "[ZAP] Running API scan against $TargetUrl"
            $cmdArgs += @(
                "zap-api-scan.py", "-t", "$TargetUrl/openapi.json",
                "-c", "/zap/config/zap-api-scan.rules",
                "-f", "openapi",
                "-r", "zap-report-$timestamp.json",
                "-w", "zap-warnings-$timestamp.md",
                "-J", "zap-alerts-$timestamp.json",
                "-d"
            )
        }
    }

    $reportFile = "$ReportDir\zap-report-$timestamp.json"
    & docker $cmdArgs
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 2) {
        Write-Error "[ZAP] Scan failed with exit code $LASTEXITCODE"
        exit 1
    }
    Write-Host "[ZAP] Report saved to $reportFile"
}

function Run-LocalZap {
    param([string]$Mode)

    $zapCli = if (Get-Command "zap-cli" -ErrorAction SilentlyContinue) {
        "zap-cli"
    } elseif (Test-Path "$env:ZAP_PATH\zap-cli.exe") {
        "$env:ZAP_PATH\zap-cli.exe"
    } else {
        Write-Error "ZAP CLI not found. Set ZAP_PATH or install zap-cli."
        exit 1
    }

    & $zapCli config --api-key $env:ZAP_API_KEY
    & $zapCli open

    try {
        & $zapCli spider $TargetUrl
        Start-Sleep -Seconds 5

        & $zapCli context import "$PSScriptRoot\zap.conf"

        if ($ActiveScan -or $FullScan) {
            & $zapCli active-scan --context "InsightFlow" --recursive $TargetUrl
        }

        if ($ApiScan) {
            & $zapCli api-scan -t "$TargetUrl/openapi.json" -f openapi -r "$PSScriptRoot\zap-api-scan.rules"
        }

        & $zapcli alerts -f json -l Medium > $reportFile
    } finally {
        & $zapCli shutdown
    }
}

# Detect Docker availability
$useDocker = if (Get-Command "docker" -ErrorAction SilentlyContinue) {
    try { & docker info *>$null; $true } catch { $false }
} else { $false }

if ($useDocker) {
    if ($FullScan) {
        Run-DockerZap -Mode "active"
    } elseif ($ActiveScan) {
        Run-DockerZap -Mode "active"
    } elseif ($ApiScan) {
        Run-DockerZap -Mode "api"
    } else {
        Run-DockerZap -Mode "baseline"
    }
} else {
    Run-LocalZap -Mode $(if ($ActiveScan -or $FullScan) { "active" } elseif ($ApiScan) { "api" } else { "baseline" })
}

# Exit codes: 0=no alerts, 1=FAIL, 2=warnings found
if ($LASTEXITCODE -eq 2) {
    Write-Host "[ZAP] Warnings found - review report"
    exit 0
}
