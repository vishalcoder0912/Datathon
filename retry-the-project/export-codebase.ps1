# Export-CaseBase.ps1
# Recursively exports the entire codebase into a single markdown file.
# Usage: .\export-codebase.ps1 [-OutputFile <path>] [-ExcludeDirs <array>] [-IncludeExt <array>]

param(
    [string]$OutputFile = "codebase.md",
    [string[]]$ExcludeDirs = @(".git", "node_modules", ".opencode", "bin", "obj", "__pycache__", "dist", "build", ".next", ".expo", ".tmp_schema_trained_patch"),
    [string[]]$IncludeExt = @()  # empty means all files; otherwise filter by extension (without dot)
)

# Ensure output directory exists
$outputDir = Split-Path -Parent $OutputFile
if ($outputDir -and -(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Clear the output file
"" | Out-File -FilePath $OutputFile -Encoding UTF8

function Get-LanguageFromExtension {
    param([string]$ext)
    switch ($ext.ToLower()) {
        "js" { return "javascript" }
        "ts" { return "typescript" }
        "tsx" { return "tsx" }
        "jsx" { return "jsx" }
        "html" { return "html" }
        "css" { return "css" }
        "scss" { return "scss" }
        "json" { return "json" }
        "md" { return "markdown" }
        "py" { return "python" }
        "java" { return "java" }
        "c" { return "c" }
        "cpp" { return "cpp" }
        "cs" { return "csharp" }
        "php" { return "php" }
        "rb" { return "ruby" }
        "go" { return "go" }
        "rs" { return "rust" }
        "swift" { return "swift" }
        "kt" { return "kotlin" }
        "sql" { return "sql" }
        default { return "" } # no language hint
    }
}

# Get all files recursively but exclude directories early
$files = Get-ChildItem -Path . -Recurse -File | Where-Object {
    $fullPath = $_.FullName
    $relativePath = $fullPath.Substring((Get-Location).Path.Length + 1)
    
    # Check if any excluded directory is in the path
    foreach ($ex in $ExcludeDirs) {
        if ($relativePath -like "*\$ex\*" -or $relativePath -like "$ex\*") {
            return $false
        }
    }
    return $true
}

$fileCount = $files.Count
Write-Host "Found $fileCount files to process" -ForegroundColor Yellow

# Open the output file for writing once
$output = New-Object System.IO.StreamWriter($OutputFile, $false) # $false means overwrite
try {
    $processed = 0
    $files | ForEach-Object {
        $file = $_
        $relativePath = $file.FullName.Substring((Get-Location).Path.Length + 1)
        
        # Optional extension filter
        if ($IncludeExt.Count -gt 0) {
            $ext = $file.Extension.TrimStart('.')
            if (-not ($IncludeExt -contains $ext.ToLower())) {
                return
            }
        }

        # Read file content
        try {
            $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
        } catch {
            # If UTF8 fails, try default
            try {
                $content = Get-Content -Path $file.FullName -Raw
            } catch {
                $content = "[Binary or unreadable file]"
            }
        }

        # Determine language hint
        $ext = $file.Extension.TrimStart('.')
        $lang = Get-LanguageFromExtension -ext $ext

        # Build markdown section
        $section = "## $relativePath`n```$lang`n$content`n``n`n"
        $output.Write($section)
        
        $processed++
        if ($processed % 100 -eq 0) {
            Write-Progress -Activity "Exporting codebase" -Status "Processed $processed/$fileCount files" -PercentComplete ($processed/$fileCount*100)
        }
    }
} finally {
    $output.Close()
}

Write-Progress -Activity "Exporting codebase" -Status "Completed" -Completed
Write-Host "Codebase exported to $OutputFile" -ForegroundColor Green