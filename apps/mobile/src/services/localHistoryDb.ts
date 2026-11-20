import type { CheckResponse, SuggestionItem } from '@select-check/shared';

export interface HistoryItem {
  id: string;
  originalText: string;
  suggestions: [SuggestionItem, SuggestionItem, SuggestionItem];
  detectedLanguage: string;
  timestamp: number;
  isFavorite: boolean;
  selectedStyle?: string;
}

const STORAGE_KEY = 'selectcheck_mobile_history_v1';

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load history from localStorage', err);
    return [];
  }
}

export function saveHistory(items: HistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save history to localStorage', err);
  }
}

export function addHistoryEntry(response: CheckResponse, selectedStyle?: string): HistoryItem {
  const items = loadHistory();
  const newItem: HistoryItem = {
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    originalText: response.originalText,
    suggestions: response.suggestions,
    detectedLanguage: response.detectedLanguage || 'EN',
    timestamp: Date.now(),
    isFavorite: false,
    selectedStyle
  };

  // Keep latest 250 items to conserve storage
  const updated = [newItem, ...items].slice(0, 250);
  saveHistory(updated);
  return newItem;
}

export function toggleFavoriteEntry(id: string): HistoryItem[] {
  const items = loadHistory();
  const updated = items.map((item) =>
    item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
  );
  saveHistory(updated);
  return updated;
}

export function deleteHistoryEntry(id: string): HistoryItem[] {
  const items = loadHistory();
  const updated = items.filter((item) => item.id !== id);
  saveHistory(updated);
  return updated;
}

export function clearAllHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear history', err);
  }
}
