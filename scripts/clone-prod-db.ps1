# Refresh the LOCAL development database with a copy of production.
#
#   powershell -ExecutionPolicy Bypass -File scripts/clone-prod-db.ps1
#
# What it touches:
#   Production  READ ONLY. Only pg_dump runs against it, through the SSH tunnel
#               on 127.0.0.1:5433. Nothing is ever written there.
#   Local       The database named in .env.local-db (e.g. olympiad_local on
#               127.0.0.1:5432) is DROPPED and recreated from the dump.
#
# Connection details come from the env files, never from this script:
#   .env.server    DATABASE_URL = production (source)
#   .env.local-db  DATABASE_URL = local copy (target) and the role the app uses
# The local `postgres` superuser password is asked for at run time.
#
# Safety: before dropping anything the target must be on this machine
# (localhost / 127.0.0.1), on a different port than production, in a database
# whose name ends in "_local", and you must type LOCAL to confirm.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Read-DbUrl([string]$file) {
  $path = Join-Path $Root $file
  if (-not (Test-Path $path)) { throw "$file not found in $Root" }
  $line = Get-Content $path | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if (-not $line) { throw "DATABASE_URL is missing in $file" }
  $url = ($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
  if ($url -notmatch '^postgres(?:ql)?://([^:@/]+)(?::([^@]*))?@([^:/?]+)(?::(\d+))?/([^?]+)') {
    throw "DATABASE_URL in $file is not a postgresql:// URL"
  }
  [pscustomobject]@{
    User = [uri]::UnescapeDataString($Matches[1])
    Pass = [uri]::UnescapeDataString([string]$Matches[2])
    Host = $Matches[3]
    Port = if ($Matches[4]) { $Matches[4] } else { '5432' }
    Db   = [uri]::UnescapeDataString($Matches[5])
  }
}

function Assert-Ok([string]$what) {
  if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE)" }
}

# Newest installed PostgreSQL client tools (pg_dump must be at least the
# server's major version).
$Bin = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue |
  Sort-Object { [int]($_.Directory.Parent.Name -replace '\D', '') } -Descending |
  Select-Object -First 1 | ForEach-Object { $_.DirectoryName }
if (-not $Bin) { throw 'PostgreSQL client tools not found under C:\Program Files\PostgreSQL' }

$Src = Read-DbUrl '.env.server'
$Dst = Read-DbUrl '.env.local-db'

# ── Guards: never drop anything that could be production ──────────────────
$localHosts = @('localhost', '127.0.0.1')
if ($localHosts -notcontains $Dst.Host) { throw "Refusing: target host '$($Dst.Host)' is not this machine." }
if ($Dst.Port -eq $Src.Port) { throw "Refusing: target port $($Dst.Port) is the production port." }
if ($Dst.Db -notlike '*_local') { throw "Refusing: target database '$($Dst.Db)' must end in _local." }
if ($Dst.Db -eq $Src.Db -and $Dst.Port -eq $Src.Port) { throw 'Refusing: target is the same as the source.' }
if ($Dst.Db -notmatch '^[A-Za-z0-9_]+$' -or $Dst.User -notmatch '^[A-Za-z0-9_]+$') {
  throw 'Refusing: local database and role names may only use letters, digits and _.'
}

$DumpDir = Join-Path $env:USERPROFILE 'Documents\olympiad-db-dumps'
New-Item -ItemType Directory -Force $DumpDir | Out-Null
$DumpFile = Join-Path $DumpDir ('prod-{0}.dump' -f (Get-Date -Format 'yyyyMMdd-HHmm'))

Write-Host ''
Write-Host 'Plan' -ForegroundColor Cyan
Write-Host ("  Read from production : {0}:{1}/{2}  (read only)" -f $Src.Host, $Src.Port, $Src.Db)
Write-Host ("  Dump file            : {0}" -f $DumpFile)
Write-Host ("  DROP and recreate    : {0}:{1}/{2}  (local copy)" -f $Dst.Host, $Dst.Port, $Dst.Db) -ForegroundColor Yellow
Write-Host ("  App role (local)     : {0}" -f $Dst.User)
Write-Host ("  Tools                : {0}" -f $Bin)
Write-Host ''
if ((Read-Host 'Type LOCAL to continue') -cne 'LOCAL') { Write-Host 'Cancelled. Nothing was changed.'; exit 1 }

$sec = Read-Host -AsSecureString ("Password of the local 'postgres' superuser on port {0}" -f $Dst.Port)
$AdminPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))

function Invoke-LocalSql([string]$db, [string]$sql) {
  $env:PGPASSWORD = $AdminPass
  & "$Bin\psql.exe" -h $Dst.Host -p $Dst.Port -U postgres -d $db -q -v ON_ERROR_STOP=1 -c $sql
  Assert-Ok "psql on local $db"
}

