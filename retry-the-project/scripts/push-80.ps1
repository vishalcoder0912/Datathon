$ErrorActionPreference = "Stop"

$files = @()
$files += git diff --name-only --diff-filter=AM
$files += git ls-files --others --exclude-standard
$files = $files | Where-Object { $_ -and $_.Trim() } | Select-Object -Unique

$total = $files.Count
$numCommits = 80
$batchSize = [math]::Ceiling($total / $numCommits)

Write-Host "Total files: $total, Commits: $numCommits, Batch size: ~$batchSize"

$commitNum = 0
for ($i = 0; $i -lt $total; $i += $batchSize) {
    $commitNum++
    $end = [math]::Min($i + $batchSize, $total)
    $batch = $files[$i..($end - 1)]

    $batch | ForEach-Object { git add -- "$_" }
    git commit -m "chore: incremental commit $commitNum / $numCommits"
    Write-Host "Commit $commitNum created (files $($i+1)-$end)"

    Write-Host "Pushing commit $commitNum / $numCommits ..."
    git push origin main
    Write-Host "Push $commitNum done"
}

Write-Host "All $numCommits commits pushed successfully!"
