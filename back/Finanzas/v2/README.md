# API local Finanzas v2

Estado actual: **solo consulta**. Se conservaron NestJS, TypeORM, entidades, DTO y
contratos. Se retiraron los POST y la lógica de escritura añadidos para que el
equipo implemente sus tareas. La base y sus funciones SQL permanecen intactas.

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
| POST | `/cuentas-cobrar` | `id_venta`, `id_cliente`, `monto_total`, fechas opcionales. | Pendiente de implementar |
| GET | `/cuentas-cobrar` | Lista; filtros `venta` y `estado`. | Activo |
| GET | `/cuentas-cobrar/:id` | Cuenta por cobrar. | Activo |
| POST | `/cuentas-pagar` | `id_oc`, `id_proveedor`, `monto_total`, fechas opcionales. | Pendiente de implementar |
| GET | `/cuentas-pagar` | Lista; filtros `orden_compra` y `estado`. | Activo |
| GET | `/cuentas-pagar/:id` | Cuenta por pagar. | Activo |
| POST | `/pagos` | Solicitud pendiente, sin movimiento de caja. | Pendiente de implementar |
| GET | `/pagos` | Lista; filtros `estado` y `tipo_operacion`. | Activo |
| GET | `/pagos/:id` | Pago con `autorizacion` y `movimiento` (o `null`). | Activo |
| POST | `/pagos/:id/decision` | `decision`: `aprobada`/`rechazada`; `observacion` obligatoria al rechazar. | Pendiente de implementar |
| POST | `/pagos/:id/ejecutar` | Cuerpo vacío `{}`; pago aprobado pasa a ejecutado. | Pendiente de implementar |
| GET | `/caja/saldo` | Saldo inicial y actual de la caja. | Activo |
| GET | `/movimientos` | Movimientos efectivamente ejecutados. | Activo |

Las reglas siguientes describen el **contrato objetivo** de los POST pendientes,
no servicios de escritura activos. Las restricciones y funciones SQL se conservan.

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
La implementación pendiente debe llamar a las funciones SQL dentro de una
transacción y validar también cuentas anuladas y caja inactiva.
Una ejecución repetida devuelve 409 y no crea un movimiento adicional.
Varias solicitudes sobre una misma deuda se validan de nuevo al ejecutar.

Errores: 400 entrada inválida o referencias incompatibles; 403 mock deshabilitado
o entorno no local; 404 registro inexistente; 409 referencia duplicada,
estado incompatible o saldo insuficiente. Crear devuelve 201; decidir/ejecutar 200.

## Validación y trabajo pendiente

Las suites añadidas de API y frontend fueron retiradas del código activo. La
implementación anterior quedó respaldada en
`respaldo-reversion.local/implementacion-actual.zip` y los archivos independientes
en `respaldo-reversion.local/retirados/`. Ese respaldo es local y está ignorado por Git.

El frontend conserva la demostración original en localStorage; no consume esta
API. El equipo debe implementar los POST con reglas confirmadas por pauta,
conectar el formulario y crear sus propias pruebas E2E. Persisten como pendientes
la alineación con maestros externos, las FK externas, los seeders de al menos diez
registros donde corresponda y la comprobación de consulta para la demo.

La autenticación real, idempotencia de creación y unicidad de obligaciones de
nómina/reembolso requieren definición posterior. No se modificó la base ni se
borraron registros para esta reversión.