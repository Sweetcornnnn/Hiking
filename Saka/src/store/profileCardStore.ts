import { create } from 'zustand';

interface ProfileCardState {
  reopenRequested: boolean;
  requestReopen: () => void;
  /** Returns true once and resets the flag. */
  consumeReopen: () => boolean;
}

export const useProfileCardStore = create<ProfileCardState>((set, get) => ({
  reopenRequested: false,
  requestReopen: () => set({ reopenRequested: true }),
  consumeReopen: () => {
    if (!get().reopenRequested) return false;
    set({ reopenRequested: false });
    return true;
  },
}));
