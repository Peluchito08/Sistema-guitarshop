import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Formulario genérico para crear/editar productos desde cualquier modal.

export interface Proveedor {
  id_proveedor: number;
  nombre_proveedor: string;
}

const productSchema = z.object({
  codigo_producto: z
    .string()
    .min(1, "El código es obligatorio")
    .max(30, "Máximo 30 caracteres"),
  nombre_producto: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "Máximo 100 caracteres"),
  descripcion: z
    .string()
    .min(1, "La descripción es obligatoria")
    .max(255, "Máximo 255 caracteres"),
  // Este es el PRECIO DE VENTA (campo real en Prisma)
  precio_venta: z.number().positive("Debe ser un precio válido"),
  cantidad_stock: z
    .number()
    .int()
    .min(0, "El stock no puede ser negativo"),
  id_proveedor: z
    .number()
    .int()
    .positive("Selecciona un proveedor"),
});

export type ProductInput = z.infer<typeof productSchema>;

interface Props {
  defaultValues?: ProductInput;
  proveedores: Proveedor[];
  loadingProveedores?: boolean;
  onSubmit: (values: ProductInput) => void;
  onCancel: () => void;
}

export default function ProductForm({
  defaultValues,
  proveedores,
  loadingProveedores,
  onSubmit,
  onCancel,
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultValues ?? {
      codigo_producto: "",
      nombre_producto: "",
      descripcion: "",
      precio_venta: 0,
      cantidad_stock: 0,
      id_proveedor: 0,
    },
  });

  const noHayProveedores = !loadingProveedores && proveedores.length === 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
      {/* CÓDIGO */}
      <div>
        <label className="text-sm font-medium text-slate-800">
          Código del producto
        </label>
        <input
          {...register("codigo_producto")}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          placeholder="CRD-001"
        />
        {errors.codigo_producto && (
          <p className="mt-1 text-xs text-red-600">
            {errors.codigo_producto.message}
          </p>
        )}
      </div>

      {/* NOMBRE */}
      <div>
        <label className="text-sm font-medium text-slate-800">
          Nombre del producto
        </label>
        <input
          {...register("nombre_producto")}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          placeholder="Cuerda de guitarra acústica"
        />
        {errors.nombre_producto && (
          <p className="mt-1 text-xs text-red-600">
            {errors.nombre_producto.message}
          </p>
        )}
      </div>

      {/* DESCRIPCIÓN */}
      <div>
        <label className="text-sm font-medium text-slate-800">
          Descripción
        </label>
        <textarea
          {...register("descripcion")}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          rows={3}
          placeholder="Detalle del producto, marca, modelo, etc."
        />
        {errors.descripcion && (
          <p className="mt-1 text-xs text-red-600">
            {errors.descripcion.message}
          </p>
        )}
      </div>

      {/* PRECIO DE VENTA */}
      <div>
        <label className="text-sm font-medium text-slate-800">
          Precio de venta
        </label>
        <input
          type="number"
          step="0.01"
          {...register("precio_venta", { valueAsNumber: true })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
        {errors.precio_venta && (
          <p className="mt-1 text-xs text-red-600">
            {errors.precio_venta.message}
          </p>
        )}
      </div>

      {/* STOCK */}
      <div>
        <label className="text-sm font-medium text-slate-800">Stock</label>
        <input
          type="number"
          {...register("cantidad_stock", { valueAsNumber: true })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
        {errors.cantidad_stock && (
          <p className="mt-1 text-xs text-red-600">
            {errors.cantidad_stock.message}
          </p>
        )}
      </div>

      {/* PROVEEDOR */}
      <div>
        <label className="text-sm font-medium text-slate-800">
          Proveedor
        </label>

        {loadingProveedores ? (
          <p className="mt-1 text-xs text-slate-500">
            Cargando proveedores...
          </p>
        ) : noHayProveedores ? (
          <p className="mt-1 text-xs text-red-600">
            No hay proveedores registrados. Primero crea uno en el módulo
            <span className="font-semibold"> Proveedores</span>.
          </p>
        ) : (
          <select
            {...register("id_proveedor", { valueAsNumber: true })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          >
            <option value="" className="text-slate-400">Selecciona un proveedor</option>
            {proveedores.map((prov) => (
              <option key={prov.id_proveedor} value={prov.id_proveedor}>
                {prov.nombre_proveedor}
              </option>
            ))}
          </select>
        )}

        {errors.id_proveedor && (
          <p className="mt-1 text-xs text-red-600">
            {errors.id_proveedor.message}
          </p>
        )}
      </div>

      {/* BOTONES */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || noHayProveedores}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {noHayProveedores
            ? "Registra un proveedor primero"
            : isSubmitting
            ? "Guardando..."
            : "Guardar"}
        </button>
      </div>
    </form>
  );
}
