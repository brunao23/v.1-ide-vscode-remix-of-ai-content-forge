import { create } from 'zustand';

interface ImplementationStore {
  checkedCount: number;
  totalCount: number;
  /** Called by ImplementationPage whenever tasks/checks change */
  setProgress: (checked: number, total: number) => void;
}

export const useImplementationStore = create<ImplementationStore>((set) => ({
  checkedCount: 0,
  totalCount: 0,
  setProgress: (checked, total) => set({ checkedCount: checked, totalCount: total }),
}));
