# Frontend
React 19, TypeScript y Vite. Gestión de caja consulta y registra operaciones
mediante /api/finanzas/operaciones y /operaciones/:id/decision.
Aprobar y ejecutar requiere una sola llamada; el backend confirma la transacción.

El formulario recibe el ID de cuenta por cobrar, cuenta por pagar o reembolso,
monto, método y concepto. No solicita nombres ni RUT como sustituto del origen.
Ventas admite ingresos; Compras y Reembolsos, egresos. No ofrece nóminas ni cuotas.
Las decisiones reales en PostgreSQL se distinguen de las maquetas anteriores.
Administrador 1 sigue siendo una identidad simulada del entorno local.

Nginx y Vite reenvían /api al backend. No hay credenciales PostgreSQL en React.
Dashboard, reportes y configuración mantienen datos demostrativos.

Desarrollo: npm ci y npm run dev desde front/. Compilar: npm run build.
Node 22 recomendado. Con Docker, iniciar desde la raíz con docker compose.
La carpeta conserva componentes y servicios antiguos que no están en la navegación.

Las pruebas front/tests/central-flow.cjs usan el cliente TypeScript compilado
contra una API y PostgreSQL efímeros, mediante scripts/Test-ModeloCentral.ps1.
No sustituyen una revisión visual en navegador.
