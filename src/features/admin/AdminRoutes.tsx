import { Route, Routes } from 'react-router-dom'
import { ArtworkFormPage } from './ArtworkFormPage'
import { ArtworksListPage } from './ArtworksListPage'
import { CategoriesPage } from './CategoriesPage'

export function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<ArtworksListPage />} />
      <Route path="obras/nueva" element={<ArtworkFormPage />} />
      <Route path="obras/:id" element={<ArtworkFormPage />} />
      <Route path="categorias" element={<CategoriesPage />} />
    </Routes>
  )
}
