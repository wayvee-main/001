import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import { CITY_CENTER, milesBetween, type GeoPoint } from '@/lib/geo';
import { useActiveCityAnchor, useActiveCityName } from '@/lib/city';
import { rowToPlace, useAllPlaces, type Place } from '@/lib/places';
import { isRegionalPoint, mergeNearbyPlaces } from '@/lib/regional-nearby';
import { useScoper } from '@/lib/store';
import { supabase } from '@/lib/supabase';

const EMPTY:Place[]=[],TTL=15*60_000;
const areas=new Map<string,{at:number;places:Place[]}>(),pending=new Map<string,Promise<void>>(),byId=new Map<string,Place>();
const lookedUp=new Set<string>(),lookingUp=new Set<string>();
const listeners=new Set<()=>void>();let version=0;
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener);};
const snapshot=()=>version;
const notify=()=>{version++;listeners.forEach(listener=>listener());};
const pointKey=(point:GeoPoint)=>point.latitude.toFixed(3)+':'+point.longitude.toFixed(3);

/** Bounded, paginated READ of collected identities; never a client scrape. */
export function hydrateRegionalPlaces(point:GeoPoint,force=false):Promise<void> {
  if(!supabase||!isRegionalPoint(point))return Promise.resolve();
  const key=pointKey(point),cached=areas.get(key);
  if(!force&&cached&&Date.now()-cached.at<TTL)return Promise.resolve();
  const existing=pending.get(key);if(existing)return existing;
  const client=supabase;
  const promise=(async()=>{
    const places:Place[]=[];
    try{
      for(let page=0;page<3;page++){
        const {data,error}=await client.rpc('nearby_regional_places',{p_lat:point.latitude,p_lon:point.longitude,p_radius_miles:5,p_limit:200,p_offset:page*200});
        if(error)return; // An unprovisioned/temporarily unavailable pool retains the old city catalog.
        for(const row of data||[]){const place=rowToPlace(row);places.push(place);byId.set(place.id,place);}
        if(!data||data.length<200)break;
      }
      areas.delete(key);areas.set(key,{at:Date.now(),places});
      while(areas.size>8)areas.delete(areas.keys().next().value!);
      while(byId.size>4000)byId.delete(byId.keys().next().value!);
      notify();
    }catch{/* Offline browsing keeps the current source records. */}
  })().finally(()=>pending.delete(key));
  pending.set(key,promise);return promise;
}

/** A saved regional place can open even outside the current nearby window. */
export function useRegionalPlace(id:string|undefined):{place:Place|undefined;pending:boolean} {
  useSyncExternalStore(subscribe,snapshot,()=>0);
  useEffect(()=>{
    if(!id||id.length>256||!supabase||byId.has(id)||lookedUp.has(id)||lookingUp.has(id))return;
    const client=supabase;lookingUp.add(id);
    void (async()=>{try{const {data}=await client.from('regional_places').select('*').eq('id',id).eq('needs_review',false).maybeSingle();if(data)byId.set(id,rowToPlace(data));}
      catch{/* A cold offline bookmark can be retried on the next app launch. */}
      finally{lookingUp.delete(id);lookedUp.add(id);notify();}})();
  },[id]);
  return {place:id?byId.get(id):undefined,pending:!!id&&id.length<=256&&!!supabase&&!byId.has(id)&&!lookedUp.has(id)};
}

export function useNearbyPlaces(){
  const local=useAllPlaces(),device=useScoper(state=>state.deviceLocation),cityAnchor=useActiveCityAnchor(),cityName=useActiveCityName();
  const locationBased=isRegionalPoint(device),anchor=locationBased?device:cityAnchor;
  const key=anchor?pointKey(anchor):'';
  useSyncExternalStore(subscribe,snapshot,()=>0);
  const latitude=anchor?.latitude,longitude=anchor?.longitude;
  useFocusEffect(useCallback(()=>{
    if(latitude!=null&&longitude!=null)void hydrateRegionalPlaces({latitude,longitude});
  },[latitude,longitude]));
  const regional=areas.get(key)?.places||EMPTY;
  const places=useMemo(()=>mergeNearbyPlaces(local,regional,anchor),[local,regional,anchor]);
  const includeOakland=!locationBased||milesBetween(device,CITY_CENTER)<=5;
  const displayCity=locationBased?(device.label?.split(',')[0]?.trim()||'Near you'):cityName;
  return {places,anchor,locationBased,includeOakland,displayCity,refresh:()=>anchor?hydrateRegionalPlaces(anchor,true):Promise.resolve()};
}
