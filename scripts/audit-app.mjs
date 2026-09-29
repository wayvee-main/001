import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const root = process.cwd();
const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function filesUnder(relativePath) {
  const base = path.join(root, relativePath);
  return fs.readdirSync(base, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/** data.ts may only reach for the curated event bundle, which is itself a
 * plain data module with no imports at all. Anything else would make the audit
 * depend on code it has not vetted, so every other require still throws. */
function loadDataModule() {
  const events = loadTypedModule('src/lib/events.ts');
  const source = read('src/lib/data.ts');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', output)(module, module.exports, (request) => {
    if (request === './events') return events;
    throw new Error(`src/lib/data.ts may only depend on ./events; it required ${request}.`);
  });
  return module.exports;
}

function loadTypedModule(relativePath, dependencies = {}) {
  const source = read(relativePath);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', output)(module, module.exports, (request) => {
    if (Object.hasOwn(dependencies, request)) return dependencies[request];
    throw new Error(`${relativePath} has an unaudited dependency: ${request}`);
  });
  return module.exports;
}

const data = loadDataModule();
const links = loadTypedModule('src/lib/links.ts');
const promotions = loadTypedModule('src/lib/promotions.ts', { '@/lib/links': links });
const restaurants = Object.values(data.RESTAURANTS);
const venues = Object.values(data.VENUES);
const events = Object.values(data.EVENTS);
const asOf = new Date();
const currentEvents = data.currentEventListings(asOf);

assert(restaurants.length >= 70, `Expected at least 70 restaurants; found ${restaurants.length}.`);
assert(venues.length >= 4, `Expected at least 4 venues; found ${venues.length}.`);
assert(currentEvents.length >= 18, `Expected at least 18 current events today; found ${currentEvents.length}. Refresh dated listings before release.`);
assert(new Set(restaurants.map((restaurant) => restaurant.name.trim().toLowerCase())).size === restaurants.length, 'Restaurant names must be unique.');

