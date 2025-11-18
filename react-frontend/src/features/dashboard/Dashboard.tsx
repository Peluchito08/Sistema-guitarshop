import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient"; // Cliente Axios preconfigurado con URL base y headers.

// Tipo que esperamos desde /api/usuarios
interface UsuarioDashboard {
  id_usuario: number;
  nombre: string;
  correo: string;
  telefono?: string;
  direccion?: string;
  cedula?: string;
}

export default function Dashboard() {
  const [usuarios, setUsuarios] = useState<UsuarioDashboard[]>([]); // Estado con la lista recibida desde el backend.
  const [loading, setLoading] = useState<boolean>(false); // Indicador de carga mientras se espera la respuesta.
  const [error, setError] = useState<string | null>(null); // Mensaje de error si falla la petición.

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        setLoading(true);
        setError(null);

        // Esta ruta está protegida con JWT en el backend
        const res = await api.get<UsuarioDashboard[]>("/usuarios"); // Consulta al endpoint para obtener usuarios recientes.
        setUsuarios(res.data);
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar la información del dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchUsuarios();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        {/* Header principal del panel */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Panel principal – GuitarShop
            </h1>
            <p className="text-sm text-slate-500">
              Resumen de ventas, inventario y clientes.
            </p>
          </div>
        </header>

        {/* Estados globales: carga/errores */}
        {loading && (
          <p className="text-sm text-slate-600">Cargando información...</p>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Tarjetas de resumen (KPIs) */}
        {!loading && !error && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">
                Usuarios registrados
              </p>
              <p className="mt-2 text-3xl font-semibold text-emerald-600">
                {usuarios.length}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Total de usuarios en el sistema.
              </p>
            </div>

            {/* Aquí luego puedes agregar más tarjetas: ventas, productos, etc. */}
            <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-400 flex items-center justify-center">
              Próxima métrica (ventas, inventario…)
            </div>
            <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-400 flex items-center justify-center">
              Próxima métrica
            </div>
            <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-4 text-xs text-slate-400 flex items-center justify-center">
              Próxima métrica
            </div>
          </section>
        )}

        {/* Tabla de usuarios recientes */}
        {!loading && !error && usuarios.length > 0 && (
          <section className="mt-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">
                Usuarios recientes
              </h2>
              <p className="text-xs text-slate-500">
                Lista de usuarios registrados en el sistema.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                      ID
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                      Nombre
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                      Correo
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                      Teléfono
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id_usuario} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {u.id_usuario}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-700">
                        {u.nombre}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-700">
                        {u.correo}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {u.telefono ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Estado vacío cuando no hay usuarios */}
        {!loading && !error && usuarios.length === 0 && (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
            <p className="font-medium text-slate-700">
              Aún no hay usuarios registrados.
            </p>
            <p className="mt-2">
              Cuando registres usuarios nuevos, aparecerán aquí en el dashboard.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
