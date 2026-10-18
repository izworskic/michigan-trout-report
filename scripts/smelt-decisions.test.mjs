import test from "node:test";
import assert from "node:assert/strict";
import {forecastNights,mphFromForecast,parseUsgsWater,assessSmelt} from "../lib/smelt-decisions.js";
test("NWS wind range uses highest stated wind, not misleading low endpoint",()=>{
 assert.equal(mphFromForecast("10 to 25 mph"),25);
 assert.equal(mphFromForecast("5 to 15 mph"),15);
 assert.equal(mphFromForecast("Calm"),0);
 assert.equal(mphFromForecast("8 to 12 knots"),14);
 assert.equal(mphFromForecast(null),null);
});
test("NWS unknown precipitation stays unknown, and high wind is graded poor",()=>{
 const periods=[21,22,23,0,1,2].map((h,i)=>({
  startTime:"2026-04-"+(i<3?"20":"21")+"T"+String(h).padStart(2,"0")+":00:00-04:00",
  temperature:48,temperatureUnit:"F",windSpeed:"10 to 25 mph",
  probabilityOfPrecipitation:{value:null},shortForecast:"Cloudy"
 }));
 const f=forecastNights(periods);
 assert.equal(f.length,1);
 assert.equal(f[0].precipChance,null);
 assert.equal(f[0].maxWindMph,25);
 assert.equal(f[0].weatherGrade,"Poor");
 assert.equal(f[0].date,"2026-04-20");
});
test("NWS missing winds never grade favorable",()=>{
 const periods=[21,22,23].map(h=>({startTime:"2026-04-20T"+h+":00:00-04:00",temperature:44,temperatureUnit:"F",windSpeed:"Variable",probabilityOfPrecipitation:{value:35}}));
 const f=forecastNights(periods);
 assert.equal(f[0].nightScore,null);
 assert.equal(f[0].weatherGrade,"Incomplete");
 assert.equal(f[0].precipChance,35);
});
test("USGS parser verifies station, units and timestamps before assigning stream temperature",()=>{
 const now=Date.parse("2026-04-20T23:00:00Z");
 const reading=(value,opts={})=>({type:"Feature",properties:{monitoring_location_id:"USGS-04043097",parameter_code:"00010",time:"2026-04-20T22:45:00Z",unit_of_measure:"degC",value,...opts}});
 const d=parseUsgsWater({features:[reading("8.5"),reading("90",{unit_of_measure:"degF"}),reading("15",{monitoring_location_id:"USGS-99999999"})]},"04043097",now);
 assert.equal(d.waterF,47.3);
 assert.equal(d.station,"04043097");
 assert.equal(d.stale,false);
 assert.equal(d.provisional,true);
 assert.equal(parseUsgsWater({features:[reading("12",{unit_of_measure:"degF"})]},"04043097",now),null);
});
test("USGS missing, future, and stale observations cannot become confident signals",()=>{
 const now=Date.parse("2026-04-20T23:00:00Z");
 const reading={properties:{monitoring_location_id:"USGS-04043097",parameter_code:"00010",unit_of_measure:"degC",value:"9",time:"2026-04-19T00:00:00Z"}};
 assert.equal(parseUsgsWater({features:[reading]},"04043097",now).stale,true);
 assert.equal(parseUsgsWater({features:[{properties:{...reading.properties,time:"2026-04-23T00:00:00Z"}}]},"04043097",now),null);
 assert.equal(parseUsgsWater({features:[]},"04043097",now),null);
});
const goodNight={date:"2026-04-20",nightScore:3,weatherGrade:"Favorable"};
const water={waterF:45,stale:false};
const params={season:true,forecast:[goodNight],water,buoy:null,alerts:[],alertState:"checked",ice:{status:"stale"}};
test("Safety warnings outrank otherwise ideal spawning temperatures",()=>{
 assert.equal(assessSmelt({...params,alerts:[{event:"Flood Warning"}]}).status,"Hazard watch");
 assert.equal(assessSmelt({...params,alertState:"unavailable"}).status,"Safety data unavailable");
 assert.equal(assessSmelt({...params,ice:{status:"current",category:"heavy",band:"9/10 ice"}}).status,"Ice watch");
});
test("No ideal-weather claim when temperature agrees but forecast is poor",()=>{
 const v=assessSmelt({...params,forecast:[{...goodNight,weatherGrade:"Poor",nightScore:0}]});
 assert.equal(v.status,"Weather caution");
 assert.equal(v.bestNight,null);
});
test("Promising is limited to measured local stream and usable forecast, never only lake buoy",()=>{
 assert.equal(assessSmelt(params).status,"Conditions promising");
 assert.equal(assessSmelt({...params,water:null,buoy:{tempF:44,stale:false}}).status,"Lake warming watch");
 assert.equal(assessSmelt({...params,season:false}).status,"Off season");
 assert.equal(assessSmelt({...params,forecast:[]}).status,"Data unavailable");
});
