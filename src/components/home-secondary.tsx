import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { RaisedTouchable } from '@/components/raised-surface';
import { homeGuideHref, type HomeGuideCategory, type HomeGuideEntry } from '@/lib/home-guide';
import { HOME_RESULT, homeEntryCategory, homeEntryMetadata, homeMenuItems, shortHomeTitle, type HomeChapter } from '@/lib/home-secondary';
import { useThemeColors } from '@/lib/theme';

const barArt=require('../../assets/home-guides/listening-room.webp');
const routeArt=require('../../assets/home-guides/walking-route.webp');

/** These exact dimensions apply to Eat, Bars, Routes and Events alike. */
export function HomeResultCard({entry}:{entry:HomeGuideEntry}) {
  const router=useRouter(),colors=useThemeColors(),meta=homeEntryMetadata(entry);
  return <RaisedTouchable testID="home-result-card" accessibilityRole="button" accessibilityLabel={[entry.name,meta.primary,meta.secondary].filter(Boolean).join('. ')}
    onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.76}
    style={{height:HOME_RESULT.height,borderRadius:HOME_RESULT.radius,padding:HOME_RESULT.inset,flexDirection:'row',alignItems:'center',gap:HOME_RESULT.textGap,overflow:'hidden'}}>
    <View testID="home-result-thumbnail" style={{width:HOME_RESULT.thumbnailWidth,height:HOME_RESULT.thumbnailHeight,flexShrink:0}}>
      <Photo uri={entry.detailContent?.photos?.[0]?.url||entry.image} radius={9} fallbackGlyph={entry.glyph} fallbackLabel={`Photo unavailable for ${entry.name}`} style={{width:'100%',height:'100%'}} />
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
  const photographed=items.filter(item=>item.image),preview=(photographed.length?photographed:items).slice(0,2);
  const photograph=entry.detailContent?.photos?.[0]?.url||entry.image||photographed[0]?.image;
  const art=category==='bars'?barArt:category==='routes'?routeArt:undefined;
  const action=category==='eat'&&items.length?'Explore the menu':category==='routes'?(entry.kind==='crawl'?'See the stops':'Explore the place'):category==='events'?(entry.kind==='event'?'Show details':'Explore the venue'):'View details';
  return <RaisedTouchable testID="home-secondary-poster" accessibilityRole="button" accessibilityLabel={[entry.name,meta.primary,action].join('. ')}
    onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.82} style={{padding:11,borderRadius:16,gap:10}}>
    <View style={{gap:4}}>
      <Text numberOfLines={2} className="font-fraunces text-ink" style={{fontSize:compact?20:22,lineHeight:compact?24:26,letterSpacing:-.4}}>{shortHomeTitle(entry.name)}</Text>
      <Text numberOfLines={1} className="font-dm text-fine text-taupe">{meta.primary}</Text>
    </View>
    {art?<Image source={art} accessibilityLabel={category==='bars'?'Illustrated listening room':'Illustrated walking guide'} contentFit="cover" style={{height:compact?108:144,width:'100%',borderRadius:10}} />:photograph?
      <Photo uri={photograph} radius={10} fallbackGlyph={entry.glyph} fallbackLabel={`Photo unavailable for ${entry.name}`} style={{height:compact?108:144,width:'100%'}} />:
      <View style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9}}><Glyph name={entry.glyph} size={24} color={colors['fg-muted']} /><Text numberOfLines={2} className="font-dm text-fine text-taupe" style={{flex:1}}>{entry.details.find(fact=>fact.label==='Address')?.value||'Explore the source listing'}</Text></View>}
    {category==='eat'&&preview.length?<View testID="home-menu-preview" style={{flexDirection:'row',gap:10}}>
      {preview.map(item=><View key={item.name} style={{flex:1,minWidth:0,minHeight:58,flexDirection:'row',alignItems:'center',gap:7}}>
        {item.image?<Photo uri={item.image} radius={7} style={{height:52,width:52,flexShrink:0}} />:null}
        <View style={{flex:1,minWidth:0,gap:4}}><Text numberOfLines={2} className="font-fraunces text-ink" style={{fontSize:12,lineHeight:15}}>{shortHomeTitle(item.name.replace(/^\d+\.\s*/,''))}</Text>
          {item.price?<Text numberOfLines={1} className="font-dm text-fine text-taupe">{item.price}</Text>:null}</View>
      </View>)}
    </View>:null}
    {category==='eat'&&preview[0]?.note?<Text numberOfLines={2} className="font-dm text-fine text-taupe">{preview[0].note}</Text>:null}
    {meta.secondary?<Text numberOfLines={1} className="font-dm text-fine text-taupe">{meta.secondary}</Text>:null}
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
      <Text className="font-dm text-fine text-peach">{action}{category==='eat'&&items.length?' · '+items.length+' items':''}</Text>
      <Glyph name="chevron" size={14} color={colors['surface-accent']} />
    </View>
  </RaisedTouchable>;
}

export function HomeChapters({chapters}:{chapters:readonly HomeChapter[]}) {
  const colors=useThemeColors(),[expanded,setExpanded]=useState<Record<string,boolean>>({});
  return <View testID="home-chapters" style={{gap:24}}>{chapters.map((chapter,index)=>{
    const shown=expanded[chapter.id]?chapter.entries:chapter.entries.slice(0,3),first=shown[0];
    return <View key={chapter.id} testID="home-chapter" style={{flexDirection:'row',gap:11}}>
      <View style={{width:21,alignItems:'center'}}>
        <Text className="font-fraunces text-peach" style={{fontSize:16,lineHeight:25}}>{String(index+1).padStart(2,'0')}</Text>
        <View style={{width:1,flex:1,marginTop:10,backgroundColor:colors['edge-faint']}} />
      </View>
      <View style={{flex:1,minWidth:0,gap:HOME_RESULT.gap}}>
        <View style={{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:8}}>
          <Text accessibilityRole="header" className="font-fraunces text-ink" style={{fontSize:21,lineHeight:25,letterSpacing:-.3,flex:1}}>{chapter.title}</Text>
          <Text className="font-dm text-fine text-taupe">{chapter.entries.length}</Text>
        </View>
        {first?<HomePoster entry={first} compact />:null}
        {shown.slice(1).map(entry=><HomeResultCard key={entry.kind+':'+entry.id} entry={entry} />)}
        {chapter.entries.length>shown.length?<TouchableOpacity accessibilityRole="button" accessibilityLabel={`Show all ${chapter.entries.length} options in ${chapter.title}`} onPress={()=>setExpanded(value=>({...value,[chapter.id]:true}))}
          style={{minHeight:34,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <Text className="font-dm text-fine text-peach">See all {chapter.entries.length}</Text><Glyph name="chevron" size={14} color={colors['surface-accent']} />
        </TouchableOpacity>:null}
      </View>
    </View>;
  })}</View>;
}
