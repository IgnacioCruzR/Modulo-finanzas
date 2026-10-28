$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location $taskRoot
$taskId = [guid]::NewGuid().ToString('N').Substring(0, 8)
$taskNetwork = "finanzas-qa-net-$taskId"
$taskPg = "finanzas-qa-pg-$taskId"
$taskApi = "finanzas-qa-api-$taskId"
$taskApiImage = 'finanzas-central-test-api'
$taskFrontImage = 'finanzas-central-test-front'
function Invoke-TaskDocker {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "Docker falló: $($args[0])" }
}
function Invoke-TaskSql($database, $file) {
  Get-Content -Raw -Encoding UTF8 -LiteralPath $file | & docker exec -i $taskPg psql -U erp_user -d $database -v ON_ERROR_STOP=1 -q
  if ($LASTEXITCODE -ne 0) { throw "SQL falló: $file" }
}
try {
  $taskSecret = @()
  if (Test-Path -LiteralPath '.npm-ca.local') { $taskSecret = @('--secret', 'id=npm_ca,src=.npm-ca.local') }
  Invoke-TaskDocker build @taskSecret -t $taskApiImage ./back
  Invoke-TaskDocker build @taskSecret --target build -t $taskFrontImage ./front
  Invoke-TaskDocker network create --internal $taskNetwork
  Invoke-TaskDocker run -d --name $taskPg --network $taskNetwork --network-alias db --tmpfs /var/lib/postgresql/data -e POSTGRES_USER=erp_user -e POSTGRES_PASSWORD=qa-local -e POSTGRES_DB=erp_local postgres:17
  $taskReady = $false
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    & docker exec $taskPg pg_isready -U erp_user -d erp_local *> $null
    if ($LASTEXITCODE -eq 0) { $taskReady=$true; break }
    Start-Sleep -Seconds 1
  }
  if (!$taskReady) { throw 'PostgreSQL de pruebas no inició.' }
  foreach ($file in @('01_schema.sql','02_operaciones.sql','04_cuotas.sql')) { Invoke-TaskSql erp_local "database/local/sql/$file" }
  Invoke-TaskSql erp_local 'back/tests/legacy_fixture.sql'
  # Copia independiente para probar que un preflight fallido revierte todo.
  Invoke-TaskDocker exec $taskPg createdb -U erp_user -T erp_local preflight_qa
  "INSERT INTO finanzas.pago(id_cxp,tipo_operacion,monto,metodo_pago) VALUES(1,'proveedor',1,'simulado'); SELECT finanzas.decidir_pago(currval(pg_get_serial_sequence('finanzas.pago','id_pago')),1,true);" | & docker exec -i $taskPg psql -U erp_user -d preflight_qa -v ON_ERROR_STOP=1 -q
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el caso aprobado.' }
  $ErrorActionPreference = 'Continue'
  $taskFailure = Get-Content -Raw database/local/sql/06_modelo_central.sql | & docker exec -i $taskPg psql -U erp_user -d preflight_qa -v ON_ERROR_STOP=1 2>&1
  $taskExit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($taskExit -eq 0 -or ($taskFailure -join ' ') -notmatch 'aprobados sin ejecutar') { throw 'El preflight no bloqueó el pago aprobado.' }
  # Verifica que la migración fallida conserve el nombre y los cinco pagos originales del caso.
  $taskCount = & docker exec $taskPg psql -U erp_user -d preflight_qa -Atc 'SELECT count(*) FROM finanzas.pago'
  if ($taskCount -ne '5') { throw 'El rollback del preflight no conservó los datos.' }
  Invoke-TaskSql erp_local 'database/local/sql/06_modelo_central.sql'
  Invoke-TaskDocker run -d --name $taskApi --network $taskNetwork -e DB_HOST=db -e DB_PORT=5432 -e DB_NAME=erp_local -e DB_USER=erp_user -e DB_PASSWORD=qa-local -e DB_SCHEMA=finanzas -e APP_ENV=local -e MOCK_AUTH_ENABLED=true -e INTEGRATION_MODE=local-fixtures -e API_HOST=0.0.0.0 $taskApiImage
  $taskReady=$false
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    & docker exec $taskApi node -e "fetch('http://127.0.0.1:3000/api/finanzas/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" *> $null
    if ($LASTEXITCODE -eq 0) { $taskReady=$true; break }
    Start-Sleep -Seconds 1
  }
  if (!$taskReady) { throw 'La API de pruebas no inició.' }
  Invoke-TaskDocker cp back/tests/central.integration.cjs "${taskApi}:/app/central.integration.cjs"
  Invoke-TaskDocker exec -e FINANZAS_TEST_ISOLATED=1 $taskApi node --test /app/central.integration.cjs
  Invoke-TaskDocker run --rm --network $taskNetwork -e "FINANZAS_TEST_API=http://${taskApi}:3000" $taskFrontImage sh -c 'node_modules/.bin/esbuild src/features/payments/cash.api.ts --bundle --platform=node --format=cjs --outfile=/tmp/cash-client.cjs && node --test tests/cash-date.cjs tests/central-flow.cjs'
  Invoke-TaskSql erp_local 'database/local/sql/07_seeders.sql'
  $taskBefore = & docker exec $taskPg psql -U erp_user -d erp_local -Atc "SELECT (SELECT count(*) FROM finanzas.operacion_financiera)||':'||saldo_actual FROM finanzas.v_saldo_caja"
  Invoke-TaskSql erp_local 'database/local/sql/07_seeders.sql'
  $taskAfter = & docker exec $taskPg psql -U erp_user -d erp_local -Atc "SELECT (SELECT count(*) FROM finanzas.operacion_financiera)||':'||saldo_actual FROM finanzas.v_saldo_caja"
  if ($taskBefore -ne $taskAfter) { throw 'El seeder no fue repetible.' }
  $taskBalanceBefore = & docker exec $taskPg psql -U erp_user -d erp_local -Atc 'SELECT saldo_actual FROM finanzas.v_saldo_caja'
  Invoke-TaskSql erp_local 'seeders_finanzas.sql'
  $taskBalanceAfter = & docker exec $taskPg psql -U erp_user -d erp_local -Atc 'SELECT saldo_actual FROM finanzas.v_saldo_caja'
  if (([decimal]::Parse($taskBalanceAfter,[cultureinfo]::InvariantCulture) - [decimal]::Parse($taskBalanceBefore,[cultureinfo]::InvariantCulture)) -ne 1175000) { throw 'El escenario de Tomas no coincide con los abonos originales.' }
  $taskBefore = & docker exec $taskPg psql -U erp_user -d erp_local -Atc "SELECT (SELECT count(*) FROM finanzas.operacion_financiera)||':'||saldo_actual FROM finanzas.v_saldo_caja"
  Invoke-TaskSql erp_local 'seeders_finanzas.sql'
  $taskAfter = & docker exec $taskPg psql -U erp_user -d erp_local -Atc "SELECT (SELECT count(*) FROM finanzas.operacion_financiera)||':'||saldo_actual FROM finanzas.v_saldo_caja"
  if ($taskBefore -ne $taskAfter) { throw 'El escenario de Tomas duplico operaciones o cambio el saldo al repetirse.' }
  Invoke-TaskDocker cp back/tests/tomas-seed.integration.cjs "${taskApi}:/app/tomas-seed.integration.cjs"
  Invoke-TaskDocker cp back/tests/tomas-seed.expected.json "${taskApi}:/app/tomas-seed.expected.json"
  Invoke-TaskDocker exec -e FINANZAS_TEST_ISOLATED=1 $taskApi node --test /app/tomas-seed.integration.cjs
  Invoke-TaskDocker run --rm --network $taskNetwork -e "FINANZAS_TEST_API=http://${taskApi}:3000" $taskFrontImage sh -c 'node_modules/.bin/esbuild src/features/payments/cash.api.ts --bundle --platform=node --format=cjs --outfile=/tmp/cash-client.cjs && node --test tests/tomas-seed-query.cjs'
  Write-Output 'Pruebas completadas: migración, API, cliente React, concurrencia y seed repetible.'
}
finally {
  $ErrorActionPreference = 'Continue'
  & docker rm -f $taskApi $taskPg 2>$null | Out-Null
  & docker network rm $taskNetwork 2>$null | Out-Null
  Pop-Location
}
