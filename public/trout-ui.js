// trout-ui.js — Shared rendering for all Michigan Trout Report pages
// One file, one standard. Every stream page, modal, and detail view
// uses these functions for consistent presentation.

const RATINGS = {
  PRIME:        { label: 'Prime',        emoji: '🎣', color: '#2e7d32', bg: '#e8f5e9', tagline: 'Drop everything and go.' },
  FISHING_WELL: { label: 'Fishing Well', emoji: '✅', color: '#558b2f', bg: '#f1f8e9', tagline: 'Worth the drive.' },
  FAIR:         { label: 'Fair',         emoji: '🟡', color: '#f9a825', bg: '#fffde7', tagline: 'Fishable. Pick your spots.' },
  TOUGH:        { label: 'Tough',        emoji: '🟠', color: '#e65100', bg: '#fff3e0', tagline: 'Fish are off.' },
  BLOWN_OUT:    { label: 'Blown Out',    emoji: '🔴', color: '#b71c1c', bg: '#ffebee', tagline: 'Stay home.' },
};

function flowBarColor(pct) {
  if (!pct) return '#ccc';
  if (pct > 200) return '#b71c1c'; if (pct > 150) return '#e65100';
  if (pct > 120) return '#f9a825'; if (pct > 80) return '#2e7d32';
  if (pct > 50) return '#558b2f'; return '#999';
}

function flyToAmazon(name, size) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(name + ' ' + (size||'') + ' fly fishing flies')}&tag=michigantrout-20`;
}

function lureToAmazon(query) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=michigantrout-20`;
}

// ── Section label (consistent across all pages) ─────────────────────────────
function sectionLabel(icon, text) {
  return `<div style="font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#bbb;margin-bottom:6px">${icon} ${text}</div>`;
}

function sectionDivider() {
  return `<div style="margin-top:12px;padding-top:10px;border-top:1px solid #e8e4dc">`;
}

// ── Rating badge ────────────────────────────────────────────────────────────
function renderRating(c) {
  const rat = RATINGS[c.ratingKey] || RATINGS.FAIR;
  return `<div style="display:flex;align-items:center;gap:10px;background:${rat.bg};border:1px solid ${rat.color}25;padding:10px 14px;border-radius:5px;margin-bottom:12px">
    <span style="font-size:24px">${rat.emoji}</span>
    <div>
      <div style="font-size:18px;font-weight:bold;color:${rat.color}">${rat.label}</div>
      <div style="font-size:13px;opacity:.8;color:${rat.color}">${rat.tagline}</div>
    </div>
  </div>`;
}

