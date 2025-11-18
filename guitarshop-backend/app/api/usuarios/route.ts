import { jsonCors, optionsCors } from "../../../lib/cors"; // Helpers para respuestas CORS preconfiguradas.
import { verifyToken } from "../../../lib/auth"; // Función que valida y decodifica el token JWT enviado en la petición.
import {
  getAllUsuarios,
  createUsuario,
  type UsuarioCreateInput,
} from "../../../lib/services/usuarioService"; // Servicio de dominio que encapsula la lógica de acceso a usuarios.

// Preflight CORS
export async function OPTIONS() {
  return optionsCors();
}

// GET /api/usuarios  -> lista de usuarios (PROTEGIDO)
export async function GET(request: Request) {
  const validation = verifyToken(request); // Extraemos y verificamos el token desde las cabeceras.

  if (!validation.valid) {
    return jsonCors({ error: validation.message }, { status: 401 });
  }

  const usuarios = await getAllUsuarios(); // Servicio que consulta todos los usuarios en la base de datos.
  return jsonCors(usuarios); // Respondemos con la lista usando CORS habilitado.
}

// POST /api/usuarios  -> crear nuevo usuario (también protegido)
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UsuarioCreateInput; // Cuerpo que debe cumplir con la interfaz de creación.

    if (!body.contrasena || !body.correo) {
      return jsonCors(
        { message: "Correo y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    const nuevoUsuario = await createUsuario(body); // Delegamos la creación al servicio para centralizar validaciones.

    return jsonCors(nuevoUsuario, { status: 201 });
  } catch (error) {
    console.error("Error POST /usuarios:", error); // Log centrado en diagnosticar sin filtrar datos sensibles.
    return jsonCors(
      { message: "Error al crear usuario", error: String(error) },
      { status: 500 }
    );
  }
}
