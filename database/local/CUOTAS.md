# Cuotas: alcance acordado

## Estado después de la reversión parcial

La base conserva todo lo descrito aquí: cuotas, aplicaciones, funciones y datos.
La API activa es de solo consulta; los POST y el formulario conectado quedaron
pendientes para el equipo. Los ejemplos de recepción siguientes son el contrato
previsto, no rutas de escritura actualmente disponibles.

Finanzas recibe el total y la cantidad de cuotas junto con las referencias
existentes de la operación. Las condiciones comerciales pertenecen a Compras
o Ventas; el formulario manual solo permite probar esa recepción. Todavía no
existe comunicación automática con los otros módulos.

## Registro

No se agrega una tabla de planes: al no permitir reprogramaciones, cada cuenta
guarda `cantidad_cuotas` y tiene un solo desglose fijo. Se agregan dos tablas:

- `finanzas.cuota`: cuenta por cobrar O cuenta por pagar, número y monto.
- `finanzas.aplicacion_pago_cuota`: pago ejecutado, cuota e importe aplicado.

`v_cuotas` calcula lo abonado, el saldo y el estado desde las aplicaciones; no
duplica saldos de cuotas en columnas editables. Las seis tablas originales se
mantienen. Las cuentas existentes se conservaron con una cuota y se asignaron
sus pagos históricos ejecutados sin volver a mover caja.

El total se divide en importes iguales a dos decimales, con el residuo de centavos
en la última cuota. Cada cuota debe tener al menos 0,01. La cantidad es un entero
positivo compatible con SMALLINT (hasta 32767); si se omite vale 1. No se calculan
intereses ni recargos. No se reciben ni inventan vencimientos individuales:
«más antigua» significa menor número de cuota pendiente, no mora por fecha.
El vencimiento opcional de la cuenta se conserva como dato general.

Ejemplo del contrato para simular la recepción desde Compras:

```http
POST /api/finanzas/cuentas-pagar
Content-Type: application/json
```

```json
{
  "id_oc": 9001,
  "id_proveedor": 12,
  "monto_total": 300000,
  "cantidad_cuotas": 3
}
```

Para Ventas se usa `/cuentas-cobrar` con `id_venta` e `id_cliente`.
No se exige enviar importe por cuota, calendario o intereses.
Las referencias externas siguen siendo lógicas y de prueba.

## Abonos y autorización

El usuario puede solicitar cualquier importe positivo hasta el saldo total
pendiente, aunque no coincida con el importe de una cuota. Solicitar y autorizar
no aplican abonos. Solo `ejecutar_pago` asigna el importe primero a la cuota
pendiente de menor número y continúa con las siguientes si sobra dinero.

Ejemplo: 300.000 en tres cuotas de 100.000, abono de 150.000:

| Cuota | Abonado | Pendiente |
|---|---:|---:|
| 1 | 100.000 | 0 |
| 2 | 50.000 | 50.000 |
| 3 | 0 | 100.000 |

Se autoriza y ejecuta el pago, no cada aplicación a cuotas por separado. Se
registra un solo movimiento de caja por pago. Asignaciones, saldo total, estado
y movimiento se confirman en una misma transacción. Las restricciones diferidas
comprueban que los importes aplicados, las cuotas y los saldos coincidan.

No hay endpoints de reprogramación. Triggers bloquean cambios de total, cantidad
de cuotas, importes y numeración después del registro. La base conserva las FK
internas y rechaza aplicaciones a cuotas de otra cuenta, pagos sin ejecutar,
importes excesivos y aplicaciones incompletas al confirmar la transacción.
Como antes, un propietario SQL puede eliminar registros o cambiar el esquema;
el usuario de la aplicación no constituye un sistema de permisos reales.

## Consulta

- `GET /cuentas-pagar/:id` y `GET /cuentas-cobrar/:id` agregan `cuotas` al detalle.
- El listado de cuentas incluye `cantidad_cuotas`.
- `GET /pagos/:id` agrega `aplicaciones` con número e importe por cuota.
- La consulta de cuotas por interfaz queda pendiente; se restauró la pantalla
  demostrativa original del equipo.

## Migración y pruebas

La migración es `sql/04_cuotas.sql`: contiene su propia transacción, adapta
históricos y reemplaza `ejecutar_pago` para incorporar las aplicaciones. En un
volumen nuevo Compose carga 01, 02 y 04 automáticamente; 03 sigue siendo una
prueba manual. No volver a cargar 02 por separado sobre una base con cuotas.

Para una instalación existente autorizada, respaldar primero y ejecutar:

```powershell
Get-Content -Raw database/local/sql/04_cuotas.sql | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U erp_user -d erp_local
```

En este equipo ya se aplicó. Se conservó un respaldo previo en
`database/backups/antes-cuotas.dump`, excluido de Git. No es necesario borrar el
volumen ni reinicializar PostgreSQL.

Antes de la reversión se comprobaron abonos libres, distribución entre cuotas,
centavos, bloqueo de reprogramaciones, concurrencia e instalación desde cero.
Las suites añadidas se archivaron con la implementación anterior; las pruebas
E2E activas quedan pendientes para el equipo. Este documento describe soporte
de base de datos y no implica que el frontend actual esté conectado.
