# Base de datos

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
