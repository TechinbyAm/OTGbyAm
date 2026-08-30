import { create } from 'zustand';
import type { Trip } from './trips';
import type { Discovery } from './discoveries';

interface PendingTripState {
  trip: Trip | null;
  setTrip: (trip: Trip) => void;
  // Set alongside `trip` only by Discovery's promote-to-trip flow (T28,
  // mirrors T8 on web). plan.tsx marks these `promoted` in
  // createMutation.onSuccess -- after the trip actually saves, never the
  // moment "Start a trip from these" is tapped, so canceling the editor
  // can't leave a discovery pointing at a trip that was never created.
  promotingDiscoveries: Discovery[] | null;
  setPromotingDiscoveries: (discoveries: Discovery[]) => void;
  clear: () => void;
}

export const usePendingTripStore = create<PendingTripState>((set) => ({
  trip: null,
  setTrip: (trip) => set({ trip }),
  promotingDiscoveries: null,
  setPromotingDiscoveries: (discoveries) => set({ promotingDiscoveries: discoveries }),
  clear: () => set({ trip: null, promotingDiscoveries: null }),
}));
