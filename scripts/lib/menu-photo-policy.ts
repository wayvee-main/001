import type { DetailContent } from '../../src/lib/detail-content';
import type { SourceLink } from './menu-photo-extract';

export const COLLECTION_REQUEST_MAX = 6000;
export const COLLECTION_IMAGE_TARGET = 10000;
export const COLLECTION_MENU_SOURCE_MAX = 16;

export function boundedCollectionLimit(value: unknown, fallback = 3000): number {
 const number = Number(value ?? fallback);
 return Math.max(0, Math.min(COLLECTION_REQUEST_MAX, Math.floor(Number.isFinite(number) ? number : fallback)));
}

export type MenuSourceEvidence = {url:string;complete:boolean;items:number};
export type MenuCoverage = {
 status:'source_complete'|'partial'|'document_only'|'unavailable';scope:'discovered_published_sources';
 item_count:number;document_count:number;expected_sources:number;captured_sources:number;
 failed_sources:number;limited:boolean;checked_at:string;
};

/** A featured item or a successful HTTP response is never a complete menu.
 * Completeness is bounded to the published menu sources actually discovered;
 * PDF/OCR and unsupported catalog formats remain explicitly partial. */
export function menuCoverage(content:DetailContent|undefined,sources:readonly SourceLink[],evidence:readonly MenuSourceEvidence[],failedSources:number,limited:boolean,now=new Date()):MenuCoverage {
 const key=(url:string)=>{try{const value=new URL(url);value.hash='';return value.href;}catch{return url;}};
 const expected=new Set(sources.filter(source=>source.document||/menu|dinner|lunch|brunch|breakfast|drinks|food|order|pickup/i.test(source.url+' '+source.title)).map(source=>key(source.url)));
 const captured=new Map(evidence.map(source=>[key(source.url),source]));
 for(const source of evidence)expected.add(key(source.url));
 const items=content?.menu?.items.length||0,documents=content?.menuDocuments?.length||0;
 const complete=items>0&&expected.size>0&&!limited&&!failedSources&&[...expected].every(url=>{
  const result=captured.get(url);return result?.complete&&result.items>0;
 });
 return {status:complete?'source_complete':items?'partial':documents?'document_only':'unavailable',scope:'discovered_published_sources',
  item_count:items,document_count:documents,expected_sources:expected.size,captured_sources:captured.size,
  failed_sources:failedSources,limited,checked_at:now.toISOString()};
}
