import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage.tsx'
import { ManifestGate } from './pages/ManifestGate.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { PlayerPage } from './pages/PlayerPage.tsx'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ManifestGate>
        {(manifest) => (
          <Routes>
            <Route path="/" element={<HomePage manifest={manifest} />} />
            <Route path="/p/:username" element={<PlayerPage manifest={manifest} />} />
            <Route path="/p/:username/:build" element={<PlayerPage manifest={manifest} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        )}
      </ManifestGate>
    </BrowserRouter>
  )
}
