// Claude model pricing per 1M tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5-20250929": { input: 3, output: 15 },
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
};

const DEFAULT_PRICING = { input: 3, output: 15 }; // default to Sonnet

export function estimateCost(
  model: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = model ? (PRICING[model] || DEFAULT_PRICING) : DEFAULT_PRICING;
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `<$0.01`;
  if (cost < 1) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(2)}`;
}

export function getModelDisplayName(model: string | null | undefined): string {
  if (!model) return "Unknown";
  if (model.includes("sonnet")) return "Sonnet 4.5";
  if (model.includes("opus")) return "Opus 4.6";
  if (model.includes("haiku")) return "Haiku 4.5";
  return model.split("-").pop() || model;
}
