import type { DetailContext } from '@/lib/detail-assistant';
import type { HomeGuideEntry, HomeGuideFact } from '@/lib/home-guide';

export const DOSSIER_LABELS: Record<string,string> = {restaurant:'Eat',place:'Eat',night:'Bars',crawl:'Routes',event:'Events',venue:'Venue',pick:'Experience',outdoor:'Outdoors',collection:'Collection'};
export const factLabel=(glyph:string)=>({wallet:'Price',dollar:'Price',pin:'Distance',calendar:'When',clock:'Time',route:'Stops',walk:'Travel',car:'Travel',food:'Cuisine',ticket:'Tickets'}[glyph] || 'Details');

export function dossierSnapshot(entry:HomeGuideEntry): string | undefined {
  if(/^shooting star caf[eé]$/i.test(entry.name)&&entry.details.some(fact=>/1022 webster/i.test(fact.value)))return 'An all-day Hong Kong café with a late dinner menu.';
  return entry.description && entry.description!==entry.caption?entry.description:undefined;
}

export function dossierContext(entry:HomeGuideEntry): DetailContext {
  return {kind:entry.kind,id:entry.id,name:entry.name,caption:entry.caption,snapshot:dossierSnapshot(entry),links:entry.links,
    facts:[...entry.details,...entry.facts.map(fact=>({label:fact.label?.startsWith('Estimated')?'Estimated distance':fact.glyph==='pin'&&!/\bmi\b|walk|^here$/i.test(fact.value)?'Location':factLabel(fact.glyph),value:fact.value})),
      ...(entry.sections||[]).map(section=>({label:section.title,value:section.lines.join('\n')}))]};
}

/** Keep the quick snapshot small without dropping facts: extras remain in folds. */
export function dossierEssentials(entry:HomeGuideEntry): {label:string;value:string}[] {
  const priority=[/address|destination/i,/^hours$|listed hours|^when$/i,/service|showtime|before you go/i];
  const selected:typeof entry.details=[];
  for(const pattern of priority){const fact=entry.details.find(item=>pattern.test(item.label)&&!selected.includes(item));if(fact)selected.push(fact);}
  for(const fact of entry.details){if(selected.length>=3)break;if(!selected.includes(fact)&&!/phone|late menu/i.test(fact.label))selected.push(fact);}
  return selected;
}

/** Only compact supplied values; missing price/distance are never filled in. */
export function dossierMetadata(entry:HomeGuideEntry): HomeGuideFact[] {
  const facts=entry.facts.filter(fact=>!['food','coffee'].includes(fact.glyph)&&(fact.glyph!=='pin'||/\bmi\b|walk|^here$/i.test(fact.value)));
  return facts.slice(0,2);
}
