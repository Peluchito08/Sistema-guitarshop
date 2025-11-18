import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../../lib/apiClient"; // Cliente HTTP configurado para consumir el backend.

const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(4, "Mínimo 4 caracteres"),
}); // Regla de validación declarativa usando Zod.

type LoginInput = z.infer<typeof loginSchema>;

export default function Login() {
  const [apiError, setApiError] = useState<string | null>(null); // Mensaje de error que proviene del backend o del fetch.

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema), // Integra las reglas de Zod con react-hook-form.
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      setApiError(null); // Limpiamos error previo antes de un nuevo intento.

      // endpoint real es /login
      const res = await api.post("/login", data); // Se envían las credenciales al backend.

      const token = res.data?.token;

      if (!token) {
        setApiError("No se recibió el token. Revisa la respuesta del backend.");
        return;
      }

      // Guardar token y redirigir al dashboard
      localStorage.setItem("auth_token", token); // Persistimos la sesión para rutas protegidas.
      window.location.href = "/"; // o "/dashboard"
    } catch (error: any) {
      console.error(error);
      const message =
        error?.response?.data?.error || // backend usamos 'error'
        error?.response?.data?.message ||
        "Error al iniciar sesión. Verifica tus credenciales.";
      setApiError(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl px-8 py-10 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            GuitarShop – Iniciar sesión
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Accede para gestionar ventas e inventario.
          </p>
        </div>

        {apiError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="text-sm font-medium text-slate-800"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="ejemplo@correo.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-800"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="••••••••"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Ingresando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} GuitarShop
        </p>
      </div>
    </div>
  );
}
