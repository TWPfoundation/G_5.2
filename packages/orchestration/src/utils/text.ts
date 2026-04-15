export function truncate(text: string, max = 500): string {
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

export function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function tokenizeSearchText(text: string): string[] {
  const normalized = normalizeForSearch(text);
  return normalized.length > 0 ? normalized.split(/\s+/) : [];
}

export function uniqueSearchTokens(text: string): string[] {
  return [...new Set(tokenizeSearchText(text))];
}

export function hasSearchPhrase(haystack: string, needle: string): boolean {
  const normalizedHaystack = normalizeForSearch(haystack);
  const normalizedNeedle = normalizeForSearch(needle);

  return normalizedNeedle.length > 0 &&
    normalizedHaystack.includes(normalizedNeedle);
}
