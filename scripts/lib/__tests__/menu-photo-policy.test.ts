/** @jest-environment node */
import { boundedCollectionLimit,menuCoverage } from '../menu-photo-policy';
import type { DetailContent } from '../../../src/lib/detail-content';
import type { SourceLink } from '../menu-photo-extract';
const base='https://venue.example/',now=new Date('2026-11-05T12:00:00Z');
const content:DetailContent={version:1,sourceUrl:base,verifiedAt:now.toISOString(),menu:{url:base+'menu',items:[{name:'Soup',categories:[]}]}};
const link=(path:string,title='Menu'):SourceLink=>({url:base+path,kind:'official',title,trustedLink:true});
it('caps malformed configuration and allows the larger bounded reservation',()=>{
 expect(boundedCollectionLimit(undefined)).toBe(3000);expect(boundedCollectionLimit('NaN')).toBe(3000);
 expect(boundedCollectionLimit(-1)).toBe(0);expect(boundedCollectionLimit(100000)).toBe(6000);
 expect(boundedCollectionLimit('800')).toBe(800);
});
it('requires every discovered menu section before reporting source completeness',()=>{
 const sources=[link('menu'),link('drinks'),link('gallery','Gallery')];
 const evidence=[{url:base+'menu',complete:true,items:1}];
 expect(menuCoverage(content,sources,evidence,0,false,now).status).toBe('partial');
 evidence.push({url:base+'drinks',complete:true,items:2});
 expect(menuCoverage(content,sources,evidence,0,false,now)).toMatchObject({status:'source_complete',expected_sources:2,captured_sources:2});
 expect(menuCoverage(content,sources,evidence,1,false,now).status).toBe('partial');
 expect(menuCoverage(content,sources,evidence,0,true,now).status).toBe('partial');
});
it('keeps semantic snapshots and OCR extraction partial, even with successful HTTP',()=>{
 expect(menuCoverage(content,[link('menu')],[{url:base+'menu',complete:false,items:1}],0,false,now).status).toBe('partial');
 expect(menuCoverage({...content,menu:undefined,menuDocuments:[{url:base+'menu.pdf',title:'Menu',format:'pdf'}]},[],[],0,false,now).status).toBe('document_only');
 expect(menuCoverage(undefined,[],[],0,false,now).status).toBe('unavailable');
});
