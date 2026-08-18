import { create } from 'zustand';
import type { Trip } from './trips';

interface PendingTripState {
  trip: Trip | null;
  setTrip: (trip: Trip) => void;
  clear: () => void;
}

export const usePendingTripStore = create<PendingTripState>((set) => ({
  trip: null,
  setTrip: (trip) => set({ trip }),
  clear: () => set({ trip: null }),
}));
