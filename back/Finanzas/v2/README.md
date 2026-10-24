# API local Finanzas v2

La API activa permite consultar cuentas y gestionar pagos transaccionales en
tres pasos: crear la solicitud, aprobarla o rechazarla y ejecutar el pago.
La ejecución registra el movimiento financiero, actualiza el saldo de la cuenta
y aplica el monto a las cuotas.

Modelo activo: las seis tablas de `database/local/sql/01_schema.sql`.
La migración `04_cuotas.sql` agrega dos tablas de cuotas y aplicaciones, sin
reemplazar las seis originales. Alcance en [CUOTAS.md](../../../database/local/CUOTAS.md).
Los módulos anteriores se conservan en `back/Finanzas/`, pero no se importan en
`AppModule` porque usan tablas incompatibles. Sus rutas `/facturas`, `/clientes`,
`/metodos-pago` y `/payments` no están activas; no se aplican sus scripts SQL.

## Arranque y usuario

Desde la raíz: `docker compose up -d --build --wait`.
API: `http://localhost:3000/api/finanzas`. PostgreSQL: `localhost:15433`.
En este equipo se confió en los certificados públicos de Windows durante la
compilación npm mediante un secreto de BuildKit, sin desactivar TLS. Si la red
intercepta HTTPS y se necesita reconstruir la imagen, desde la raíz:

```powershell
docker build --secret id=npm_ca,src=.npm-ca.local -t finanzas-local-api ./back
docker compose up -d --no-build --wait
```

`.npm-ca.local` contiene certificados públicos de confianza del equipo, está
ignorado por Git y no se copia a la imagen. En redes sin este requisito basta
con `docker compose up -d --build --wait`.

Se requiere Node 22 para ejecutar la API fuera de Docker.
Desde `back/` también se puede usar `npm ci`, `npm run build`, `npm start`;
se carga el `.env` de esa carpeta o, si no existe, el de la raíz. Detener primero
el servicio API de Docker para liberar el puerto 3000.

Todas las rutas requieren el mock local: `APP_ENV=local`,
`MOCK_AUTH_ENABLED=true`, host local y base `erp_local`. El usuario siempre es
Administrador 1, ID 1; no se acepta `id_autorizador` desde el cliente.
No hay contraseña de administrador ni autenticación real. El Compose publica
ambos servicios solo en loopback. No habilitar este mock en una base remota.

## Contrato

Las respuestas devuelven BIGINT y NUMERIC como cadenas, fechas DATE como
`YYYY-MM-DD`, timestamps como ISO y campos ausentes opcionales como `null`.
Los importes de entrada son números positivos con un máximo de dos decimales;
los IDs en cuerpos JSON son enteros positivos hasta `Number.MAX_SAFE_INTEGER`.
Los IDs de ruta admiten todo el rango BIGINT positivo. Los campos desconocidos
se rechazan para evitar cambios de estado o autorizador desde el cliente.

Todas las rutas siguientes tienen prefijo `/api/finanzas`:

| Método | Ruta | Resultado / entrada | Estado actual |
|---|---|---|---|
| GET | `/salud` | Conexión PostgreSQL y modelo activo. | Activo |
| GET | `/usuario` | Administrador mock actual. | Activo |
| GET | `/cuentas-cobrar` | Lista; filtros `venta` y `estado`. | Activo |
| GET | `/cuentas-cobrar/:id` | Cuenta por cobrar. | Activo |
| GET | `/cuentas-pagar` | Lista; filtros `orden_compra` y `estado`. | Activo |
| GET | `/cuentas-pagar/:id` | Cuenta por pagar. | Activo |
| POST | `/pagos` | Crea una solicitud pendiente. | Activo |
| GET | `/pagos` | Lista; filtros `estado` y `tipo_operacion`. | Activo |
| GET | `/pagos/:id` | Pago con `autorizacion` y `movimiento` (o `null`). | Activo |
| POST | `/pagos/:id/decision` | `decision`: `aprobada`/`rechazada`; `observacion` obligatoria al rechazar. | Activo |
| POST | `/pagos/:id/ejecutar` | Cuerpo vacío `{}`; ejecuta el pago aprobado. | Activo |
| GET | `/caja/saldo` | Saldo inicial y actual de la caja. | Activo |
| GET | `/movimientos` | Movimientos efectivamente ejecutados. | Activo |

El flujo de pagos es: `POST /pagos` crea la solicitud; `POST /pagos/:id/decision`
la aprueba o rechaza; `POST /pagos/:id/ejecutar` realiza la transacción. La ruta
de decisión recibe `{"decision":"aprobada"}` o
`{"decision":"rechazada","observacion":"Motivo"}`. La ejecución recibe `{}`.
No existe una ruta `/pagos/:id/aprobar`: el endpoint activo es
`/pagos/:id/decision`. La consulta activa usa `/cuentas-cobrar`, no
`/cuentas-por-cobrar`.

Crear cuenta debe inicializar saldo igual al monto y estado `pendiente`.
`cantidad_cuotas` es opcional y vale 1; permite un entero entre 1 y 32767, siempre
que el total alcance al menos 0,01 por cuota. Se generan las cuotas automáticamente
al crear la cuenta, sin fechas individuales ni reprogramación. El detalle de
cuenta incluye `cuotas` y el detalle de pago incluye `aplicaciones`.
Si se omite emisión se usa CURRENT_DATE de PostgreSQL; vencimiento no puede
ser anterior a emisión. No se permite definir manualmente saldo ni estado.

Ejemplo de solicitud:

```json
{"tipo_operacion":"cobro","id_cxc":1,"monto":50000,"metodo_pago":"simulado","descripcion":"Abono"}
```

Orígenes mutuamente excluyentes:

- `cobro`: solo `id_cxc`.
- `proveedor`: solo `id_cxp`.
- `nomina`: `id_nomina` e `id_empleado`.
- `reembolso`: solo `id_reembolso`.

Métodos: `efectivo`, `transferencia`, `tarjeta`, `simulado`.
Una ejecución repetida devuelve 409 y no crea un movimiento adicional.
Varias solicitudes sobre una misma deuda se validan de nuevo al ejecutar.

Errores: 400 entrada inválida o referencias incompatibles; 403 mock deshabilitado
o entorno no local; 404 registro inexistente; 409 referencia duplicada,
estado incompatible o saldo insuficiente. Crear devuelve 201; decidir/ejecutar 200.

## Validación y alcance pendiente

El frontend conserva la demostración original en localStorage; no consume esta
API. La conexión del frontend y la alineación con maestros externos y sus FK
siguen fuera del alcance de este backend.

La autenticación real, idempotencia de creación y unicidad de obligaciones de
nómina/reembolso requieren definición posterior.

**Nota técnica:** la tabla `finanzas.cuenta_financiera` tiene la restricción
`ck_caja_unica`, que limita la caja a `id_cuenta = 1`. No se pueden crear varias
cuentas financieras sin cambiar esa restricción del esquema.