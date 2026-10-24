# ERP universitario — Grupo 7 Finanzas

## Alcance

PostgreSQL local Docker con **seis tablas** propias en `finanzas`: `cuenta_cobrar`, `cuenta_pagar`, `pago`, `autorizacion_pago`, `movimiento_financiero`, `cuenta_financiera`. Una vista `v_saldo_caja` y dos funciones SQL para decisiones y ejecución.

No implementa backend ni interfaz; `json/ejemplos_api.json` son **contratos propuestos** para Codex. Solo para operaciones simuladas de un ERP académico. La base del profesor NO se toca.

## Estructura

- `compose.yaml`: PostgreSQL 17 local (localhost:5433)
- `.env.example`: plantilla para contraseña local
- `sql/01_schema.sql`: modelo, restricciones, índices, vista y caja general inicial por $10.000.000 CLP
- `sql/02_operaciones.sql`: funciones `decidir_pago` y `ejecutar_pago`
- `sql/03_pruebas.sql`: escenario de cobro aprobado y pago a proveedor rechazado (ejecutar manualmente una sola vez)
- `json/ejemplos_api.json`: ejemplos JSON que Codex puede usar para diseñar DTOs y endpoints

## Instalación

1. Copiar `.env.example` a `.env` y cambiar `POSTGRES_PASSWORD`.
2. Ejecutar `docker compose up -d` desde esta carpeta.
3. Conectar DBeaver: host `localhost`, puerto `5433`, base `erp_local`, usuario `erp_user`, contraseña de `.env`.
4. Verificar: `SELECT * FROM finanzas.v_saldo_caja;`
5. Prueba opcional (base recién inicializada):

```bash
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U erp_user -d erp_local < sql/03_pruebas.sql
```

Pruebas esperadas: cuenta por cobrar saldo 100000 (`parcial`), cuenta por pagar saldo 300000 (`pendiente`), pago de cobro `ejecutado`, pago a proveedor `rechazado`, caja 10050000.

**Nota**: los scripts dentro de `/docker-entrypoint-initdb.d` solo se ejecutan con el volumen de PostgreSQL vacío. Si cambias SQL después de levantar el contenedor, usa migraciones. No uses `docker compose down -v` con datos importantes porque elimina el volumen.

## Diseño y seguridad

- Referencias externas `id_venta`, `id_cliente`, `id_oc`, `id_proveedor`, `id_nomina`, `id_reembolso`, `id_empleado` son enteros lógicos sin FK externa hasta Sprint 3; las tablas internas sí usan FK.
- Un `pago` tiene un solo origen según `tipo_operacion`: `cobro`, `proveedor`, `nomina`, `reembolso`.
- Un pago comienza `pendiente`; decisión única `aprobada` / `rechazada`; ejecución solo si está aprobado.
- La ejecución crea un solo movimiento y actualiza deuda y caja de forma atómica. Un rechazo no crea movimiento ni disminuye deuda.
- Para un proyecto real, faltan privilegios mínimos, auditoría adicional, reversiones, roles, conciliaciones y procesos más avanzados. No expongas credenciales remotas en el repositorio.
- **Importante:** las funciones implementan las invariantes si los cambios pasan por ellas; la cuenta de propietario puede modificar directamente tablas. Cuando el backend esté listo, restringe las operaciones de escritura a las funciones o servicios transaccionales autorizados.
- La integración con otros grupos **no está implementada**; solo se deja prevista para Sprint 3.
