import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { deleteStoredItem, getStoredItem, setStoredItem } from '@/lib/storage';
import { todayIso } from '@/lib/stay';
import { toggleEveningStop, type EveningStop, type LocalOffer } from '@/lib/local-perks';

// SecureStore payloads can span chunks. Serialize writes so rapid +/- taps
// cannot leave a marker from one version pointing at another version's chunks.
let pendingWrite: Promise<unknown> = Promise.resolve();
const writeStoredItem = (key: string, value: string) => {
  const write = pendingWrite.catch(() => undefined).then(() => setStoredItem(key, value));
  pendingWrite = write;
  return write;
};

interface PerksState {
  date: string; stops: EveningStop[]; savedOffers: string[];
  offer: LocalOffer | null; eggOpen: boolean; eggRoll: number; hydrated: boolean;
  toggleStop: (stop: EveningStop) => void;
  clearEvening: (city: string) => void;
  openOffer: (offer: LocalOffer | null) => void;
  toggleOffer: (id: string) => void;
  openEgg: () => void; closeEgg: () => void; reroll: () => void;
}

/** A device-local evening draft works before sign-in. Account saves and
 * bookings keep their existing authenticated paths. No raw prompts stored. */
export const useLocalPerks = create<PerksState>()(persist((set, get) => ({
  date: todayIso(), stops: [], savedOffers: [], offer: null, eggOpen: false, eggRoll: 0, hydrated: false,
  toggleStop: stop => set(state => ({ date: todayIso(), stops: toggleEveningStop(state.date === todayIso() ? state.stops : [], stop) })),
  clearEvening: city => set(state => ({ stops: state.stops.filter(stop => stop.city !== city) })),
  openOffer: offer => set({ offer, eggOpen: false }),
  toggleOffer: id => set(state => ({ savedOffers: state.savedOffers.includes(id) ? state.savedOffers.filter(value => value !== id) : [...state.savedOffers, id] })),
  openEgg: () => set({ eggOpen: true, offer: null, eggRoll: get().eggOpen ? get().eggRoll : 0 }),
  closeEgg: () => set({ eggOpen: false }),
  reroll: () => set(state => ({ eggRoll: state.eggRoll + 1 })),
}), {
  name: 'wayvee.local-perks.v1',
  storage: createJSONStorage(() => ({ getItem: getStoredItem, setItem: writeStoredItem, removeItem: deleteStoredItem })),
  partialize: state => ({ date: state.date, stops: state.stops, savedOffers: state.savedOffers }),
  merge: (stored, current) => {
    const value = stored as Partial<PerksState> | null;
    const valid = Array.isArray(value?.stops) ? value.stops.filter(stop => stop && typeof stop.id === 'string' && typeof stop.kind === 'string' && typeof stop.city === 'string' && typeof stop.name === 'string' && typeof stop.caption === 'string' && typeof stop.glyph === 'string' && Array.isArray(stop.facts)).slice(0, 40) : [];
    return { ...current, date: todayIso(), stops: value?.date === todayIso() ? valid : [],
      savedOffers: Array.isArray(value?.savedOffers) ? value.savedOffers.filter((id): id is string => typeof id === 'string').slice(-100) : [] };
  },
  onRehydrateStorage: () => () => { useLocalPerks.setState({ hydrated: true }); },
}));
