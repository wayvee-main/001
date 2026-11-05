import { useActiveCity } from '@/lib/city';
import type { HomeGuideEntry } from '@/lib/home-guide';
import { eveningStopKey, MAX_EVENING_STOPS, perksAreaKey } from '@/lib/local-perks';
import { useLocalPerks } from '@/lib/local-perks-store';
import { todayIso } from '@/lib/stay';
import { useScoper } from '@/lib/store';

/** Save and add-to-evening for one listing, shared by every card that offers them. */
export function useEntryActions(entry: HomeGuideEntry) {
  const s = useScoper(), perks = useLocalPerks(), activeCity = useActiveCity();
  const city = perksAreaKey(activeCity, s.deviceLocation), key = eveningStopKey(entry);
  const added = perks.date === todayIso() && perks.stops.some(stop => stop.city === city && eveningStopKey(stop) === key);
  const saved = entry.saveKind ? s.isSaved(entry.saveKind, entry.id) : entry.planKind ? s.isPlanned(entry.planKind, entry.id) : false;
  const canSave = Boolean(entry.saveKind || entry.planKind);
  const save = () => {
    if (entry.saveKind) s.toggleSaved(entry.saveKind, entry.id, entry.name);
    else if (entry.planKind) s.togglePlan(entry.planKind, entry.id, entry.name);
  };
  const add = () => {
    if (!added && perks.stops.filter(stop => stop.city === city).length >= MAX_EVENING_STOPS && perks.date === todayIso()) { s.showToast('Keep up to eight stops in an evening.'); return; }
    perks.toggleStop({ kind: entry.kind, id: entry.id, city, name: entry.name, caption: entry.caption, image: entry.image, glyph: entry.glyph, facts: entry.facts });
    s.showToast(added ? 'A little room for something else.' : 'One good stop, kept in mind.');
  };
  return { saved, canSave, save, added, add };
}
