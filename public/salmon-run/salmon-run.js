// salmon-run.js — live USGS conditions + honest run-status read for the Michigan fall run.
// Data: USGS Instantaneous Values (00060 discharge, 00010 water temp). CORS-open, fetched client-side.
// Run status is an interpretation from calendar window + water temp + flow trend. It is guidance, not a guarantee.
const RIVERS = {"big-manistee-tippy-dam": {"gauge": "04125550", "hasTemp": true, "species": ["king", "coho", "steelhead"], "name": "Big Manistee River (Below Tippy Dam)"}, "pere-marquette": {"gauge": "04122500", "hasTemp": false, "species": ["king", "coho", "steelhead"], "name": "Pere Marquette River"}, "muskegon-croton-dam": {"gauge": "04121970", "hasTemp": true, "species": ["king", "coho", "steelhead"], "name": "Muskegon River (Below Croton Dam)"}, "little-manistee": {"gauge": "04126195", "hasTemp": true, "species": ["king", "coho", "steelhead"], "name": "Little Manistee River"}, "platte-river": {"gauge": "04126740", "hasTemp": false, "species": ["coho", "king"], "name": "Platte River"}, "white-river": {"gauge": "04122200", "hasTemp": false, "species": ["king", "steelhead"], "name": "White River"}, "au-sable-foote-dam": {"gauge": "04137500", "hasTemp": true, "species": ["steelhead", "king"], "name": "Au Sable River (Below Foote Dam)"}};

function doy(m,d){ return Math.floor((Date.UTC(2025,m-1,d)-Date.UTC(2025,0,0))/86400000); }
function today(){ const n=new Date(); return {m:n.getMonth()+1, d:n.getDate(), doy: doy(n.getMonth()+1,n.getDate())}; }
const A=(m,d)=>doy(m,d);

function kingStatus(day, t, trend){
  let b;
  if (day < A(8,20)) b={label:'Off-Season', color:'#9e9e9e', note:'Kings are still staging in the lake. The river run gets going around early September.'};
  else if (day < A(9,5)) b={label:'Staging', color:'#8e6f3e', note:'Kings are gathering near the river mouths. The first fish move on cool nights and rain.'};
  else if (day < A(9,22)) b={label:'Building', color:'#c77d2e', note:'The run is underway and building toward peak. Rain and cooling water pull fresh fish up.'};
  else if (day < A(10,12)) b={label:'Peak Run', color:'#2e7d32', note:'Prime time. Chinook are moving through in numbers.'};
  else if (day < A(10,31)) b={label:'Winding Down', color:'#7d6608', note:'Later, darker fish. The best of the king run is passing.'};
  else b={label:'Over', color:'#9e9e9e', note:'The chinook run has finished for the year.'};
  const active = (b.label==='Staging'||b.label==='Building'||b.label==='Peak Run');
  if (t!=null && active){
    if (t>66) b.note='Water is still warm at '+t+'F. Kings hold and stage; the run turns on as it drops toward the upper 50s.';
    else if (t<=62 && t>=48) b.note='Water is '+t+'F, right in the trigger zone.'+(trend==='rising'?' A rising river should pull fresh fish up.':' Good conditions for a push.');
  }
  if (trend==='rising' && (b.label==='Staging'||b.label==='Building')) b.note+=' Flow is rising, a classic cue for fresh fish.';
  return b;
}
function steelheadStatus(day, t){
  let b;
  if (day>=A(10,15) && day<A(12,1)) b={label:'Fall Run', color:'#2e7d32', note:'Fall steelhead are moving in with and after the salmon.'};
  else if (day>=A(12,1) || day<A(3,1)) b={label:'Winter Holdover', color:'#5c6bc0', note:'Winter fish hold in the deeper runs. Fishable, but tough in the cold.'};
  else if (day>=A(3,1) && day<A(5,1)) b={label:'Spring Run', color:'#2e7d32', note:'Prime spring steelhead, the heaviest and most active run of the year.'};
  else b={label:'Between Runs', color:'#9e9e9e', note:'Off-season for most rivers. A few summer-run fish are possible on select water.'};
  if (t!=null && t<34) b.note='Water is very cold at '+t+'F, which slows the fish. Go deep and slow.';
  return b;
}
function cohoStatus(day){
  if (day < A(9,15)) return {label:'Off-Season', color:'#9e9e9e', note:'Coho run late September into November. Not yet.'};
  if (day < A(11,15)) return {label:'Running', color:'#2e7d32', note:'Coho season. The peak is often early to mid October.'};
  return {label:'Over', color:'#9e9e9e', note:'The coho run has passed.'};
}
function boardStatus(species, t, trend){
  const T=today(), day=T.doy, m=T.m;
  if (species.includes('king') && (m>=8 && m<=10)) return kingStatus(day,t,trend);
  if (species.includes('steelhead') && (m>=11 || m<=4)) return steelheadStatus(day,t);
  if (species.includes('coho') && (m>=9 && m<=11)) return cohoStatus(day);
  if (species.includes('king')) return kingStatus(day,t,trend);
  if (species.includes('steelhead')) return steelheadStatus(day,t);
  return cohoStatus(day);
}

