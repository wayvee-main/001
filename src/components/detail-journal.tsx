import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { RaisedTouchable } from '@/components/raised-surface';
import { VENUES, type ScoperEvent } from '@/lib/data';
import { eventJournalDetails, filterJournalMenu, journalMenuCategories, restaurantJournalMenu, type JournalArtist, type JournalMenuItem, type JournalSpecial, type MenuJournalListing } from '@/lib/detail-journal';
import type { DetailContent } from '@/lib/detail-content';
import { streetAddress, ticketLink } from '@/lib/links';
import { useControlSurface, useRaisedSurface } from '@/lib/shadows';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

function useJournalLink() {
  const toast=useScoper(state=>state.showToast);
  return (url:string)=>{void Linking.openURL(url).catch(()=>toast('Could not open that link. Please try again.'));};
}

export function JournalHeading({title,action,onAction}: {title:string;action?:string;onAction?:()=>void}) {
  const colors=useThemeColors();
  return <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
    <Text accessibilityRole="header" className="font-fraunces text-ink" style={{flex:1,fontSize:20,lineHeight:25,letterSpacing:-.3}}>{title}</Text>
    {action&&onAction?<TouchableOpacity accessibilityRole="button" accessibilityLabel={action} onPress={onAction} activeOpacity={.72} style={{minHeight:36,flexDirection:'row',alignItems:'center',gap:5}}>
      <Text className="font-dm text-fine text-peach">{action}</Text><Glyph name="arrow" size={12} color={colors['surface-accent']} />
    </TouchableOpacity>:null}
  </View>;
}

function JournalSpecialCard({special,glyph='book'}: {special:JournalSpecial;glyph?:string}) {
  const open=useJournalLink(),colors=useThemeColors();
  return <RaisedTouchable testID="journal-special" accessibilityRole="link" accessibilityLabel={`${special.title}. ${special.label}. ${special.description}`} onPress={()=>open(special.url)} activeOpacity={.76}
    style={{backgroundColor:colors['surface-ribbon'],borderRadius:14,padding:13,flexDirection:'row',alignItems:'center',gap:11}}>
    <Glyph name={glyph} size={20} color={colors['surface-accent']} />
    <View style={{flex:1,minWidth:0,gap:4}}>
      <Text className="font-dm text-fine uppercase text-peach" style={{letterSpacing:.5}}>{special.label}</Text>
      <Text className="font-fraunces text-ink" style={{fontSize:18,lineHeight:23}}>{special.title}</Text>
      <Text className="font-dm text-fine text-taupe" style={{lineHeight:17}}>{special.description}</Text>
    </View><Glyph name="chevron" size={13} color={colors['surface-accent']} />
  </RaisedTouchable>;
}

