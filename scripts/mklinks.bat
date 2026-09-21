@echo off
set "REPO=%~dp0.."

set FOLDERS=. adapters apps\api apps\web apps\worker core infra infra\compose infra\k8s infra\terraform packages\config packages\db packages\errors packages\events packages\ffmpeg packages\job-contracts packages\observability packages\storage packages\testing packages\tsconfig tools

for %%F in (%FOLDERS%) do (
    cd /d "%REPO%\%%F"
    if exist "CLAUDE.md" del /f /q "CLAUDE.md"
    mklink "CLAUDE.md" "AGENTS.md"
)

echo All relative NTFS symlinks created successfully.