async function fetchGauge(gauge){
  const url='https://waterservices.usgs.gov/nwis/iv/?format=json&sites='+gauge+'&parameterCd=00060,00010&period=P7D&siteStatus=active';
  const r=await fetch(url); if(!r.ok) throw new Error('usgs');
  const d=await r.json(); let flow=null,tempC=null,series=[],flowObservedAt=null,tempObservedAt=null;
  for(const s of d.value.timeSeries){
    const code=s.variable.variableCode[0].value; const vals=s.values[0].value||[];
    if(code==='00060'){ series=vals.map(v=>parseFloat(v.value)).filter(x=>!isNaN(x)&&x>-100000);
      for(let i=vals.length-1;i>=0;i--){const x=parseFloat(vals[i].value); if(!isNaN(x)&&x>-100000){flow=x;flowObservedAt=vals[i].dateTime||null;break;}} }
    if(code==='00010'){ for(let i=vals.length-1;i>=0;i--){const x=parseFloat(vals[i].value); if(!isNaN(x)&&x>-100){tempC=x;tempObservedAt=vals[i].dateTime||null;break;}} }
  }
  let trend='steady';
  if(series.length>24){ const recent=series[series.length-1]; const base=series.slice(0,Math.floor(series.length/2)); const med=base.sort((a,b)=>a-b)[Math.floor(base.length/2)];
    if(med>0){ if(recent>med*1.15) trend='rising'; else if(recent<med*0.85) trend='falling'; } }
  const tempF = tempC!=null ? Math.round(tempC*9/5+32*10)/10 : null;
  return {flow, tempF: tempC!=null? Math.round((tempC*9/5+32)*10)/10 : null, trend, flowObservedAt, tempObservedAt};
}
function arrow(tr){ return tr==='rising'?'&#9650; rising':tr==='falling'?'&#9660; falling':'&#8212; steady'; }
function pill(s){ return '<span class="status-pill" style="background:'+s.color+'1a;color:'+s.color+'">'+s.label+'</span>'; }


/* A second, species-specific signal. Seasonal calendar is not a fish count.
   Temperature guidance follows the steelhead page's 40s-50s fall window. */
function steelheadSignal(day, tempF, trend){
  const fall=day>=A(10,1)&&day<A(12,1);
  const winter=day>=A(12,1)||day<A(3,1);
  const spring=day>=A(3,1)&&day<A(5,1);
  if(!fall&&!winter&&!spring) return {label:'Between runs',color:'#777',note:'Outside the usual fall, winter and spring steelhead windows.',score:-1};
  let signal=fall
    ? {label:day<A(10,15)?'Arriving now':'Fall run',color:'#2e7d32',note:'Fall steelhead arrival window (not a verified fish count).',score:0}
    : winter
      ? {label:'Winter hold',color:'#5068ad',note:'Winter steelhead may hold in deeper, slower river runs.',score:0}
      : {label:'Spring run',color:'#2e7d32',note:'Spring steelhead migration window.',score:0};
  if(tempF==null){
    signal.note+=' No USGS temperature reading here; temperature readiness is unknown.';
    signal.score=-1;
    return signal;
  }
  const low=spring?38:40, high=spring?52:55;
  if(tempF>=low&&tempF<=high){
    signal.note+=' Water at '+tempF+'°F is in the '+low+'–'+high+'°F steelhead temperature window.';
    signal.score=10-Math.abs(tempF-(low+high)/2)*0.1;
  }else if(tempF>60){
    signal.label='Water too warm'; signal.color='#95611c'; signal.score=1;
    signal.note='Water at '+tempF+'°F remains warmer than the usual steelhead trigger range.';
  }else if(tempF>high){
    signal.label='Cooling toward run'; signal.color='#987020'; signal.score=4;
    signal.note='Water at '+tempF+'°F is approaching the steelhead trigger range.';
  }else{
    signal.label='Cold, slower fish'; signal.color='#5068ad'; signal.score=3;
    signal.note='Water at '+tempF+'°F is below the active temperature window; fish can be present but less active.';
  }
  if(trend==='rising'){signal.note+=' USGS flow is rising.'; signal.score+=0.3;}
  return signal;
}
function speciesPills(salmon,steelhead,tracked){
  return '<div class="run-statuses"><div class="run-status-group"><span class="run-type">Salmon</span>'+pill(salmon)+'</div>'+
    '<div class="run-status-group"><span class="run-type">Steelhead</span>'+
    (tracked?pill(steelhead):'<span class="status-pill status-not-tracked">Not tracked</span>')+'</div></div>';
}

