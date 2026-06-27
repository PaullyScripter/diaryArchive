import { create } from "zustand";

interface DiaryState {
  currentDiaryId: string | null;
  setCurrentDiaryId: (id: string | null) => void;
}

export const useDiaryStore = create<DiaryState>((set) => ({
  currentDiaryId: null,
  setCurrentDiaryId: (id) => set({ currentDiaryId: id }),
}));
