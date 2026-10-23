import * as Linking from 'expo-linking';
import { Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { PocketDossierScreen, type DossierChip, type DossierFold } from '@/components/pocket-dossier';
import type { HomeGuideEntry } from '@/lib/home-guide';
import { DOSSIER_LABELS, dossierContext, dossierEssentials, dossierMetadata } from '@/lib/pocket-dossier';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

export function HomeEntryDossier({entry}: {entry:HomeGuideEntry}) {
  const s=useScoper(),colors=useThemeColors(),context=dossierContext(entry),essentials=dossierEssentials(entry);
  const saved=entry.saveKind?s.isSaved(entry.saveKind,entry.id):entry.planKind?s.isPlanned(entry.planKind,entry.id):false;
  const save=()=>{if(entry.saveKind)s.toggleSaved(entry.saveKind,entry.id,entry.name);else if(entry.planKind)s.togglePlan(entry.planKind,entry.id,entry.name);};
  const open=(url:string)=>{void Linking.openURL(url).catch(()=>s.showToast('Could not open that link. Please try again.'));};
  const directions=entry.links.find(link=>/^directions$|open the route/i.test(link.label));
  const chips:DossierChip[]=dossierMetadata(entry).map((fact,index)=>({key:'fact-'+index,label:fact.value,glyph:['wallet','dollar'].includes(fact.glyph)?undefined:fact.glyph,accessibilityLabel:fact.label||fact.value}));
  if(entry.saveKind||entry.planKind)chips.push({key:'save',label:saved?'Saved':'Save',glyph:saved?'check':'bookmark',selected:saved,onPress:save,testID:'home-guide-save',accessibilityLabel:saved?`Remove ${entry.name} from ${entry.saveKind?'saved places':'plans'}`:`Save ${entry.name}`});
  if(directions)chips.push({key:'directions',label:'Directions',glyph:'navigation',accent:true,onPress:()=>open(directions.url)});
  const links=entry.links.filter(link=>link!==directions),remaining=entry.details.filter(fact=>!essentials.includes(fact));
  const folds:DossierFold[]=[];
  for(const section of entry.sections||[])folds.push({key:'section-'+section.title,label:section.title,glyph:entry.kind==='restaurant'?'book':entry.glyph,
    children:<View style={{gap:9}}>{section.lines.map((line,index)=><Text key={index} className="font-dm text-label text-taupe" style={{lineHeight:19}}>{line}</Text>)}</View>});
  if(remaining.length)folds.push({key:'more',label:'More details',glyph:'compass',children:<View style={{gap:9}}>{remaining.map((fact,index)=><View key={index} style={{gap:3}}><Text className="font-dm text-fine text-taupe">{fact.label}</Text><Text className="font-dm text-label text-ink" style={{lineHeight:18}}>{fact.value}</Text></View>)}</View>});
  if(links.length)folds.push({key:'links',label:entry.kind==='restaurant'?'Menu & ordering':'Official links',glyph:entry.kind==='restaurant'?'book':'compass',children:<View style={{gap:4}}>{links.map(link=><TouchableOpacity key={link.url} accessibilityRole="link" accessibilityLabel={link.label} onPress={()=>open(link.url)} style={{minHeight:38,flexDirection:'row',alignItems:'center',gap:6}}>
    <Text className="font-dm text-label text-peach">{link.label}</Text><Glyph name="arrow" size={13} color={colors['surface-accent']} />
  </TouchableOpacity>)}</View>});
  if(entry.kind==='restaurant'&&folds.length){
    const content=<View style={{gap:15}}>{folds.map(fold=><View key={fold.key} style={{gap:7}}>
      {fold.key.startsWith('section-')?<Text className="font-dm-medium text-label text-ink">{fold.label}</Text>:null}{fold.children}
    </View>)}</View>;
    folds.splice(0,folds.length,{key:'menu',label:'Menu & ordering',glyph:'book',children:content});
  }
  return <PocketDossierScreen key={entry.kind+':'+entry.id} context={context} image={entry.image} glyph={entry.glyph} eyebrow={DOSSIER_LABELS[entry.kind]} chips={chips} essentials={essentials} folds={folds} />;
}
