import { ICON_PATHS, type IconName } from '../../lib/brandIcons'

/** Ícono de marca decorativo: el enlace que lo contiene lleva el nombre accesible. */
export function BrandIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path d={ICON_PATHS[name]} fill="currentColor" />
    </svg>
  )
}
