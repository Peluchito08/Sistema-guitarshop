import { jsonCors, optionsCors } from "../../../../lib/cors"; // Utilidades para responder con cabeceras CORS consistentes.
import { verifyToken } from "../../../../lib/auth"; // Función encargada de validar el JWT enviado en la solicitud.
import {
  getUsuarioById,
  updateUsuario,
  deleteUsuario,
  type UsuarioUpdateInput,
} from "../../../../lib/services/usuarioService"; // Servicio que centraliza la lógica de acceso/edición de usuarios.


// OPTIONS -> CORS preflight
export async function OPTIONS() {
  return optionsCors();
}

// Función auxiliar para extraer ID de la URL
function getIdFromUrl(req: Request): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const idString = parts[parts.length - 1];
  const id = Number(idString);
  return Number.isNaN(id) ? null : id;
} // Extrae el parámetro dinámico `[id]` de la ruta y lo valida como número.

// GET /api/usuarios/:id  (PROTEGIDO)
export async function GET(req: Request) {
  const validation = verifyToken(req); // Confirma que el cliente envía un token válido.
  if (!validation.valid) {
    return jsonCors({ error: validation.message }, { status: 401 });
  }

  const id = getIdFromUrl(req); // Convertimos el segmento final de la URL en ID numérico.
  if (id === null) {
    return jsonCors({ message: "ID inválido" }, { status: 400 });
  }

  try {
    const usuario = await getUsuarioById(id); // Obtiene el usuario en base al identificador.

    if (!usuario) {
      return jsonCors({ message: "Usuario no encontrado" }, { status: 404 });
    }

    return jsonCors(usuario);
  } catch (error) {
    console.error("Error GET /usuarios/[id]:", error); // Deja registro en consola para depuración.
    return jsonCors(
      { message: "Error interno", error: String(error) },
      { status: 500 }
    );
  }
}

// PUT /api/usuarios/:id  (PROTEGIDO)
export async function PUT(req: Request) {
  const validation = verifyToken(req); // Reutilizamos la validación del token antes de permitir cambios.
  if (!validation.valid) {
    return jsonCors({ error: validation.message }, { status: 401 });
  }

  const id = getIdFromUrl(req); // Determina qué usuario se pretende modificar.
  if (id === null) {
    return jsonCors({ message: "ID inválido" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as UsuarioUpdateInput; // Datos opcionales que se desean actualizar.

    const usuarioActualizado = await updateUsuario(id, body); // Servicio que aplica las modificaciones en base de datos.

    return jsonCors(usuarioActualizado);
  } catch (error) {
    console.error("Error PUT /usuarios/[id]:", error); // Log orientado a diagnosticar el fallo.
    return jsonCors(
      { message: "Error al actualizar usuario", error: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/usuarios/:id  (PROTEGIDO)
export async function DELETE(req: Request) {
  const validation = verifyToken(req); // Protección para evitar borrados sin autenticación.
  if (!validation.valid) {
    return jsonCors({ error: validation.message }, { status: 401 });
  }

  const id = getIdFromUrl(req); // Identifica al usuario que se eliminará.
  if (id === null) {
    return jsonCors({ message: "ID inválido" }, { status: 400 });
  }

  try {
    await deleteUsuario(id); // Delegamos la eliminación al servicio para mantener la lógica encapsulada.
    return jsonCors({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error("Error DELETE /usuarios/[id]:", error); // Mensaje controlado en logs para futura revisión.
    return jsonCors(
      { message: "Error al eliminar usuario", error: String(error) },
      { status: 500 }
    );
  }
}
