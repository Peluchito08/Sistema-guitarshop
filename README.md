# 🎸 GuitarShop — Sistema Administrativo y Ventas
GuitarShop es una aplicación web diseñada para administrar de manera sencilla y eficiente un pequeño negocio de venta de cuerdas y accesorios musicales. La plataforma permite llevar un control completo de productos, inventario, ventas y clientes, brindando al emprendedor y tienda musical una herramienta práctica para gestionar su negocio sin complicaciones.

La aplicación está pensada especialmente para que el sistema sea rápido y accesible, sin procesos complejos. Con GuitarShop, el usuario puede registrar sus productos, actualizar stock, registrar ventas diarias, calcular ganancias y consultar historiales, todo desde una interfaz clara e intuitiva.

Proyecto grupal con **Next.js (backend)** y **React (frontend)**, conectado a una base de datos **PostgreSQL local**.  
Este repositorio contiene ambos entornos de trabajo para desarrollo colaborativo.

## 📁 Estructura del Proyecto

guitarshop/
 ├── guitarshop-backend/            → API REST con Next.js (App Router)
 │    ├── app/api/...               → Rutas REST (login, usuarios, producto, etc.)
 │    ├── src/shared/...            → Infra compartida (auth, cors, prisma)
 │    ├── src/modules/...           → Servicios por módulo (application)
 │    ├── prisma/                   → Esquema del ORM Prisma
 │    └── package.json
 │
 └── react-frontend/                → Interfaz creada con React + Vite
    ├── src/features/...          → Pantallas y lógica por feature
    ├── src/shared/api/apiClient  → Cliente Axios (canónico)
    ├── src/lib/apiClient         → Re-export por compatibilidad
    └── package.json

## ⚙️ Requisitos Previos
| Herramienta 
| [Git](https://git-scm.com/) 
| [Node.js](https://nodejs.org/) 
| [PostgreSQL](https://www.postgresql.org/download/) 
| VS Code (opcional)

> Nota: este repo está probado con **Node.js 20.x** (ver `engines` en los `package.json`).

## 🚀 Clonar el Repositorio

git clone https://github.com/<TU_USUARIO>/Guitarshop.git
cd Guitarshop

---
## 🧩 Configurar el Backend

### 1️⃣ Instalar dependencias

cd guitarshop-backend
npm install

### 2️⃣ Crear la base de datos local en PostgreSQL

Tienes dos opciones (elige **solo una**):

**Opción A (recomendada): Prisma migrations**
- Crea una base vacía llamada `guitarshop`.
- No importes `guitarshop.sql`.

**Opción B: Importar el SQL**
- Crea una base `guitarshop`.
- Importa/ejecuta `guitarshop.sql`.
- En este caso **no ejecutes** `prisma migrate dev` (ya existen tablas).

### 3️⃣ Configurar las variables de entorno

Dentro de la carpeta `guitarshop-backend`, copia `.env.example` a `.env` y ajusta lo necesario.

Mínimo requerido:

- `DATABASE_URL` (tu usuario/contraseña/puerto pueden variar)
- `JWT_SECRET`
- `CORS_ORIGIN` (por defecto `http://localhost:5173`)

> 🔸 Si tu usuario o contraseña de PostgreSQL son distintos, cámbialos en la URL:
>
> postgresql://<usuario>:<contraseña>@localhost:5432/guitarshop?schema=public
> 

---

### 4️⃣ Generar el Cliente Prisma y Migrar Tablas

Si usas **Opción A (Prisma migrations)**:

npx prisma generate
npx prisma migrate deploy

> Nota: `migrate deploy` aplica las migraciones ya versionadas en `prisma/migrations`.
> `migrate dev --name ...` se usa cuando vas a **crear** una migración nueva (cambiaste el schema).

Si usas **Opción B (importaste guitarshop.sql)**:

npx prisma generate

Esto evita errores por tablas ya existentes.

Para abrir el panel de control visual de Prisma:

npx prisma studio

---

### 5️⃣ Ejecutar el Backend (Next.js)

npm run dev


Por defecto se ejecutará en:

👉 [http://localhost:3000](http://localhost:3000)

---

## 💻 Configurar el Frontend

cd ../react-frontend

### 1️⃣ Variables de entorno del frontend

Copia `.env.example` a `.env` y deja:

VITE_API_BASE_URL=http://localhost:3000/api

### 2️⃣ Instalar y ejecutar

npm install
npm run dev

Por defecto se ejecutará en:

👉 [http://localhost:5173](http://localhost:5173)

---

## 💾 Estructura de Base de Datos (Prisma)

Las tablas principales son:

| Tabla               | Descripción                        |
| ------------------- | ---------------------------------- |
| `cliente`           | Información de los clientes        |
| `proveedor`         | Datos de proveedores               |
| `producto`          | Catálogo de productos              |
| `factura`           | Encabezado de las ventas           |
| `detalle_factura`   | Detalles de los productos vendidos |
| `compra`            | Registro de compras a proveedores  |
| `producto_compra`   | Detalle de productos comprados     |
| `kardex`            | Movimientos de inventario          |
| `usuario`           | Usuarios del sistema               |
| `credito` y `cuota` | Control de ventas a crédito        |

---

## 🧠 Recomendaciones de Trabajo

* No trabajar directamente en `main`. Usa ramas (`feature/...`).
* Sincroniza antes de comenzar:

  git pull origin main
  
* No subir archivos `.env` ni `node_modules`.
* Usa `npx prisma studio` para visualizar o editar datos.

---

## 👥 Integrantes del Proyecto

| Nombre             | Rol                            |
| ------------------ | ------------------------------ |
| Euclides Anchundia | Líder de Repositorio           |
| Alayn Macias       | ...                            |
| Luis Macias        | ...                            |
| Samuel Macias      | ...                            |
| Gerald Anchundia   | ...                            |
| Jose Palma         | ...                            |
---

## 🔄 Flujo de Trabajo en Equipo
1. Crear una rama nueva para cada tarea:

   git checkout -b feature/nombre-tarea

2. Guardar cambios:

   git add .
   git commit -m "Agrega API de facturas"
   git push -u origin feature/nombre-tarea
   
3. Crear un **Pull Request** en GitHub hacia `main`.
4. El líder revisa y aprueba la fusión.
5. Actualizar el repositorio local:

   git pull origin main

---
