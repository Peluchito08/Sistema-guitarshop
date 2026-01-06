import prisma from "../../../shared/prisma/prismaClient";
import { Prisma } from "../../../../generated/prisma/client";

const clienteSelect = {
  id_cliente: true,
  nombres: true,
  apellidos: true,
  cedula: true,
  correo: true,
  telefono: true,
  direccion: true,
  fecha_registro: true,
  id_estado: true,
} as const;

// ==========================
// LISTAR CLIENTES
// ==========================
export async function listarClientes() {
  const clientes = await prisma.cliente.findMany({
    where: { id_estado: 1 }, // solo activos (cambia si quieres todos)
    select: clienteSelect,
    orderBy: { id_cliente: "asc" },
  });

  return clientes;
}

// ==========================
// OBTENER CLIENTE POR ID
// ==========================
export async function obtenerClientePorId(id: number) {
  const cliente = await prisma.cliente.findUnique({
    where: { id_cliente: id },
    select: clienteSelect,
  });

  return cliente; // puede ser null
}

// ==========================
// CREAR CLIENTE
// ==========================
export async function crearCliente(data: {
  nombres: string;
  apellidos: string;
  cedula: string;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  id_usuario_modifi?: number | null;
}) {
  try {
    const cliente = await prisma.cliente.create({
      data: {
        nombres: data.nombres,
        apellidos: data.apellidos,
        cedula: data.cedula,
        correo: data.correo ?? null,
        telefono: data.telefono ?? null,
        direccion: data.direccion ?? null,
        // fecha_registro se pone sola (default now())
        id_estado: 1, // ACTIVO
        id_usuario_modifi: data.id_usuario_modifi ?? null,
      },
      select: clienteSelect,
    });

    return cliente;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // cedula (o correo) duplicado
      throw new Error("CLIENTE_DUPLICADO");
    }
    throw error;
  }
}

// ==========================
// ACTUALIZAR CLIENTE
// ==========================
export async function actualizarCliente(
  id: number,
  data: {
    nombres?: string;
    apellidos?: string;
    cedula?: string;
    correo?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    id_usuario_modifi?: number | null;
  }
) {
  const updateData: Prisma.clienteUncheckedUpdateInput = {};

  if (data.nombres !== undefined) updateData.nombres = data.nombres;
  if (data.apellidos !== undefined) updateData.apellidos = data.apellidos;
  if (data.cedula !== undefined) updateData.cedula = data.cedula;
  if (data.correo !== undefined) updateData.correo = data.correo;
  if (data.telefono !== undefined) updateData.telefono = data.telefono;
  if (data.direccion !== undefined) updateData.direccion = data.direccion;
  if (data.id_usuario_modifi !== undefined)
    updateData.id_usuario_modifi = data.id_usuario_modifi;

  try {
    const cliente = await prisma.cliente.update({
      where: { id_cliente: id },
      data: updateData,
      select: clienteSelect,
    });

    return cliente;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("CLIENTE_DUPLICADO");
    }
    throw error;
  }
}

// ==========================
// ELIMINAR CLIENTE (BORRADO REAL)
// ==========================
export async function eliminarCliente(id: number) {
  const cliente = await prisma.cliente.delete({
    where: { id_cliente: id },
    select: clienteSelect,
  });

  return cliente;
}