async function renderBoard(){
  const tb=document.getElementById('runboard-body'); if(!tb) return;
  const slugs=Object.keys(RIVERS).filter(slug=>document.getElementById('row-'+slug));
  const stamp=document.getElementById('board-stamp');
  const summaries=await Promise.all(slugs.map(async slug=>{
    const R=RIVERS[slug], row=document.getElementById('row-'+slug);
    try{
      const c=await fetchGauge(R.gauge), st=boardStatus(R.species,c.tempF,c.trend);
      const steelhead=R.species.includes('steelhead')?steelheadSignal(today().doy,c.tempF,c.trend):null;
      row.querySelector('.c-status').innerHTML=speciesPills(st,steelhead,!!steelhead);
      row.querySelector('.c-flow').innerHTML=(c.flow!=null? Math.round(c.flow).toLocaleString()+' <span class="trend">cfs</span>':'&#8212;')+(c.flow!=null?'<div class="trend">'+arrow(c.trend)+'</div>':'');
      row.querySelector('.c-temp').innerHTML=(c.tempF!=null? c.tempF+'&deg;F':'<span class="trend">no sensor</span>');
      row.querySelector('.c-note').textContent=st.note;
      if(steelhead)row.querySelector('.c-status').title=steelhead.note;
      return {slug,name:R.name,tempF:c.tempF,trend:c.trend,steelhead};
    }catch(e){
      row.querySelector('.c-status').innerHTML='<span class="trend">USGS data unavailable</span>';
      row.querySelector('.c-flow').innerHTML='&#8212;'; row.querySelector('.c-temp').innerHTML='&#8212;';
      return null;
    }
  }));
  const picks=document.getElementById('steelhead-picks');
  if(picks){
    const spring=today().doy>=A(3,1)&&today().doy<A(5,1);
    const low=spring?38:40, high=spring?52:55;
    const observed=summaries.filter(x=>x&&x.steelhead&&x.steelhead.score>=0&&x.tempF!=null);
    const favorable=observed.filter(x=>x.tempF>=low&&x.tempF<=high)
      .sort((a,b)=>b.steelhead.score-a.steelhead.score).slice(0,3);
    const cooling=observed.filter(x=>x.tempF>high&&x.tempF<=60)
      .sort((a,b)=>a.tempF-b.tempF).slice(0,3);
    const chosen=favorable.length?favorable:cooling;
    const links=chosen.map(x=>'<a href="/salmon-run/rivers/'+x.slug+'.html">'+x.name.split(' (')[0]+'</a> ('+x.tempF+'°F, '+x.trend+' flow)').join(' · ');
    picks.innerHTML=favorable.length
      ? '<strong>Rivers in the '+low+'–'+high+'°F steelhead temperature window:</strong> '+links+
        '<div class="trend">Temperature/flow indicators only; not confirmed fish counts. Rivers without a temperature sensor are not ranked.</div>'
      : cooling.length
        ? '<strong>No monitored river is in the '+low+'–'+high+'°F steelhead temperature window yet.</strong> Closest cooling readings: '+links+
          '<div class="trend">These rivers are still warmer than the target range; this is a watchlist, not a fishing hot-spot claim. Rivers without temperature sensors are unranked.</div>'
        : '<strong>No monitored river currently matches the '+low+'–'+high+'°F steelhead temperature window.</strong> See USGS readings and individual rivers below. Missing temperature sensors are not assumed to be favorable.';
  }
  if(stamp) stamp.textContent='Live USGS readings as of '+new Date().toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}