function JournalSheet({title,onClose,children}: {title?:string;onClose:()=>void;children:ReactNode}) {
  const colors=useThemeColors(),insets=useSafeAreaInsets(),{height}=useWindowDimensions();
  const closeButton=useRef<ComponentRef<typeof TouchableOpacity>>(null);
  useEffect(()=>{
    if(!title||Platform.OS!=='web')return;
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose();}};
    document.addEventListener('keydown',key,true);return()=>document.removeEventListener('keydown',key,true);
  },[title,onClose]);
  return <Modal visible={Boolean(title)} transparent animationType="fade" onRequestClose={onClose} onShow={()=>{if(Platform.OS==='web')closeButton.current?.focus();}}>
    <View style={{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.42)',paddingHorizontal:16,paddingTop:insets.top+14,paddingBottom:Math.max(16,insets.bottom)}}>
      <Pressable accessibilityLabel="Dismiss details" onPress={onClose} style={{position:'absolute',inset:0}} />
      <View testID="journal-sheet" role="dialog" aria-modal accessibilityViewIsModal accessibilityLabel={title} style={{maxHeight:height*.82,width:'100%',maxWidth:500,alignSelf:'center',backgroundColor:colors['surface-navigation'],borderWidth:1,borderColor:colors['edge-card'],borderRadius:22,padding:18,gap:14}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Text accessibilityRole="header" className="font-fraunces text-ink" style={{flex:1,fontSize:23,lineHeight:28}}>{title}</Text>
          <TouchableOpacity ref={closeButton} accessibilityRole="button" accessibilityLabel="Close details" onPress={onClose} style={{width:40,height:40,alignItems:'center',justifyContent:'center',borderRadius:20,borderWidth:1,borderColor:colors['edge-card'],backgroundColor:colors['surface-control']}}><Glyph name="close" size={16} color={colors.fg} /></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{gap:14,paddingBottom:4}}>{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}

export function RestaurantJournal({restaurant,content,onPlan}: {restaurant:MenuJournalListing;content?:DetailContent;onPlan?:()=>void}) {
  const colors=useThemeColors(),control=useControlSurface(),selected=useControlSurface(true),open=useJournalLink(),router=useRouter();
  const [category,setCategory]=useState('All'),[dish,setDish]=useState<JournalMenuItem|null>(null),[menuOpen,setMenuOpen]=useState(false);
  const trigger=useRef<ComponentRef<typeof TouchableOpacity>|null>(null);
  const menu=restaurantJournalMenu(restaurant,content),categories=journalMenuCategories(menu.items),active=categories.includes(category)?category:'All';
  const items=filterJournalMenu(menu.items,active),lead=items.filter(item=>item.image).slice(0,2),remaining=items.filter(item=>!lead.includes(item));
  const selectDish=(item:JournalMenuItem,button:ComponentRef<typeof TouchableOpacity>|null)=>{trigger.current=button;setMenuOpen(false);setDish(item);};
  const close=()=>{setMenuOpen(false);setDish(null);if(Platform.OS==='web')requestAnimationFrame(()=>trigger.current?.focus());};
  const official=()=>open(content?.menu?.url||(restaurant.id==='shootingstar'?restaurant.orderUrl||restaurant.menuUrl:restaurant.menuUrl));
  const openMenu=()=>{setDish(null);setMenuOpen(true);};
  const plan=onPlan||(()=>router.push(`/create?restaurantId=${encodeURIComponent(restaurant.id)}&q=${encodeURIComponent(`Night out starting at ${restaurant.name}`)}`));
  return <View testID="menu-journal" style={{gap:20}}>
    <View style={{gap:11}}>
      <JournalHeading title="Explore the menu" action="Browse menu" onAction={openMenu} />
      {menu.items.length>0?<>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingBottom:3}}>
          {categories.map(label=><TouchableOpacity key={label} testID={'journal-filter-'+label.toLowerCase()} accessibilityRole="button" accessibilityLabel={label+' menu items'} accessibilityState={{selected:active===label}} onPress={()=>setCategory(label)} activeOpacity={.74}
            style={[active===label?selected:control,{minHeight:34,paddingHorizontal:12,borderRadius:999,flexDirection:'row',alignItems:'center',gap:5}]}>
            {label==='All'?<Glyph name="food" size={12} color={active===label?colors['on-selected']:colors['fg-muted']} />:null}
            <Text className="font-dm text-fine" style={{color:active===label?colors['on-selected']:colors['fg-muted']}}>{label}</Text>
          </TouchableOpacity>)}
        </ScrollView>
        {lead.length?<View testID="journal-menu-cards" style={{flexDirection:'row',gap:10,alignItems:'stretch'}}>
          {lead.map(item=><MenuCard key={item.name} item={item} onSelect={selectDish} />)}
        </View>:null}
        {menu.note?<Text className="font-dm text-fine text-taupe" style={{lineHeight:17}}>{menu.note}</Text>:null}
      </>:<Text className="font-dm text-label text-taupe" style={{lineHeight:19}}>Explore the current menu on their official site.</Text>}
    </View>
    {menu.specials.map(special=><JournalSpecialCard key={special.title} special={special} />)}
    {remaining.length>0?<View style={{gap:7}}>
      <JournalHeading title={lead.length?"More dishes":"On the menu"} />
      {remaining.slice(0,6).map(item=><MenuRow key={item.name} item={item} onSelect={selectDish} />)}
      {remaining.length>6?<JournalHandoff label={`Explore all ${menu.items.length} items`} glyph="arrow" onPress={openMenu} />:null}
    </View>:null}
    <View style={{flexDirection:'row',gap:8}}>
      <JournalHandoff label={restaurant.reserveUrl?'Reserve':restaurant.primaryAction.label} glyph="arrow" onPress={()=>open(restaurant.reserveUrl||restaurant.primaryAction.url)} />
      <JournalHandoff label="Plan a night" glyph="route" onPress={plan} />
    </View>
    <DetailGoods content={content} />
    <JournalSheet title={menuOpen?`Menu · ${restaurant.name}`:dish?.name} onClose={close}>
      {menuOpen?<View testID="journal-full-menu" style={{gap:10}}>{menu.note?<Text className="font-dm text-fine text-taupe">{menu.note}</Text>:null}{menu.items.map(item=><MenuRow key={item.name} item={item} onSelect={selectDish} />)}<JournalHandoff label="Official menu & ordering" glyph="arrow" onPress={official} /></View>:null}
      {dish?<>
        <JournalHandoff label="Back to menu" glyph="back" onPress={openMenu} />
        {dish.image?<Photo uri={dish.image} fit="contain" radius={12} fallbackGlyph="food" fallbackLabel={`No dish photo for ${dish.name}`} style={{width:'100%',height:170}} stripedPlaceholder={false} />:null}
        {dish.price?<Text className="font-dm-medium text-label text-ink">{dish.price}</Text>:null}
        {dish.desc?<Text className="font-dm text-label text-taupe" style={{lineHeight:20}}>{dish.desc}</Text>:null}
        {dish.note||menu.note?<Text className="font-dm text-fine text-taupe" style={{lineHeight:18}}>{dish.note||menu.note}</Text>:null}
        <JournalHandoff label="View official menu" glyph="arrow" onPress={official} />
      </>:null}
    </JournalSheet>
  </View>;
}

