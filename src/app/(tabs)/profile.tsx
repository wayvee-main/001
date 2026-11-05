import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraList, AuroraRow, GradientFill, GradientText, IconBadge, SectionRule, useGlass } from '@/components/aurora';
import { Glyph } from '@/components/glyph';
import { LocalPerksHeader } from '@/components/local-perks';
import { Screen, ScreenScroll, useAppGutter } from '@/components/layout';
import { APPEARANCE_OPTIONS, restoreAppearance, saveAppearance, type AppearancePreference } from '@/lib/appearance';
import { initialsFor } from '@/lib/auth';
import { switchCity } from '@/lib/bootstrap';
import { useActiveCity, useActiveCityName, useCityOptions } from '@/lib/city';
import { stayProgress } from '@/lib/stay';
import { useScoper } from '@/lib/store';
import { useAurora } from '@/lib/aurora';
import { useThemeColors } from '@/lib/theme';

/** One preference or destination row: gradient-tinted glyph, label, and either a
 * short value at the right or a longer note underneath. */
function Setting({label,note,glyph,onPress,divider=false,value=false}:{label:string;note:string;glyph:string;onPress:()=>void;divider?:boolean;value?:boolean}) {
  return <AuroraRow divider={divider} accessibilityLabel={`${label}. ${note}`} onPress={onPress} title={label}
    subtitle={value?undefined:note} trailing={value?note:undefined} leading={<IconBadge glyph={glyph} size={38} iconSize={18} />} />;
}

export default function ProfileScreen() {
  const router=useRouter(),s=useScoper(),colors=useThemeColors(),glass=useGlass(),aurora=useAurora();
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
  return <Screen aurora><ScreenScroll gap={20} clearsTabBar>
    <LocalPerksHeader profile={false} />
    <Text accessibilityRole="header" className="font-dm-bold text-ink" style={{fontSize:32,lineHeight:37,letterSpacing:-1.1}}>Your kind of <GradientText text="city." /></Text>
    <View testID="profile-card" style={[glass,{borderRadius:26,padding:18,gap:16}]}>
      <View className="flex-row items-center gap-x-3.5">
        <View style={{width:58,height:58,borderRadius:29,overflow:'hidden',alignItems:'center',justifyContent:'center'}}>
          <LinearGradient colors={[...aurora.ring]} start={{x:0,y:1}} end={{x:1,y:0}} style={{position:'absolute',top:0,right:0,bottom:0,left:0}} />
          <View style={{width:53,height:53,borderRadius:27,overflow:'hidden',alignItems:'center',justifyContent:'center',backgroundColor:colors['surface-raised']}}>
            {s.profileAvatarUrl?<Image source={{uri:s.profileAvatarUrl}} contentFit="cover" style={{width:53,height:53}} />:
              <Text className="font-dm-bold text-ink" style={{fontSize:21,lineHeight:26}}>{s.session?initialsFor(displayName):'G'}</Text>}
          </View>
        </View>
        <View className="min-w-0 flex-1"><Text numberOfLines={1} className="font-dm-medium text-ink" style={{fontSize:20,lineHeight:25,letterSpacing:-.3}}>{displayName}</Text>
          <Text className="font-dm" style={{marginTop:1,fontSize:13,lineHeight:18,color:colors['fg-muted']}}>{cityName}</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open notifications" onPress={()=>router.push('/notifications')}
          className="h-11 w-11 items-center justify-center rounded-full" style={{backgroundColor:colors['surface-sunk']}}>
          <Glyph name="bell" size={19} color={colors.fg} />
        </TouchableOpacity>
      </View>
      {!s.session?<View className="flex-row items-center gap-x-3" style={{paddingTop:16,borderTopWidth:1,borderTopColor:aurora.glassEdge}}>
        <Text className="min-w-0 flex-1 font-dm" style={{fontSize:14,lineHeight:19,color:colors['fg-muted']}}>Sign in to save places and plans.</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sign in or create account" onPress={()=>s.openSheet('auth')} activeOpacity={.78}
          className="h-11 flex-row items-center gap-x-1.5 rounded-full px-4" style={{overflow:'hidden'}}>
          <GradientFill />
          <Text className="font-dm-medium" style={{fontSize:14,lineHeight:19,color:aurora.onFill}}>Sign in</Text>
          <View><Glyph name="arrow" size={15} color={aurora.onFill} /></View>
        </TouchableOpacity>
      </View>:null}
    </View>
    <View style={{marginTop:8}}>
      <Text accessibilityRole="header" className="font-dm-medium text-ink" style={{fontSize:20,lineHeight:25,letterSpacing:-.4,marginBottom:14}}>Keep the good ones close</Text>
      <AuroraList>
        <Setting label="Saved places" note={`${s.savedPlaceKeys.length} good finds`} glyph="heart" onPress={()=>router.push('/saved')} />
        <Setting divider label="Your evening" note="The places you’re keeping in mind" glyph="route" onPress={()=>router.push('/evening')} />
        <Setting divider label="Local offers" note="A little extra, from the venue" glyph="tag" onPress={()=>router.push('/offers')} />
        <Setting divider label={s.stay?.propertyName||'Link your stay'} note={progress?`Night ${progress.currentNight} of ${progress.totalNights}`:'Hotel, Airbnb, wherever you call home'} glyph="briefcase" onPress={s.openStaySheet} />
        <Setting divider label="Your taste" note="The things you gravitate toward" glyph="spark" onPress={()=>router.push('/taste')} />
        <Setting divider label="My plans" note="Saved evenings and upcoming stops" glyph="calendar" onPress={()=>router.push('/plans')} />
      </AuroraList>
    </View>
    <SectionRule spacing={10} />
    <View>
      <Text accessibilityRole="header" className="font-dm-medium text-ink" style={{fontSize:20,lineHeight:25,letterSpacing:-.4,marginBottom:14}}>Preferences</Text>
      <AuroraList>
        <Setting value label="City" note={cityName} glyph="pin" onPress={()=>setPicker('city')} />
        <Setting divider value label="Appearance" note={APPEARANCE_OPTIONS.find(x=>x.value===appearance)?.label||'System'} glyph="sun" onPress={()=>setPicker('appearance')} />
        <Setting divider label="Location" note={locationNote} glyph="compass" onPress={()=>void manageLocation()} />
        <Setting divider label="Notifications" note="Plan and checkout nudges" glyph="bell" onPress={()=>router.push('/notifications')} />
        {s.session?<Setting divider label="Log out" note="You can keep exploring as a guest" glyph="logout" onPress={()=>s.openSheet('logout')} />:null}
      </AuroraList>
    </View>
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
