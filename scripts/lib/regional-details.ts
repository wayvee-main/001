import { parseDetailContent, type DetailContent } from '../../src/lib/detail-content';

/** Empty fields from a partial source never erase prior verified goods. */
export function mergeRegionalDetails(existing: DetailContent | undefined, incoming: DetailContent | undefined): DetailContent | undefined {
  if (!incoming) return existing;
  const photos = [...(existing?.photos || []), ...(incoming.photos || [])]
    .filter((photo, index, all) => all.findIndex(other => other.url === photo.url) === index).slice(0, 16);
  return parseDetailContent({
    ...existing, ...incoming, description: incoming.description || existing?.description,
    subtitle: incoming.subtitle || existing?.subtitle, ageLabel: incoming.ageLabel || existing?.ageLabel,
    menu: incoming.menu?.items.length ? {
      ...existing?.menu, ...incoming.menu,
      items: [...(existing?.menu?.items || []), ...incoming.menu.items].reduce<NonNullable<DetailContent['menu']>['items']>((all, item) => {
        const index = all.findIndex(old => old.name.toLowerCase() === item.name.toLowerCase());
        if (index < 0) all.push(item);
        else all[index] = { ...all[index], ...item, image: item.image || all[index].image, desc: item.desc || all[index].desc, note: item.note || all[index].note };
        return all;
      }, []),
    } : existing?.menu,
    photos, offers: incoming.offers?.length ? incoming.offers : existing?.offers,
    artists: incoming.artists?.length ? incoming.artists : existing?.artists,
    notes: incoming.notes?.length ? incoming.notes : existing?.notes,
    links: incoming.links?.length ? incoming.links : existing?.links,
    venue: incoming.venue || existing?.venue,
  });
}

export function detailRetryAt(failures: number, now = Date.now()): string {
  return new Date(now + Math.min(7, 2 ** Math.min(3, Math.max(0, failures - 1))) * 86_400_000).toISOString();
}
