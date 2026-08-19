# Switches this web app to the SERVER (production) database — real data
# from mittmee.com, via the SSH tunnel.
#
# IMPORTANT: start the tunnel FIRST, or every request will fail:
#   .\tunnel-to-prod-db.ps1
#
# Then run this script, then start your dev server as usual.

$ErrorActionPreference = "Stop"

# Next.js always prefers .env.local over .env, no matter what — if this file exists it will
# silently win regardless of which mode we just switched to. Remove it so .env is authoritative.
$webLocalEnv = "$PSScriptRoot\.env.local"
if (Test-Path $webLocalEnv) { Remove-Item $webLocalEnv -Force; Write-Output "Removed stray .env.local (would have silently overridden this switch)" }

Copy-Item "$PSScriptRoot\.env.server" "$PSScriptRoot\.env" -Force
Write-Output "olympiad_app-web_version- -> SERVER (production, via tunnel)"

Write-Output ""
Write-Output "This project now points at the SERVER (production) database."
Write-Output "Make sure the SSH tunnel is running: .\tunnel-to-prod-db.ps1"
