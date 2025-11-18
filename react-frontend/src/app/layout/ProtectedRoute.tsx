import { Navigate, Outlet } from "react-router-dom"; // Componentes para redirecciones y para renderizar rutas hijas.

export const ProtectedRoute = () => {
  const token = localStorage.getItem("auth_token"); // Leemos el token almacenado en el navegador.
  if (!token) return <Navigate to="/login" replace />; // Si no hay sesión, se redirige al login.
  return <Outlet />; // Si está autenticado, se renderiza la ruta protegida correspondiente.
};
