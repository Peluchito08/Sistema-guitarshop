import { NavLink, Outlet } from "react-router-dom"; // Componentes de routing para enlaces y renderizado de rutas anidadas.

export const AppLayout = () => {
  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr]">
      {/* Layout base con una columna fija para el menú y otra flexible para el contenido */}
      <aside className="border-r p-4 space-y-3">
        <h1 className="text-xl font-bold">GuitarShop</h1>
        <nav className="flex flex-col text-sm gap-2">
          {/* NavLink aplica clases activas automáticamente según la ruta actual */}
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/productos">Productos</NavLink>
          <NavLink to="/ventas">Ventas (POS)</NavLink>
        </nav>
      </aside>
      <main className="p-6">
        <Outlet /> {/* Renderiza la ruta hija correspondiente al menú seleccionado */}
      </main>
    </div>
  );
};
