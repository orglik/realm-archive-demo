import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted fonts (OFL / SIL Open Font License) — bundled via @fontsource so the app makes NO
// third-party request at runtime. Previously these came from fonts.googleapis.com in index.html.
// Variable builds where one exists, static weights otherwise. See THIRD_PARTY_LICENSES.md.
import '@fontsource-variable/heebo'              // 100–900, used as --font-heebo
import '@fontsource-variable/noto-sans-hebrew'   // 100–900, used as --font-sans (body)
import '@fontsource/ibm-plex-mono/400.css'       // --font-mono: no variable build exists
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
