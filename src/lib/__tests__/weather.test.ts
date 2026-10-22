jest.mock('@/lib/supabase',()=>({supabase:{from:jest.fn()}}));
jest.mock('@/lib/storage',()=>({getStoredItem:jest.fn().mockResolvedValue(null),setStoredItem:jest.fn().mockResolvedValue(undefined)}));
jest.mock('@/lib/city',()=>({activeCity:jest.fn(()=>'oakland'),useActiveCity:jest.fn(()=>'oakland'),cityCacheKey:(base:string,city:string)=>base+'|'+city}));

let weather:typeof import('@/lib/weather');
let read:jest.Mock;
let city:jest.Mock;
const hour=(start:string,temperature=67)=>({
  starts_at:start,ends_at:new Date(Date.parse(start)+3600000).toISOString(),
  temperature_f:temperature,short_forecast:'Partly Cloudy',precip_probability:10,wind_label:null,is_daytime:true,
});
beforeEach(()=>{
  jest.resetModules();jest.useFakeTimers();jest.setSystemTime(new Date('2026-10-22T00:59:00Z'));
  const db=jest.requireMock('@/lib/supabase'),cities=jest.requireMock('@/lib/city');
  city=cities.activeCity as jest.Mock;
  read=jest.fn().mockResolvedValue({data:[hour('2026-10-22T00:00:00Z')],error:null});
  const query={select:jest.fn(),eq:jest.fn(),gte:jest.fn(),order:jest.fn(),limit:read};
  for(const key of ['select','eq','gte','order'] as const)query[key].mockReturnValue(query);
  (db.supabase!.from as jest.Mock).mockReturnValue(query);
  weather=jest.requireActual('@/lib/weather');
});
afterEach(()=>jest.useRealTimers());

it('renders current sourced weather and shares concurrent launch requests',async()=>{
  await Promise.all([weather.hydrateWeatherFromBackend(),weather.hydrateWeatherFromBackend()]);
  expect(read).toHaveBeenCalledTimes(1);
  expect(weather.weatherLine(weather.weatherAt()!)).toBe('67° · Partly Cloudy');
  await weather.hydrateWeatherFromBackend();expect(read).toHaveBeenCalledTimes(1);
});
it('fetches the next period after a short resume across the hour boundary',async()=>{
  await weather.hydrateWeatherFromBackend();
  jest.setSystemTime(new Date('2026-10-22T01:01:00Z'));
  expect(weather.weatherAt()).toBeNull();
  read.mockResolvedValue({data:[hour('2026-10-22T01:00:00Z',65)],error:null});
  await weather.hydrateWeatherFromBackend();
  expect(read).toHaveBeenCalledTimes(2);expect(weather.weatherAt()?.temperatureF).toBe(65);
});
it('refreshes a still-valid forecast after fifteen minutes and hides expired weather on failure',async()=>{
  jest.setSystemTime(new Date('2026-10-22T00:00:00Z'));
  await weather.hydrateWeatherFromBackend();
  jest.setSystemTime(new Date('2026-10-22T00:15:00Z'));
  read.mockResolvedValue({data:[hour('2026-10-22T00:00:00Z',64)],error:null});
  await weather.hydrateWeatherFromBackend();expect(weather.weatherAt()?.temperatureF).toBe(64);
  jest.setSystemTime(new Date('2026-10-23T01:15:00Z'));
  read.mockResolvedValue({data:null,error:{message:'offline'}});
  await weather.hydrateWeatherFromBackend();expect(weather.weatherAt()).toBeNull();
});
it('does not publish a late response for a city the guest already left',async()=>{
  let finish!:(value:unknown)=>void;
  read.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const request=weather.hydrateWeatherFromBackend();city.mockReturnValue('san-francisco');
  finish({data:[hour('2026-10-22T00:00:00Z')],error:null});
  expect(await request).toBe(false);expect(weather.weatherAt()).toBeNull();
});
