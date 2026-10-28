# Módulo Finanzas
React + TypeScript + Vite, NestJS + TypeORM y PostgreSQL 17.

## Modelo activo
Seis tablas internas en el esquema `finanzas`: `cuenta_cobrar`, `cuenta_pagar`,
`operacion_financiera`, `autorizacion_financiera`, `movimiento_financiero` y
`cuenta_financiera`. Sin cuotas ni nóminas. Una aprobación ejecuta inmediatamente
la operación dentro de una transacción; un rechazo no mueve caja.

- [Modelo y migración](docs/MODELO_CENTRAL.md)
- [API y contratos](back/Finanzas/v2/README.md)
- [Arranque local](database/local/USO_LOCAL.md)

## Docker
Copiar `.env.example` a `.env` y definir la misma contraseña en
`POSTGRES_PASSWORD` y `DB_PASSWORD`. No versionar `.env`.

```powershell
docker compose up -d --build --wait
```

Frontend: http://localhost:8080. API: http://localhost:3000/api/finanzas.
PostgreSQL: localhost:15433, base `erp_local`, usuario `erp_user`.
Para una base existente aplicar primero la migración descrita en la guía local.
No borrar el volumen para actualizar.

Administrador 1 e integración mediante fixtures son exclusivos del entorno local.
La base del profesor no está conectada. Dashboard, reportes y configuración
conservan sus demostraciones; Gestión de caja usa la API y PostgreSQL.

## Pruebas
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Test-ModeloCentral.ps1
```
La suite crea su propia red interna y PostgreSQL efímero, sin puertos publicados,
y los elimina al finalizar. No modifica el volumen del proyecto.

## Estructura
- `front/`: interfaz y cliente HTTP.
- `back/Finanzas/v2/`: módulo activo; se conserva el nombre de carpeta por compatibilidad.
- `database/local/sql/`: historial SQL, migración y seeds.
- `scripts/`: verificación aislada.
Los módulos antiguos de `back/Finanzas/` no se registran en AppModule.
