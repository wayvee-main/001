import { milesBetween, type GeoPoint } from '@/lib/geo';
import type { Place } from '@/lib/places';

/** The supported region is wider than the former Oakland commute circle. */
export function isRegionalPoint(point:GeoPoint|null|undefined):point is GeoPoint {
  return !!point&&Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)&&point.latitude>=36.8&&point.latitude<=39&&point.longitude>=-123.65&&point.longitude<=-121.1;
}

/** Filtering happens before display; the stored regional pool stays broad. */
export function mergeNearbyPlaces(local:readonly Place[],regional:readonly Place[],anchor:GeoPoint|null,radius=5):Place[] {
  const entries=new Map<string,Place>();
  for(const place of [...local,...regional]){
    if(place.needsReview||!Number.isFinite(place.lat)||!Number.isFinite(place.lon))continue;
    if(anchor&&milesBetween(anchor,{latitude:place.lat,longitude:place.lon})>radius)continue;
    const old=entries.get(place.id);
    const oldGoods=old?.detailContent,newGoods=place.detailContent;
    const goods=oldGoods&&(!newGoods||Date.parse(oldGoods.verifiedAt)>Date.parse(newGoods.verifiedAt))?oldGoods:newGoods;
    entries.set(place.id,old?{...old,...place,image:place.image||old.image,detailContent:goods,openingHours:place.openingHours||old.openingHours}:place);
  }
  return [...entries.values()].sort((a,b)=>anchor?milesBetween(anchor,{latitude:a.lat,longitude:a.lon})-milesBetween(anchor,{latitude:b.lat,longitude:b.lon})||a.id.localeCompare(b.id):a.id.localeCompare(b.id));
}
