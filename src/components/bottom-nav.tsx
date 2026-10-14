import { useRouter } from 'expo-router';
import { EditorialNav } from '@/components/editorial-nav';

const ITEMS = [
  { key: 'home', label: 'Home', href: '/', glyph: 'home' },
  { key: 'discover', label: 'Discover', href: '/discover', glyph: 'compass' },
  { key: 'create', label: 'Vee', href: '/create', glyph: 'spark' },
  { key: 'profile', label: 'You', href: '/profile', glyph: 'user' },
] as const;

export function DetailBottomNav({active='home'}:{active?:(typeof ITEMS)[number]['key']}) {
  const router=useRouter();
  return <EditorialNav reserveSpace items={ITEMS.map(x=>({key:x.key,label:x.label,glyph:x.glyph,selected:x.key===active,onPress:()=>router.replace(x.href)}))} />;
}