type DishSelection=(item:JournalMenuItem,button:ComponentRef<typeof TouchableOpacity>|null)=>void;
function MenuCard({item,onSelect}: {item:JournalMenuItem;onSelect:DishSelection}) {
  const colors=useThemeColors(),surface=useRaisedSurface(1),button=useRef<ComponentRef<typeof TouchableOpacity>>(null);
  return <TouchableOpacity ref={button} testID="journal-menu-card" accessibilityRole="button" accessibilityLabel={[item.name,item.price].filter(Boolean).join('. ')} activeOpacity={.76} onPress={()=>onSelect(item,button.current)}
    style={[surface,{flex:1,minWidth:0,borderRadius:13,padding:6,backgroundColor:colors['home-tile']}]}>
    <Photo uri={item.image} radius={8} stripedPlaceholder={false} fallbackGlyph="food" fallbackLabel={`No dish photo for ${item.name}`} style={{width:'100%',height:88}} />
    <View style={{paddingHorizontal:3,paddingTop:8,paddingBottom:4,gap:6}}>
      <Text numberOfLines={2} className="font-fraunces text-ink" style={{fontSize:16,lineHeight:20,minHeight:40,letterSpacing:-.2}}>{item.name}</Text>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:5}}><Text className="font-dm text-fine text-taupe">{item.price||'On the menu'}</Text><Glyph name="arrow" size={12} color={colors['surface-accent']} /></View>
    </View>
  </TouchableOpacity>;
}

function MenuRow({item,onSelect}: {item:JournalMenuItem;onSelect:DishSelection}) {
  const colors=useThemeColors(),button=useRef<ComponentRef<typeof TouchableOpacity>>(null);
  return <TouchableOpacity ref={button} testID="journal-menu-row" accessibilityRole="button" accessibilityLabel={[item.name,item.price].filter(Boolean).join('. ')} onPress={()=>onSelect(item,button.current)} activeOpacity={.72}
    style={{minHeight:72,paddingVertical:10,borderTopWidth:1,borderTopColor:colors['edge-faint'],flexDirection:'row',alignItems:'center',gap:10}}>
    {item.image?<Photo uri={item.image} radius={9} stripedPlaceholder={false} fallbackGlyph="food" fallbackLabel={`No dish photo for ${item.name}`} style={{width:52,height:48}} />:null}
    <View style={{flex:1,minWidth:0,gap:4}}><Text numberOfLines={2} className="font-fraunces text-ink" style={{fontSize:16,lineHeight:20}}>{item.name}</Text>
      {item.desc?<Text numberOfLines={1} className="font-dm text-fine text-taupe">{item.desc}</Text>:null}
    </View>{item.price?<Text className="font-dm text-fine text-taupe">{item.price}</Text>:null}<Glyph name="arrow" size={12} color={colors['surface-accent']} />
  </TouchableOpacity>;
}

