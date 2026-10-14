import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph } from '@/components/glyph';
import { Screen, ScreenScroll, useAppGutter } from '@/components/layout';
import { PrimaryButton } from '@/components/ui';
import { APPEARANCE_OPTIONS, restoreAppearance, saveAppearance, type AppearancePreference } from '@/lib/appearance';
import { initialsFor } from '@/lib/auth';
import { switchCity } from '@/lib/bootstrap';
import { useActiveCity, useActiveCityName, useCityOptions } from '@/lib/city';
import { useNow } from '@/lib/clock';
import { EVENTS, isCurrentEvent } from '@/lib/data';
import { useElevation } from '@/lib/shadows';
import { stayProgress } from '@/lib/stay';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

function Setting({label,note,glyph,onPress}:{label:string;note:string;glyph:string;onPress:()=>void}) {
  const colors=useThemeColors();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label}. ${note}`} onPress={onPress} activeOpacity={.78}
    className="flex-row items-center gap-x-2.5 rounded-setting bg-surface-raised px-3 py-[13px]"
    style={{borderColor:colors['control-edge'],borderWidth:1,minHeight:62}}>
    <Glyph name={glyph} size={18} color={colors['fg-muted']} />
    <View className="min-w-0 flex-1"><Text className="font-dm text-[13px] leading-[18px] text-ink">{label}</Text>
      <Text className="mt-[3px] font-dm text-fine text-taupe">{note}</Text></View>
    <Glyph name="chevron" size={14} color={colors['fg-muted']} />
  </TouchableOpacity>;
}

export default function ProfileScreen() {
  const router=useRouter(),s=useScoper(),colors=useThemeColors(),lift=useElevation(1);
  const city=useActiveCity(),cityName=useActiveCityName(),cityOptions=useCityOptions();
  const gutter=useAppGutter(),insets=useSafeAreaInsets(),now=useNow();
  const [appearance,setAppearance]=useState<AppearancePreference>('system');
  const [picker,setPicker]=useState<'city'|'appearance'|null>(null);
  useEffect(()=>{restoreAppearance().then(setAppearance).catch(()=>undefined);},[]);
  const displayName=s.session?.user.name||'Hello, wanderer.';
  const currentPlanCount=s.plans.filter(id=>EVENTS[id]&&isCurrentEvent(EVENTS[id],now)).length;
  const stats=[
    {value:s.savedPlaceKeys.length,label:'Saved',href:'/saved'},
    {value:currentPlanCount,label:'Plans',href:'/plans'},
    {value:s.followedVenues.length,label:'Following',href:'/following'},
  ];
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
    <View className="mt-2 flex-row items-center justify-between">
      <Text className="font-fraunces text-display text-ink">Your Wayvee</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open notifications" onPress={()=>router.push('/notifications')}
        className="h-9 w-9 items-center justify-center rounded-full bg-surface-raised">
        <Glyph name="bell" size={18} color={colors.fg} />
      </TouchableOpacity>
    </View>
    <View className="flex-row items-center gap-x-[13px]">
      <View style={[lift,{width:56,height:56,borderRadius:28,borderWidth:5,borderColor:colors['surface-raised'],overflow:'hidden'}]}>
        {s.profileAvatarUrl?<Image source={{uri:s.profileAvatarUrl}} contentFit="cover" style={{width:46,height:46}} />:
          <LinearGradient colors={[colors['tile-bars'],colors['tile-eat'],colors['tile-routes']]} start={{x:0,y:0}} end={{x:1,y:1}}
            style={{flex:1,alignItems:'center',justifyContent:'center'}}>
            <Text className="font-dm-medium text-[22px] text-ink">{s.session?initialsFor(displayName):'G'}</Text>
          </LinearGradient>}
      </View>
      <View className="min-w-0 flex-1"><Text className="font-fraunces text-ink" style={{fontSize:25,lineHeight:29}}>{displayName}</Text>
        <Text className="mt-[7px] font-dm text-fine text-taupe">{cityName} · Your city, at your pace</Text></View>
    </View>
    {!s.session?<LinearGradient colors={[colors['surface-raised'],colors['tile-eat']]} start={{x:0,y:0}} end={{x:1,y:1}}
      style={{borderRadius:17,padding:14,borderWidth:1,borderColor:colors['control-edge']}}>
      <Text className="font-fraunces text-[19px] leading-[23px] text-ink">Make yourself at home.</Text>
      <Text className="mt-[7px] font-dm text-label text-taupe">Keep your favorite places, plans and preferences together.</Text>
      <PrimaryButton label="Sign in or create account" onPress={()=>s.openSheet('auth')} className="mt-4" />
    </LinearGradient>:null}
    <View className="flex-row gap-x-[9px]">
      {stats.map(x=><TouchableOpacity key={x.label} accessibilityRole="button" accessibilityLabel={`${x.label}: ${x.value}`} onPress={()=>router.push(x.href as never)} activeOpacity={.78}
        className="min-w-0 flex-1 items-center rounded-stat bg-surface-raised py-3.5 px-[5px]" style={{borderColor:colors['control-edge'],borderWidth:1}}>
        <Text className="font-fraunces text-[24px] leading-[29px] text-ink">{x.value}</Text>
        <Text className="mt-1 font-dm text-fine text-taupe">{x.label}</Text>
      </TouchableOpacity>)}
    </View>
    <View className="gap-y-2">
      <Text className="mb-1 font-fraunces text-section text-ink">Your starting point</Text>
      <Setting label={s.stay?.propertyName||'Link your stay'} note={progress?`Night ${progress.currentNight} of ${progress.totalNights}`:'Hotel, Airbnb, wherever you call home'} glyph="briefcase" onPress={s.openStaySheet} />
      <Setting label="Your taste" note="The things you gravitate toward" glyph="spark" onPress={()=>router.push('/taste')} />
      <Setting label="My plans" note="Saved evenings and upcoming stops" glyph="calendar" onPress={()=>router.push('/plans')} />
    </View>
    <View className="gap-y-2">
      <Text className="mb-1 font-fraunces text-section text-ink">Preferences</Text>
      <Setting label="City" note={cityName} glyph="pin" onPress={()=>setPicker('city')} />
      <Setting label="Appearance" note={APPEARANCE_OPTIONS.find(x=>x.value===appearance)?.label||'System'} glyph="sun" onPress={()=>setPicker('appearance')} />
      <Setting label="Location" note={locationNote} glyph="compass" onPress={()=>void manageLocation()} />
      <Setting label="Notifications" note="Plan and checkout nudges" glyph="bell" onPress={()=>router.push('/notifications')} />
      {s.session?<Setting label="Log out" note="You can keep exploring as a guest" glyph="logout" onPress={()=>s.openSheet('logout')} />:null}
    </View>
  </ScreenScroll>
  <Modal visible={picker!==null} transparent animationType="slide" onRequestClose={()=>setPicker(null)}>
    <View className="flex-1 justify-end" style={{backgroundColor:'rgba(0,0,0,.4)'}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss preferences" onPress={()=>setPicker(null)} style={{position:'absolute',inset:0}} />
      <View accessibilityViewIsModal className="rounded-t-sheet bg-bg" style={{paddingHorizontal:gutter,paddingTop:22,paddingBottom:Math.max(insets.bottom,20),maxHeight:'75%'}}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="font-fraunces text-title text-ink">{picker==='appearance'?'A change of light':'Your corner of the city'}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close preferences" onPress={()=>setPicker(null)} className="h-11 w-11 items-center justify-center rounded-full bg-surface-raised">
            <Glyph name="close" size={18} color={colors.fg} />
          </TouchableOpacity>
        </View>
        <ScrollView>
          {picker==='appearance'?APPEARANCE_OPTIONS.map(x=><TouchableOpacity key={x.value} accessibilityRole="button" accessibilityState={{selected:appearance===x.value}} onPress={()=>chooseAppearance(x.value)}
            className="min-h-[58px] flex-row items-center justify-between border-b border-edge-soft py-3">
            <Text className="font-dm text-body text-ink">{x.label}</Text>{appearance===x.value?<Glyph name="check" size={18} color={colors['fg-accent']} />:null}
          </TouchableOpacity>):cityOptions.map(x=><TouchableOpacity key={x.slug} accessibilityRole="button" accessibilityState={{selected:city===x.slug}} onPress={()=>chooseCity(x.slug)}
            className="min-h-[58px] flex-row items-center justify-between border-b border-edge-soft py-3">
            <Text className="font-dm text-body text-ink">{x.name}</Text>{city===x.slug?<Glyph name="check" size={18} color={colors['fg-accent']} />:null}
          </TouchableOpacity>)}
        </ScrollView>
      </View>
    </View>
  </Modal>
  </Screen>;
}
