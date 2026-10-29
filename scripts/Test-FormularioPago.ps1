$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
$taskId = [guid]::NewGuid().ToString('N').Substring(0, 8)
$taskNetwork = "finanzas-form-net-$taskId"
$taskPg = "finanzas-form-pg-$taskId"
$taskApi = "finanzas-form-api-$taskId"
function Invoke-TaskDocker {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "Docker fallo: $($args[0])" }
}
try {
  $taskSecret = @()
  if (Test-Path '.npm-ca.local') { $taskSecret = @('--secret','id=npm_ca,src=.npm-ca.local') }
  Invoke-TaskDocker build @taskSecret -t finanzas-form-test-api ./back
  Invoke-TaskDocker build @taskSecret --target build -t finanzas-form-test-front ./front
  Invoke-TaskDocker network create --internal $taskNetwork
  Invoke-TaskDocker run -d --name $taskPg --network $taskNetwork --network-alias db --tmpfs /var/lib/postgresql/data -e POSTGRES_USER=erp_user -e POSTGRES_PASSWORD=qa-local -e POSTGRES_DB=erp_local postgres:17
  $taskReady=$false
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    & docker exec $taskPg pg_isready -U erp_user -d erp_local *> $null
    if ($LASTEXITCODE -eq 0) { $taskReady=$true; break }
    Start-Sleep -Seconds 1
  }
  if (!$taskReady) { throw 'No inicio PostgreSQL efimero.' }
  foreach ($file in @('database/local/sql/01_schema.sql','database/local/sql/02_operaciones.sql','database/local/sql/04_cuotas.sql','database/local/sql/06_modelo_central.sql','seeders_finanzas.sql')) {
    Get-Content -Raw -Encoding UTF8 $file | & docker exec -i $taskPg psql -U erp_user -d erp_local -v ON_ERROR_STOP=1 -q
    if ($LASTEXITCODE -ne 0) { throw "Fallo SQL: $file" }
  }
  "INSERT INTO finanzas.cuenta_pagar(id_oc,monto_total,saldo_pendiente) VALUES(7001,98000,98000);" | & docker exec -i $taskPg psql -U erp_user -d erp_local -v ON_ERROR_STOP=1 -q
  if ($LASTEXITCODE -ne 0) { throw 'Fallo el fixture de Compras.' }
  Invoke-TaskDocker run -d --name $taskApi --network $taskNetwork -e DB_HOST=db -e DB_PORT=5432 -e DB_NAME=erp_local -e DB_USER=erp_user -e DB_PASSWORD=qa-local -e DB_SCHEMA=finanzas -e DB_SSL=false -e APP_ENV=local -e MOCK_AUTH_ENABLED=true -e INTEGRATION_MODE=local-fixtures -e API_HOST=0.0.0.0 finanzas-form-test-api
  $taskReady=$false
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    & docker exec $taskApi node -e "fetch('http://127.0.0.1:3000/api/finanzas/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" *> $null
    if ($LASTEXITCODE -eq 0) { $taskReady=$true; break }
    Start-Sleep -Seconds 1
  }
  if (!$taskReady) { throw 'No inicio la API efimera.' }
  Invoke-TaskDocker run --rm --network $taskNetwork -e "FINANZAS_TEST_API=http://${taskApi}:3000" finanzas-form-test-front sh -c 'node_modules/.bin/esbuild src/features/payments/paymentRequest.validation.ts --bundle --platform=node --format=cjs --outfile=/tmp/payment-validation.cjs && node_modules/.bin/esbuild src/features/payments/paymentRequest.api.ts --bundle --platform=node --format=cjs --outfile=/tmp/payment-api.cjs && node --test tests/payment-request.integration.cjs'
}
finally {
  $ErrorActionPreference='Continue'
  & docker rm -f $taskApi $taskPg 2>$null | Out-Null
  & docker network rm $taskNetwork 2>$null | Out-Null
  Pop-Location
}
