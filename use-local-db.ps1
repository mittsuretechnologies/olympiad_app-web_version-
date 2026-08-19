# Switches this web app to the LOCAL database (old Supabase project — safe
# to experiment on, doesn't touch real production data).
#
# Run this, then start your dev server as usual.

$ErrorActionPreference = "Stop"

# Defensive: if a real .env.local ever exists here, Next.js would silently prefer it over
# .env regardless of this switch. Not expected in local mode, but guard anyway.
$webLocalEnv = "$PSScriptRoot\.env.local"
if (Test-Path $webLocalEnv) { Remove-Item $webLocalEnv -Force; Write-Output "Removed stray .env.local (would have silently overridden this switch)" }

Copy-Item "$PSScriptRoot\.env.supabase" "$PSScriptRoot\.env" -Force
Write-Output "olympiad_app-web_version- -> LOCAL (Supabase)"

Write-Output ""
Write-Output "This project now points at the LOCAL (Supabase) database."
Write-Output "No SSH tunnel needed for this mode."
