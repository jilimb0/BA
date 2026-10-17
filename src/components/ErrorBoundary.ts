/**
 * ErrorBoundary and Skeleton loader definitions for Business Analyzer.
 */
export function withErrorBoundary<T extends (...args: unknown[]) => unknown>(fn: T): T {
  return ((...args: unknown[]) => {
    try {
      return fn(...args);
    } catch (err) {
      console.warn('[ErrorBoundary-Intercepted]', err);
      return null;
    }
  }) as T;
}

export function renderSkeletonLoader(): string {
  return `
    <div class="skeleton-loader space-y-3 p-4 animate-pulse">
      <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
      <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
      <div class="h-8 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
    </div>
  `;
}
