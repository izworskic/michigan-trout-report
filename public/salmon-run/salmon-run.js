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
  const d=await r.json(); let flow=null,tempC=null,series=[];
  for(const s of d.value.timeSeries){
    const code=s.variable.variableCode[0].value; const vals=s.values[0].value||[];
    if(code==='00060'){ series=vals.map(v=>parseFloat(v.value)).filter(x=>!isNaN(x)&&x>-100000);
      for(let i=vals.length-1;i>=0;i--){const x=parseFloat(vals[i].value); if(!isNaN(x)&&x>-100000){flow=x;break;}} }
    if(code==='00010'){ for(let i=vals.length-1;i>=0;i--){const x=parseFloat(vals[i].value); if(!isNaN(x)&&x>-100){tempC=x;break;}} }
  }
  let trend='steady';
  if(series.length>24){ const recent=series[series.length-1]; const base=series.slice(0,Math.floor(series.length/2)); const med=base.sort((a,b)=>a-b)[Math.floor(base.length/2)];
    if(med>0){ if(recent>med*1.15) trend='rising'; else if(recent<med*0.85) trend='falling'; } }
  const tempF = tempC!=null ? Math.round(tempC*9/5+32*10)/10 : null;
  return {flow, tempF: tempC!=null? Math.round((tempC*9/5+32)*10)/10 : null, trend};
}
function arrow(tr){ return tr==='rising'?'&#9650; rising':tr==='falling'?'&#9660; falling':'&#8212; steady'; }
function pill(s){ return '<span class="status-pill" style="background:'+s.color+'1a;color:'+s.color+'">'+s.label+'</span>'; }

async function renderBoard(){
  const tb=document.getElementById('runboard-body'); if(!tb) return;
  const slugs=Object.keys(RIVERS);
  const stamp=document.getElementById('board-stamp');
  await Promise.all(slugs.map(async slug=>{
    const R=RIVERS[slug]; const row=document.getElementById('row-'+slug);
    try{
      const c=await fetchGauge(R.gauge); const st=boardStatus(R.species,c.tempF,c.trend);
      row.querySelector('.c-status').innerHTML=pill(st);
      row.querySelector('.c-flow').innerHTML=(c.flow!=null? Math.round(c.flow).toLocaleString()+' <span class="trend">cfs</span>':'&#8212;')+(c.flow!=null?'<div class="trend">'+arrow(c.trend)+'</div>':'');
      row.querySelector('.c-temp').innerHTML=(c.tempF!=null? c.tempF+'&deg;F':'<span class="trend">no sensor</span>');
      row.querySelector('.c-note').textContent=st.note;
    }catch(e){ row.querySelector('.c-status').innerHTML='<span class="trend">data unavailable</span>'; row.querySelector('.c-flow').innerHTML='&#8212;'; row.querySelector('.c-temp').innerHTML='&#8212;'; }
  }));
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
