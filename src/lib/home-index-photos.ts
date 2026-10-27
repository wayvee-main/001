import { CRAWLS } from '@/lib/data';
import type { HomeGuideCatalog, HomeGuideEntry } from '@/lib/home-guide';
import { HOME_TILE_PREVIEW_PHOTOS } from '@/lib/home-tile-photos';
import { usableHomePhoto } from '@/lib/home-tile-previews';

export type HomeIndexPhoto = { source: string | number; label: string };

function entryPhotos(entry: HomeGuideEntry): HomeIndexPhoto[] {
  const bundled = HOME_TILE_PREVIEW_PHOTOS[`/${entry.kind}/${entry.id}`];
  const photos: HomeIndexPhoto[] = bundled ? [bundled] : [];
  const urls = [
    entry.image,
    ...(entry.detailContent?.photos?.map(photo => photo.url) || []),
    ...(entry.detailContent?.menu?.items.map(item => item.image) || []),
  ];
  for (const url of urls) {
    const source = usableHomePhoto(url);
    if (!source) continue;
    const path = new URL(source).pathname;
    if (/\.(svg|ico)$/i.test(path) || /(?:^|[^a-z0-9])(logo|wordmark|brandmark|favicon|icon)(?:[^a-z0-9]|$)/i.test(path)) continue;
    photos.push({ source, label: `Photo from ${entry.name}` });
  }
  return photos;
}

const addressKey = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** A route can show one of its actual stops; never borrow another branch's photo. */
export function homeIndexPhotos(entry: HomeGuideEntry, catalog: HomeGuideCatalog): HomeIndexPhoto[] {
  const photos = entryPhotos(entry);
  if (entry.kind === 'crawl') {
    for (const stop of CRAWLS[entry.id]?.stops || []) {
      const street = addressKey(stop.note.split('·')[0]);
      const match = Object.values(catalog.entries).find(candidate => candidate.kind !== 'crawl'
        && addressKey(candidate.name) === addressKey(stop.name)
        && street && candidate.details.some(fact => fact.label === 'Address' && addressKey(fact.value).startsWith(street)));
      if (match) photos.push(...entryPhotos(match).map(photo => ({ ...photo, label: `${match.name}, a stop on ${entry.name}` })));
    }
  }
  return photos.filter((photo, index) => photos.findIndex(other => other.source === photo.source) === index);
}

export const homeIndexPhotoKey = (photos: readonly HomeIndexPhoto[]) => JSON.stringify(photos.map(photo => photo.source));