function JournalHandoff({label,glyph,onPress}: {label:string;glyph:string;onPress:()=>void}) {
  const colors=useThemeColors();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={onPress} activeOpacity={.72}
    style={{flexShrink:1,minHeight:40,paddingHorizontal:11,borderRadius:12,backgroundColor:colors['surface-navigation'],borderWidth:1,borderColor:colors['edge-card'],flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6}}>
    <Text numberOfLines={1} className="font-dm text-fine text-ink">{label}</Text><Glyph name={glyph} size={12} color={colors['surface-accent']} />
  </TouchableOpacity>;
}

export function EventJournal({event}: {event:ScoperEvent}) {
  const colors=useThemeColors(),open=useJournalLink(),router=useRouter();
  const [artist,setArtist]=useState<JournalArtist|null>(null),details=eventJournalDetails(event);
  const hasTickets=event.ticketed&&Boolean(event.ticketUrl),url=hasTickets?ticketLink(event.ticketUrl!):event.sourceUrl;
  const venue=event.venueId?VENUES[event.venueId]:undefined;
  const venueImage=event.detailContent?.venue?.image||(event.venueId==='fox'?'https://thefoxoakland.com/wp-content/uploads/sites/5/2016/12/Fox-Interiors-pkp--1024x682.jpg':venue?.image);
  const venueAction=()=>event.detailContent?.venue?.url?open(event.detailContent.venue.url):venue?router.push(`/venue/${venue.id}`):open(event.sourceUrl);
  const plan=(dinner:boolean)=>router.push(`/create?eventId=${encodeURIComponent(event.id)}&q=${encodeURIComponent(dinner?`Dinner before ${event.name} at ${event.venue}`:`Plan an evening around ${event.name}`)}`);
  const artists=details.artists;
  return <View testID="event-journal" style={{gap:20}}>
    {artists.length>0?<View style={{gap:11}}>
      <JournalHeading title="On the bill" action="Explore" onAction={()=>open(event.sourceUrl)} />
      <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>{artists.map(person=><ArtistCard key={person.name} artist={person} onPress={()=>setArtist(person)} />)}</View>
    </View>:null}
    <RaisedTouchable testID="journal-tickets" accessibilityRole="link" accessibilityLabel={hasTickets?'Official tickets':'Official event listing'} onPress={()=>open(url)} activeOpacity={.76}
      style={{backgroundColor:colors['home-tile'],padding:13,borderRadius:13,flexDirection:'row',alignItems:'center',gap:11}}>
      <Glyph name="ticket" size={20} color={colors['surface-accent']} /><View style={{flex:1,minWidth:0,gap:4}}>
        <Text className="font-dm-medium text-label text-ink">{hasTickets?'Official tickets':/rsvp/i.test(event.priceLabel)?'RSVP':'Official listing'}</Text>
        <Text className="font-dm text-fine text-taupe" style={{lineHeight:17}}>{event.priceLabel}{event.ticketProvider?' · '+event.ticketProvider:''}</Text>
      </View><Glyph name="arrow" size={13} color={colors['surface-accent']} />
    </RaisedTouchable>
    {details.upgrade?<JournalSpecialCard special={details.upgrade} glyph="seat" />:null}
    <View style={{gap:11}}>
      <JournalHeading title="The room" action="Venue details" onAction={venueAction} />
      <RaisedTouchable testID="journal-venue" accessibilityRole="button" accessibilityLabel={`Explore ${event.venue}`} onPress={venueAction} activeOpacity={.76}
        style={{backgroundColor:colors['home-tile'],padding:7,borderRadius:13,flexDirection:'row',alignItems:'center',gap:12}}>
        <Photo uri={venueImage} radius={8} stripedPlaceholder={false} fallbackGlyph="landmark" fallbackLabel={`No venue photo for ${event.venue}`} style={{width:86,height:91}} />
        <View style={{flex:1,minWidth:0,gap:5,paddingVertical:4,paddingRight:4}}><Text numberOfLines={2} className="font-fraunces text-ink" style={{fontSize:18,lineHeight:23}}>{event.venue}</Text>
          {event.addr?<Text numberOfLines={2} className="font-dm text-fine text-taupe" style={{lineHeight:17}}>{streetAddress(event.addr)}</Text>:null}
          <Text className="font-dm text-fine text-peach">Get to know the venue →</Text>
        </View>
      </RaisedTouchable>
    </View>
    <DetailGoods content={event.detailContent} />
    <View style={{gap:5}}><JournalHeading title="Make an evening of it" />
      <EventPlanRow label="Dinner before the show" glyph="food" onPress={()=>plan(true)} />
      <EventPlanRow label="Let Vee shape the rest" glyph="route" onPress={()=>plan(false)} />
    </View>
    <JournalSheet title={artist?.name} onClose={()=>setArtist(null)}>
      {artist?<><Photo uri={artist.image} fit="contain" radius={12} stripedPlaceholder={false} fallbackGlyph="music" fallbackLabel={`No artist photo for ${artist.name}`} style={{width:'100%',height:180}} />
        {artist.role?<Text className="font-dm text-fine text-peach">{artist.role}</Text>:null}
        {artist.description?<Text className="font-dm text-label text-taupe" style={{lineHeight:20}}>{artist.description}</Text>:null}
        <JournalHandoff label="Official artist details" glyph="arrow" onPress={()=>open(artist.url||event.sourceUrl)} />
      </>:null}
    </JournalSheet>
  </View>;
}

