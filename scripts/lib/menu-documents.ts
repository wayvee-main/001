import { execFile } from 'node:child_process';
import { mkdtemp,writeFile,rm,readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { menuFromText,type PlaceIdentity } from './menu-photo-extract';
const run=promisify(execFile);

export async function readMenuDocument(body:Buffer,format:'pdf'|'image',url:string,identity:PlaceIdentity){
 const dir=await mkdtemp(join(tmpdir(),'wayvee-menu-'));
 try{
  const input=join(dir,format==='pdf'?'menu.pdf':'menu.image');await writeFile(input,body);
  if(format==='pdf'){
   try{const result=await run('pdftotext',['-layout','-f','1','-l','12',input,'-'],{timeout:20000,maxBuffer:1_000_000});const parsed=menuFromText(result.stdout,url,identity);if(parsed?.menu?.items.length)return parsed;}catch{/* OCR fallback below is separately bounded. */}
   await run('pdftoppm',['-f','1','-l','3','-scale-to','1800','-png',input,join(dir,'page')],{timeout:30000,maxBuffer:100_000});
  }
  const images=format==='pdf'?(await readdir(dir)).filter(name=>/^page.*\.png$/.test(name)).map(name=>join(dir,name)):[input];
  const lines:string[]=[],confidence=new Map<string,number>();
  for(const image of images.slice(0,3)){
   const result=await run('tesseract',[image,'stdout','-l','eng','--psm','6','tsv'],{timeout:25000,maxBuffer:1_000_000,env:{...process.env,OMP_THREAD_LIMIT:'1'}});
   const groups=new Map<string,{words:string[];scores:number[]}>();
   for(const row of result.stdout.split('\n').slice(1)){
    const c=row.split('\t');if(c.length<12||c[0]!=='5'||!c[11]?.trim())continue;
    const key=c.slice(1,5).join(':');const g=groups.get(key)||{words:[],scores:[]};g.words.push(c.slice(11).join('\t'));g.scores.push(Number(c[10]));groups.set(key,g);
   }
   for(const g of groups.values()){const text=g.words.join(' ').trim();if(!text)continue;lines.push(text);confidence.set(text,Math.min(...g.scores));}
  }
  return menuFromText(lines.join('\n'),url,identity,new Date(),confidence);
 }catch{return undefined;}finally{await rm(dir,{recursive:true,force:true});}
}
