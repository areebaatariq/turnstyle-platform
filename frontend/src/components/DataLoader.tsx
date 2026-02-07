import { ReactNode } from 'react';
import { useBootstrap } from '@/hooks/useQueries';

interface DataLoaderProps {
  children: ReactNode;
}

/**
 * Loads all core app data in a single request, hydrates React Query cache,
 * then renders children. If bootstrap fails (e.g. old backend without /api/bootstrap),
 * falls back to rendering children so individual queries can fetch their own data.
 */
export default function DataLoader({ children }: DataLoaderProps) {
  const { isLoading, isError, error } = useBootstrap();

  // Bootstrap unavailable (404 / old backend) - render children; they'll fetch per-query
  const is404 = isError && error instanceof Error && (
    error.message.includes('404') || error.message.includes('Cannot GET')
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    );
  }

  if (isError && !is404) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-destructive font-medium">Failed to load data</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Please refresh the page to try again.'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
