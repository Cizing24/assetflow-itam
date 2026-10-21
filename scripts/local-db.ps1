param([switch]$Stop)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pgBin = if ($env:PG_BIN) { $env:PG_BIN } else { 'C:\Program Files\PostgreSQL\18\bin' }
$localRoot = Join-Path $projectRoot '.local'
$dataPath = Join-Path $localRoot 'postgres'
if (!(Test-Path (Join-Path $pgBin 'pg_ctl.exe'))) { throw 'Install PostgreSQL or set PG_BIN to its bin directory.' }
if ($Stop) { & "$pgBin\pg_ctl.exe" -D $dataPath stop -m fast; exit $LASTEXITCODE }
New-Item -ItemType Directory -Force $localRoot | Out-Null
if (!(Test-Path (Join-Path $dataPath 'PG_VERSION'))) {
  $pwPath = Join-Path $localRoot 'init-password'
  [IO.File]::WriteAllText($pwPath, 'assetflow_local_only')
  try { & "$pgBin\initdb.exe" -D $dataPath -U assetflow --pwfile=$pwPath --auth=scram-sha-256 --encoding=UTF8 --locale=C; if ($LASTEXITCODE -ne 0) { throw 'initdb failed' } }
  finally { Remove-Item -LiteralPath $pwPath -ErrorAction SilentlyContinue }
}
& "$pgBin\pg_ctl.exe" -D $dataPath status *> $null
if ($LASTEXITCODE -ne 0) { & "$pgBin\pg_ctl.exe" -D $dataPath -l (Join-Path $localRoot 'postgres.log') -o '-h 127.0.0.1 -p 55432' -w start; if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL start failed' } }
$env:PGPASSWORD = 'assetflow_local_only'
try {
  foreach ($database in @('assetflow', 'assetflow_test')) {
    $exists = & "$pgBin\psql.exe" -h 127.0.0.1 -p 55432 -U assetflow -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$database'"
    if ($exists -ne '1') { & "$pgBin\createdb.exe" -h 127.0.0.1 -p 55432 -U assetflow $database; if ($LASTEXITCODE -ne 0) { throw 'createdb failed' } }
  }
} finally { Remove-Item Env:PGPASSWORD }
Write-Output 'Isolated PostgreSQL ready on 127.0.0.1:55432 (development + test databases).'
