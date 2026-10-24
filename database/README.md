# Base de datos

## Modelo activo

El modelo aprobado está en `local/sql/`: seis tablas originales más dos tablas
para cuotas/aplicaciones, funciones y vistas. Ver [CUOTAS.md](local/CUOTAS.md).
Usar el Compose de la raíz y consultar [USO_LOCAL.md](local/USO_LOCAL.md).
El frontend de demostración está en http://localhost:8080 y la base en localhost:15433.
La API conserva solo consultas GET; las escrituras desde la aplicación quedan
pendientes para el equipo. No se revirtieron datos, cuotas ni funciones SQL.

## Modelo anterior (referencia)

Los scripts de `migrations/` que se describen a continuación pertenecen al modelo
anterior; no se ejecutan sobre la base v2.

Esta carpeta se reserva para los recursos de PostgreSQL del proyecto:

- `migrations/`: cambios versionados del esquema.
- `seeds/`: datos iniciales o de desarrollo.

La migración `20261023_outgoing_payments.sql` agrega tablas para obligaciones
salientes y su registro transaccional. No se ejecuta automáticamente y no elimina
ni modifica las tablas existentes. Revísala y ejecútala solo en una base autorizada
después de confirmar el esquema destino. No incluye obligaciones de demostración.

La base indicada usa el esquema `finanzas` para el módulo financiero y permite
consultar entidades comunes del esquema `public`. El documento de referencia
disponible no detalla las tablas ni sus columnas; agregar migraciones cuando se
confirme el diseño del esquema.
