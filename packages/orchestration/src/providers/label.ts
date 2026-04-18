import type { ModelProvider, ProviderLabel } from "../types/providers";

export function describeProvider(
  provider: ModelProvider,
  fallbackModel = "unknown"
): ProviderLabel {
  const label = provider.getLabel?.();
  if (label) {
    return label;
  }

  return {
    name: provider.name,
    model: (provider as { model?: string }).model ?? fallbackModel,
  };
}