// ── Conditions stats (flow, temp, gage) ─────────────────────────────────────
function renderConditionStats(c) {
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:10px">
    <div style="background:#fff;border-radius:4px;padding:8px 10px;border:1px solid #e8e4dc">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Flow</div>
      <div style="font-size:15px;color:#2c2c2c">${c.flow !== null && c.flow !== undefined ? c.flow.toLocaleString() + ' cfs' : '—'}</div>
      ${c.flowLabel ? `<div style="font-size:10px;color:#bbb">${c.flowLabel}</div>` : ''}
    </div>
    <div style="background:#fff;border-radius:4px;padding:8px 10px;border:1px solid #e8e4dc">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Water Temp</div>
      <div style="font-size:15px;color:#2c2c2c">${c.tempF !== null && c.tempF !== undefined ? c.tempF + '°F' : '—'}</div>
      ${c.tempLabel ? `<div style="font-size:10px;color:#bbb">${c.tempLabel}</div>` : ''}
    </div>
    <div style="background:#fff;border-radius:4px;padding:8px 10px;border:1px solid #e8e4dc">
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Gage Height</div>
      <div style="font-size:15px;color:#2c2c2c">${c.gage !== null && c.gage !== undefined ? c.gage + ' ft' : '—'}</div>
      ${c.stats?.p50 ? `<div style="font-size:10px;color:#bbb">Median: ${c.stats.p50} cfs</div>` : ''}
    </div>
  </div>`;
}

// ── Flow bar ────────────────────────────────────────────────────────────────
function renderFlowBar(pct) {
  if (!pct) return '';
  return `<div style="background:#e8e4dc;border-radius:3px;height:5px;margin:4px 0 2px;overflow:hidden">
    <div style="height:100%;border-radius:3px;width:${Math.min(pct/2,100)}%;background:${flowBarColor(pct)}"></div>
  </div>
  <div style="font-size:10px;color:#bbb">${pct}% of seasonal median</div>`;
}

// ── Weather forecast ────────────────────────────────────────────────────────
function renderWeather(wx) {
  if (!wx?.today) return '';
  const t = wx.today;
  return `${sectionDivider()}
    ${sectionLabel('🌤', 'Weather Forecast')}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
      <span style="font-size:12px;background:#f0f4ff;padding:3px 8px;border-radius:3px;color:#444">${t.tempF || '?'}°F air</span>
      <span style="font-size:12px;background:#f0f4ff;padding:3px 8px;border-radius:3px;color:#444">${t.forecast || ''}</span>
      ${t.wind ? `<span style="font-size:12px;background:#f0f4ff;padding:3px 8px;border-radius:3px;color:#444">Wind: ${t.wind}</span>` : ''}
      ${t.rain > 15 ? `<span style="font-size:12px;background:#fff5f2;padding:3px 8px;border-radius:3px;color:#c62828">Rain: ${t.rain}%</span>` : ''}
    </div>
    ${t.cloud?.hatchTip ? `<div style="font-size:11px;color:#666;margin-bottom:3px">${t.cloud.hatchTip}</div>` : ''}
    ${t.wind_int?.tip ? `<div style="font-size:11px;color:#666;margin-bottom:3px">${t.wind_int.tip}</div>` : ''}
    ${wx.flowTrend && wx.flowTrend !== 'stable' ? `<div style="font-size:11px;color:#c62828;margin-bottom:3px">⚠ Rain incoming. Flow may rise in 12-24h.</div>` : ''}
    ${wx.bestWindow && wx.bestWindow.name !== t.name ? `<div style="font-size:11px;color:#2e7d32;margin-top:3px">Best window: <strong>${wx.bestWindow.name}</strong> (${wx.bestWindow.tempF}°F, ${wx.bestWindow.rain}% rain)</div>` : ''}
    ${wx.week?.length ? renderWeekForecast(wx.week) : ''}
  </div>`;
}

function renderWeekForecast(week) {
  const days = (week || []).slice(0, 5);
  if (!days.length) return '';
  return `<div style="display:flex;gap:6px;overflow-x:auto;padding:8px 0 2px;margin-top:6px">
    ${days.map(d => `<div style="background:#fff;border:1px solid #dde3f0;border-radius:4px;padding:6px 8px;min-width:72px;text-align:center;flex-shrink:0">
      <div style="font-size:10px;color:#8899bb;text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px">${(d.name||'').replace(' Night','').slice(0,3)}</div>
      <div style="font-size:13px;color:#2c2c2c">${d.tempF}°</div>
      ${d.rain > 10 ? `<div style="font-size:10px;color:#6680cc;margin-top:2px">💧${d.rain}%</div>` : ''}
      <div style="font-size:10px;color:#888;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:64px">${d.forecast||''}</div>
    </div>`).join('')}
  </div>`;
}

// ── Fly recommendations ─────────────────────────────────────────────────────
function renderFlies(recData) {
  if (!recData?.recommendation) return '';
  const flies = (recData.staticRec?.topFlies || []).slice(0, 4);
  const flyTags = flies.map(f =>
    `<a href="${flyToAmazon(f.name, f.sizes[0])}" target="_blank" rel="noopener sponsored" style="display:inline-block;background:#e8f5e9;color:#1a3a1a;font-size:11px;padding:3px 8px;border-radius:3px;margin:2px;text-decoration:none;border:1px solid #c8e6c9;cursor:pointer" title="Buy ${f.name} on Amazon">${f.name} #${f.sizes[0]}</a>`
  ).join('');

  return `${sectionDivider()}
    ${sectionLabel('🪰', 'Fly Recommendations')}
    <div style="font-size:13px;color:#3a3a3a;margin-bottom:6px;line-height:1.6">${recData.recommendation}</div>
    ${flyTags ? `<div>${flyTags}</div>` : ''}
  </div>`;
}