function ArtistCard({artist,onPress}: {artist:JournalArtist;onPress:()=>void}) {
  const colors=useThemeColors();
  return <RaisedTouchable testID="journal-artist" accessibilityRole="button" accessibilityLabel={[artist.name,artist.role].filter(Boolean).join('. ')} onPress={onPress} activeOpacity={.76}
    style={{flexGrow:1,flexBasis:'45%',minWidth:0,borderRadius:13,padding:6,backgroundColor:colors['home-tile']}}>
    <Photo uri={artist.image} radius={8} stripedPlaceholder={false} fallbackGlyph="music" fallbackLabel={`No artist photo for ${artist.name}`} style={{width:'100%',height:104}} />
    <View style={{paddingHorizontal:3,paddingTop:8,paddingBottom:4,gap:6}}><Text numberOfLines={2} className="font-fraunces text-ink" style={{fontSize:17,lineHeight:21,minHeight:21}}>{artist.name}</Text>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:5}}><Text className="font-dm text-fine text-taupe">{artist.role||'On the bill'}</Text><Glyph name="arrow" size={12} color={colors['surface-accent']} /></View>
    </View>
  </RaisedTouchable>;
}

function EventPlanRow({label,glyph,onPress}: {label:string;glyph:string;onPress:()=>void}) {
  const colors=useThemeColors();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={onPress} activeOpacity={.72} style={{minHeight:44,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:1,borderBottomColor:colors['edge-faint']}}>
    <Glyph name={glyph} size={14} color={colors['surface-accent']} /><Text className="font-dm text-label text-ink" style={{flex:1}}>{label}</Text><Glyph name="arrow" size={13} color={colors['surface-accent']} />
  </TouchableOpacity>;
}

/** Actual source payload, shared by map entries and curated detail routes. */
export function DetailGoods({content}: {content?:DetailContent}) {
  const colors=useThemeColors(),open=useJournalLink();
  const [note,setNote]=useState<{title:string;body:string;url?:string}|null>(null);
  if(!content)return null;
  return <View testID="detail-goods" style={{gap:18}}>
    {(content.photos?.length||0)>1?<View style={{gap:10}}><JournalHeading title="A closer look" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10}}>{content.photos!.slice(1).map(photo=><Photo key={photo.url} uri={photo.url} radius={12} fallbackGlyph="landmark" fallbackLabel="Source photo unavailable" style={{width:174,height:110}} />)}</ScrollView>
    </View>:null}
    {content.notes?.map(item=><View key={item.title} style={{gap:8}}>
      <JournalHeading title={item.title} action="Read more" onAction={()=>setNote(item)} />
      <Text numberOfLines={4} className="font-dm text-label text-taupe" style={{lineHeight:20}}>{item.body}</Text>
    </View>)}
    <TouchableOpacity accessibilityRole="link" accessibilityLabel="Open the source for these details" onPress={()=>open(content.sourceUrl)} style={{minHeight:34,flexDirection:'row',alignItems:'center',gap:5}}>
      <Text className="font-dm text-fine text-taupe">Details checked {new Date(content.menu?.verifiedAt||content.verifiedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</Text><Glyph name="arrow" size={12} color={colors['surface-accent']} />
    </TouchableOpacity>
    <JournalSheet title={note?.title} onClose={()=>setNote(null)}>{note?<><Text className="font-dm text-label text-ink" style={{lineHeight:21}}>{note.body}</Text>{note.url?<JournalHandoff label="Official details" glyph="arrow" onPress={()=>open(note.url!)} />:null}</>:null}</JournalSheet>
  </View>;
}