for (const [key, restaurant] of Object.entries(data.RESTAURANTS)) {
  assert(key === restaurant.id, `Restaurant key/id mismatch: ${key}/${restaurant.id}.`);
  assert(restaurant.menuHighlights.length >= 3, `${restaurant.name} needs at least 3 searchable menu highlights.`);
  assert(/^https:\/\//.test(restaurant.sourceUrl), `${restaurant.name} is missing an HTTPS official source.`);
  assert(/^https:\/\//.test(restaurant.primaryAction.url), `${restaurant.name} has an invalid primary action URL.`);
}

for (const [key, venue] of Object.entries(data.VENUES)) {
  assert(key === venue.id, `Venue key/id mismatch: ${key}/${venue.id}.`);
  assert(/^https:\/\//.test(venue.sourceUrl), `${venue.name} is missing an HTTPS official calendar.`);
}

for (const [key, event] of Object.entries(data.EVENTS)) {
  assert(key === event.id, `Event key/id mismatch: ${key}/${event.id}.`);
  assert(/^https:\/\//.test(event.sourceUrl), `${event.name} is missing an HTTPS official source.`);
  if (event.venueId) assert(Boolean(data.VENUES[event.venueId]), `${event.name} points to missing venue ${event.venueId}.`);
  if (event.startsAt) assert(!Number.isNaN(new Date(event.startsAt).getTime()), `${event.name} has an invalid startsAt timestamp.`);
}

for (const chip of data.CUISINES.filter((label) => label !== 'All')) {
  const ids = data.CUISINE_MATCH[chip] ?? [];
  assert(ids.length >= 15, `${chip} should populate at least 15 restaurant rows.`);
  for (const id of ids) assert(Boolean(data.RESTAURANTS[id]), `${chip} points to missing restaurant ${id}.`);
}
assert(data.CUISINES.every((label) => ['All', 'American', 'Latin', 'Asian', 'Italian + Pizza'].includes(label)), 'Food Hub pills contain a non-cuisine category.');

const baseFilters = { sort: 'Best match', price: null, distance: null, openLate: false, delivery: false, reserve: false };
const foodHubPicks = data.FOOD_HUB_SECTIONS.flatMap((section) => section.picks);
const foodHubIds = foodHubPicks.map((pick) => pick.id);
assert(data.FOOD_HUB_SECTIONS.length === 4, 'The All view must be divided into four curated cuisine sections.');
assert(data.FOOD_HUB_SECTIONS.every((section) => section.picks.length >= 15), 'Every All-view cuisine section needs at least 15 spots.');
assert(foodHubIds.length === data.FAV_POOL.length, 'The Food Hub sections must expose the complete Hub roster.');
assert(new Set(foodHubIds).size === foodHubIds.length, 'Food Hub sections repeat a restaurant.');
assert(foodHubPicks.every((pick) => pick.reason?.trim()), 'Every Food Hub restaurant needs a purposeful reason to go.');
for (const id of foodHubIds) assert(Boolean(data.RESTAURANTS[id]), `Food Hub points to missing restaurant ${id}.`);
assert(data.searchFoodHub('fried chicken', baseFilters).some((restaurant) => restaurant.id === 'aburaya'), 'Menu search does not find Aburaya fried chicken.');
assert(data.searchFoodHub('ramen', baseFilters).length >= 3, 'Menu search should find multiple ramen restaurants.');
assert(data.searchFoodHub('sancocho', baseFilters).some((restaurant) => restaurant.id === 'alamar'), 'Menu search does not find alaMar by dish.');
assert(data.searchFoodHub('piedmont ramen', baseFilters).some((restaurant) => restaurant.id === 'mensho'), 'Token search does not combine neighborhood and menu terms.');
assert(data.restaurantSearchCue(data.RESTAURANTS.alamar, 'sancocho').includes('Sancocho'), 'Search results do not explain their matching menu item.');

for (const category of ['Upcoming', 'Live music', 'Outdoor', 'Movies']) {
  assert(currentEvents.some((event) => event.cats.includes(category)), `${category} has no current event listings.`);
}

const homeEvents = data.homeEventPicks(asOf);
assert(homeEvents.length >= 4, 'Home needs at least four current event picks.');
assert(new Set(homeEvents.map((event) => event.venueId ?? event.venue.toLowerCase())).size === homeEvents.length, 'Home event picks repeat a venue.');

for (const collection of Object.values(data.CURATED_COLLECTIONS)) {
  assert(collection.items.length >= 2, `${collection.title} needs at least 2 items.`);
  for (const item of collection.items) {
    const exists = item.type === 'restaurant' ? data.RESTAURANTS[item.id] : data.EVENTS[item.id];
    assert(Boolean(exists), `${collection.title} points to missing ${item.type} ${item.id}.`);
  }
}
const activeCollections = Object.values(data.CURATED_COLLECTIONS)
  .filter((collection) => data.activeCollectionItems(collection, asOf).length > 0);
assert(activeCollections.length >= 2, `Expected at least 2 active collections today; found ${activeCollections.length}.`);
const lateNightItems = data.CURATED_COLLECTIONS['late-night'].items;
const lateNightIds = lateNightItems.map((item) => item.id);
assert(lateNightItems.length >= 3, 'Late-night food needs at least three verified choices.');
assert(lateNightItems.every((item) => item.type === 'restaurant' && item.note), 'Late-night choices need a focused reason to go.');
assert(lateNightIds.every((id) => data.RESTAURANTS[id]?.openLate), 'Late-night collection contains a restaurant without verified late hours.');
// Home's own food groups were removed, so the late-night collection is the
// only curated food surface the Hub can now collide with.
const homeSurfaceFoodIds = new Set(lateNightIds);
assert(foodHubIds.every((id) => !homeSurfaceFoodIds.has(id)), 'The Food Hub duplicates a restaurant already surfaced on Home.');
assert(read('src/app/collection/[id].tsx').includes('activeCollectionItems(collection)'), 'Collection details are not filtering expired events.');
const homeSource = read('src/app/(tabs)/index.tsx');
assert(homeSource.includes('<Photo uri={event.image}'), 'Home event picks are missing thumbnails.');
assert(homeSource.includes("promotionForPlacement('home-food')"), 'Home is missing its contextual food promotion.');
assert(homeSource.includes('<CompactPromo promotion={foodPromotion} compact'), 'The Home delivery promotion is not using the reduced-height treatment.');
assert(read('src/app/(tabs)/discover.tsx').includes("promotionForPlacement('discover-rides')"), 'Discover is missing its contextual ride promotion.');
assert(read('src/app/featured/ordering.tsx').includes("promotionForPlacement('ordering-savings')"), 'Ordering is missing its contextual savings promotion.');
const foodHubSource = read('src/app/featured/index.tsx');
assert(foodHubSource.includes('FOOD_HUB_SECTIONS.map'), 'The expanded food directory is missing curated Hub sections.');
assert(foodHubSource.includes('<FoodHubRow'), 'The Food Hub is not using compact restaurant rows.');
assert(foodHubSource.includes('<PromoRibbon'), 'The Food Hub is missing integrated promo ribbons.');
const promoSource = read('src/components/compact-promo.tsx');
assert(promoSource.includes("w-[3px] rounded-full"), 'Promotions are missing their restrained visual accent.');
assert(promoSource.includes('shrink-0 flex-row gap-x-1.5'), 'Food Hub promo actions are not using the simplified horizontal layout.');
assert(!promoSource.includes('items-end gap-y-1.5'), 'Food Hub promo actions still use the old stacked layout.');
assert(!foodHubSource.includes('<FeaturedPlaceCard'), 'The Food Hub still contains the old heavy cards.');
assert(foodHubSource.includes("'Filters on'"), 'The Food Hub does not visibly confirm active filters.');
assert(foodHubSource.includes('searchFoodHub(query, filters)'), 'Food Hub search is not global across cuisines and filters.');
assert(foodHubSource.includes('restaurantSearchCue'), 'Food Hub search results do not expose their matching dish or term.');
assert(read('src/components/overlays.tsx').includes("'Lowest price'"), 'The Filter sheet is missing its functional price sort.');
assert(read('src/components/overlays.tsx').includes('searchRestaurants(q)'), 'Global app search does not index the complete restaurant/menu catalog.');

const promotionIds = promotions.PROMOTIONS.map((promotion) => promotion.id);
assert(new Set(promotionIds).size === promotionIds.length, 'Promotion IDs must be unique.');
for (const promotion of promotions.PROMOTIONS) {
  assert(promotion.actions.length >= 1 && promotion.actions.length <= 2, `${promotion.id} must stay minimal with one or two actions.`);
  assert(!Number.isNaN(new Date(promotion.verifiedAt).getTime()), `${promotion.id} has an invalid verification date.`);
  for (const action of promotion.actions) {
    assert(/^https:\/\//.test(action.url) || /^\//.test(action.url), `${promotion.id}/${action.label} is missing a valid action.`);
  }
  if (promotion.displayUntil) {
    assert(new Date(promotion.displayUntil).getTime() > new Date(promotion.verifiedAt).getTime(), `${promotion.id} has an invalid recheck cutoff.`);
  }
}
for (const placement of ['home-food', 'discover-rides', 'ordering-savings']) {
  assert(Boolean(promotions.promotionForPlacement(placement, new Date('2026-07-19T19:00:00Z'))), `${placement} has no current promotion.`);
  assert(Boolean(promotions.promotionForPlacement(placement, new Date('2027-07-19T19:00:00Z'))), `${placement} has no evergreen fallback.`);
}
assert(
  new Set(promotions.PROMOTIONS.map((promotion) => promotion.id)).size === promotions.PROMOTIONS.length,
  'Two promotions share an id.',
);
const eventDetailSource = read('src/app/event/[id].tsx');
const restaurantDetailSource = read('src/app/restaurant/[id].tsx');
const venueDetailSource = read('src/app/venue/[id].tsx');
const sharedDetailSource = read('src/components/detail.tsx');
assert(restaurantDetailSource.includes('<DetailFactList facts={planningFacts}'), 'Restaurant details are not using the shared minimal fact list.');
assert(restaurantDetailSource.includes('availableMenuCategories.map'), 'Restaurant details expose empty menu-category dead ends.');
assert(venueDetailSource.includes('<DetailFactList facts={venue.detailFacts}'), 'Venue details are not using the shared minimal fact list.');
assert(restaurantDetailSource.includes('compact') && venueDetailSource.includes('compact'), 'Restaurant and venue heroes are not using the compact detail language.');
assert(venueDetailSource.includes('<Photo uri={event.image}'), 'Venue event listings are missing compact thumbnails.');
assert(sharedDetailSource.includes('width: 96, height: 96'), 'Compact place details are missing the restricted horizontal identity thumbnail.');
assert(venueDetailSource.includes('width: 44, height: 44'), 'Venue event thumbnails are larger than the compact detail language allows.');
assert(!restaurantDetailSource.includes("label: 'Directions'") && !venueDetailSource.includes("label: 'Directions'"), 'Detail pages repeat directions outside the tappable location row.');
assert(eventDetailSource.includes('Object.keys(EVENTS).map'), 'Known event URLs are not pre-rendered for the expired-listing handoff.');
assert(eventDetailSource.includes('!ev || !isCurrentEvent(ev)'), 'Expired event detail URLs still render stale listings.');
assert(!read('src/app/plans.tsx').includes('Past plans'), 'Past listings remain visible in plans.');

const auditedTextFiles = [
  ...filesUnder('src').filter((file) => /\.(ts|tsx)$/.test(file)),
  path.join(root, 'README.md'),
  path.join(root, 'DATA_SOURCES.md'),
];
const combinedText = auditedTextFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
assert(!/marriott/i.test(combinedText), 'Marriott wording must not appear in app or release documentation.');
assert(!/coming soon/i.test(combinedText), 'A visible coming-soon dead end remains in the app or release documentation.');
assert(!/GUEST\.(hotel|hotelShort)/.test(combinedText), 'Legacy hotel identity fields remain in use.');

const authSource = read('src/lib/auth.ts');
const onboardingSource = read('src/components/onboarding.tsx');
assert(!onboardingSource.includes('YOUR OAKLAND GUIDE'), 'The removed auth location pill returned.');
assert(!onboardingSource.includes('Eat well. Catch what'), 'The removed auth tagline returned.');
assert(authSource.includes("provider: 'google'"), 'Google OAuth is not wired.');
assert(!authSource.includes("provider: 'apple'"), 'Apple OAuth should remain disabled for this release.');
assert(authSource.includes('exchangeCodeForSession'), 'PKCE callback exchange is missing.');
assert(read('src/app/_layout.tsx').includes('if (!session)'), 'The authenticated app wall is missing.');
assert(read('package.json').includes('verify-web-build.mjs'), 'The production auth-bundle verification is not part of build:web.');

const schema = read('supabase/migrations/20260929000000_wayvee_initial.sql');
const backendMigration = schema;
for (const table of ['profiles', 'user_preferences', 'user_plans', 'venue_follows', 'saved_places']) {
  assert(backendMigration.includes(`create table if not exists public.${table}`), `Backend migration is missing ${table}.`);
  assert(backendMigration.includes(`alter table public.${table} enable row level security`), `${table} is missing row-level security.`);
  assert(backendMigration.includes(`revoke all on public.${table} from anon`), `${table} does not explicitly deny anonymous access.`);
}
const authHardening = schema;
assert(authHardening.includes('left(') && authHardening.includes('80'), 'OAuth profile-name hardening is missing.');
assert(authHardening.includes('revoke all on function public.handle_new_user()'), 'The auth trigger function remains RPC-executable.');

if (errors.length) {
  console.error(`Wayvee release audit failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Wayvee release audit passed: ${restaurants.length} restaurants, ${venues.length} venues, ${currentEvents.length} current events, ${activeCollections.length} active collections.`);
