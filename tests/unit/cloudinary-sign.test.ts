// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { buildPublicId, isValidPublicId, signParams } from '../../supabase/functions/_shared/cloudinary'

const A = '11111111-2222-3333-4444-555555555555'
const B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

describe('signParams', () => {
  test('vector oficial de la documentación de Cloudinary', async () => {
    expect(await signParams({ public_id: 'sample_image', timestamp: 1315060510 }, 'abcd')).toBe(
      'b4ad47fb4e25c7bf5f92a20089f9db59bc302313',
    )
  })
  test('ordena alfabéticamente y excluye file, api_key, resource_type y cloud_name', async () => {
    const a = await signParams({ timestamp: 1, public_id: 'x', api_key: 'k', file: 'f', resource_type: 'image', cloud_name: 'c' }, 's')
    const b = await signParams({ public_id: 'x', timestamp: 1 }, 's')
    expect(a).toBe(b)
  })
})

describe('public_id', () => {
  test('buildPublicId arma la ruta de la obra', () => {
    expect(buildPublicId(A, B)).toBe(`ale-arte/artworks/${A}/${B}`)
  })
  test('isValidPublicId acepta el formato correcto', () => {
    expect(isValidPublicId(`ale-arte/artworks/${A}/${B}`)).toBe(true)
  })
  test.each([
    '',
    `ale-arte/artworks/${A}/../${B}`,
    `otra/carpeta/${A}/${B}`,
    `ale-arte/artworks/${A}`,
    `ale-arte/artworks/${A}/${B}/extra`,
    `ale-arte/artworks/${A}/${B.toUpperCase()}`,
  ])('isValidPublicId rechaza %j', (id) => {
    expect(isValidPublicId(id)).toBe(false)
  })
})
