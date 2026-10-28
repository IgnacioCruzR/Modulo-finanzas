# Cuotas retiradas
El modelo central aprobado ya no gestiona cuotas. La migración 06_modelo_central.sql
elimina cuota, aplicacion_pago_cuota, v_cuotas, cantidad_cuotas y funciones auxiliares.
04_cuotas.sql se conserva exclusivamente como historial de migraciones.
Los abonos siguen permitidos contra el saldo total de la obligación.
Consultar [modelo activo](../../docs/MODELO_CENTRAL.md).
