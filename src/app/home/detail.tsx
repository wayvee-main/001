import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { Glyph } from '@/components/glyph';
import { HomeGuideFacts, HomeGuideHeading, HomeGuideScreen } from '@/components/home-field-guide';
import { Photo } from '@/components/photo';
import { EmptyState } from '@/components/ui';
import { homeGuideKey } from '@/lib/home-guide';
import { useControlSurface, useRaisedSurface } from '@/lib/shadows';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { useHomeGuide } from '@/lib/use-home-guide';

export default function HomeDetailScreen() {
  const {kind,id}=useLocalSearchParams<{kind?:string;id?:string}>(),{catalog,now}=useHomeGuide();
  const colors=useThemeColors(),surface=useRaisedSurface(1),control=useControlSurface(),s=useScoper();
  const entry=catalog.entries[homeGuideKey(kind || '',id || '')];
  const saved=!!entry&&(entry.saveKind?s.isSaved(entry.saveKind,entry.id):entry.planKind?s.isPlanned(entry.planKind,entry.id):false);
  const save=()=>{if(!entry)return;if(entry.saveKind)s.toggleSaved(entry.saveKind,entry.id,entry.name);else if(entry.planKind)s.togglePlan(entry.planKind,entry.id,entry.name);};
  const open=(url:string)=>{void Linking.openURL(url).catch(()=>s.showToast('Could not open that link. Please try again.'));};
  return <HomeGuideScreen now={now}>
    {entry?<>
      <Photo uri={entry.image} fallbackGlyph={entry.glyph} fallbackLabel={`Photo unavailable for ${entry.name}`} radius={15} style={{width:'100%',height:190}} />
      <HomeGuideHeading title={entry.name} subtitle={entry.caption} />
      <HomeGuideFacts facts={entry.facts} />
      {entry.description!==entry.caption?<Text className="font-dm text-label leading-[19px] text-taupe">{entry.description}</Text>:null}
      {entry.saveKind||entry.planKind?<TouchableOpacity testID="home-guide-save" accessibilityRole="button" accessibilityLabel={saved?(entry.saveKind?'Remove from saved places':'Remove from your plans'):(entry.saveKind?'Save for later':'Add to your plans')} onPress={save} activeOpacity={.78}
        style={{backgroundColor:colors['accent-fill'],minHeight:43,borderRadius:999,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7,borderWidth:1,borderColor:colors['edge-card'],borderBottomColor:colors['edge-card-bottom']}}>
        <Glyph name={saved?'check':'heart'} size={16} color={colors['on-accent']} />
        <Text className="font-dm-medium text-label" style={{color:colors['on-accent']}}>{saved?(entry.saveKind?'Saved for later':'In your plans'):(entry.saveKind?'Save for later':'Add to your plans')}</Text>
      </TouchableOpacity>:null}
      {entry.details.length?<View style={[surface,{padding:15,borderRadius:14,gap:12}]}>
        <Text className="font-dm text-fine uppercase tracking-[1px] text-taupe">Worth knowing</Text>
        {entry.details.map((fact,i)=><View key={i} className="gap-y-1"><Text className="font-dm-medium text-label text-ink">{fact.label}</Text><Text className="font-dm text-label leading-[18px] text-taupe">{fact.value}</Text></View>)}
      </View>:null}
      {entry.sections?.map(section=><View key={section.title} className="gap-y-2.5"><Text className="font-fraunces text-section text-ink">{section.title}</Text>
        {section.lines.map((line,i)=><Text key={i} className="border-t border-edge-faint pt-2.5 font-dm text-label leading-[19px] text-taupe">{line}</Text>)}
      </View>)}
      <View className="gap-y-2">{entry.links.map(link=><TouchableOpacity key={link.url} accessibilityRole="link" accessibilityLabel={link.label} onPress={()=>open(link.url)} activeOpacity={.78}
        style={[control,{minHeight:41,borderRadius:999,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7,paddingHorizontal:12}]}>
        <Text className="font-dm text-label text-ink">{link.label}</Text><Glyph name="arrow" size={14} color={colors['surface-accent']} />
      </TouchableOpacity>)}</View>
    </>:<><HomeGuideHeading title="This one has moved on" /><EmptyState compact title="No current listing" message="Head back to Home for the latest local options." /></>}
  </HomeGuideScreen>;
}
