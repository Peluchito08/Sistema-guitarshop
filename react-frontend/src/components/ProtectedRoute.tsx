import type { ReactNode } from "react"; // Tipado para declarar que el componente recibirá nodos React como hijos.

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem("auth_token"); // Se consulta el token persistido luego del login.

  if (!token) {
    // Si no existe token, redirigimos manualmente hacia la pantalla de acceso.
    window.location.href = "/login";
    return null;
  }

  return <>{children}</>; // Con token válido, renderizamos los componentes protegidos.
}
