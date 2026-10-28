# API de Finanzas: modelo central
La carpeta mantiene su nombre v2; el modelo activo tiene seis tablas y no usa cuotas.
Prefijo: `/api/finanzas`. BIGINT y NUMERIC se devuelven como cadenas.

| Método | Ruta | Uso |
|---|---|---|
| GET | /salud | Verifica el modelo activo y la conexión |
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

400 entrada inválida; 403 mock no habilitado; 404 referencia interna inexistente;
409 estado, duplicado o saldo incompatible; 503 integración externa no disponible.
Creaciones: 201; decisiones: 200.

## Entorno
Node 22 y PostgreSQL 17. Configuración .env en back/ o raíz; synchronize=false.
APP_ENV=local, MOCK_AUTH_ENABLED=true y base erp_local permiten Administrador 1.
INTEGRATION_MODE=local-fixtures valida las referencias de prueba documentadas.
Para HTTP configurar INTEGRATION_VENTA_URL, INTEGRATION_ORDEN_COMPRA_URL,
INTEGRATION_REEMBOLSO_URL e INTEGRATION_USUARIO_URL. Los endpoints definitivos
y la autenticación real se acordarán con los otros módulos.

Los módulos anteriores no se registran. Ver [modelo y migración](../../../docs/MODELO_CENTRAL.md).
