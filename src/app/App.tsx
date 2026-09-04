import { lazy, Suspense } from 'solid-js';
import { Route, Router } from '@solidjs/router';
import { SiteLayout } from '@/app/SiteLayout';
import HomePage from '@/pages/HomePage';
import { MusicPageFallback } from '@/pages/MusicPageFallback';

const MusicPage = lazy(() => import('@/pages/MusicPage'));

export default function App() {
  return (
    <Router root={SiteLayout}>
      <Route path="/" component={HomePage} />
      <Route
        path="/music"
        component={() => (
          <Suspense fallback={<MusicPageFallback />}>
            <MusicPage />
          </Suspense>
        )}
      />
    </Router>
  );
}
