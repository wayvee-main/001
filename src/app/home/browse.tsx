import { Redirect, useLocalSearchParams } from 'expo-router';
import { HOME_LEDGERS, isHomeLedgerCategory } from '@/lib/home-ledger';

/** Keep saved category links working; generic search belongs to Quiet index. */
export default function HomeBrowseScreen() {
  const params=useLocalSearchParams<{category?:string|string[];q?:string|string[]}>();
  const category=Array.isArray(params.category)?params.category[0]:params.category;
  const query=Array.isArray(params.q)?params.q[0]:params.q;
  return <Redirect href={{pathname:isHomeLedgerCategory(category)?HOME_LEDGERS[category].href:'/search',params:query?{q:query}:{}}} />;
}
