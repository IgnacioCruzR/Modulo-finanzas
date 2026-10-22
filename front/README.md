# Frontend

Aplicación web del módulo financiero, construida con React, TypeScript y Vite.

La vista inicial presenta el dashboard del mockup con indicadores y un gráfico
mensual de demostración; los datos se reemplazarán por información de la API
cuando el backend esté disponible.

## Requisitos

- Node.js 20.19+ o 22.12+
- npm

## Comandos

Desde esta carpeta:

```bash
npm install
npm run dev
```

Otros comandos disponibles:

```bash
npm run build
npm run preview
```

## Estructura

```text
front/
├── src/
│   ├── app/                    # Arranque y configuración de la aplicación
│   ├── assets/                 # Recursos estáticos
│   ├── features/
│   │   ├── dashboard/          # Panel e indicadores financieros
│   │   ├── payments/           # Registro de pagos
│   │   ├── reports/            # Emisión y consulta de informes
│   │   └── settings/           # Configuración del módulo
│   ├── shared/
│   │   ├── components/         # Componentes reutilizables
│   │   ├── hooks/              # Hooks reutilizables
│   │   ├── layout/             # Estructura visual compartida
│   │   ├── services/api/       # Cliente para la API del backend
│   │   ├── types/              # Tipos compartidos
│   │   └── utils/              # Funciones auxiliares
│   └── main.tsx                # Punto de entrada de Vite
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

El frontend consumirá la API del backend. No debe conectarse directamente a
PostgreSQL ni almacenar credenciales de base de datos.