// ── Lure recommendations ────────────────────────────────────────────────────
function renderLures(lureRec) {
  if (!lureRec) return '';
  if (!lureRec.allowed) {
    return `${sectionDivider()}
      <div style="font-size:11px;color:#999;font-style:italic">⚠ ${lureRec.reason}</div>
    </div>`;
  }
  if (!lureRec.lures?.length) return '';

  const tags = lureRec.lures.map(l => {
    const colorStr = l.colors?.length ? ` (${l.colors.join(', ')})` : '';
    return `<a href="${lureToAmazon(l.amazonQuery)}" target="_blank" rel="noopener sponsored" style="display:inline-block;background:#fff3e0;color:#bf360c;font-size:11px;padding:3px 8px;border-radius:3px;margin:2px;text-decoration:none;border:1px solid #ffcc80;cursor:pointer" title="Buy ${l.name} on Amazon">${l.category}: ${l.name} ${l.size}${colorStr}</a>`;
  }).join('');

  return `${sectionDivider()}
    ${sectionLabel('🎣', 'Lure Recommendations')}
    <div style="font-size:12px;color:#666;margin-bottom:6px">${lureRec.advice}</div>
    ${tags}
  </div>`;
}

// ── Affiliate disclosure ────────────────────────────────────────────────────
function renderDisclosure() {
  return `<div style="font-size:9px;color:#ccc;margin-top:8px;padding-top:6px;border-top:1px solid #f0ece4">Product links go to Amazon. Commission at no cost to you.</div>`;
}

// ── Regulation badge ────────────────────────────────────────────────────────
function renderRegulationBadge(recData) {
  const gt = recData?.river?.gearType;
  if (!gt || gt === 'general') return '';
  
  const badges = {
    'artificial': { label: 'Artificial Lures Only', bg: '#fffde7', color: '#f9a825', icon: '⚠', desc: 'No live bait allowed on this water. Flies, spinners, and hard lures only.' },
    'flies_only': { label: 'Flies Only', bg: '#ffebee', color: '#c62828', icon: '🪰', desc: 'Artificial flies only. No spinning gear, no bait.' },
    'gear_restricted': { label: 'Gear Restricted', bg: '#ffebee', color: '#c62828', icon: '⚠', desc: 'DNR gear restricted water. Artificial flies only, no scented lures.' },
  };
  
  const b = badges[gt];
  if (!b) return '';
  
  return `<div style="margin-bottom:10px;padding:8px 12px;background:${b.bg};border-left:3px solid ${b.color};border-radius:0 4px 4px 0">
    <div style="font-size:12px;color:${b.color};font-weight:bold">${b.icon} ${b.label}</div>
    <div style="font-size:11px;color:#666;margin-top:2px">${b.desc} Check the <a href="https://www.michigan.gov/dnr/things-to-do/fishing/maps" target="_blank" rel="noopener" style="color:#2c5f2d">DNR Fishing Guide</a> for boundaries.</div>
  </div>`;
}

// ── Full conditions widget (used by stream pages) ───────────────────────────
// Call this with conditions data + recommend API data
function renderFullWidget(c, recData, riverId) {
  if (!c?.ratingKey) {
    return '<span style="color:#bbb;font-size:13px">No live data available today. Check back tomorrow or <a href="https://waterdata.usgs.gov/mi/nwis/current/?type=flow" target="_blank" rel="noopener" style="color:#4a7c4a">check USGS directly</a>.</span>';
  }

  const pct = c.flowPct;
  const wx = recData?.weather;
  const lr = recData?.lureRec;

  return [
    renderRating(c),
    renderRegulationBadge(recData),
    renderConditionStats(c),
    renderFlowBar(pct),
    renderWeather(wx),
    renderFlies(recData),
    renderLures(lr),
    renderDisclosure(),
    `<div style="display:flex;gap:10px;margin-top:12px;padding-top:10px;border-top:1px solid #e8e4dc;flex-wrap:wrap">
      <a href="/river.html?id=${riverId}" style="font-family:Georgia,serif;font-size:12px;padding:10px 14px;border-radius:4px;text-decoration:none;background:#1a3a1a;color:#fff;min-height:44px;display:inline-flex;align-items:center">Full report + all gauges →</a>
      <a href="/map.html?river=${riverId}" style="font-family:Georgia,serif;font-size:12px;padding:10px 14px;border-radius:4px;text-decoration:none;background:#e3f2fd;color:#1565c0;border:1px solid #90caf9;font-weight:bold;min-height:44px;display:inline-flex;align-items:center">🗺 Map</a>
    </div>`,
  ].join('');
}