try {
  # Last check against the live server: the target must be a different
  # PostgreSQL server than production, not just a different port setting.
  $env:PGPASSWORD = $AdminPass
  $dstId = (& "$Bin\psql.exe" -h $Dst.Host -p $Dst.Port -U postgres -d postgres -tAc 'SELECT system_identifier FROM pg_control_system()').Trim()
  Assert-Ok 'connecting to the local server'
  # Read-only on production; the role may not be allowed to call this, in which
  # case the host/port/name guards above stand on their own.
  $env:PGPASSWORD = $Src.Pass
  $ErrorActionPreference = 'Continue'
  $srcId = (& "$Bin\psql.exe" -h $Src.Host -p $Src.Port -U $Src.User -d $Src.Db -tAc 'SELECT system_identifier FROM pg_control_system()' 2>$null)
  $srcOk = $LASTEXITCODE -eq 0
  $ErrorActionPreference = 'Stop'
  if ($srcOk -and $srcId -and "$srcId".Trim() -eq $dstId) {
    throw 'Refusing: the target port reaches the production server.'
  }

  Write-Host '==> 1/4 Dumping production (read only)' -ForegroundColor Cyan
  $env:PGPASSWORD = $Src.Pass
  # pg_dump stops on the first table the source role may not read, so leave
  # those out (read-only catalog lookup). They will be missing locally.
  $unreadable = @(& "$Bin\psql.exe" -h $Src.Host -p $Src.Port -U $Src.User -d $Src.Db -tA -c @"
SELECT quote_ident(n.nspname) || '.' || quote_ident(c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p','v','m','S')
  AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
  AND NOT has_table_privilege(current_user, c.oid, 'SELECT')
ORDER BY 1
"@) | Where-Object { $_ -and $_.Trim() }
  Assert-Ok 'listing tables (is the SSH tunnel on 127.0.0.1:5433 up?)'
  $dumpArgs = @('-h', $Src.Host, '-p', $Src.Port, '-U', $Src.User, '-d', $Src.Db,
                '--format=custom', '--no-owner', '--no-privileges', '--file', $DumpFile)
  if ($unreadable.Count -gt 0) {
    Write-Host ("    Skipping {0} table(s) the '{1}' role cannot read (they will be missing locally):" -f $unreadable.Count, $Src.User) -ForegroundColor Yellow
    $unreadable | ForEach-Object { Write-Host "      $_" -ForegroundColor Yellow }
    # A filter file avoids passing quoted "MixedCase" names on the command line.
    $filterFile = Join-Path $DumpDir 'exclude-unreadable.txt'
    $unreadable | ForEach-Object { "exclude table $_" } | Set-Content $filterFile -Encoding ascii
    $dumpArgs += "--filter=$filterFile"
  }
  & "$Bin\pg_dump.exe" @dumpArgs
  Assert-Ok 'pg_dump'
  Write-Host ('    {0} MB' -f [math]::Round((Get-Item $DumpFile).Length / 1MB, 2)) -ForegroundColor Green

  Write-Host '==> 2/4 Recreating the local database' -ForegroundColor Cyan
  Invoke-LocalSql 'postgres' "DROP DATABASE IF EXISTS $($Dst.Db) WITH (FORCE);"
  # The app connects as this role; create it (local only) if it doesn't exist yet.
  $pass = $Dst.Pass -replace "'", "''"
  Invoke-LocalSql 'postgres' ('DO $do$ BEGIN CREATE ROLE ' + $Dst.User + " LOGIN PASSWORD '$pass'; EXCEPTION WHEN duplicate_object THEN ALTER ROLE " + $Dst.User + " LOGIN PASSWORD '$pass'; END " + '$do$;')
  Invoke-LocalSql 'postgres' "CREATE DATABASE $($Dst.Db) OWNER $($Dst.User);"

  Write-Host '==> 3/4 Restoring' -ForegroundColor Cyan
  $env:PGPASSWORD = $AdminPass
  & "$Bin\pg_restore.exe" -h $Dst.Host -p $Dst.Port -U postgres -d $Dst.Db --no-owner --no-privileges $DumpFile
  if ($LASTEXITCODE -ne 0) { Write-Host "    pg_restore reported warnings (exit $LASTEXITCODE)" -ForegroundColor Yellow }

  Write-Host '==> 4/4 Handing every restored object to the app role' -ForegroundColor Cyan
  # --no-owner left everything owned by postgres; Prisma migrations need the
  # app role to OWN the tables, not just have rights on them.
  Invoke-LocalSql $Dst.Db @"
DO `$`$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT nspname FROM pg_namespace
           WHERE nspname NOT LIKE 'pg\_%' AND nspname <> 'information_schema'
  LOOP
    EXECUTE format('ALTER SCHEMA %I OWNER TO $($Dst.User)', r.nspname);
  END LOOP;
  FOR r IN SELECT schemaname AS s, tablename AS n, 'TABLE' AS k FROM pg_tables
             WHERE schemaname NOT LIKE 'pg\_%' AND schemaname <> 'information_schema'
           UNION ALL SELECT schemaname, sequencename, 'SEQUENCE' FROM pg_sequences
             WHERE schemaname NOT LIKE 'pg\_%' AND schemaname <> 'information_schema'
           UNION ALL SELECT schemaname, viewname, 'VIEW' FROM pg_views
             WHERE schemaname NOT LIKE 'pg\_%' AND schemaname <> 'information_schema'
  LOOP
    EXECUTE format('ALTER %s %I.%I OWNER TO $($Dst.User)', r.k, r.s, r.n);
  END LOOP;
END
`$`$;
"@
} finally {
  $env:PGPASSWORD = $null
  $AdminPass = $null
}

Write-Host ''
Write-Host ("Done. Local copy ready at {0}:{1}/{2}." -f $Dst.Host, $Dst.Port, $Dst.Db) -ForegroundColor Green
Write-Host 'Point the app at it:  copy .env.local-db over .env (keep .env.server for production).'
