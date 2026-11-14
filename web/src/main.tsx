import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/tokens.css';
import './theme/materials.css';
import { App } from './App';
import { connect } from './state/world';
import { installEconDemo } from './globe/economy/econDemo';
installEconDemo();

// ?gallery or #gallery opens the model gallery instead of the app (its own chunk, no server needed).
const wantsGallery = () => new URLSearchParams(location.search).has('gallery') || location.hash === '#gallery';
const isGallery = wantsGallery();
const Gallery = lazy(() => import('./gallery/Gallery').then((m) => ({ default: m.Gallery })));
window.addEventListener('hashchange', () => { if (wantsGallery() !== isGallery) location.reload(); });
// ?materials opens the material-system reference sheet (theme/MaterialsSheet.tsx, no server needed).
const isMaterials = new URLSearchParams(location.search).has('materials');
const MaterialsSheet = lazy(() => import('./theme/MaterialsSheet').then((m) => ({ default: m.MaterialsSheet })));

if (!isGallery && !isMaterials) connect();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isMaterials ? (
      <Suspense fallback={null}>
        <MaterialsSheet />
      </Suspense>
    ) : isGallery ? (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
