# Uso local
## Base compartida del profesor (Neon)
Con las credenciales de Neon en el .env privado y DB_SSL=true, iniciar solamente
el Compose principal, sin compose.local.yaml:

```powershell
docker compose up -d --build --wait
```

El frontend sigue en localhost:8080, pero las consultas y operaciones usan la base
compartida si2_22026, esquema finanzas. No versionar ni compartir el .env en Git.
La configuracion local previa de este equipo esta respaldada en un archivo
.env.local-before-neon-*.bak, tambien excluido de Git. El volumen local se conserva.
Para volver al PostgreSQL local, usar el complemento del apartado siguiente;
este mantiene su clave local en POSTGRES_PASSWORD y no necesita copiar datos de Neon.
Los pasos de migracion y seeders de esta guia corresponden al entorno local:
el cambio de conexion a Neon no requiere ejecutarlos sobre la base compartida.

## Arranque local con el Compose actual
El Compose base ahora usa el servidor indicado por DB_HOST (por ejemplo Neon) y
no define PostgreSQL. Para usar la base local conservada, agregar compose.local.yaml:

```powershell
docker compose -f compose.yaml -f compose.local.yaml up -d --build --wait
```

Si este equipo requiere su CA publica durante npm:

```powershell
docker compose -f compose.yaml -f compose.local.yaml -f compose.ca.yaml build
docker compose -f compose.yaml -f compose.local.yaml up -d --no-build --wait
```

El complemento reutiliza finanzas-local_pg_finanzas_v2, conserva los datos y
configura la API hacia postgres:5432. Para comandos de postgres descritos abajo,
usar siempre `docker compose -f compose.yaml -f compose.local.yaml` en lugar de
`docker compose`. Las instrucciones antiguas sobre cuotas/05_seeders.sql que
persisten mas abajo son del modelo anterior: no aplicarlas sobre las seis tablas.

Usar compose.yaml de la raíz. El Compose de back/ pertenece al modelo anterior.

## Arranque
Docker Desktop con contenedores Linux. Copiar .env.example a .env y configurar
POSTGRES_PASSWORD y DB_PASSWORD con la misma contraseña. No versionar .env.

```powershell
docker compose up -d --build --wait
```

Si npm necesita la CA pública local del equipo:
```powershell
docker compose -f compose.yaml -f compose.ca.yaml build
docker compose up -d --no-build --wait
```
.npm-ca.local no se versiona ni se incluye en las imágenes.

Frontend http://localhost:8080; API http://localhost:3000/api/finanzas.
PostgreSQL localhost:15433, base erp_local, esquema finanzas, usuario erp_user,
contraseña POSTGRES_PASSWORD de .env. Dentro de Docker: postgres:5432.
Todo publicado solo en localhost; la base del profesor no está conectada.

## Actualizar una base existente
Respaldar antes y detener clientes que escriben. No borrar el volumen.
```powershell
docker compose stop api frontend
docker compose exec -T postgres pg_dump -U erp_user -d erp_local -Fc -f /tmp/antes-central.dump
New-Item -ItemType Directory -Force database/backups
docker compose cp postgres:/tmp/antes-central.dump database/backups/antes-central.dump
Get-Content -Raw database/local/sql/06_modelo_central.sql | docker compose exec -T postgres psql -U erp_user -d erp_local -v ON_ERROR_STOP=1
```
Revisar el código de salida de psql: si falla no iniciar la API nueva.
Reconstruir e iniciar los tres servicios cuando la migración haya confirmado.
No repetir 06 sobre una base ya migrada. Detalles y bloqueos en
[MODELO_CENTRAL.md](../../docs/MODELO_CENTRAL.md).

Una instalación nueva aplica 01, 02, 04 y 06 automáticamente; termina con seis
tablas. Los scripts anteriores son historial y no deben reaplicarse después.

## Datos de desarrollo
```powershell
Get-Content -Raw database/local/sql/07_seeders.sql | docker compose exec -T postgres psql -U erp_user -d erp_local -v ON_ERROR_STOP=1
```
No se ejecutan automáticamente. Crea 12 cuentas de cada tipo y, en una instalación
vacía, 24 operaciones, 20 autorizaciones y 16 movimientos. Es repetible: omite
orígenes ya existentes, no reinicia la caja ni duplica operaciones.
La caja tiene una fila por diseño; los IDs externos son fixtures, no maestros reales.
03_pruebas.sql conserva el mismo escenario general que 07_seeders.sql.

## Diez registros originales de Tomas
seeders_finanzas.sql, en la raiz, recupera su escenario del commit bdf3acd:
ventas 5001-5010, diez cuentas por cobrar, diez operaciones ejecutadas, diez
autorizaciones y diez movimientos de ingreso. Conserva los totales, abonos y
metodos originales; no fuerza IDs ni utiliza cuotas o datos personales.

El volumen `finanzas-local_pg_finanzas_v2` conserva los datos al detener o recrear
el contenedor. No utilizar `docker compose down -v` para la operación habitual:
elimina los datos. Cambios posteriores de SQL requieren migraciones revisadas.

## Seeders de desarrollo

`sql/05_seeders.sql` carga al menos 10 registros en cada tabla del modelo v2:
12 cuentas por cobrar, 12 por pagar, sus cuotas, 24 pagos en todos los estados,
20 autorizaciones, 14 movimientos y 16 aplicaciones a cuotas. Los pagos pasan por
`decidir_pago` y `ejecutar_pago`, por lo que saldos, estados y caja quedan
coherentes. `cuenta_financiera` mantiene una sola fila por la restricción
`ck_caja_unica`. El script no se carga automáticamente y se detiene sin cambios
si ya se aplicó. Si también se usan `03_pruebas.sql` o el `seeders_finanzas.sql`
de la raíz, hay que ejecutarlos antes, porque ambos asumen IDs fijos desde 1.
En PowerShell:

```powershell
Get-Content -Raw database/local/sql/05_seeders.sql | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U erp_user -d erp_local
```

## Escenario opcional de demostración
```powershell
Get-Content -Raw seeders_finanzas.sql | docker compose exec -T postgres psql -U erp_user -d erp_local -v ON_ERROR_STOP=1
```

Solo cargar en desarrollo local, despues de 06. No se ejecuta automaticamente.
Al cargarlo por primera vez aumenta la caja en 1.175.000 CLP; no reinicia su saldo
inicial. Al repetirlo verifica que las ventas existentes correspondan al escenario
y no crea otro abono. Si encuentra un origen incompatible revierte toda la carga.
Las fechas de solicitud conservan la antiguedad relativa original. La autorizacion
y ejecucion se registran en el momento real de carga, sin alterar historicos.
El script termina mostrando las diez operaciones. En la interfaz, limpiar los
filtros de fecha si alguna solicitud pertenece al mes anterior.

## Comprobación
```powershell
docker compose ps
docker compose exec -T postgres psql -U erp_user -d erp_local -c "SELECT * FROM finanzas.v_saldo_caja;"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Test-ModeloCentral.ps1
```
Las pruebas crean y eliminan sus propios contenedores efímeros; no usan el volumen.
El volumen finanzas-local_pg_finanzas_v2 conserva datos. No usar down -v.
