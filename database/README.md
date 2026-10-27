# Base de datos
Modelo activo: seis tablas internas, cinco FK internas y v_saldo_caja.
Ver [modelo](../docs/MODELO_CENTRAL.md) y [uso local](local/USO_LOCAL.md).

Los scripts local/sql/01_schema.sql, 02_operaciones.sql y 04_cuotas.sql son
historial. 06_modelo_central.sql migra conservando registros y saldo, y retira
cuotas y referencias redundantes. 07_seeders.sql carga fixtures repetibles.
No ejecutar migraciones de database/migrations/ ni back/Finanzas/sql/ sobre
la base actual: pertenecen al modelo anterior. No crear maestros externos aquí.
