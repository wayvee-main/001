import * as Location from 'expo-location';

import { getStoredItem, setStoredItem } from '@/lib/storage';

const LOCATION_KEY = 'wayvee.location.v1';

const US_STATE_ABBREVIATIONS: Readonly<Record<string, string>> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO',
  Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID',
  Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA',
  Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR',
  Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
  Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA',
  'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'District of Columbia': 'DC',
  'Puerto Rico': 'PR',
};

export type WayveeLocationStatus = 'unknown' | 'granted' | 'denied' | 'skipped';

export interface WayveeDeviceLocation {
  latitude: number;
  longitude: number;
  label?: string;
  updatedAt: number;
}

export function cityStateDisplayLabel(
  location: Pick<WayveeDeviceLocation, 'label'> | null | undefined,
  fallbackCity = 'Oakland',
  fallbackState = 'CA',
): string {
  const label = location?.label?.trim();
  if (label && !/\bcounty\b/i.test(label) && /,\s*[A-Z]{2}$/.test(label)) return label;
  return `${fallbackCity}, ${fallbackState}`;
}

export interface WayveeLocationPreference {
  status: WayveeLocationStatus;
  canAskAgain: boolean;
  deviceLocation: WayveeDeviceLocation | null;
}

const DEFAULT_PREFERENCE: WayveeLocationPreference = {
  status: 'unknown',
  canAskAgain: true,
  deviceLocation: null,
};

async function savePreference(preference: WayveeLocationPreference) {
  await setStoredItem(LOCATION_KEY, JSON.stringify(preference));
  return preference;
}

async function storedPreference(): Promise<WayveeLocationPreference> {
  const raw = await getStoredItem(LOCATION_KEY);
  if (!raw) return DEFAULT_PREFERENCE;
  try {
    return { ...DEFAULT_PREFERENCE, ...(JSON.parse(raw) as WayveeLocationPreference) };
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

async function locationLabel(latitude: number, longitude: number): Promise<string | undefined> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const locality = [place?.city, place?.district, place?.subregion]
      .find((value) => value && !/\bcounty\b/i.test(value));
    const region = place?.region?.trim();
    const state = region && (/^[A-Z]{2}$/.test(region) ? region : US_STATE_ABBREVIATIONS[region]);
    return locality && state ? `${locality}, ${state}` : undefined;
  } catch {
    return undefined;
  }
}

async function normalizedLocation(position: Location.LocationObject): Promise<WayveeDeviceLocation> {
  const { latitude, longitude } = position.coords;
  return {
    latitude,
    longitude,
    label: await locationLabel(latitude, longitude),
    updatedAt: Date.now(),
  };
}

export async function restoreLocationPreference(): Promise<WayveeLocationPreference> {
  const stored = await storedPreference();
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      if (stored.status === 'granted') {
        return savePreference({ status: 'denied', canAskAgain: permission.canAskAgain, deviceLocation: null });
      }
      if (permission.status === Location.PermissionStatus.DENIED && !permission.canAskAgain && stored.status === 'unknown') {
        return savePreference({ status: 'denied', canAskAgain: false, deviceLocation: null });
      }
      return { ...stored, canAskAgain: permission.canAskAgain };
    }

    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000 });
    const deviceLocation = lastKnown ? await normalizedLocation(lastKnown) : stored.deviceLocation;
    return savePreference({ status: 'granted', canAskAgain: permission.canAskAgain, deviceLocation });
  } catch {
    return stored;
  }
}

export async function requestWayveeLocation(): Promise<WayveeLocationPreference> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return savePreference({ status: 'denied', canAskAgain: permission.canAskAgain, deviceLocation: null });
  }

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return savePreference({
    status: 'granted',
    canAskAgain: permission.canAskAgain,
    deviceLocation: await normalizedLocation(position),
  });
}

/** Re-reads the device position for an already-granted guest — distance sorting
 * is only "right now" if the fix is. Returns null when permission isn't granted
 * (nothing to refresh) so callers can leave the stored preference untouched. */
export async function refreshWayveeLocation(): Promise<WayveeLocationPreference | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) return null;
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return savePreference({
    status: 'granted',
    canAskAgain: permission.canAskAgain,
    deviceLocation: await normalizedLocation(position),
  });
}

export function skipWayveeLocation(): Promise<WayveeLocationPreference> {
  return savePreference({ status: 'skipped', canAskAgain: true, deviceLocation: null });
}
