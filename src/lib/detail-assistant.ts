/** The assistant reads the open listing, never a guessed venue or generated facts. */
export type DetailContext = {
  kind: string;
  id: string;
  name: string;
  caption?: string;
  snapshot?: string;
  facts: readonly { label: string; value: string }[];
  links: readonly { label: string; url: string }[];
};

export type DetailAnswer = { text: string; links: { label: string; url: string }[] };

const publicLinks = (context: DetailContext) => context.links.filter(link => /^https?:\/\//i.test(link.url));

/** Carries the same pinned entity IDs the existing Vee planner accepts. */
export function detailPlanHref(context: DetailContext): string {
  const keys: Record<string, string> = { restaurant:'restaurantId', night:'nightlifeId', event:'eventId', venue:'venueId', crawl:'crawlId' };
  const params=new URLSearchParams({q:`Plan an evening around ${context.name}`});
  if(Object.prototype.hasOwnProperty.call(keys,context.kind))params.set(keys[context.kind],context.id);
  return '/create?'+params.toString();
}

/** A deliberately bounded fact assistant. Unknown policies, availability and
 * suitability stay unknown; listed hours are never promoted into live status. */
export function answerDetailQuestion(context: DetailContext, rawQuestion: string): DetailAnswer {
  const question=rawQuestion.trim().toLowerCase();
  const links=publicLinks(context),source=links.filter(link=>!/directions/i.test(link.label)).slice(0,2);
  const read=(labels:RegExp)=>{
    const seen=new Set<string>();
    return context.facts.filter(fact=>{const key=fact.value.trim().toLowerCase();if(!labels.test(fact.label)||seen.has(key))return false;seen.add(key);return true;});
  };
  const say=(facts:readonly {label:string;value:string}[])=>facts.map(fact=>`${fact.label}: ${fact.value}`).join('\n');
  if(!question)return {text:'What would you like to know about '+context.name+'?',links:[]};
  if(/allerg|gluten|celiac|nut.free|safe to eat/.test(question))return {
    text:`This listing does not confirm ingredient or allergy safety. Check directly with ${context.name} before ordering.`,links:source,
  };
  const topics: {question:RegExp;facts:RegExp;links?:RegExp}[]=[
    {question:/\b(where|address|located|directions|get there)\b/,facts:/address|location|venue|destination/i,links:/directions/i},
    {question:/\b(how far|distance|walk|travel|drive)\b/,facts:/distance|travel|walk|route|stops/i,links:/directions|route/i},
    {question:/\b(hours?|open|close[ds]?|late|midnight|when|time|start|doors|tonight|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,facts:/hours|late menu|when|date|time|showtime|start|doors|right now/i},
    {question:/\b(price|cost|expensive|cheap|budget|tickets?|cover)\b/,facts:/price|tickets|cost|budget/i,links:/tickets|booking|experience/i},
    {question:/\b(menu|food|dish|dishes|eat|dinner|lunch|breakfast|order|pickup|delivery)\b/,facts:/menu|cuisine|service|type/i,links:/menu|order/i},
    {question:/\b(reserv|reservation|book|booking|availability|available|sold out)\w*/,facts:/reserv|booking/i,links:/reserv|booking|tickets|experience/i},
    {question:/\b(parking|park|accessible|accessibility|wheelchair)\b/,facts:/parking|access|before you go/i},
    {question:/\b(age|kids|children|under|21|18)\b/,facts:/age|policy/i},
    {question:/\b(service|phone|contact|call)\b/,facts:/service|phone|contact/i},
    {question:/\b(lineup|perform|playing|who)\w*/,facts:/lineup|artist|venue/i},
  ];
  const topic=topics.find(item=>item.question.test(question));
  if(topic){
    const facts=read(topic.facts),related=topic.links?links.filter(link=>topic.links!.test(link.label)):[];
    if(facts.length)return {text:say(facts)+(topic.facts.source.includes('hours')?'\nThese are listed times; check the official page for changes.':''),links:related.length?related.slice(0,2):source};
    if(related.length)return {text:`Use ${context.name}’s official link for the current details.`,links:related.slice(0,2)};
    return {text:`That detail is not included in this listing for ${context.name}. Check the official source for confirmation.`,links:source};
  }
  if(/\b(what is|tell me|about|snapshot|describe)\b/.test(question))return {
    text:context.snapshot || context.caption || `The listing for ${context.name} does not include a description.`,links:source,
  };
  return {text:`I can help with ${context.name}’s listed location, times, pricing, menu and links. This listing does not confirm that specific detail.`,links:source};
}
