# scripts/create-claude-symlinks.ps1
$ErrorActionPreference = "Stop"

$repoRoot = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $repoRoot

$folders = @(
    ".",
    "adapters",
    "apps/api",
    "apps/web",
    "apps/worker",
    "core",
    "infra",
    "infra/compose",
    "infra/k8s",
    "infra/terraform",
    "packages/config",
    "packages/db",
    "packages/errors",
    "packages/events",
    "packages/ffmpeg",
    "packages/job-contracts",
    "packages/observability",
    "packages/storage",
    "packages/testing",
    "packages/tsconfig",
    "tools"
)

Write-Host "Creating relative NTFS SymbolicLinks (CLAUDE.md -> AGENTS.md)..." -ForegroundColor Cyan

foreach ($folder in $folders) {
    $dir = Join-Path $repoRoot $folder
    $agentsFile = Join-Path $dir "AGENTS.md"
    $claudeFile = Join-Path $dir "CLAUDE.md"

    if (-not (Test-Path $agentsFile)) {
        Write-Warning "AGENTS.md not found in $folder, skipping."
        continue
    }

    if (Test-Path $claudeFile) {
        Remove-Item $claudeFile -Force
    }

    Push-Location $dir
    try {
        # Using cmd /c mklink creates a clean relative symbolic link
        cmd /c "mklink CLAUDE.md AGENTS.md" | Out-Null
        $link = Get-Item "CLAUDE.md"
        Write-Host "  [OK] $folder/CLAUDE.md -> $($link.Target) ($($link.LinkType))" -ForegroundColor Green
    } catch {
        Write-Error "Failed creating symlink in $folder: $_"
    } finally {
        Pop-Location
    }
}

Write-Host "All CLAUDE.md symbolic links successfully created." -ForegroundColor Cyan
