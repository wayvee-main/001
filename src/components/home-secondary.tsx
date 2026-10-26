import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { RaisedTouchable } from '@/components/raised-surface';
import { homeGuideHref, type HomeGuideCategory, type HomeGuideEntry } from '@/lib/home-guide';
import { HOME_RESULT, homeEntryCategory, homeEntryMetadata, homeMenuItems, shortHomeTitle } from '@/lib/home-secondary';
import { useThemeColors } from '@/lib/theme';

const barArt=require('../../assets/home-guides/listening-room.webp');
const routeArt=require('../../assets/home-guides/walking-route.webp');

/** These exact dimensions apply to Eat, Bars, Routes and Events alike. */
export function HomeResultCard({entry,borderless=false}:{entry:HomeGuideEntry;borderless?:boolean}) {
  const router=useRouter(),colors=useThemeColors(),meta=homeEntryMetadata(entry);
  return <RaisedTouchable testID="home-result-card" accessibilityRole="button" accessibilityLabel={[entry.name,meta.primary,meta.secondary].filter(Boolean).join('. ')}
    onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.76}
    style={[borderless?{backgroundColor:colors['surface-control'],borderWidth:0}:undefined,{height:HOME_RESULT.height,borderRadius:HOME_RESULT.radius,padding:HOME_RESULT.inset,flexDirection:'row',alignItems:'center',gap:HOME_RESULT.textGap,overflow:'hidden'}]}>
    <View testID="home-result-thumbnail" style={{width:HOME_RESULT.thumbnailWidth,height:HOME_RESULT.thumbnailHeight,flexShrink:0}}>
      <Photo uri={entry.detailContent?.photos?.[0]?.url||entry.image} radius={9} stripedPlaceholder={!borderless} fallbackGlyph={entry.glyph} fallbackLabel={`Photo unavailable for ${entry.name}`} style={[{width:'100%',height:'100%'},borderless?{borderWidth:0}:undefined]} />
    </View>
    <View style={{flex:1,minWidth:0,gap:3}}>
      <Text numberOfLines={1} ellipsizeMode="tail" className="font-fraunces text-ink" style={{fontSize:17,lineHeight:20,letterSpacing:-.25}}>{shortHomeTitle(entry.name)}</Text>
      <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm text-taupe" style={{fontSize:11,lineHeight:13}}>{meta.primary}</Text>
      {meta.secondary?<Text numberOfLines={1} ellipsizeMode="tail" className="font-dm text-taupe" style={{fontSize:11,lineHeight:13}}>{meta.secondary}</Text>:null}
    </View>
    <Glyph name="chevron" size={15} color={colors['surface-accent']} />
  </RaisedTouchable>;
}

export function HomePoster({entry,category=homeEntryCategory(entry),compact=false}:{entry:HomeGuideEntry;category?:HomeGuideCategory;compact?:boolean}) {
  const router=useRouter(),colors=useThemeColors(),meta=homeEntryMetadata(entry),items=homeMenuItems(entry);
  const photographed=items.filter(item=>item.image);
  const photograph=(category==='eat'?photographed[0]?.image:undefined)||entry.detailContent?.photos?.[0]?.url||entry.image||photographed[0]?.image;
  const art=category==='bars'?barArt:category==='routes'?routeArt:undefined;
  const action=category==='eat'&&items.length?'Explore the menu':category==='routes'?(entry.kind==='crawl'?'See the stops':'Explore the place'):category==='events'?(entry.kind==='event'?'Show details':'Explore the venue'):'View details';
  return <RaisedTouchable testID="home-secondary-poster" accessibilityRole="button" accessibilityLabel={[entry.name,meta.primary,action].join('. ')}
    onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.82} style={{backgroundColor:colors['surface-control'],borderWidth:0,padding:11,borderRadius:16,gap:10}}>
    <View style={{gap:4}}>
      <Text numberOfLines={2} className="font-fraunces text-ink" style={{fontSize:compact?20:22,lineHeight:compact?24:26,letterSpacing:-.4}}>{shortHomeTitle(entry.name)}</Text>
      <Text numberOfLines={1} className="font-dm text-fine text-taupe">{meta.primary}</Text>
    </View>
    {art?<Image source={art} accessibilityLabel={category==='bars'?'Illustrated listening room':'Illustrated walking guide'} contentFit="cover" style={{height:compact?108:144,width:'100%',borderRadius:10}} />:photograph?
      <Photo uri={photograph} radius={10} stripedPlaceholder={false} fallbackGlyph={entry.glyph} fallbackLabel={`Photo unavailable for ${entry.name}`} style={{height:compact?108:144,width:'100%',borderWidth:0}} />:
      <View style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9}}><Glyph name={entry.glyph} size={24} color={colors['fg-muted']} /><Text numberOfLines={2} className="font-dm text-fine text-taupe" style={{flex:1}}>{entry.details.find(fact=>fact.label==='Address')?.value||'Explore the source listing'}</Text></View>}
    {meta.secondary?<Text numberOfLines={1} className="font-dm text-fine text-taupe">{meta.secondary}</Text>:null}
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
      <Text className="font-dm text-fine text-peach">{action}{category==='eat'&&items.length?' · '+items.length+' items':''}</Text>
      <Glyph name="chevron" size={14} color={colors['surface-accent']} />
    </View>
  </RaisedTouchable>;
}
