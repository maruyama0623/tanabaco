const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/api';

export interface AiSearchInput {
  query: string;
  photoUrl?: string | null;
  department?: string;
}

export interface AiSearchSuggestion {
  productId: string;
  reason?: string;
  confidence?: number;
}

export interface AiSearchResponse {
  suggestions: AiSearchSuggestion[];
  model?: string;
  totalTokens?: number;
}

export async function requestAiSearch(input: AiSearchInput): Promise<AiSearchResponse> {
  const res = await fetch(`${API_BASE}/ai-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'AI検索に失敗しました');
  }

  const data = (await res.json()) as AiSearchResponse & { error?: string };
  if (data.error) {
    throw new Error(data.error);
  }
  return {
    suggestions: data.suggestions ?? [],
    model: data.model,
    totalTokens: data.totalTokens,
  };
}
