import prisma from "../../../shared/prisma/prismaClient";
import { Prisma } from "../../../../generated/prisma/client";

const proveedorSelect = {
  id_proveedor: true,
  nombre_proveedor: true,
  ruc_cedula: true,
  correo: true,
  telefono: true,
  direccion: true,
  fecha_registro: true,
  id_estado: true,
} as const;

// ==========================
// LISTAR PROVEEDORES
// ==========================
export async function listarProveedores() {
  const proveedores = await prisma.proveedor.findMany({
    where: { id_estado: 1 }, // solo activos
    select: proveedorSelect,
    orderBy: { id_proveedor: "asc" },
  });

  return proveedores;
}

// ==========================
// OBTENER PROVEEDOR POR ID
// ==========================
export async function obtenerProveedorPorId(id: number) {
  const proveedor = await prisma.proveedor.findUnique({
    where: { id_proveedor: id },
    select: proveedorSelect,
  });

  return proveedor; // puede ser null
}

// ==========================
// CREAR PROVEEDOR
// ==========================
export async function crearProveedor(data: {
  nombre_proveedor: string;
  ruc_cedula: string;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  id_usuario_modifi?: number | null;
}) {
  try {
    const proveedor = await prisma.proveedor.create({
      data: {
        nombre_proveedor: data.nombre_proveedor,
        ruc_cedula: data.ruc_cedula,
        correo: data.correo ?? null,
        telefono: data.telefono ?? null,
        direccion: data.direccion ?? null,
        id_estado: 1,
        id_usuario_modifi: data.id_usuario_modifi ?? null,
      },
      select: proveedorSelect,
    });

    return proveedor;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // ruc_cedula duplicado
      throw new Error("PROVEEDOR_DUPLICADO");
    }
    throw error;
  }
}

// ==========================
// ACTUALIZAR PROVEEDOR
// ==========================
export async function actualizarProveedor(
  id: number,
  data: {
    nombre_proveedor?: string;
    ruc_cedula?: string;
    correo?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    id_usuario_modifi?: number | null;
  }
) {
  const updateData: Prisma.proveedorUncheckedUpdateInput = {};

  if (data.nombre_proveedor !== undefined)
    updateData.nombre_proveedor = data.nombre_proveedor;
  if (data.ruc_cedula !== undefined) updateData.ruc_cedula = data.ruc_cedula;
  if (data.correo !== undefined) updateData.correo = data.correo;
  if (data.telefono !== undefined) updateData.telefono = data.telefono;
  if (data.direccion !== undefined) updateData.direccion = data.direccion;
  if (data.id_usuario_modifi !== undefined)
    updateData.id_usuario_modifi = data.id_usuario_modifi;

  try {
    const proveedor = await prisma.proveedor.update({
      where: { id_proveedor: id },
      data: updateData,
      select: proveedorSelect,
    });

    return proveedor;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("PROVEEDOR_DUPLICADO");
    }
    throw error;
  }
}

// ==========================
// ELIMINAR PROVEEDOR (solo si no tiene relaciones)
// ==========================
export async function eliminarProveedor(id: number) {
  // Verificar si está usado en compra o producto
  const [compras, productos] = await Promise.all([
    prisma.compra.count({ where: { id_proveedor: id } }),
    prisma.producto.count({ where: { id_proveedor: id } }),
  ]);

  if (compras > 0 || productos > 0) {
    // Tiene relaciones, no se puede borrar
    throw new Error("PROVEEDOR_CON_RELACIONES");
  }

  const proveedor = await prisma.proveedor.delete({
    where: { id_proveedor: id },
    select: proveedorSelect,
  });

  return proveedor;
}
