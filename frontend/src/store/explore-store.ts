import { create } from "zustand";

export interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  content_html: string;
  tags: string[];
  emotion: string | null;
  author: {
    id: string;
    username: string;
    avatar_path: string | null;
  };
  stats: {
    like_count: number;
    comment_count: number;
    bookmark_count: number;
  };
  is_liked: boolean;
  is_bookmarked: boolean;
  is_owner: boolean;
  created_at: string;
  highlights: {
    title: string;
    content_text: string;
  };
}

interface ExploreState {
  query: string;
  selectedTags: string[];
  selectedEmotion: string | null;
  selectedYear: number | null;
  selectedMonth: number | null;
  sort: string;
  page: number;

  setQuery: (q: string) => void;
  toggleTag: (tag: string) => void;
  setEmotion: (emotion: string | null) => void;
  setDate: (year: number | null, month: number | null) => void;
  setSort: (sort: string) => void;
  setPage: (page: number) => void;
  clearFilters: () => void;
  hasActiveFilters: () => boolean;
}

export const useExploreStore = create<ExploreState>((set, get) => ({
  query: "",
  selectedTags: [],
  selectedEmotion: null,
  selectedYear: null,
  selectedMonth: null,
  sort: "created_at:desc",
  page: 1,

  setQuery: (q) => set({ query: q, page: 1 }),
  toggleTag: (tag) =>
    set((s) => ({
      selectedTags: s.selectedTags.includes(tag)
        ? s.selectedTags.filter((t) => t !== tag)
        : [...s.selectedTags, tag],
      page: 1,
    })),
  setEmotion: (emotion) => set({ selectedEmotion: emotion, page: 1 }),
  setDate: (year, month) => set({ selectedYear: year, selectedMonth: month, page: 1 }),
  setSort: (sort) => set({ sort, page: 1 }),
  setPage: (page) => set({ page }),
  clearFilters: () =>
    set({
      query: "",
      selectedTags: [],
      selectedEmotion: null,
      selectedYear: null,
      selectedMonth: null,
      page: 1,
    }),
  hasActiveFilters: () => {
    const s = get();
    return (
      s.query !== "" ||
      s.selectedTags.length > 0 ||
      s.selectedEmotion !== null ||
      s.selectedYear !== null ||
      s.selectedMonth !== null
    );
  },
}));
