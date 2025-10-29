# 🎸 GuitarShop — Sistema Administrativo y Ventas

Proyecto grupal con **Next.js (backend)** y **React (frontend)**, conectado a una base de datos **PostgreSQL local**.  
Este repositorio contiene ambos entornos de trabajo para desarrollo colaborativo.

---

## 📁 Estructura del Proyecto

```

Guitarshop/
│
├── guitarshop-backend/   # Backend (Next.js + Prisma + PostgreSQL)
│
└── react-frontend/       # Frontend (React + Vite)

````

---

## ⚙️ Requisitos Previos

Cada integrante debe tener instalado:

| Herramienta | Versión recomendada | Uso |
|--------------|--------------------|-----|
| [Git](https://git-scm.com/) | 2.40 o superior | Control de versiones |
| [Node.js](https://nodejs.org/) | 18.x o superior | Ejecutar React y Next.js |
| [PostgreSQL](https://www.postgresql.org/download/) | 14 o superior | Base de datos local |
| VS Code (opcional) | Última | Editor de código |

---

## 🚀 Clonar el Repositorio

```bash
git clone https://github.com/<TU_USUARIO>/Guitarshop.git
cd Guitarshop
````

---

## 🧩 Configurar el Backend

### 1️⃣ Instalar dependencias

```bash
cd guitarshop-backend
npm install
```

### 2️⃣ Crear la base de datos local en PostgreSQL

Cada integrante debe abrir **pgAdmin** o su consola de PostgreSQL y ejecutar el código que se le dio por whatsapp

### 3️⃣ Configurar las variables de entorno

Dentro de la carpeta `guitarshop-backend`, crea un archivo llamado `.env` con este contenido:

```env
# URL de conexión local a PostgreSQL
DATABASE_URL="postgresql://postgres:12345@localhost:5432/guitarshop?schema=public"

# Clave secreta para JWT (se puede cambiar)
JWT_SECRET="GuitarShop_123"
```

> 🔸 Si tu usuario o contraseña de PostgreSQL son distintos, cámbialos en la URL:
>
> ```
> postgresql://<usuario>:<contraseña>@localhost:5432/guitarshop?schema=public
> ```

---

### 4️⃣ Generar el Cliente Prisma y Migrar Tablas

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Esto creará todas las tablas en la base de datos local.

Para abrir el panel de control visual de Prisma:

```bash
npx prisma studio
```

---

### 5️⃣ Ejecutar el Backend (Next.js)

```bash
npm run dev
```

Por defecto se ejecutará en:

👉 [http://localhost:3000](http://localhost:3000)

---

## 💻 Configurar el Frontend

```bash
cd ../react-frontend
npm install
npm run dev
```

Por defecto se ejecutará en:

👉 [http://localhost:5173](http://localhost:5173)

---

## 🔄 Flujo de Trabajo en Equipo

1. Crear una rama nueva para cada tarea:

   ```bash
   git checkout -b feature/nombre-tarea
   ```
2. Guardar cambios:

   ```bash
   git add .
   git commit -m "Agrega API de facturas"
   git push -u origin feature/nombre-tarea
   ```
3. Crear un **Pull Request** en GitHub hacia `main`.
4. El líder revisa y aprueba la fusión.
5. Actualizar el repositorio local:

   ```bash
   git pull origin main
   ```

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

* No trabajes directamente en `main`. Usa ramas (`feature/...`).
* Sincroniza antes de comenzar:

  ```bash
  git pull origin main
  ```
* No subas archivos `.env` ni `node_modules`.
* Usa `npx prisma studio` para visualizar o editar datos.

---

## 👥 Integrantes del Proyecto

| Nombre             | Rol                            |
| ------------------ | ------------------------------ |
| Euclides Anchundia | Líder de Repositorio / Backend |
| ...                | ...                            |
| ...                | ...                            |

---

## 🏁 Estado del Proyecto

✅ Estructura base lista
🕓 APIs y frontend en desarrollo
🚀 Base de datos conectada localmente con PostgreSQL

---

````

---

## ⚙️ Qué deben hacer tus compañeros exactamente

1. Clonar el repo:
   ```bash
   git clone https://github.com/<tu_usuario>/Guitarshop.git
   cd Guitarshop
````

2. Crear su base de datos local:

   ```sql
   CREATE DATABASE guitarshop;
   ```

3. Copiar el `.env` dentro de `guitarshop-backend` (usando el ejemplo del README).

4. Ejecutar:

   ```bash
   cd guitarshop-backend
   npm install
   npx prisma migrate dev --name init
   npm run dev
   ```

5. Probar Prisma Studio:

   ```bash
   npx prisma studio
   ```

6. (Opcional) Iniciar frontend:

   ```bash
   cd ../react-frontend
   npm install
   npm run dev
   ```

---

