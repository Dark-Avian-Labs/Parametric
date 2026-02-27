import { Component, lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { APP_PATHS } from './paths';
import { Layout } from '../components/Layout/Layout';
import { NotFoundPage } from '../components/NotFoundPage/NotFoundPage';
import { RequireAuth } from '../features/auth/RequireAuth';

const BuildOverview = lazy(() =>
  import('../components/BuildOverview/BuildOverview').then((mod) => ({
    default: mod.BuildOverview,
  })),
);
const ModBuilder = lazy(() =>
  import('../components/ModBuilder/ModBuilder').then((mod) => ({
    default: mod.ModBuilder,
  })),
);
const AdminPage = lazy(() =>
  import('../components/Auth/AdminPage').then((mod) => ({
    default: mod.AdminPage,
  })),
);
const ProfilePage = lazy(() =>
  import('../features/profile/ProfilePage').then((mod) => ({
    default: mod.ProfilePage,
  })),
);
const LoginPage = lazy(() =>
  import('../components/Auth/LoginPage').then((mod) => ({
    default: mod.LoginPage,
  })),
);

type ChunkErrorBoundaryProps = {
  children: React.ReactNode;
  reset?: () => void;
};

type ChunkErrorBoundaryState = {
  hasError: boolean;
};

class ChunkErrorBoundary extends Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  state: ChunkErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ChunkErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(
      '[ChunkErrorBoundary] Chunk load failed',
      error,
      info.componentStack,
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
    if (this.props.reset) {
      this.props.reset();
      return;
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted" role="alert">
              We could not load this page. Please try again.
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-md bg-white px-4 py-2 text-sm text-black transition hover:opacity-90"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted" role="status" aria-live="polite">
        Loading...
      </p>
    </div>
  );
}

export function AppRoutes() {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route
              path="/"
              element={<Navigate to={APP_PATHS.home} replace />}
            />
            <Route path={APP_PATHS.buildOverview} element={<BuildOverview />} />
            <Route path={APP_PATHS.buildNew} element={<ModBuilder />} />
            <Route path={APP_PATHS.buildEdit} element={<ModBuilder />} />
            <Route path={APP_PATHS.admin} element={<AdminPage />} />
            <Route path={APP_PATHS.profile} element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path={APP_PATHS.login} element={<LoginPage />} />
        </Routes>
      </Suspense>
    </ChunkErrorBoundary>
  );
}
