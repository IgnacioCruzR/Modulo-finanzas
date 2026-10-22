# Base de datos

Esta carpeta se reserva para los recursos de PostgreSQL del proyecto:

- `migrations/`: cambios versionados del esquema.
- `seeds/`: datos iniciales o de desarrollo.

La base indicada usa el esquema `finanzas` para el módulo financiero y permite
consultar entidades comunes del esquema `public`. El documento de referencia
disponible no detalla las tablas ni sus columnas; agregar migraciones cuando se
confirme el diseño del esquema.
