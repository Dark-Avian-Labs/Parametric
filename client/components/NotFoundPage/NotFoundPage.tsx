import { Link } from 'react-router-dom';

import { APP_PATHS } from '../../app/paths';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="space-y-3 text-center">
        <span
          className="block text-8xl font-bold leading-none text-muted/80"
          role="status"
          aria-label="Error 404"
        >
          404
        </span>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted">
          We could not find the page you were looking for.
        </p>
        <Link
          to={APP_PATHS.home}
          className="inline-block rounded-md bg-white px-4 py-2 text-sm text-black transition hover:opacity-90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
