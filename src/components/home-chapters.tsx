import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { RaisedTouchable } from '@/components/raised-surface';
import { HomeResultCard } from '@/components/home-secondary';
import { homeGuideHref, type HomeGuideEntry } from '@/lib/home-guide';
import { HOME_LEDGERS } from '@/lib/home-ledger';
import { HOME_RESULT, homeEntryCategory, homeEntryMetadata, homeMenuItems, shortHomeTitle, type HomeChapter } from '@/lib/home-secondary';
import { useControlSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

export function HomeChapterTitle({title,subtitle}:{title:string;subtitle:string}) {
  return <View style={{gap:9}}><Text testID="home-chapter-title" accessibilityRole="header" className="font-fraunces text-ink" style={{fontSize:34,lineHeight:38,letterSpacing:-.7}}>{title}</Text>
    <Text className="font-dm text-label text-taupe">{subtitle}</Text></View>;
}

/** A3's quiet city toolbar, without the old Wayvee/header/context stack. */
export function HomeChapterHeader({city,category}:{city:string;category?:string}) {
  const router=useRouter(),colors=useThemeColors(),control=useControlSurface();
  return <View testID="home-chapter-header" style={{height:38,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={()=>router.canGoBack()?router.back():router.replace('/')} style={[control,{width:35,height:35,borderRadius:18,alignItems:'center',justifyContent:'center'}]}>
      <Glyph name="chevronLeft" size={16} color={colors.fg} />
    </TouchableOpacity>
    <Text numberOfLines={1} className="font-dm text-fine text-taupe" style={{letterSpacing:.7,textTransform:'uppercase',flexShrink:1}}>{[city,category].filter(Boolean).join(' · ')}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="View saved places" onPress={()=>router.push('/saved')} style={[control,{width:35,height:35,borderRadius:18,alignItems:'center',justifyContent:'center'}]}>
      <Glyph name="bookmark" size={16} color={colors.fg} />
    </TouchableOpacity>
  </View>;
}

/** The indexes use the same horizontal editorial door as A3's idea cards. */
export function HomeChapterDoor({title,summary,image,glyph,onPress,testID}:{title:string;summary:string;image?:string;glyph:string;onPress:()=>void;testID?:string}) {
  const colors=useThemeColors();
  return <RaisedTouchable testID={testID} accessibilityRole="button" accessibilityLabel={title+'. '+summary} onPress={onPress} activeOpacity={.78} style={{padding:7,borderRadius:13,flexDirection:'row',alignItems:'center',gap:11,minHeight:104}}>
    <Photo uri={image} radius={8} fallbackGlyph={glyph} style={{width:'40%',height:90,flexShrink:0}} />
    <View style={{flex:1,minWidth:0,gap:7}}><Text numberOfLines={2} className="font-fraunces text-ink" style={{fontSize:19,lineHeight:23,letterSpacing:-.3}}>{title}</Text>
      <Text numberOfLines={2} className="font-dm text-fine text-taupe" style={{lineHeight:17}}>{summary}</Text></View>
    <Glyph name="chevron" size={14} color={colors['surface-accent']} />
  </RaisedTouchable>;
}

function IdeaFeature({entry,featureDish=false}:{entry:HomeGuideEntry;featureDish?:boolean}) {
  const router=useRouter(),colors=useThemeColors(),category=homeEntryCategory(entry),items=homeMenuItems(entry);
  const dish=category==='eat'&&featureDish?(items.find(item=>item.image)||items[0]):undefined;
  const image=(dish?.image)||entry.detailContent?.photos?.[0]?.url||entry.image;
  const meta=homeEntryMetadata(entry),address=entry.details.find(fact=>fact.label==='Address')?.value.split(',')[0];
  const summary=category==='events'?meta.primary:dish?.name.replace(/^\d+\.\s*/,'')||((entry.description!==entry.caption?entry.description:undefined)||meta.primary);
  const support=category==='eat'?(items.length?`Menu · ${items.length} items`:entry.links.some(link=>/menu|order/i.test(link.label))?'Menu':undefined):category==='events'?(entry.kind==='event'?'Official listing':'Venue guide'):undefined;
  return <View testID="home-idea-feature" style={{gap:9}}>
    <RaisedTouchable testID="home-idea-feature-card" accessibilityRole="button" accessibilityLabel={[entry.name,summary,dish?.price].filter(Boolean).join('. ')} onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.78}
      style={{padding:7,borderRadius:13,flexDirection:'row',alignItems:'center',gap:11,minHeight:114}}>
      <Photo uri={image} radius={8} fallbackGlyph={entry.glyph} style={{width:'43%',height:100,flexShrink:0}} />
      <View style={{flex:1,minWidth:0,gap:6}}>
        <Text numberOfLines={2} className="font-fraunces text-ink" style={{fontSize:18,lineHeight:22,letterSpacing:-.25}}>{shortHomeTitle(entry.name)}</Text>
        <Text numberOfLines={2} className="font-dm text-fine text-taupe" style={{lineHeight:16}}>{summary}</Text>
        {entry.kind==='event'?<Text numberOfLines={1} className="font-dm text-fine text-taupe">{entry.caption}</Text>:null}
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>{dish?.price?<Text className="font-dm text-fine text-ink">{dish.price}</Text>:<View />}<Glyph name="chevron" size={14} color={colors['surface-accent']} /></View>
      </View>
    </RaisedTouchable>
    <View testID="home-idea-feature-facts" style={{flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:4}}>
      <View style={{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:5}}><Glyph name={category==='events'?'ticket':'pin'} size={12} color={colors['surface-accent']} />
        <Text numberOfLines={1} className="font-dm text-fine text-taupe" style={{flexShrink:1}}>{category==='events'?(entry.kind==='event'?'Tickets via official listing':'Explore the venue'):address||meta.secondary||meta.primary}</Text></View>
      {support&&category!=='events'?<View style={{flexShrink:0,flexDirection:'row',alignItems:'center',gap:5}}><Glyph name="food" size={12} color={colors['surface-accent']} /><Text className="font-dm text-fine text-taupe">{support}</Text></View>:null}
    </View>
    {dish?.note?<Text numberOfLines={2} className="font-dm text-fine text-taupe">{dish.note}</Text>:null}
  </View>;
}

function CollectionFeature({entry}:{entry:HomeGuideEntry}) {
  const router=useRouter(),colors=useThemeColors(),items=homeMenuItems(entry),category=homeEntryCategory(entry);
  const preview=items.filter(item=>item.image).slice(0,2),meta=homeEntryMetadata(entry),image=entry.detailContent?.photos?.[0]?.url||entry.image||preview[0]?.image;
  return <RaisedTouchable testID="home-collection-feature" accessibilityRole="button" accessibilityLabel={[entry.name,entry.description,meta.primary].filter(Boolean).join('. ')} onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.8}
    style={{padding:7,borderRadius:13,gap:7}}>
    <View testID="home-chapter-cover" style={{height:104,width:'100%'}}><Photo uri={image} radius={8} fallbackGlyph={entry.glyph} style={{height:'100%',width:'100%'}} /></View>
    <View style={{paddingHorizontal:2,gap:5}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
        <Text testID="home-chapter-feature-title" numberOfLines={2} className="font-fraunces text-ink" style={{fontSize:18,lineHeight:22,letterSpacing:-.2,flex:1}}>{shortHomeTitle(entry.name)}</Text><Glyph name="chevron" size={14} color={colors['surface-accent']} />
      </View>
      <Text numberOfLines={2} className="font-dm text-fine text-taupe" style={{lineHeight:17}}>{category==='events'?[...new Set([entry.caption,meta.primary].filter(Boolean))].join(' · '):entry.description||entry.caption}</Text>
    </View>
    {preview.length?<View testID="home-chapter-menu-preview" style={{flexDirection:'row',gap:7}}>{preview.map(item=><View key={item.name} style={{flex:1,minWidth:0,minHeight:58,padding:5,borderWidth:1,borderColor:colors['edge-faint'],borderRadius:9,flexDirection:'row',alignItems:'center',gap:6}}>
      <Photo uri={item.image} radius={6} style={{width:45,height:45,flexShrink:0}} /><View style={{flex:1,minWidth:0,gap:3}}><Text numberOfLines={2} className="font-dm text-ink" style={{fontSize:10,lineHeight:13}}>{item.name.replace(/^\d+\.\s*/,'')}</Text>{item.price?<Text numberOfLines={1} className="font-dm text-fine text-taupe">{item.price}</Text>:null}</View>
    </View>)}</View>:null}
    {preview[0]?.note?<Text numberOfLines={2} className="font-dm text-fine text-taupe">{preview[0].note}</Text>:null}
  </RaisedTouchable>;
}

/** A3 uses two different card compositions, rather than compact B5 posters. */
export function HomeChapters({chapters,variant}:{chapters:readonly HomeChapter[];variant:'ideas'|'collection'}) {
  const router=useRouter(),colors=useThemeColors(),[expanded,setExpanded]=useState<Record<string,boolean>>({});
  return <View testID={`home-chapters-${variant}`} style={{gap:25}}>{chapters.map((chapter,index)=>{
    const first=chapter.entries[0];if(!first)return null;
    const isCollection=variant==='collection',open=!!expanded[chapter.id];
    const seeAll=()=>chapter.entries.length>1?setExpanded(value=>({...value,[chapter.id]:!open})):router.push((isCollection?homeGuideHref(first):HOME_LEDGERS[homeEntryCategory(first)].href) as never);
    return <View key={chapter.id} testID="home-chapter" style={{flexDirection:'row',gap:11}}>
      <View style={{width:isCollection?22:13,alignItems:'center'}}>
        {isCollection?<Text testID="home-chapter-number" className="font-fraunces text-peach" style={{fontSize:19,lineHeight:25}}>{String(index+1).padStart(2,'0')}</Text>:<View testID="home-chapter-dot" style={{width:8,height:8,borderRadius:4,backgroundColor:colors['surface-accent'],marginTop:8}} />}
        <View style={{width:1,flex:1,marginTop:10,backgroundColor:colors['edge-faint']}} />
      </View>
      <View style={{flex:1,minWidth:0,gap:10}}>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
          <Text accessibilityRole="header" className="font-fraunces text-ink" style={{fontSize:21,lineHeight:25,letterSpacing:-.3,flex:1}}>{chapter.title}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${open?'Show fewer':'See all'} in ${chapter.title}`} onPress={seeAll} hitSlop={6} style={{minHeight:28,flexDirection:'row',alignItems:'center',gap:6}}>
            <Text className={`font-dm text-fine ${isCollection?'text-taupe':'text-peach'}`}>{isCollection?`${chapter.entries.length} ${chapter.entries.length===1?'place':'places'}`:open?'Less':'See all'}</Text><Glyph name="chevron" size={12} color={colors['surface-accent']} />
          </TouchableOpacity>
        </View>
        {isCollection?<CollectionFeature entry={first} />:<IdeaFeature entry={first} featureDish={chapter.id==='start'} />}
        {open?<View style={{gap:HOME_RESULT.gap}}>{chapter.entries.slice(1).map(entry=><HomeResultCard key={entry.kind+':'+entry.id} entry={entry} />)}</View>:null}
      </View>
    </View>;
  })}</View>;
}
