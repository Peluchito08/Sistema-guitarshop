import prisma from "../../../shared/prisma/prismaClient";
import { Prisma } from "../../../../generated/prisma/client";
import { hashPassword } from "../../auth/application/authService";

// Campos que vamos a devolver al frontend (sin password_hash)
const usuarioSelect = {
  id_usuario: true,
  nombre_completo: true,
  correo: true,
  telefono: true,
  direccion: true,
  cedula: true,
  rol: true,
  fecha_creacion: true, // 
  id_estado: true,
} as const;

// ==========================
// LISTAR USUARIOS
// ==========================
export async function obtenerUsuarios() {
  const usuarios = await prisma.usuario.findMany({
    where: { id_estado: 1 }, // solo activos (puedes quitar este filtro si quieres ver todos)
    select: usuarioSelect,
    orderBy: { id_usuario: "asc" },
  });

  return usuarios;
}

// ==========================
// OBTENER POR ID
// ==========================
export async function obtenerUsuarioPorId(id: number) {
  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario: id },
    select: usuarioSelect,
  });

  return usuario; // puede ser null
}

// ==========================
// CREAR USUARIO
// ==========================
export async function crearUsuario(data: {
  nombre_completo: string;
  correo: string;
  telefono?: string | null;
  direccion?: string | null;
  cedula?: string | null;
  rol?: string;
  password: string;
  id_usuario_modifi?: number | null;
}) {
  const password_hash = await hashPassword(data.password);

  try {
    const usuario = await prisma.usuario.create({
      data: {
        nombre_completo: data.nombre_completo,
        correo: data.correo,
        telefono: data.telefono ?? null,
        direccion: data.direccion ?? null,
        cedula: data.cedula ?? null,
        rol: data.rol ?? "VENDEDOR",
        password_hash,
        // fecha_creacion se pone sola por default
        // id_estado default = 1 (activo)
        id_usuario_modifi: data.id_usuario_modifi ?? null,
      },
      select: usuarioSelect,
    });

    return usuario;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // unique constraint (correo o cedula)
      throw new Error("CORREO_O_CEDULA_DUPLICADO");
    }
    throw error;
  }
}

// ==========================
// ACTUALIZAR USUARIO
// ==========================
export async function actualizarUsuario(
  id: number,
  data: {
    nombre_completo?: string;
    correo?: string;
    telefono?: string | null;
    direccion?: string | null;
    cedula?: string | null;
    rol?: string;
    password?: string;
    id_usuario_modifi?: number | null;
  }
) {
    const updateData: Prisma.usuarioUncheckedUpdateInput = {};

  if (data.nombre_completo !== undefined)
    updateData.nombre_completo = data.nombre_completo;
  if (data.correo !== undefined) updateData.correo = data.correo;
  if (data.telefono !== undefined) updateData.telefono = data.telefono;
  if (data.direccion !== undefined) updateData.direccion = data.direccion;
  if (data.cedula !== undefined) updateData.cedula = data.cedula;
  if (data.rol !== undefined) updateData.rol = data.rol;
  if (data.id_usuario_modifi !== undefined)
    updateData.id_usuario_modifi = data.id_usuario_modifi;

  if (data.password) {
    updateData.password_hash = await hashPassword(data.password);
  }

  try {
    const usuario = await prisma.usuario.update({
      where: { id_usuario: id },
      data: updateData,
      select: usuarioSelect,
    });

    return usuario;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("CORREO_O_CEDULA_DUPLICADO");
    }
    throw error;
  }
}

// ==========================
// ELIMINAR USUARIO
// ==========================
export async function eliminarUsuario(id: number) {
  const usuario = await prisma.usuario.delete({
    where: { id_usuario: id },
    select: usuarioSelect,
  });

  return usuario;
}