async function renderRiver(slug){
  const el=document.getElementById('widgetContent'); if(!el) return; const R=RIVERS[slug];
  try{
    const c=await fetchGauge(R.gauge); const st=boardStatus(R.species,c.tempF,c.trend);
    el.innerHTML=
      '<div class="widget-rating"><span class="status-pill" style="background:'+st.color+'1a;color:'+st.color+';font-size:14px;padding:5px 13px">'+st.label+'</span></div>'+
      '<p style="font-size:14px;color:#444;margin:10px 0 14px">'+st.note+'</p>'+
      '<div class="widget-stats">'+
        '<div class="widget-stat"><div class="widget-stat-label">Flow</div><div class="widget-stat-value num">'+(c.flow!=null?Math.round(c.flow).toLocaleString()+' cfs':'&#8212;')+'</div><div class="widget-stat-sub">'+arrow(c.trend)+'</div></div>'+
        '<div class="widget-stat"><div class="widget-stat-label">Water Temp</div><div class="widget-stat-value num">'+(c.tempF!=null?c.tempF+'&deg;F':'&#8212;')+'</div><div class="widget-stat-sub">'+(c.tempF!=null?'':'no USGS sensor')+'</div></div>'+
        '<div class="widget-stat"><div class="widget-stat-label">7-Day Trend</div><div class="widget-stat-value" style="font-size:13px">'+arrow(c.trend)+'</div></div>'+
      '</div>'+
      '<div class="widget-actions"><a class="widget-btn widget-btn-primary" href="https://waterdata.usgs.gov/monitoring-location/'+R.gauge+'/" target="_blank" rel="noopener">USGS gauge '+R.gauge+'</a></div>'+
      '<div class="trend" style="margin-top:8px">Updated '+new Date().toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'. Run status is our read from date, water temp, and flow trend.</div>';
  }catch(e){ el.innerHTML='<span style="color:#bbb;font-size:13px">Live data unavailable right now. <a href="https://waterdata.usgs.gov/monitoring-location/'+R.gauge+'/" target="_blank" rel="noopener" style="color:#4a7c4a">Check USGS directly</a>.</span>'; }
}


