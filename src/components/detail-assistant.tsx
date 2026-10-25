import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '@/components/glyph';
import { useAppGutter } from '@/components/layout';
import { VeeMark } from '@/components/vee-mark';
import { answerDetailQuestion, detailPlanHref, type DetailAnswer, type DetailContext } from '@/lib/detail-assistant';
import { useControlSurface, useRaisedSurface } from '@/lib/shadows';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

/** A sibling of the scroll view: always available above the detail navigation. */
export function DetailAssistantDock({context,chevron=false}: {context:DetailContext;chevron?:boolean}) {
  const [open,setOpen]=useState(false),[draft,setDraft]=useState('');
  const [conversation,setConversation]=useState<{question:string;answer:DetailAnswer}[]>([]);
  const input=useRef<TextInput>(null),scroll=useRef<ScrollView>(null),trigger=useRef<ComponentRef<typeof TouchableOpacity>>(null),router=useRouter();
  const colors=useThemeColors(),control=useControlSurface(),surface=useRaisedSurface(1),gutter=useAppGutter();
  const insets=useSafeAreaInsets(),{height}=useWindowDimensions(),showToast=useScoper(s=>s.showToast);
  const restoreFocus=()=>{if(Platform.OS==='web')requestAnimationFrame(()=>trigger.current?.focus());};
  const close=()=>{Keyboard.dismiss();setOpen(false);restoreFocus();};
  useEffect(()=>{
    if(Platform.OS!=='web'||!open)return;
    const onEscape=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      event.preventDefault();Keyboard.dismiss();setOpen(false);restoreFocus();
    };
    document.addEventListener('keydown',onEscape,true);
    return ()=>document.removeEventListener('keydown',onEscape,true);
  },[open]);
  const openLink=(url:string)=>{void Linking.openURL(url).catch(()=>showToast('Could not open that link. Please try again.'));};
  const send=()=>{
    const question=draft.trim();if(!question)return;
    setConversation(current=>[...current,{question,answer:answerDetailQuestion(context,question)}].slice(-8));setDraft('');input.current?.focus();
  };
  return <>
    <View testID="detail-assistant-dock" style={{width:'100%',maxWidth:720,alignSelf:'center',paddingHorizontal:gutter,paddingTop:6,paddingBottom:4}}>
      <TouchableOpacity ref={trigger} testID="detail-ask-vee" accessibilityRole="button" accessibilityLabel={`Ask Vee about ${context.name}`}
        activeOpacity={.75} onPress={()=>setOpen(true)} style={[control,{backgroundColor:colors['surface-ribbon'],minHeight:46,borderRadius:14,paddingHorizontal:11,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:8}]}>
        <VeeMark size={26} variant="compact" /><Text className="font-dm text-fine text-ink" style={{flex:1}}>A little help with this {context.kind==='event'?'show':context.kind==='crawl'?'route':'place'}?</Text><Glyph name={chevron?'chevron':'arrow'} size={13} color={colors['surface-accent']} />
      </TouchableOpacity>
    </View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} onShow={()=>input.current?.focus()}>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
        <View style={{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.42)',paddingHorizontal:14,paddingTop:insets.top+14,paddingBottom:Math.max(14,insets.bottom)}}>
          <Pressable accessibilityLabel="Dismiss Vee" onPress={close} style={{position:'absolute',inset:0}} />
          <View testID="detail-vee-sheet" role="dialog" aria-modal accessibilityViewIsModal accessibilityLabel={`Vee · ${context.name}`}
            style={[surface,{width:'100%',maxWidth:500,maxHeight:height*.82,alignSelf:'center',borderRadius:23,padding:18,backgroundColor:colors['surface-navigation'],gap:15}]}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:7}}><VeeMark size={28} /><Text className="font-fraunces text-ink" style={{fontSize:24,lineHeight:28}}>Vee</Text></View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close Vee" onPress={close} style={[control,{width:40,height:40,borderRadius:999,alignItems:'center',justifyContent:'center'}]}><Glyph name="close" size={16} color={colors.fg} /></TouchableOpacity>
            </View>
            <View style={[surface,{padding:11,borderRadius:12,flexDirection:'row',alignItems:'center',gap:8}]}>
              <Glyph name="pin" size={14} color={colors['surface-accent']} /><View style={{flex:1,minWidth:0}}>
                <Text numberOfLines={2} className="font-dm text-label text-ink">{context.name}</Text>
                {context.caption?<Text numberOfLines={1} className="mt-0.5 font-dm text-fine text-taupe">{context.caption}</Text>:null}
              </View>
            </View>
            <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} onContentSizeChange={()=>scroll.current?.scrollToEnd({animated:false})} contentContainerStyle={{gap:16,paddingBottom:3}}>
              {conversation.length?conversation.map((message,index)=><View key={index} style={{gap:8}}>
                <Text className="font-dm-medium text-label text-ink">{message.question}</Text>
                <Text accessibilityLiveRegion={index===conversation.length-1?'polite':'none'} className="font-dm text-label text-taupe" style={{lineHeight:19}}>{message.answer.text}</Text>
                {message.answer.links.map(link=><TouchableOpacity key={link.url} accessibilityRole="link" accessibilityLabel={link.label} onPress={()=>openLink(link.url)} style={{flexDirection:'row',alignItems:'center',gap:5,minHeight:32}}>
                  <Text className="font-dm text-fine text-peach">{link.label}</Text><Glyph name="arrow" size={12} color={colors['surface-accent']} />
                </TouchableOpacity>)}
              </View>):<Text className="font-dm text-label text-taupe" style={{lineHeight:19}}>What would you like to know about this {context.kind==='event'?'show':context.kind==='crawl'?'route':'place'}?</Text>}
            </ScrollView>
            <View style={[control,{padding:12,borderRadius:17,gap:9,backgroundColor:colors['surface-input']}]}>
              <Text className="font-dm text-fine text-taupe">Ask about this {context.kind==='event'?'show':context.kind==='crawl'?'route':'place'}</Text>
              <TextInput ref={input} testID="detail-vee-input" accessibilityLabel={`Ask about ${context.name}`} value={draft} onChangeText={setDraft}
                multiline maxLength={600} placeholder="What would you like to know?" placeholderTextColor={colors['fg-muted']} className="font-dm text-ink"
                style={{fontSize:16,lineHeight:23,minHeight:65,maxHeight:130,padding:0,textAlignVertical:'top',borderWidth:0,outlineWidth:0}} />
              <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Plan an evening around ${context.name}`} onPress={()=>{close();router.push(detailPlanHref(context) as never);}} style={{minHeight:36,justifyContent:'center'}}>
                  <Text className="font-dm text-fine text-peach">Plan around this</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="detail-vee-send" accessibilityRole="button" accessibilityLabel="Send to Vee" disabled={!draft.trim()} onPress={send}
                  style={{width:38,height:38,borderRadius:999,backgroundColor:colors['accent-fill'],opacity:draft.trim()?1:.45,alignItems:'center',justifyContent:'center'}}>
                  <Glyph name="arrowUp" size={17} color={colors['on-accent']} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}
