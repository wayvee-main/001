import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { activeCity, useActiveCity } from '@/lib/city';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { hydratePlacesFromBackend } from '@/lib/places';

const requests=new Map<string,{at:number;promise:Promise<unknown>}>();
/** Detail pages refresh the actual catalog on entry, including a menu populated
 * after launch. Concurrent pages share one request; city switches stay isolated. */
export function useDetailRefresh(kind:string|undefined):void {
  const city=useActiveCity(),[,update]=useState(0),family=kind==='event'||kind==='venue'?'events':'places';
  useFocusEffect(useCallback(()=>{
    let mounted=true;const key=city+':'+family,prior=requests.get(key),now=Date.now();
    const promise=prior&&now-prior.at<30_000?prior.promise:family==='events'?hydrateEventsFromBackend(true):hydratePlacesFromBackend(true);
    requests.set(key,{at:prior&&now-prior.at<30_000?prior.at:now,promise});
    void promise.catch(()=>undefined).then(()=>{if(mounted&&activeCity()===city)update(value=>value+1);});
    return()=>{mounted=false;};
  },[city,family]));
}