// Dedicated March–April conditions tracker, not a fish count. All river values
// and flow trends come from the same fetchGauge() used across salmon-run pages.
function springActive(day){return day>=A(3,1)&&day<A(5,1);}
function springFresh(timestamp){
  if(!timestamp)return false;
  const delta=Date.now()-Date.parse(timestamp);
  return Number.isFinite(delta)&&delta>=-3600000&&delta<=86400000;
}
function springTime(timestamp){
  const t=Date.parse(timestamp||'');
  return Number.isFinite(t)?new Date(t).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'time unknown';
}
function springVerdict(day,temp,trend,tempFresh,flowFresh){
  if(!springActive(day))return {label:'Off season',tone:'neutral',score:null,note:'Spring migration typically takes place March–April. Water readings alone cannot establish an active spring steelhead run outside that window.'};
  if(temp==null)return {label:'No temperature sensor',tone:'neutral',score:null,note:'This gauge provides flow information but no usable water temperature. Temperature readiness is unknown.'};
  if(!tempFresh)return {label:'Temperature outdated',tone:'neutral',score:null,note:'The latest temperature observation is older than 24 hours or undated. It cannot be used to rank spring readiness.'};
  const flowNote=!flowFresh?'Flow observation is outdated or undated.':trend==='rising'?'Seven-day discharge is rising; that can be a movement cue, not proof of fish.':trend==='falling'?'Seven-day discharge is falling; verify access and fishability.':'Seven-day discharge is relatively steady.';
  if(temp>=38&&temp<=52)return {label:'In spring temp window',tone:'ready',score:100-Math.abs(temp-45)*2+(flowFresh&&trend==='rising'?3:0),note:'Water is '+temp+'°F, within the 38–52°F spring steelhead temperature band. '+flowNote};
  if(temp<38)return {label:'Cold, watch warming',tone:'cold',score:null,note:'Water is '+temp+'°F, below the 38–52°F spring band. Fish may be present, but colder water can slow movement. '+flowNote};
  return {label:'Warmer than window',tone:'warm',score:null,note:'Water is '+temp+'°F, above the spring trigger band. Fish may still be present; this cannot establish fish counts. '+flowNote};
}
async function renderSpringBoard(){
  const board=document.getElementById('spring-rivers');
  if(!board)return;
  const day=today().doy,active=springActive(day);
  const now=new Date(),springYear=now.getMonth()>=4?now.getFullYear()+1:now.getFullYear();
  const status=document.getElementById('spring-season');
  status.innerHTML=active?
    '<strong>Spring migration window</strong><span>March–April: watch temperature and seven-day flow changes. No verified fish counts.</span>':
    '<strong>Off season · spring '+springYear+' ahead</strong><span>The next typical migration window is March–April. Conditions are visible below, but no active spring-run claim is being made.</span>';
  const button=document.getElementById('spring-refresh');
  button.disabled=true;board.setAttribute('aria-busy','true');
  document.getElementById('spring-stamp').textContent='Checking USGS gauges…';
  const slugs=Object.keys(RIVERS).filter(slug=>RIVERS[slug].species.includes('steelhead')&&document.getElementById('spring-'+slug));
  const results=await Promise.all(slugs.map(async slug=>{
    const el=document.getElementById('spring-'+slug),river=RIVERS[slug];
    try{
      const c=await fetchGauge(river.gauge);
      const tf=springFresh(c.tempObservedAt),ff=springFresh(c.flowObservedAt);
      const v=springVerdict(day,c.tempF,c.trend,tf,ff);
      const statusEl=el.querySelector('.spring-status');
      statusEl.textContent=v.label;statusEl.className='spring-status spring-'+v.tone;
      el.querySelector('.spring-temp').textContent=c.tempF==null?'No sensor':c.tempF+'°F';
      el.querySelector('.spring-flow').textContent=c.flow==null?'Unavailable':Math.round(c.flow).toLocaleString('en-US')+' cfs';
      el.querySelector('.spring-trend').textContent=c.flow==null?'No data':c.trend==='rising'?'▲ rising':c.trend==='falling'?'▼ falling':'— steady';
      el.querySelector('.spring-note').textContent=v.note;
      el.querySelector('.spring-measured').textContent='Temp: '+(c.tempF==null?'no sensor':springTime(c.tempObservedAt)+(tf?'':' (old/undated)'))+' · Flow: '+(c.flow==null?'unavailable':springTime(c.flowObservedAt)+(ff?'':' (old/undated)'));
      return {slug,name:river.name,score:v.score,temp:c.tempF,tempFresh:tf,flowFresh:ff,trend:c.trend};
    }catch(e){
      el.querySelector('.spring-status').textContent='USGS unavailable';
      el.querySelector('.spring-status').className='spring-status spring-neutral';
      el.querySelector('.spring-temp').textContent='Unavailable';
      el.querySelector('.spring-flow').textContent='Unavailable';
      el.querySelector('.spring-trend').textContent='No data';
      el.querySelector('.spring-note').textContent='This station failed to return usable USGS conditions; follow the official gauge link or refresh.';
      el.querySelector('.spring-measured').textContent='No observation returned';
      return null;
    }
  }));
  const found=results.filter(Boolean),good=found.filter(x=>x.score!=null).sort((a,b)=>b.score-a.score);
  const missed=found.filter(x=>x.temp==null||!x.tempFresh).length;
  const unavailable=results.length-found.length;
  const summary=document.getElementById('spring-summary');
  if(!active)summary.innerHTML='<strong>Spring run: off season.</strong> Six river gauges are displayed for planning. We do not interpret fall or winter readings as evidence of spring migration.';
  else if(good.length)summary.innerHTML='<strong>'+good.length+' river'+(good.length===1?' matches':'s match')+' the 38–52°F spring temperature window.</strong> '+
      good.map(x=>'<a href="/salmon-run/rivers/'+x.slug+'.html">'+x.name.split(' (')[0]+'</a> ('+x.temp+'°F, '+(x.flowFresh?x.trend+' flow':'unverified flow age')+')').join(' · ')+
      '<small>Ranked by proximity to 45°F, with rising seven-day flow as a secondary signal. These are not fish sightings or verified catches.</small>';
  else summary.innerHTML='<strong>No recent measured temperature is currently in the 38–52°F spring window.</strong> Some waters may be colder or warmer, while others lack fresh temperature data. No river is declared “hot.”';
  if(missed||unavailable)summary.innerHTML+='<small>'+missed+' station'+(missed===1?' has':'s have')+' missing or outdated temperatures'+(unavailable?', '+unavailable+' request'+(unavailable===1?' failed':'s failed'):'')+'. These are excluded from readiness rankings.</small>';
  document.getElementById('spring-stamp').textContent='USGS checked '+new Date().toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'. Actual gauge observation times are shown on each river.';
  button.disabled=false;board.setAttribute('aria-busy','false');
}
