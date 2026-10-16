// Species-specific mayfly signals for the Au Sable watershed.
// Model v1: explainable field-guide heuristics, NOT measured insect emergence.
// Never call this a calibrated hatch probability.
export const REACHES = Object.freeze([
  { id: 'north-branch', name: 'North Branch · Kellogg’s Bridge', branch: 'North Branch', station: '04135800', lat: 44.7166645, lon: -84.4196263, dataScope: 'At Kellogg’s Bridge; not a reading for every North Branch reach.' },
  { id: 'south-branch', name: 'South Branch · near Luzerne', branch: 'South Branch', station: '04135700', lat: 44.6147385, lon: -84.4555750, dataScope: 'At the South Branch gauge near Luzerne; upstream conditions can differ.' },
  { id: 'red-oak', name: 'Mainstream · Red Oak', branch: 'Mainstream', station: '04136000', lat: 44.6769593, lon: -84.2925146, dataScope: 'Below branch confluences. NOT a live Holy Waters / Grayling gauge.' },
  { id: 'mio', name: 'Mainstream · Mio', branch: 'Mainstream', station: '04136500', lat: 44.6600138, lon: -84.1311167, dataScope: 'Mio gauge conditions only. A dam-influenced reach: do not extrapolate upstream.' },
  { id: 'mckinley', name: 'Mainstream · McKinley', branch: 'Mainstream', station: '04136900', lat: 44.6127754, lon: -83.8376616, dataScope: 'Lower Au Sable near McKinley; dam-influenced water.' }
]);
// Temperatures are broad field-guide associations in Fahrenheit, not lab-derived
// emergence thresholds. Mayflies within a named angling group can be multiple taxa.
export const MAYFLIES = Object.freeze([
  { id:'bwo', name:'Blue-Winged Olive', latin:'Baetis and related genera', sizes:'#16–22', months:[[3,1,5,31],[9,1,11,15]], water:[42,56], time:'Cloudy afternoons', fly:'BWO emerger / parachute', note:'Small olives may emerge on cool or overcast days.' },
  { id:'hendrickson', name:'Hendrickson', latin:'Ephemerella subvaria', sizes:'#12–14', months:[[4,15,5,25]], water:[48,58], time:'Afternoons', fly:'Hendrickson dry / Red Quill', note:'A classic warming-water spring hatch.' },
  { id:'march-brown', name:'March Brown / Gray Fox', latin:'Maccaffertium species', sizes:'#10–14', months:[[5,1,6,25]], water:[52,62], time:'Afternoons to evening', fly:'March Brown / Gray Fox', note:'Emergence can be sporadic; watch riffles and spinner flights.' },
  { id:'gray-drake', name:'Gray Drake', latin:'Siphlonurus species', sizes:'#10–12', months:[[5,15,7,10]], water:[54,68], time:'Dusk spinner flights', fly:'Gray Drake spinner', note:'Spinner activity is not the same as a daytime emergence.' },
  { id:'brown-drake', name:'Brown Drake', latin:'Ephemera simulans', sizes:'#8–12', months:[[5,20,7,10]], water:[56,68], time:'Dusk / evening', fly:'Brown Drake dun / spinner', note:'Often earlier on warmer reaches; timing varies by year.' },
  { id:'sulphur', name:'Sulphur', latin:'Ephemerella and related genera', sizes:'#14–18', months:[[5,15,7,20]], water:[54,68], time:'Evenings', fly:'Sulphur comparadun / emerger', note:'Carry pale-yellow emergers and rusty spinners.' },
  { id:'hex', name:'Hexagenia (Hex)', latin:'Hexagenia limbata', sizes:'#4–8', months:[[6,10,7,25]], water:[60,72], time:'After dark', fly:'Extended-body Hex / Hex nymph', note:'This signal is not proof that Hex are emerging tonight.' },
  { id:'isonychia', name:'Isonychia / Slate Drake', latin:'Isonychia species', sizes:'#10–14', months:[[6,1,9,20]], water:[56,70], time:'Afternoons / evenings', fly:'Isonychia nymph / dun', note:'Sporadic hatches can continue much of summer.' },
  { id:'trico', name:'Trico', latin:'Tricorythodes species', sizes:'#20–24', months:[[7,1,9,20]], water:[58,72], time:'Early-morning spinner falls', fly:'Trico spinner', note:'Focus on morning spinner falls, not just the dun hatch.' },
  { id:'white-fly', name:'White Mayfly', latin:'Ephoron leukon', sizes:'#12–16', months:[[8,1,9,30]], water:[60,72], time:'Dusk / nighttime', fly:'White mayfly / White Wulff', note:'Late-summer emergence in suitable reaches.' }
]);

export function detroitCalendar(date = new Date()) {
  const bits = new Intl.DateTimeFormat('en-US', {timeZone:'America/Detroit',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(date);
  const o=Object.fromEntries(bits.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
  return {year:o.year, month:o.month, day:o.day};
}
export function inSeason(s, month, day) {
  const v=month*100+day;
  return s.months.some(w=>v>=w[0]*100+w[1] && v<=w[2]*100+w[3]);
}
export function rankMayfly(s, {month,day,waterTempF=null,windMph=null,cloudy=false}={}) {
  if (!inSeason(s,month,day)) return {signal:'Off season',order:0,reason:'Outside the usual regional hatch window.'};
  if (!Number.isFinite(waterTempF)) return {signal:'Temperature unavailable',order:1,reason:'Seasonally possible, but no fresh measured water temperature to evaluate.'};
  if (waterTempF>=68) return {signal:'Trout heat caution',order:1,reason:'Measured water temperature is at or above 68°F. Avoid recommending catch-and-release trout fishing.'};
  const [low,high]=s.water;
  const within=waterTempF>=low&&waterTempF<=high;
  const near=waterTempF>=low-4&&waterTempF<=high+4;
  if (!near) return {signal:'Temperature outside typical range',order:2,reason:'Seasonally possible, but water is outside this field-guide temperature association.'};
  const calm=windMph===null||windMph<=12;
  const prime=within&&calm;
  const bonus=cloudy&&s.id==='bwo';
  return prime
    ? {signal:'Conditions favorable',order:bonus?5:4,reason:'Season, water temperature and wind favor activity. Insects are not directly observed.'}
    : {signal:'Building / variable',order:3,reason:within?'Water temperature fits, but wind may reduce surface or spinner activity.':'Water temperature is close to the typical association.'};
}
export function buildMayflyReport({reach,now=new Date(),waterTempF=null,flowCfs=null,observedAt=null,windMph=null,cloudy=false,weatherText=null,temperatureSource='unavailable'}={}) {
  const {month,day}=detroitCalendar(now);
  const species=MAYFLIES.map(s=>({...s,...rankMayfly(s,{month,day,waterTempF,windMph,cloudy})}))
      .sort((a,b)=>b.order-a.order||a.name.localeCompare(b.name));
  return {
    reach, generatedAt:now.toISOString(), month, day, species, waterTempF, flowCfs,
    observedAt, temperatureSource, windMph, weatherText,
    troutHeatCaution:Number.isFinite(waterTempF)&&waterTempF>=68,
    disclaimer:'Condition-based, uncalibrated field-guide estimate — not a reported or verified hatch. Water readings are taken at the named gauge, not across an entire river reach.',
  };
}
