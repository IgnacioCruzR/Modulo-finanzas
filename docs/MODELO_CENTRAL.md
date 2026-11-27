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

## Validación de referencias externas

Consultar `cuenta_cobrar` o `cuenta_pagar` para validar el origen hacía que el
alta exigiera una cuenta ya existente. El mismo modo también daba por válidos
los reembolsos y usuarios sin verificarlos. Finanzas conserva las referencias
externas y la restricción local de unicidad de la cuenta por origen.

`IntegracionExternaService` valida el identificador y delega la comprobación
en uno de cuatro adaptadores de lectura. NestJS selecciona una instancia por
módulo a partir de la configuración. Los adaptadores controlan la consulta y
traducen las respuestas a resultados de validación. Finanzas aplica su contrato
HTTP y ejecuta las escrituras de caja en la transacción local, después de la
validación. La fuente puede cambiar el estado del origen entre la consulta y
la confirmación local. Cualquier garantía entre módulos requiere un acuerdo.

### Contratos observados y pendientes

Los enlaces apuntan a las revisiones inspeccionadas de la rama principal.

| Módulo | Implementación observada | Pendiente para un adaptador real |
|---|---|---|
| E-Commerce y Ventas | `GET /api/pedidos/cliente/:idCliente/:idPedido` exige la sesión del cliente y devuelve `success`, `persistence` y `pedido`. La lectura usa `ecommerce_ventas.ecom_pedido` y `ecom_detalle_pedido`. [Ruta](https://github.com/benjatorress/LesGo-ECommerce/blob/671f368e41a250af4723333614e13d203588e800/backend/routes/pedidosRoutes.js#L6), [respuesta](https://github.com/benjatorress/LesGo-ECommerce/blob/671f368e41a250af4723333614e13d203588e800/backend/controllers/pedidosController.js#L102), [consulta](https://github.com/benjatorress/LesGo-ECommerce/blob/671f368e41a250af4723333614e13d203588e800/backend/services/pedidosService.js#L48). | Confirmar quién expone `id_venta`, cómo se vincula con `id_pedido`, qué estado permite cobrar y qué identidad de servicio tiene acceso. Postventa ya trata ambos ID como campos distintos. [Consulta de Postventa](https://github.com/JOT4JOT4/postventa/blob/297be51456ac65a58e8efd225596051bbca9fb63/backend/src/requests/database-purchase.gateway.ts#L14). |
| Compras | `GET /api/solicitudes/:id` entrega el detalle de una solicitud con sus controles de acceso. `compras.compras_oc` tiene `id_oc` y `estado`. El módulo de órdenes registra entidades y carece de controlador REST en la revisión consultada. [Solicitudes](https://github.com/BrunoPrun0/compras_SI2/blob/b648f8194bd6d77eb82157c628803db6117be27e/backend/src/solicitudes/solicitudes.controller.ts#L52), [entidad](https://github.com/BrunoPrun0/compras_SI2/blob/b648f8194bd6d77eb82157c628803db6117be27e/backend/src/ordenes/orden.entity.ts#L3), [módulo](https://github.com/BrunoPrun0/compras_SI2/blob/b648f8194bd6d77eb82157c628803db6117be27e/backend/src/ordenes/ordenes.module.ts#L6). | Acordar una consulta por `id_oc` y los estados que habilitan registrar o pagar la obligación. |
| Postventa | `GET /postventa/solicitudes/:id/reembolsos` recibe `id_reclamo`, devuelve `[]` o una lista con `id`, `caseId`, `purchaseId`, `customerId`, `amount`, `status` y `requestedAt`. La migración vincula `reembolso.id_reembolso` al reclamo y solo contempla el estado `Pendiente`. [Ruta](https://github.com/JOT4JOT4/postventa/blob/297be51456ac65a58e8efd225596051bbca9fb63/backend/src/refunds/refunds.controller.ts#L6), [respuesta](https://github.com/JOT4JOT4/postventa/blob/297be51456ac65a58e8efd225596051bbca9fb63/backend/src/refunds/refund-reader.ts#L5), [DDL](https://github.com/JOT4JOT4/postventa/blob/297be51456ac65a58e8efd225596051bbca9fb63/backend/src/database/migrations/1794652800000-CreateRefundRequests.ts#L5). | Acordar cómo consultar con `id_reembolso`, qué significa `Pendiente` para ejecutar un egreso y cómo autenticar a Finanzas. |
| RRHH | `POST /auth/login` devuelve `{ accessToken, user }` y el JWT distingue el origen `demo` o `db`. La verificación interna relee `rrhh.usuario`, por `id_empleado`, junto con el rol y el estado de la cuenta. `GET /hr/dashboard` requiere JWT y sirve al tablero de RRHH. [Autenticación](https://github.com/Pabluntt/Lesgo-RRHH/blob/88f8efae80e99c9c31bea9a782980968a1b3ff4e/backend/src/auth/auth.service.ts#L44), [verificación](https://github.com/Pabluntt/Lesgo-RRHH/blob/88f8efae80e99c9c31bea9a782980968a1b3ff4e/backend/src/auth/auth.service.ts#L78), [tabla](https://github.com/Pabluntt/Lesgo-RRHH/blob/88f8efae80e99c9c31bea9a782980968a1b3ff4e/sql/03_usuario.sql#L4), [tablero](https://github.com/Pabluntt/Lesgo-RRHH/blob/88f8efae80e99c9c31bea9a782980968a1b3ff4e/backend/src/hr/hr.controller.ts#L36). | Acordar autenticación del actor, identidad verificable y el permiso específico para decidir operaciones de Finanzas. El alcance de RRHH en esta fase se limita a identidad y permisos. |

La selección por recurso, los fixtures y los códigos públicos están en la
[configuración de la API](../back/Finanzas/v2/README.md#validación-externa).
