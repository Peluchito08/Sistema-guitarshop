# GuitarShop Backend (Next.js + Prisma)

API REST construida con Next.js (App Router) y Prisma (PostgreSQL).

## Requisitos

- Node.js
- PostgreSQL

## Variables de entorno

Crea un archivo `.env` en esta carpeta con al menos:

```env
DATABASE_URL="postgresql://postgres:12345@localhost:5432/guitarshop?schema=public"
JWT_SECRET="GuitarShop_123"
CORS_ORIGIN="http://localhost:5173"
```

## Instalación y ejecución

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Servidor por defecto: http://localhost:3000

## Estructura (Clean Architecture pragmática)

- `app/api/**` → Capa de entrega (HTTP). Mantiene los nombres/rutas de endpoints.
- `src/shared/**` → Infra compartida
	- `src/shared/auth` (JWT + helpers)
	- `src/shared/http/cors` (helpers de CORS)
	- `src/shared/prisma` (PrismaClient singleton)
- `src/modules/**/application/*Service.ts` → Casos de uso / lógica de aplicación por módulo.
- `lib/**` → Puentes de compatibilidad (re-export) para no romper imports existentes.

## Nota sobre endpoints "stub" (501)

Algunos endpoints existían como archivos `route.ts` vacíos (lo que rompe el build de Next). Para mantener las rutas sin cambiarlas, ahora responden `501 Endpoint no implementado`:

- `/api/detalle_factura` y `/api/detalle_factura/[id]`
- `/api/factura` y `/api/factura/[id]`
- `/api/kardex` y `/api/kardex/[id]`
- `/api/producto_compra` y `/api/producto_compra/[id]`
- `/api/producto_venta` y `/api/producto_venta/[id]`

Si estos endpoints deben funcionar, se implementan sus handlers dentro de `app/api/**` usando los servicios en `src/modules/**` (sin renombrar rutas).
