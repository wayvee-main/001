import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraList, useAuroraCard } from '@/components/aurora';
import { CityDeskHeadline, CityDeskSection } from '@/components/city-desk';
import { Glyph } from '@/components/glyph';
import { LocalPerksHeader } from '@/components/local-perks';
import { Screen, ScreenScroll, useAppGutter } from '@/components/layout';
import { APPEARANCE_OPTIONS, restoreAppearance, saveAppearance, type AppearancePreference } from '@/lib/appearance';
import { initialsFor } from '@/lib/auth';
import { switchCity } from '@/lib/bootstrap';
import { useActiveCity, useActiveCityName, useCityOptions } from '@/lib/city';
import { stayProgress } from '@/lib/stay';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

/** One quiet destination row. Longer explanations remain in its accessible name. */
function Setting({label,note,glyph,onPress,divider=false,value=false,hint}:{label:string;note:string;glyph:string;onPress:()=>void;divider?:boolean;value?:boolean;hint?:string}) {
  const colors=useThemeColors();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label}. ${hint || note}`} onPress={onPress} activeOpacity={.72}
    style={{minHeight:54,paddingHorizontal:14,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:11,borderTopWidth:divider?1:0,borderTopColor:colors['edge-faint']}}>
    <Glyph name={glyph} size={18} color={colors['fg-muted']} />
    <Text numberOfLines={1} className="font-dm text-ink" style={{flex:1,fontSize:13,lineHeight:19}}>{label}</Text>
    {value?<Text numberOfLines={1} className="font-dm" style={{maxWidth:'40%',fontSize:11,lineHeight:17,color:colors['fg-muted']}}>{note}</Text>:null}
    <Glyph name="chevron" size={14} color={colors['fg-muted']} />
  </TouchableOpacity>;
}

export default function ProfileScreen() {
  const router=useRouter(),s=useScoper(),colors=useThemeColors(),card=useAuroraCard('citydesk');
  const city=useActiveCity(),cityName=useActiveCityName(),cityOptions=useCityOptions();
  const gutter=useAppGutter(),insets=useSafeAreaInsets();
  const [appearance,setAppearance]=useState<AppearancePreference>('system');
  const [picker,setPicker]=useState<'city'|'appearance'|null>(null);
  useEffect(()=>{restoreAppearance().then(setAppearance).catch(()=>undefined);},[]);
  const displayName=s.session?.user.name||'Hello, wanderer.';
  const progress=s.stay?stayProgress(s.stay):null;
  const locationNote=s.locationStatus==='granted'
    ?s.deviceLocation?.label||'Device location enabled'
    :s.locationStatus==='denied'?'Location access off · City reference'
      :'City reference · Permission optional';
  const manageLocation=async()=>{
    if(s.locationStatus==='denied'&&!s.locationCanAskAgain){
      try{await Linking.openSettings();}catch{s.showToast('Open your device settings to enable location');}
      return;
    }
    try{const status=await s.requestLocation();s.showToast(status==='granted'?'Location access enabled':'Location access was not enabled');}
    catch{s.showToast('Could not update location access');}
  };
  const chooseAppearance=(value:AppearancePreference)=>{
    setAppearance(value);setPicker(null);
    void saveAppearance(value).catch(()=>s.showToast('Could not save your appearance choice'));
  };
  const chooseCity=(slug:string)=>{
    setPicker(null);void switchCity(slug).catch(()=>s.showToast('Could not switch city'));
  };
  return <Screen><ScreenScroll gap={20} clearsTabBar>
    <LocalPerksHeader appearance="citydesk" title="You" profile={false} />
    <CityDeskHeadline accent="All in one place.">All yours.</CityDeskHeadline>
    <View testID="profile-card" style={[card,{borderRadius:21,padding:17}]}>
      <View className="flex-row items-center gap-x-3.5">
        <View style={{width:48,height:48,borderRadius:16,overflow:'hidden',alignItems:'center',justifyContent:'center',backgroundColor:colors['accent-tint']}}>
            {s.profileAvatarUrl?<Image source={{uri:s.profileAvatarUrl}} contentFit="cover" style={{width:48,height:48}} />:
              <Text className="font-dm-medium" style={{fontSize:22,lineHeight:27,color:colors['pill-ink']}}>{s.session?initialsFor(displayName):'G'}</Text>}
        </View>
        <View className="min-w-0 flex-1"><Text numberOfLines={1} className="font-dm-medium text-ink" style={{fontSize:17,lineHeight:22,letterSpacing:-.3}}>{displayName}</Text>
          <Text className="font-dm" style={{marginTop:3,fontSize:12,lineHeight:17,color:colors['fg-muted']}}>{s.session?cityName:'Make the city your own.'}</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open notifications" onPress={()=>router.push('/notifications')}
          className="h-11 w-11 items-center justify-center rounded-full" style={{borderWidth:1,borderColor:colors['control-edge']}}>
          <Glyph name="bell" size={19} color={colors.fg} />
        </TouchableOpacity>
      </View>
    </View>
    {!s.session?<TouchableOpacity accessibilityRole="button" accessibilityLabel="Sign in or create account" onPress={()=>s.openSheet('auth')} activeOpacity={.78}
      style={{minHeight:44,marginTop:-12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
      <Text className="font-dm" style={{fontSize:12,lineHeight:18,color:colors['pill-ink']}}>Sign in to keep your good finds</Text><Glyph name="chevron" size={14} color={colors['pill-ink']} />
    </TouchableOpacity>:null}
    <CityDeskSection title="Keep the good ones close" action="Open" onMore={()=>router.push('/saved')}>
      <AuroraList compact>
        <Setting value label="Saved places" note={String(s.savedPlaceKeys.length)} glyph="bookmark" onPress={()=>router.push('/saved')} />
        <Setting divider label="Your evening" note="The places you’re keeping in mind" glyph="route" onPress={()=>router.push('/evening')} />
        <Setting divider label="Local offers" note="A little extra, from the venue" glyph="tag" onPress={()=>router.push('/offers')} />
        <Setting divider label={s.stay?.propertyName||'Link your stay'} note={progress?`Night ${progress.currentNight} of ${progress.totalNights}`:'Hotel, Airbnb, wherever you call home'} glyph="briefcase" onPress={s.openStaySheet} />
        <Setting divider label="Your taste" note="The things you gravitate toward" glyph="spark" onPress={()=>router.push('/taste')} />
        <Setting divider label="My plans" note="Saved evenings and upcoming stops" glyph="calendar" onPress={()=>router.push('/plans')} />
      </AuroraList>
    </CityDeskSection>
    <CityDeskSection title="Preferences" action="Edit" onMore={()=>setPicker('appearance')}>
      <AuroraList compact>
        <Setting value label="City" note={cityName} glyph="pin" onPress={()=>setPicker('city')} />
        <Setting divider value label="Appearance" note={APPEARANCE_OPTIONS.find(x=>x.value===appearance)?.label||'System'} glyph="sun" onPress={()=>setPicker('appearance')} />
        <Setting divider value label="Location" note={s.locationStatus==='granted'?'Device location':'City reference'} hint={locationNote} glyph="compass" onPress={()=>void manageLocation()} />
        <Setting divider label="Notifications" note="Plan and checkout nudges" glyph="bell" onPress={()=>router.push('/notifications')} />
        {s.session?<Setting divider label="Log out" note="You can keep exploring as a guest" glyph="logout" onPress={()=>s.openSheet('logout')} />:null}
      </AuroraList>
    </CityDeskSection>
  </ScreenScroll>
  <Modal visible={picker!==null} transparent animationType="slide" onRequestClose={()=>setPicker(null)}>
    <View className="flex-1 justify-end" style={{backgroundColor:'rgba(0,0,0,.4)'}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss preferences" onPress={()=>setPicker(null)} style={{position:'absolute',inset:0}} />
      <View accessibilityViewIsModal className="rounded-t-sheet bg-bg" style={{paddingHorizontal:gutter,paddingTop:22,paddingBottom:Math.max(insets.bottom,20),maxHeight:'75%'}}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="font-fraunces text-title text-ink">{picker==='appearance'?'A change of light':'Your corner of the city'}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close preferences" onPress={()=>setPicker(null)} className="h-11 w-11 items-center justify-center rounded-full bg-surface-raised border border-edge-card border-b-edge-card-bottom shadow-soft-light dark:shadow-soft-dark">
            <Glyph name="close" size={18} color={colors.fg} />
          </TouchableOpacity>
        </View>
        <ScrollView>
          {picker==='appearance'?APPEARANCE_OPTIONS.map(x=><TouchableOpacity key={x.value} accessibilityRole="button" accessibilityState={{selected:appearance===x.value}} onPress={()=>chooseAppearance(x.value)}
            className="min-h-[58px] flex-row items-center justify-between border-b border-edge-faint py-3">
            <Text className="font-dm text-body text-ink">{x.label}</Text>{appearance===x.value?<Glyph name="check" size={18} color={colors['fg-accent']} />:null}
          </TouchableOpacity>):cityOptions.map(x=><TouchableOpacity key={x.slug} accessibilityRole="button" accessibilityState={{selected:city===x.slug}} onPress={()=>chooseCity(x.slug)}
            className="min-h-[58px] flex-row items-center justify-between border-b border-edge-faint py-3">
            <Text className="font-dm text-body text-ink">{x.name}</Text>{city===x.slug?<Glyph name="check" size={18} color={colors['fg-accent']} />:null}
          </TouchableOpacity>)}
        </ScrollView>
      </View>
    </View>
  </Modal>
  </Screen>;
}
