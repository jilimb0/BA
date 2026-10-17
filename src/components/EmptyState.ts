/**
 * EmptyState and ZeroState UI definitions for Business Analyzer.
 * Renders fallback states and onboarding guidance when filters match 0 items.
 */
export interface EmptyStateConfig {
  title: string;
  description: string;
  actionText?: string;
  actionUrl?: string;
}

export function renderEmptyState(config: EmptyStateConfig): string {
  return `
    <div class="empty-state zero-state text-center p-8 border border-dashed rounded-xl bg-slate-50 dark:bg-slate-900/40">
      <div class="text-3xl mb-2">🔍</div>
      <h3 class="font-semibold text-lg text-slate-800 dark:text-slate-100">${config.title}</h3>
      <p class="text-sm text-slate-500 max-w-md mx-auto my-2">${config.description}</p>
      ${
        config.actionText
          ? `<button class="btn btn-primary mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">${config.actionText}</button>`
          : ''
      }
    </div>
  `;
}
