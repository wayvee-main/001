import { PROMOTION_LINKS } from '@/lib/links';

export type PromotionPlacement = 'home-food' | 'discover-rides' | 'ordering-savings';
export type PromotionTone = 'warm' | 'sage' | 'mist';

export interface PromotionAction {
  label: string;
  url: string;
  primary?: boolean;
}

export interface WayveePromotion {
  id: string;
  placement: PromotionPlacement;
  priority: number;
  eyebrow: string;
  title: string;
  detail: string;
  finePrint?: string;
  tone: PromotionTone;
  actions: PromotionAction[];
  verifiedAt: string;
  /** Internal recheck cutoff. The offer disappears after this point unless reverified. */
  displayUntil?: string;
}

export const PROMOTIONS: readonly WayveePromotion[] = [
  {
    id: 'doordash-oakland-deals',
    placement: 'home-food',
    priority: 20,
    eyebrow: 'DOORDASH',
    title: 'Oakland deals nearby',
    detail: 'Rotating % off and BOGO offers',
    finePrint: 'Terms apply per offer',
    tone: 'warm',
    actions: [
      { label: 'Browse deals', url: PROMOTION_LINKS.doorDashOaklandDeals, primary: true },
    ],
    verifiedAt: '2026-07-19',
  },
  {
    id: 'lyft-first-ride',
    placement: 'discover-rides',
    priority: 10,
    eyebrow: 'LYFT',
    title: '50% off your first ride',
    detail: 'Up to $10 · code 50OFF1WB',
    finePrint: 'New riders only',
    tone: 'mist',
    actions: [
      { label: 'Open Lyft', url: PROMOTION_LINKS.lyftFirstRide, primary: true },
    ],
    verifiedAt: '2026-07-19',
    displayUntil: '2026-07-27T06:59:59Z',
  },
  {
    id: 'ride-options',
    placement: 'discover-rides',
    priority: 20,
    eyebrow: 'UBER',
    title: 'Get there by ride',
    detail: 'Live ETAs and upfront pricing',
    tone: 'mist',
    actions: [
      { label: 'Open Uber', url: PROMOTION_LINKS.uberRide, primary: true },
    ],
    verifiedAt: '2026-07-19',
  },
  {
    id: 'uber-one-savings',
    placement: 'ordering-savings',
    priority: 10,
    eyebrow: 'UBER ONE',
    title: '$0 delivery fee',
    detail: 'On eligible Uber Eats orders for members',
    finePrint: 'Membership terms apply',
    tone: 'sage',
    actions: [
      { label: 'Uber One', url: PROMOTION_LINKS.uberOne, primary: true },
    ],
    verifiedAt: '2026-07-19',
  },
];

function isDisplayable(promotion: WayveePromotion, now: Date): boolean {
  if (!promotion.displayUntil) return true;
  const cutoff = new Date(promotion.displayUntil);
  return !Number.isNaN(cutoff.getTime()) && now.getTime() <= cutoff.getTime();
}

/** Picks one contextual promotion and automatically falls back when a volatile offer ages out. */
export function promotionForPlacement(placement: PromotionPlacement, now = new Date()): WayveePromotion | undefined {
  return PROMOTIONS
    .filter((promotion) => promotion.placement === placement && isDisplayable(promotion, now))
    .sort((a, b) => a.priority - b.priority)[0];
}
