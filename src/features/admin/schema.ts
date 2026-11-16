import { z } from 'zod'

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().transform((v) => (v ? v : null))

export const artworkInputSchema = z
  .object({
    title: z.string().trim().min(1, 'El título es obligatorio').max(150),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones').max(170),
    description: optionalText(5000),
    price: z.number().int().nonnegative('El precio no puede ser negativo').max(999_999_999_999).nullable(),
    height: z.number().positive().max(99999).nullable(),
    width: z.number().positive().max(99999).nullable(),
    measurement_unit: z.enum(['cm', 'm', 'in']).nullable(),
    technique: optionalText(150),
    category_id: z.uuid('Categoría inválida'),
    creation_date: z.iso.date().nullable(),
    availability_status: z.enum(['available', 'sold', 'commission']),
    publication_status: z.enum(['draft', 'published']),
    display_order: z.number().int(),
  })
  .refine((v) => (v.height == null && v.width == null) || v.measurement_unit != null, {
    message: 'Indica la unidad de medida',
    path: ['measurement_unit'],
  })

export type ArtworkInput = z.infer<typeof artworkInputSchema>

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(100),
  description: optionalText(1000),
})
export type CategoryInput = z.infer<typeof categoryInputSchema>
