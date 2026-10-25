# Base local del módulo Finanzas

La configuración activa para esta base es `compose.yaml` en la raíz del repositorio.
Ejecutar los comandos desde esa raíz. El Compose anterior de `back/` corresponde
al modelo anterior y no debe utilizarse para inicializar esta base.

## Arranque

Se requiere Docker Desktop con contenedores Linux. Copiar `.env.example` a `.env`
si no existe y definir una contraseña local; usar el mismo valor en
`POSTGRES_PASSWORD` y `DB_PASSWORD`. No versionar `.env`.

```powershell
docker compose up -d --wait
docker compose ps
```

Conexión desde DBeaver o una aplicación ejecutada en el equipo:

- Host: `localhost`
- Puerto: `15433`
- Base: `erp_local`
- Usuario: `erp_user`
- Contraseña: `POSTGRES_PASSWORD` del archivo `.env`
- Esquema: `finanzas`
- SSL local: desactivado

El mismo Compose levanta el frontend en **http://localhost:8080** y la API en
`http://localhost:3000/api/finanzas`.
La API conserva solo consultas GET y el usuario mock Administrador 1. Los DTO y
payloads siguen como contrato para implementar las escrituras. El frontend volvió
a la demostración original del equipo y no modifica PostgreSQL. Se conservaron
todas las tablas, cuotas, aplicaciones, funciones y datos.

## Reconstruir frontend y backend

En una red con certificados habituales:

```powershell
docker compose up -d --build --wait
```

En este equipo la descarga npm requiere la CA pública de confianza de Windows,
guardada en `.npm-ca.local` (ignorada por Git). Se entrega a la compilación
mediante secreto BuildKit; no se copia a las imágenes ni se desactiva TLS:

```powershell
docker compose -f compose.yaml -f compose.ca.yaml build
docker compose up -d --no-build --wait
```

Los tres servicios solo publican puertos en localhost. El frontend utiliza
`/api/finanzas` y Nginx reenvía la petición a `api:3000` dentro de Docker.
No se configuran credenciales PostgreSQL en React.

## Estado de la reversión parcial

Se retiraron el formulario conectado, los POST del modelo v2 y las suites
automatizadas añadidas. La implementación completa previa está en
`respaldo-reversion.local/implementacion-actual.zip`; no contiene credenciales.
El código original de los compañeros se mantiene.

Los endpoints GET pueden consultarse por el puerto 8080 bajo /api/finanzas.
Las tareas transaccionales y E2E quedan para el equipo; no hay una suite activa
de pagos en este estado. El escenario SQL opcional del ZIP se conserva como
parte de la base local, no como seeder alineado con maestros ni prueba E2E.

## Inicialización y persistencia

Se cargan `sql/01_schema.sql`, `sql/02_operaciones.sql` y `sql/04_cuotas.sql`
únicamente al crear un volumen vacío. El modelo base tiene seis tablas y la
ampliación de cuotas agrega dos tablas más. Incluyen funciones, vistas y una caja
inicial de 10.000.000 CLP. `sql/03_pruebas.sql` no se carga automáticamente.
Ver [CUOTAS.md](CUOTAS.md) para la recepción de total/cantidad y los abonos.
No se aplican las migraciones del modelo anterior.

```powershell
docker compose exec -T postgres psql -U erp_user -d erp_local -c "SELECT * FROM finanzas.v_saldo_caja;"
docker compose stop
docker compose start
```

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

Solo en una base recién inicializada y una única vez; modifica datos locales.
En PowerShell:

```powershell
Get-Content -Raw database/local/sql/03_pruebas.sql | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U erp_user -d erp_local
```

Los archivos `README.md`, `sql/` y `json/` de esta carpeta proceden del ZIP
`erp_finanzas_v2_docker.zip`; las instrucciones de rutas del README original
corresponden al paquete original. Para este repositorio utilizar este documento.
Esta configuración no se conecta a la base compartida del profesor.
