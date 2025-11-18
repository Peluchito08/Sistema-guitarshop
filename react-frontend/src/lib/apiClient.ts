import axios from "axios"; // Axios se usa como cliente HTTP principal para el frontend.

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // URL configurada en .env apuntando al backend.
  withCredentials: true, // Permite enviar cookies si el backend las necesita.
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token"); // Recuperamos el JWT persistido tras el login.
  if (token) config.headers.Authorization = `Bearer ${token}`; // Adjuntamos el token en cada petición protegida.
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("auth_token"); // Expiró o no es válido el token.
      window.location.href = "/login"; // Redirigimos para forzar nueva autenticación.
    }
    return Promise.reject(err);
  }
);
