# Refresh the local development database from production.
#
# Production is only reachable through the SSH tunnel on 127.0.0.1:5433, so
# start that first (olympiad-checker/tunnel-to-prod-db.ps1). The dump step is
# strictly READ-ONLY against production -- nothing in this script writes there.
# The local database is dropped and recreated, so this is repeatable.
#
#   powershell -File scripts/clone-prod-db.ps1

$ErrorActionPreference = 'Stop'

$Bin = 'C:\Program Files\PostgreSQL\16\bin'
$DumpFile = Join-Path $env:TEMP 'prod_olympiad.dump'

# Source: production, via the tunnel.
$SrcPort = '5433'; $SrcUser = 'olympiad'; $SrcDb = 'olympiad'
$SrcPass = 'kE56y3x9CEPtsPBsFpftdJba'

# Target: the local PostgreSQL 16 service.
$DstPort = '5432'; $DstUser = 'postgres'; $DstDb = 'olympiad_local'
$DstPass = 'postgres'

if (-not (Test-Path "$Bin\pg_dump.exe")) { throw "PostgreSQL client tools not found at $Bin" }

Write-Host '==> 1/4 Dumping production (read-only)' -ForegroundColor Cyan
$env:PGPASSWORD = $SrcPass
& "$Bin\pg_dump.exe" -h 127.0.0.1 -p $SrcPort -U $SrcUser -d $SrcDb `
    --format=custom --no-owner --no-privileges --file $DumpFile
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit $LASTEXITCODE) -- is the SSH tunnel up?" }
$mb = [math]::Round((Get-Item $DumpFile).Length / 1MB, 2)
Write-Host ('    dump: {0} ({1} MB)' -f $DumpFile, $mb) -ForegroundColor Green

Write-Host '==> 2/4 Recreating local database' -ForegroundColor Cyan
$env:PGPASSWORD = $DstPass
& "$Bin\psql.exe" -h 127.0.0.1 -p $DstPort -U $DstUser -d postgres -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DstDb;"
& "$Bin\psql.exe" -h 127.0.0.1 -p $DstPort -U $DstUser -d postgres -q -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DstDb;"
if ($LASTEXITCODE -ne 0) { throw "could not recreate $DstDb (exit $LASTEXITCODE)" }

# The app's DSN connects as `olympiad`, so that role has to exist locally too.
# Dollar-quoting is assembled by concatenation -- PowerShell would otherwise
# try to expand $do$ as a variable inside a double-quoted string.
$createRole = 'DO ' + '$do$' + " BEGIN CREATE ROLE $SrcUser LOGIN PASSWORD '$SrcPass'; " +
              'EXCEPTION WHEN duplicate_object THEN NULL; END ' + '$do$' + ';'
& "$Bin\psql.exe" -h 127.0.0.1 -p $DstPort -U $DstUser -d postgres -q -c $createRole

Write-Host '==> 3/4 Restoring' -ForegroundColor Cyan
& "$Bin\pg_restore.exe" -h 127.0.0.1 -p $DstPort -U $DstUser -d $DstDb --no-owner --no-privileges $DumpFile
if ($LASTEXITCODE -ne 0) { Write-Host "    pg_restore reported warnings (exit $LASTEXITCODE)" -ForegroundColor Yellow }

Write-Host '==> 4/4 Granting access to the app role' -ForegroundColor Cyan
foreach ($stmt in @(
    "GRANT ALL ON DATABASE $DstDb TO $SrcUser;",
    "GRANT ALL ON SCHEMA public, scanner TO $SrcUser;",
    "GRANT ALL ON ALL TABLES IN SCHEMA public, scanner TO $SrcUser;",
    "GRANT ALL ON ALL SEQUENCES IN SCHEMA public, scanner TO $SrcUser;")) {
    & "$Bin\psql.exe" -h 127.0.0.1 -p $DstPort -U $DstUser -d $DstDb -q -c $stmt
}
$env:PGPASSWORD = $null

Write-Host ''
Write-Host 'Done. .env should point at:' -ForegroundColor Green
Write-Host "  postgresql://${SrcUser}:${SrcPass}@127.0.0.1:$DstPort/$DstDb"
