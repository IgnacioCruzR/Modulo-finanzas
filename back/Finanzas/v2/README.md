# API de Finanzas: modelo central
La carpeta mantiene su nombre v2; el modelo activo tiene seis tablas y no usa cuotas.
Prefijo: `/api/finanzas`. BIGINT y NUMERIC se devuelven como cadenas.

| Método | Ruta | Uso |
|---|---|---|
| GET | /salud | Verifica el modelo activo y la conexión sin credenciales |
| GET | /usuario | Administrador 1 local |
| GET, POST | /cuentas-cobrar | Consultar o recibir una obligación de Ventas |
| GET | /cuentas-cobrar/:id | Detalle |
| GET, POST | /cuentas-pagar | Consultar o recibir una obligación de Compras |
| GET | /cuentas-pagar/:id | Detalle |
| GET, POST | /operaciones | Consultar o solicitar operación |
| GET | /operaciones/:id | Incluye autorización y movimiento |
| POST | /operaciones/:id/decision | Rechazar o aprobar y ejecutar atómicamente |
| GET | /caja/saldo | Vista de saldo |
| GET | /movimientos | Movimientos confirmados |

Se retiran /pagos y /pagos/:id/ejecutar. No existe ejecución separada.
Los consumidores deben actualizar rutas, id_operacion, fecha_ejecucion y estados.

## Payloads
Cuenta por cobrar: `{"id_venta":7001,"monto_total":100000}`.
Cuenta por pagar: `{"id_oc":8001,"monto_total":200000}`.
Ambas admiten fecha_emision y fecha_vencimiento (YYYY-MM-DD). El saldo inicial
es el total y el estado pendiente. No aceptan terceros, cuotas, saldo ni estado.

Operación: `{"id_cxp":1,"monto":1000,"metodo_pago":"transferencia","descripcion":"Abono a orden de compra"}`.
Exactamente uno de id_cxc/id_cxp/id_reembolso; los otros pueden omitirse o ser null,
nunca cero. Sin tipo_operacion ni nómina. Monto positivo, hasta dos decimales.
Método opcional al solicitar; obligatorio para ejecutar.

Aprobar: `{"decision":"aprobada"}`, o agregar metodo_pago si estaba pendiente.
Rechazar: `{"decision":"rechazada","observacion":"Motivo"}`.
El autorizador viene de la sesión; no se admite en el cuerpo. Campos desconocidos
se rechazan. Una segunda decisión devuelve 409 y no duplica movimientos.

Filtros de cuentas: estado y venta/orden_compra. De operaciones: estado
(pendiente/rechazada/ejecutada) y origen (cobro/proveedor/reembolso).

Las creaciones devuelven `201` y las decisiones `200`. Las rutas de negocio
devuelven `403` cuando la autenticación de prueba no está habilitada.

## Entorno
Node 22 y PostgreSQL 17. Configuración .env en back/ o raíz; synchronize=false.
El Administrador 1 requiere `MOCK_AUTH_ENABLED=true`, `APP_ENV=local` o `test`,
y la base `erp_local` en `localhost`, `127.0.0.1`, `::1`, `postgres` o `db`.
Fuera de ese entorno, salud informa `autenticacion: "no-configurada"`.
La autenticación real del actor queda pendiente del contrato con RRHH.

## Validación externa

`INTEGRATION_MODE=local-fixtures` usa los siguientes IDs, con los mismos
requisitos de entorno y base del administrador simulado.

| Recurso | IDs de prueba | Prefijo de configuración |
|---|---|---|
| Venta | 101, 5001–5010, 7001–7012 | `INTEGRATION_VENTA` |
| Orden de compra | 75, 7001, 8001–8012 | `INTEGRATION_ORDEN_COMPRA` |
| Reembolso | 9001, 9002 | `INTEGRATION_REEMBOLSO` |
| Usuario habilitado para decidir operaciones | 1 | `INTEGRATION_USUARIO` |

`INTEGRATION_MODE=http` es el modo predeterminado. Cada recurso sin adaptador
seleccionado devuelve `503`. Si existe un puente confirmado que implementa el
contrato histórico de Finanzas, configura `<PREFIJO>_ADAPTER=http-bridge` y
`<PREFIJO>_URL` con su URL base. El puente hace `GET {URL}/{id}` y verifica
`200 application/json` con `{ "id": "<id solicitado>", "habilitada": true }`.
La URL base sola deja pendiente el adaptador. La selección se puede hacer por
módulo también en local, manteniendo los fixtures en los demás recursos.
`INTEGRATION_TIMEOUT_MS` admite de 1 a 30000 ms y el valor predeterminado es
5000 ms. El plazo abarca la consulta y la lectura de la respuesta.

| HTTP de Finanzas | Significado |
|---|---|
| `400` | ID o referencia externa inválida. Una referencia externa inexistente conserva el `400` que espera la API, incluso si el puente devuelve `404`. |
| `404` | Cuenta u operación interna inexistente. |
| `409` | Conflicto de negocio, como una referencia existente e inhabilitada, un `409` del puente, un duplicado local o saldo incompatible. |
| `503` | Contrato pendiente, configuración inválida, fallo de red, timeout o respuesta incompatible. También se usa si el servicio externo rechaza la autenticación del puente. |

Los contratos nativos y los puntos pendientes están en el
[modelo y auditoría de integraciones](../../../docs/MODELO_CENTRAL.md#contratos-observados-y-pendientes).
Las pruebas unitarias se ejecutan con `npm run test:integraciones --prefix back`.

Ver [modelo y migración](../../../docs/MODELO_CENTRAL.md).
