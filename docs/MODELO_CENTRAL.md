# Modelo central de Finanzas
Actualizado: 27 de octubre de 2026.

## Tablas y relaciones
| Tabla | Campos |
|---|---|
| cuenta_cobrar | id_cxc PK, id_venta UNIQUE, monto_total, saldo_pendiente, fecha_emision, fecha_vencimiento nullable, estado |
| cuenta_pagar | id_cxp PK, id_oc UNIQUE, monto_total, saldo_pendiente, fecha_emision, fecha_vencimiento nullable, estado |
| operacion_financiera | id_operacion PK, id_cxc FK nullable, id_cxp FK nullable, id_reembolso nullable, monto, metodo_pago nullable, estado, fecha_solicitud, fecha_ejecucion nullable, descripcion nullable |
| autorizacion_financiera | id_autorizacion PK, id_operacion FK UNIQUE, id_autorizador, decision, observacion nullable, fecha_autorizacion |
| movimiento_financiero | id_mov_fin PK, id_operacion FK UNIQUE, id_cuenta FK, tipo_flujo, monto, fecha_movimiento, descripcion nullable |
| cuenta_financiera | id_cuenta PK CHECK = 1, nombre, saldo_inicial, moneda CLP, activa, fecha_apertura |

Las PK son BIGINT IDENTITY; importes NUMERIC(15,2); fechas de cuentas DATE y
fechas de operaciones TIMESTAMPTZ. Las cinco FK son internas. No hay maestros
externos dentro del esquema Finanzas.

## Reglas
- Cuentas: pendiente, parcial, pagada o anulada; el saldo coincide con el estado.
- Una venta/orden origina como máximo una cuenta.
- Operaciones: pendiente, rechazada o ejecutada; exactamente un origen no nulo.
- Métodos: efectivo, transferencia, tarjeta o simulado; obligatorio al ejecutar.
- Aprobación y ejecución son una misma transacción. El candado transaccional de
  caja se toma antes de bloquear filas; se revalidan deuda, estado, caja y saldo.
- Una operación tiene como máximo una autorización y un movimiento.
- Rechazar exige motivo. No genera movimiento.
- Se aceptan abonos parciales al saldo total; no hay cuotas ni reprogramación.
- Triggers diferidos verifican autorización, movimiento, importe, flujo y saldo.
  Los registros decididos, autorizaciones y movimientos son inmutables.
- La vista v_saldo_caja calcula saldo_inicial + ingresos - egresos.
- Caja inicial: 10.000.000 CLP. Seeds repetidos no cambian ese saldo ni duplican caja.

## Migración
06_modelo_central.sql conserva IDs, importes, movimientos y fechas históricas.
Renombra pago/id_pago a operacion_financiera/id_operacion y autorizacion_pago
a autorizacion_financiera; fecha_pago pasa a fecha_ejecucion. Los estados
ejecutado/rechazado pasan a ejecutada/rechazada. No vuelve a ejecutar pagos.
El saldo de caja se compara antes y después dentro de la misma transacción.

Se eliminan id_cliente, id_proveedor, cantidad_cuotas, las dos tablas de cuotas,
su vista y once funciones antiguas. Se crean funciones para el flujo central.
Las eliminaciones son explícitas y sin CASCADE; dependencias inesperadas abortan
la migración. No modifica otros esquemas.

Antes de migrar: respaldo completo, revisar estados y detener clientes de escritura.
La migración se detiene si encuentra nóminas, aprobados sin ejecutar, historial
inconsistente o saldos que no coinciden con pagos ejecutados. No los recategoriza
ni ejecuta automáticamente. Su tratamiento requiere una decisión del equipo.

El respaldo previo conserva el desglose de cuotas y los campos eliminados.
Para volver atrás se restaura el dump en otra base y se verifica antes de sustituir
la base de trabajo; no hay una migración inversa que reconstruya cuotas perdidas.

01, 02 y 04 permanecen como historial de instalación. Una base nueva aplica
01 → 02 → 04 → 06 y termina con seis tablas. No reaplicar scripts anteriores a 06
sobre una base migrada. No repetir 06: los renombres identifican su aplicación.

## Integración del próximo sprint
Solo se guarda id_venta, id_oc o id_reembolso. El cliente se obtiene mediante
VENTA → PEDIDO → CLIENTE y el proveedor mediante ORDEN_COMPRA → PROVEEDOR.
No se copian nombres ni RUT en descripciones como sustituto de esas relaciones.

Ahora INTEGRATION_MODE=local-fixtures valida IDs explícitos de desarrollo:
ventas 101, 5001–5010 y 7001–7012; órdenes 75 y 8001–8012; reembolsos 9001 y 9002; usuario 1.
No son registros reales de otros módulos.

El adaptador HTTP está preparado para GET {URL}/{id} con respuesta
{id: string, habilitada: boolean}. Este es un contrato propuesto, pendiente de
acordar con los equipos. URLs configurables por recurso, sin credenciales en React.
404 o habilitada=false rechazan la referencia; indisponibilidad o respuesta
incompatible devuelve 503. También se revalida el origen al aprobar.
La comprobación HTTP no es una transacción distribuida: acordar idempotencia,
reservas y eventos con los otros módulos en el siguiente sprint.

El usuario continúa siendo Administrador 1 simulado. La autenticación y autorización
reales del ERP y los destinos externos siguen pendientes de integración.
