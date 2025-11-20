import prisma from "../prisma";
import { Prisma } from "@prisma/client";

// Puedes usar directamente el tipo de Prisma
export type ProveedorCreateInput = Prisma.proveedorCreateInput;

export async function getAllProveedores() {
  return prisma.proveedor.findMany();
}

export async function getProveedorById(id: number) {
  return prisma.proveedor.findUnique({
    where: { id_proveedor: id },
  });
}

export async function createProveedor(data: ProveedorCreateInput) {
  // Si quieres forzar fecha y fecha_creacion desde backend:
  return prisma.proveedor.create({
    data: {
      ...data,
      // Si en la BD ya tienen DEFAULT, puedes quitar estas dos líneas
      fecha: data.fecha ?? new Date(),
      fecha_creacion: data.fecha_creacion ?? new Date(),
    },
  });
}

export async function updateProveedor(
  id: number,
  data: Partial<ProveedorCreateInput>
) {
  return prisma.proveedor.update({
    where: { id_proveedor: id },
    data,
  });
}

export async function deleteProveedor(id: number) {
  return prisma.proveedor.delete({
    where: { id_proveedor: id },
  });
}
