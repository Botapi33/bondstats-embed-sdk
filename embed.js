/* BondStats Embed SDK v1.2.1
   Embeddable fixed-income intelligence for websites, dashboards and research tools.
*/
(() => {
  'use strict';

  const VERSION = '1.2.1';
  const SCRIPT = document.currentScript;
  const CONFIG = (window.BondStatsConfig && typeof window.BondStatsConfig === 'object') ? window.BondStatsConfig : {};
  const DATA_URL = SCRIPT?.dataset?.bondstatsDataUrl || CONFIG.dataUrl || 'https://botapi33.github.io/bondstats-global-yields/global_yields.json';
  const DEFAULT_HOME = CONFIG.home || 'https://www.bondstats.org/';
  // GitHub Pages is only the technical delivery layer. Public widget CTAs
  // default to BondStats itself so integrations always return users to the
  // BondStats product. Set product-specific URLs through BondStatsConfig.links
  // or a component's `link` attribute once those BondStats pages exist.
  const LINKS = Object.freeze({
    home: DEFAULT_HOME,
    systemPressure: CONFIG.links?.systemPressure || DEFAULT_HOME,
    sovereignSpread: CONFIG.links?.sovereignSpread || DEFAULT_HOME,
    financialClock: CONFIG.links?.financialClock || DEFAULT_HOME,
    curveSignal: CONFIG.links?.curveSignal || DEFAULT_HOME
  });
  const CACHE_MS = 5 * 60 * 1000;
  const REFRESH_MS = 15 * 60 * 1000;
  const MAX_FRESH_DAYS = 7;

  let cache = { ts: 0, promise: null, data: null };

  const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
  const number = v => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace('%', '').replace(',', '.').trim());
    return Number.isFinite(n) ? n : null;
  };
  const changeToBps = (rawChange, value, previous) => {
    // Prefer the observable yield difference when both levels are available. This
    // avoids ambiguity over whether an upstream `change` field is in percentage
    // points or basis points.
    if (Number.isFinite(value) && Number.isFinite(previous)) return (value - previous) * 100;
    const c = number(rawChange);
    if (!Number.isFinite(c)) return null;
    // BondStats canonical feed expresses rate changes in percentage points. For
    // future feeds already expressed in bp, values above 1 are treated as bp.
    return Math.abs(c) <= 1 ? c * 100 : c;
  };
  const median = values => {
    const a = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };
  const fmtBp = v => Number.isFinite(v) ? `${v > 0 ? '+' : ''}${Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1)} bp` : '—';
  const fmtYield = v => Number.isFinite(v) ? `${v.toFixed(2)}%` : '—';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const pretty = s => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const aliases = new Map([
    ['us', 'united states'], ['usa', 'united states'], ['u.s.', 'united states'],
    ['uk', 'united kingdom'], ['u.k.', 'united kingdom'], ['britain', 'united kingdom'],
    ['eurozone', 'euro area'], ['eu', 'euro area'], ['de', 'germany'], ['it', 'italy'],
    ['fr', 'france'], ['es', 'spain'], ['ch', 'switzerland'], ['jp', 'japan']
  ]);
  const canon = s => aliases.get(norm(s)) || norm(s);
  const toDate = v => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const fmtDate = v => {
    const d = toDate(v);
    return d ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d) : '—';
  };

  async function fetchRaw(force = false) {
    const now = Date.now();
    if (!force && cache.data && now - cache.ts < CACHE_MS) return cache.data;
    if (!force && cache.promise) return cache.promise;
    cache.promise = fetch(DATA_URL, { cache: 'no-store', mode: 'cors' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(raw => {
        cache = { ts: Date.now(), promise: null, data: parseFeed(raw) };
        return cache.data;
      })
      .catch(err => { cache.promise = null; throw err; });
    return cache.promise;
  }

  function parseFeed(raw) {
    const records = [];
    const meta = {
      lastUpdated: raw?.meta?.lastUpdated || raw?.lastUpdated || raw?.updated || raw?.timestamp || '',
      title: raw?.meta?.title || 'BondStats Global Yields'
    };

    // Canonical BondStats schema: countries: { countryKey: { value, previousValue, change, ... } }
    if (raw && raw.countries && typeof raw.countries === 'object') {
      for (const [key, row] of Object.entries(raw.countries)) {
        if (!row || typeof row !== 'object') continue;
        const value = number(row.value);
        const previous = number(row.previousValue);
        const changeBps = changeToBps(row.change, value, previous);
        if (!Number.isFinite(value)) continue;
        records.push({
          market: row.label || pretty(key), marketKey: canon(row.label || key), tenor: '10Y',
          value, previous, changeBps,
          frequency: String(row.frequency || 'daily').toLowerCase(), stalenessDays: number(row.stalenessDays),
          isFallback: Boolean(row.isFallback), date: row.date || '', source: row.source || 'BondStats', tier: row.tier || ''
        });
      }
    }

    // Flexible recursive parsing for future multi-tenor versions.
    const TENORS = ['3M','6M','1Y','2Y','3Y','5Y','7Y','10Y','20Y','30Y'];
    const tenorOf = s => {
      if (!s) return null;
      const x = String(s).toUpperCase().replace(/\s+/g,'').replace(/YEARS?/g,'Y').replace(/YRS?/g,'Y').replace(/MONTHS?/g,'M');
      const m = x.match(/(\d+)([MY])/); return m ? `${m[1]}${m[2]}` : null;
    };
    const get = (o, keys) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k]; return null; };
    const seen = new Set(records.map(r => `${r.marketKey}|${r.tenor}|${r.date}|${r.value}`));
    const walk = (node, path = []) => {
      if (Array.isArray(node)) { node.forEach((v,i)=>walk(v,path.concat(i))); return; }
      if (!node || typeof node !== 'object') return;
      const explicitTenor = tenorOf(get(node,['tenor','maturity','term','duration','bondType','bond_type'])) || path.map(tenorOf).filter(Boolean).at(-1);
      const v = number(get(node,['yield','rate','current','latest'])); // intentionally omit generic value to avoid duplicating canonical countries schema
      if (explicitTenor && TENORS.includes(explicitTenor) && Number.isFinite(v)) {
        const mk = get(node,['country','market','name','label','economy','regionName']) || [...path].reverse().find(p => typeof p === 'string' && !tenorOf(p) && !['data','markets','countries','yields','rates','series','observations','values'].includes(norm(p)));
        if (mk) {
          const market = pretty(mk), marketKey = canon(market);
          const prev = number(get(node,['previousValue','previous_value','previous','prior','prev']));
          const changeBps = changeToBps(get(node,['change','dailyChange','daily_change']), v, prev);
          const rec = { market, marketKey, tenor: explicitTenor, value: v, previous: prev, changeBps,
            frequency: String(get(node,['frequency','freq']) || 'daily').toLowerCase(), stalenessDays: number(get(node,['stalenessDays','staleness_days','staleDays'])),
            isFallback: Boolean(get(node,['isFallback','fallback','is_fallback'])), date: get(node,['date','observationDate','observation_date','timestamp','updated']) || '', source: get(node,['source','provider','dataSource']) || 'BondStats', tier: get(node,['tier']) || '' };
          const id = `${rec.marketKey}|${rec.tenor}|${rec.date}|${rec.value}`;
          if (!seen.has(id)) { seen.add(id); records.push(rec); }
        }
      }
      Object.entries(node).forEach(([k,v2]) => { if (v2 && typeof v2 === 'object') walk(v2,path.concat(k)); });
    };
    walk(raw, []);

    return { raw, meta, records };
  }

  function ageDays(v) {
    const d = toDate(v);
    if (!d) return null;
    return Math.max(0, (Date.now() - d.getTime()) / 86400000);
  }
  function eligible(r) {
    const daily = r.frequency === 'daily' || r.frequency === '1d' || r.frequency.includes('day');
    const freshness = Number.isFinite(r.stalenessDays) ? r.stalenessDays : ageDays(r.date);
    return daily && !r.isFallback && Number.isFinite(r.value) && Number.isFinite(freshness) && freshness <= MAX_FRESH_DAYS;
  }
  function marketRecord(feed, market, tenor = '10Y') {
    const key = canon(market);
    const matches = feed.records.filter(r => eligible(r) && r.marketKey === key && r.tenor === tenor);
    return matches.sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0))[0] || null;
  }

  function linearScore(value, stops) {
    if (!Number.isFinite(value)) return null;
    if (value <= stops[0][0]) return stops[0][1];
    for (let i=1;i<stops.length;i++) {
      const [x1,y1]=stops[i], [x0,y0]=stops[i-1];
      if (value <= x1) return y0 + ((value-x0)*(y1-y0))/(x1-x0);
    }
    return stops.at(-1)[1];
  }
  const levelScore = y => clamp(linearScore(y, [[0,0],[1,8],[2,20],[3,35],[4,55],[5,72],[6,84],[8,96],[10,100]]));
  const moveScore = bps => clamp(linearScore(bps, [[0,0],[1,8],[2,18],[3,30],[5,48],[8,66],[12,80],[20,93],[30,100]]));
  const marketPressure = m => clamp(levelScore(m.value)*0.6 + moveScore(Math.abs(m.changeBps || 0))*0.25 + (m.changeBps > 1 ? clamp(linearScore(m.changeBps,[[1,10],[3,35],[5,60],[10,85],[20,100]]))*0.15 : 0));

  function systemPressure(feed) {
    const markets = feed.records.filter(r => eligible(r) && r.tenor === '10Y' && Number.isFinite(r.changeBps));
    const unique = [];
    const keys = new Set();
    for (const r of markets.sort((a,b)=>(toDate(b.date)?.getTime()||0)-(toDate(a.date)?.getTime()||0))) {
      if (!keys.has(r.marketKey)) { keys.add(r.marketKey); unique.push(r); }
    }
    if (unique.length < 5) return { score: null, state: 'Unavailable', markets: unique.length, observationDate: '' };
    const medYield = median(unique.map(m=>m.value));
    const medAbsMove = median(unique.map(m=>Math.abs(m.changeBps)));
    const breadth = unique.filter(m=>Math.abs(m.changeBps)>=3).length / unique.length * 100;
    const upward = unique.filter(m=>m.changeBps>1).length / unique.length * 100;
    const components = {
      level: levelScore(medYield),
      move: moveScore(medAbsMove),
      breadth: clamp(linearScore(breadth, [[0,0],[15,15],[30,35],[50,60],[70,82],[90,100]])),
      direction: clamp(linearScore(upward, [[0,0],[20,15],[40,35],[60,60],[80,85],[100,100]]))
    };
    const score = clamp(components.level*0.40 + components.move*0.25 + components.breadth*0.20 + components.direction*0.15);
    const bands = [[24,'Contained'],[39,'Normal'],[54,'Pressure Building'],[69,'Elevated'],[84,'High'],[100,'Extreme']];
    const state = bands.find(([max])=>score<=max)?.[1] || 'Extreme';
    const observationDate = unique.map(m=>toDate(m.date)).filter(Boolean).sort((a,b)=>b-a)[0];
    const ranked = unique.map(m=>({ market:m.market, value:m.value, changeBps:m.changeBps, score:marketPressure(m) })).sort((a,b)=>b.score-a.score);
    return { score, state, markets: unique.length, observationDate: observationDate?.toISOString() || '', components, topMarket: ranked[0] || null, ranked };
  }

  function spread(feed, market, benchmark) {
    const a = marketRecord(feed, market, '10Y'), b = marketRecord(feed, benchmark, '10Y');
    if (!a || !b) return { market, benchmark, spreadBps:null, changeBps:null, marketRecord:a, benchmarkRecord:b };
    return { market:a.market, benchmark:b.market, spreadBps:(a.value-b.value)*100,
      changeBps:Number.isFinite(a.changeBps)&&Number.isFinite(b.changeBps)?a.changeBps-b.changeBps:null, marketRecord:a, benchmarkRecord:b };
  }

  function curve(feed, market, shortTenor='2Y', longTenor='10Y') {
    const s = marketRecord(feed, market, shortTenor), l = marketRecord(feed, market, longTenor);
    if (!s || !l) return { market, shortTenor, longTenor, available:false, label:'Tenor coverage unavailable' };
    const slopeBps = (l.value-s.value)*100;
    const delta = Number.isFinite(l.changeBps)&&Number.isFinite(s.changeBps) ? l.changeBps-s.changeBps : null;
    const avg = Number.isFinite(l.changeBps)&&Number.isFinite(s.changeBps) ? (l.changeBps+s.changeBps)/2 : null;
    let label = slopeBps < 0 ? 'Inverted' : 'Curve available';
    if (Number.isFinite(delta) && Number.isFinite(avg)) {
      if (Math.abs(delta)<1.5) label = avg>1.5?'Parallel Higher':avg<-1.5?'Parallel Lower':(slopeBps<0?'Inverted · Stable':'Stable');
      else if (delta>0) label = avg>1.5?'Bear Steepening':avg<-1.5?'Bull Steepening':'Steepening';
      else label = avg>1.5?'Bear Flattening':avg<-1.5?'Bull Flattening':'Flattening';
    }
    return { market:l.market, shortTenor, longTenor, available:true, short:s, long:l, slopeBps, slopeChangeBps:delta, label };
  }

  const TOKYO='Asia/Tokyo', SINGAPORE='Asia/Singapore', HONGKONG='Asia/Hong_Kong', LONDON='Europe/London', NEWYORK='America/New_York';
  const clockZones = { tokyo:TOKYO, singapore:SINGAPORE, 'hong kong':HONGKONG, hongkong:HONGKONG, london:LONDON, 'new york':NEWYORK, newyork:NEWYORK };
  const clockLabel = s => ({tokyo:'Tokyo',singapore:'Singapore','hong kong':'Hong Kong',hongkong:'Hong Kong',london:'London','new york':'New York',newyork:'New York'}[norm(s)] || pretty(s));
  const timeIn = zone => new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());

  const baseCss = `
    :host{--bs-bg:#090c0b;--bs-panel:#0d1110;--bs-line:#202724;--bs-text:#edf4f0;--bs-muted:#8d9a94;--bs-green:#29e783;--bs-soft:#b9c5bf;display:block;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--bs-text);font-variant-numeric:tabular-nums}
    :host([theme="light"]){--bs-bg:#f7f9f8;--bs-panel:#fff;--bs-line:#dfe5e2;--bs-text:#101614;--bs-muted:#66716c;--bs-green:#0a9f58;--bs-soft:#4b5852}
    *{box-sizing:border-box}.card{position:relative;background:var(--bs-bg);border:1px solid var(--bs-line);border-radius:14px;padding:18px 20px;overflow:hidden}.top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.eyebrow{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--bs-muted);font-weight:700}.title{margin-top:6px;font-size:15px;font-weight:650;letter-spacing:-.01em}.big{font-size:42px;line-height:1;font-weight:580;letter-spacing:-.045em}.unit{font-size:13px;color:var(--bs-muted);margin-left:5px}.state{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--bs-green)}.dot{width:6px;height:6px;border-radius:99px;background:var(--bs-green);box-shadow:0 0 0 3px color-mix(in srgb,var(--bs-green) 12%, transparent)}.muted{color:var(--bs-muted)}.desc{margin-top:10px;color:var(--bs-soft);font-size:12px;line-height:1.55}.meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:15px;padding-top:12px;border-top:1px solid var(--bs-line);font-size:10px;color:var(--bs-muted)}.meta b{color:var(--bs-soft);font-weight:600}.link{color:var(--bs-green);text-decoration:none;font-weight:650;white-space:nowrap}.error{font-size:12px;color:#d7a16a}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.metric{padding:12px 0;border-top:1px solid var(--bs-line)}.metric .k{font-size:10px;text-transform:uppercase;letter-spacing:.10em;color:var(--bs-muted)}.metric .v{margin-top:5px;font-size:20px;font-weight:600}.pair{display:flex;align-items:baseline;gap:8px}.brand{font-size:11px;font-weight:700;letter-spacing:.02em}.brand span{color:var(--bs-green)}
    @media(max-width:520px){.card{padding:15px 16px;border-radius:12px}.big{font-size:36px}.title{font-size:14px}.desc{font-size:11px}.grid{gap:8px}.metric .v{font-size:18px}}
  `;

  class BondStatsBase extends HTMLElement {
    constructor(){ super(); this.attachShadow({mode:'open'}); this._timer=null; }
    connectedCallback(){ this.renderLoading(); this.load(); this._timer=setInterval(()=>this.load(),REFRESH_MS); }
    disconnectedCallback(){ if(this._timer) clearInterval(this._timer); }
    attr(name,fallback=''){ return this.getAttribute(name) ?? fallback; }
    link(){ return this.attr('link', this.constructor.defaultLink || DEFAULT_HOME); }
    shell(content){ return `<style>${baseCss}</style><div class="card">${content}</div>`; }
    renderLoading(){ this.shadowRoot.innerHTML=this.shell(`<div class="eyebrow">BondStats Embedded Intelligence</div><div class="title">Loading live market data…</div>`); }
    renderError(err){ this.shadowRoot.innerHTML=this.shell(`<div class="brand">Bond<span>Stats</span></div><div class="title">Data temporarily unavailable</div><div class="desc error">${esc(err?.message || 'Unable to load BondStats data.')}</div>`); }
    async load(){ try { const feed=await fetchRaw(); this.render(feed); } catch(e){ this.renderError(e); } }
  }

  class BondStatsSystemPressure extends BondStatsBase {
    static defaultLink = LINKS.systemPressure;
    render(feed){
      const x=systemPressure(feed), score=Number.isFinite(x.score)?Math.round(x.score):'—';
      const desc = x.state==='Contained'?'Sovereign-rate pressure is broadly contained across the eligible market universe.' : x.state==='Normal'?'Rate pressure remains broadly orderly across fresh sovereign markets.' : x.state==='Pressure Building'?'Pressure is becoming more visible across the eligible sovereign universe.' : x.state==='Elevated'?'Broad sovereign-rate pressure is elevated and deserves closer attention.' : 'Sovereign-rate pressure is unusually high across the eligible market universe.';
      this.shadowRoot.innerHTML=this.shell(`
        <div class="top"><div><div class="eyebrow">System Pressure Index</div><div class="pair" style="margin-top:9px"><div class="big">${score}</div><div class="unit">/100</div></div></div><div class="state"><i class="dot"></i>${esc(x.state)}</div></div>
        <div class="desc">${esc(desc)}</div>
        <div class="meta"><span><b>${x.markets}</b> fresh markets</span><span>Observation <b>${fmtDate(x.observationDate)}</b></span>${x.topMarket?`<span>Highest <b>${esc(x.topMarket.market)}</b></span>`:''}<span style="margin-left:auto"><a class="link" href="${esc(this.link())}" target="_blank" rel="noopener">Explore on BondStats →</a></span></div>`);
    }
  }

  class BondStatsSovereignSpread extends BondStatsBase {
    static defaultLink = LINKS.sovereignSpread;
    static get observedAttributes(){ return ['market','benchmark']; }
    attributeChangedCallback(){ if(this.isConnected) this.load(); }
    render(feed){
      const market=this.attr('market','Italy'), bench=this.attr('benchmark','Germany'), x=spread(feed,market,bench);
      const direction=Number.isFinite(x.changeBps)?(x.changeBps>0?'Widening':x.changeBps<0?'Compressing':'Unchanged'):'Current spread';
      this.shadowRoot.innerHTML=this.shell(`
        <div class="top"><div><div class="eyebrow">10Y Sovereign Spread</div><div class="title">${esc(x.market)} vs ${esc(x.benchmark)}</div></div><div class="state"><i class="dot"></i>${esc(direction)}</div></div>
        <div class="pair" style="margin-top:16px"><div class="big">${Number.isFinite(x.spreadBps)?x.spreadBps.toFixed(0):'—'}</div><div class="unit">bp</div></div>
        <div class="grid"><div class="metric"><div class="k">Daily spread change</div><div class="v">${fmtBp(x.changeBps)}</div></div><div class="metric"><div class="k">Market / benchmark</div><div class="v">${fmtYield(x.marketRecord?.value)} / ${fmtYield(x.benchmarkRecord?.value)}</div></div></div>
        <div class="meta"><span>Observation <b>${fmtDate(x.marketRecord?.date || x.benchmarkRecord?.date)}</b></span><span style="margin-left:auto"><a class="link" href="${esc(this.link())}" target="_blank" rel="noopener">Explore on BondStats →</a></span></div>`);
    }
  }

  class BondStatsCurveSignal extends BondStatsBase {
    static defaultLink = LINKS.curveSignal;
    static get observedAttributes(){ return ['market','short','long']; }
    attributeChangedCallback(){ if(this.isConnected) this.load(); }
    render(feed){
      const market=this.attr('market','United States'), shortT=this.attr('short','2Y'), longT=this.attr('long','10Y'), x=curve(feed,market,shortT,longT);
      if(!x.available){
        this.shadowRoot.innerHTML=this.shell(`<div class="top"><div><div class="eyebrow">Curve Signal</div><div class="title">${esc(pretty(market))} · ${esc(shortT)}/${esc(longT)}</div></div><div class="state">Coverage</div></div><div class="desc">The current live feed does not expose both requested tenors for this market. BondStats never synthesizes missing curve points; the component activates automatically when live tenor coverage is available.</div><div class="meta"><span><b>Transparent data rule</b></span><span style="margin-left:auto"><a class="link" href="${esc(this.link())}" target="_blank" rel="noopener">Explore on BondStats →</a></span></div>`); return;
      }
      this.shadowRoot.innerHTML=this.shell(`<div class="top"><div><div class="eyebrow">Curve Signal</div><div class="title">${esc(x.market)} · ${esc(shortT)}/${esc(longT)}</div></div><div class="state"><i class="dot"></i>${esc(x.label)}</div></div><div class="pair" style="margin-top:16px"><div class="big">${Number.isFinite(x.slopeBps)?x.slopeBps.toFixed(0):'—'}</div><div class="unit">bp slope</div></div><div class="grid"><div class="metric"><div class="k">${esc(shortT)}</div><div class="v">${fmtYield(x.short.value)}</div></div><div class="metric"><div class="k">${esc(longT)}</div><div class="v">${fmtYield(x.long.value)}</div></div></div><div class="meta"><span>Slope Δ <b>${fmtBp(x.slopeChangeBps)}</b></span><span>Observation <b>${fmtDate(x.long.date)}</b></span><span style="margin-left:auto"><a class="link" href="${esc(this.link())}" target="_blank" rel="noopener">Explore on BondStats →</a></span></div>`);
    }
  }

  class BondStatsFinancialClock extends HTMLElement {
    constructor(){ super(); this.attachShadow({mode:'open'}); this._timer=null; }
    connectedCallback(){ this.render(); this._timer=setInterval(()=>this.render(),1000); }
    disconnectedCallback(){ if(this._timer) clearInterval(this._timer); }
    render(){
      const raw=(this.getAttribute('cities')||'London,New York,Tokyo').split(',').map(s=>s.trim()).filter(Boolean).slice(0,5);
      const link=this.getAttribute('link')||LINKS.financialClock;
      const items=raw.map(city=>{const k=norm(city),zone=clockZones[k];return zone?`<div class="metric"><div class="k">${esc(clockLabel(city))}</div><div class="v">${esc(timeIn(zone))}</div></div>`:''}).join('');
      this.shadowRoot.innerHTML=`<style>${baseCss}</style><div class="card"><div class="top"><div><div class="eyebrow">Global Financial Clock</div><div class="title">Live financial-center time</div></div><div class="state"><i class="dot"></i>Live</div></div><div class="grid">${items}</div><div class="meta"><span>IANA time zones · automatic DST</span><span style="margin-left:auto"><a class="link" href="${esc(link)}" target="_blank" rel="noopener">Explore on BondStats →</a></span></div></div>`;
    }
  }

  const define = (name, cls) => { if (!customElements.get(name)) customElements.define(name, cls); };
  define('bondstats-system-pressure', BondStatsSystemPressure);
  define('bondstats-sovereign-spread', BondStatsSovereignSpread);
  define('bondstats-curve-signal', BondStatsCurveSignal);
  define('bondstats-financial-clock', BondStatsFinancialClock);

  function upgradeDataWidgets(root=document){
    root.querySelectorAll('[data-bondstats-widget]').forEach(node=>{
      if(node.dataset.bondstatsUpgraded) return;
      const map={
        'system-pressure':'bondstats-system-pressure',
        'sovereign-spread':'bondstats-sovereign-spread',
        'curve-signal':'bondstats-curve-signal',
        'financial-clock':'bondstats-financial-clock'
      };
      const tag=map[node.dataset.bondstatsWidget]; if(!tag) return;
      const el=document.createElement(tag);
      [...node.attributes].forEach(a=>{
        if(a.name.startsWith('data-') && !['data-bondstats-widget','data-bondstats-upgraded'].includes(a.name)) el.setAttribute(a.name.slice(5),a.value);
        else if(['id','class','style','title','aria-label'].includes(a.name)) el.setAttribute(a.name,a.value);
      });
      el.dataset.bondstatsUpgraded='1';
      node.replaceWith(el);
    });
  }

  const api = Object.freeze({
    version: VERSION,
    dataUrl: DATA_URL,
    refresh: async()=>{ cache={ts:0,promise:null,data:null}; const d=await fetchRaw(true); document.querySelectorAll('bondstats-system-pressure,bondstats-sovereign-spread,bondstats-curve-signal').forEach(el=>el.load?.()); return d; },
    getSystemPressure: async()=>systemPressure(await fetchRaw()),
    getSpread: async(market,benchmark)=>spread(await fetchRaw(),market,benchmark),
    getCurveSignal: async(market,shortTenor='2Y',longTenor='10Y')=>curve(await fetchRaw(),market,shortTenor,longTenor),
    getMarket: async(market,tenor='10Y')=>marketRecord(await fetchRaw(),market,tenor),
    diagnostics: async()=>{
      const checks = {
        version: VERSION,
        dataUrl: DATA_URL,
        links: LINKS,
        customElements: ['bondstats-system-pressure','bondstats-sovereign-spread','bondstats-curve-signal','bondstats-financial-clock'].every(x=>Boolean(customElements.get(x))),
        timeZones: ['Asia/Tokyo','Asia/Singapore','Asia/Hong_Kong','Europe/London','America/New_York'].every(z=>{ try { new Intl.DateTimeFormat('en',{timeZone:z}).format(); return true; } catch { return false; } }),
        publicLinksOnBondStats: Object.entries(LINKS).filter(([k])=>k!=='home').every(([,url])=>{ try { const h=new URL(url).hostname.toLowerCase(); return h==='bondstats.org' || h.endsWith('.bondstats.org'); } catch { return false; } })
      };
      try {
        const feed = await fetchRaw(true);
        const eligible10Y = feed.records.filter(r=>eligible(r)&&r.tenor==='10Y');
        checks.feed = true;
        checks.records = feed.records.length;
        checks.eligible10Y = new Set(eligible10Y.map(r=>r.marketKey)).size;
        checks.systemPressure = Number.isFinite(systemPressure(feed).score);
      } catch (e) {
        checks.feed = false;
        checks.feedError = e?.message || String(e);
        checks.systemPressure = false;
      }
      checks.ok = Boolean(checks.customElements && checks.timeZones && checks.publicLinksOnBondStats && checks.feed);
      return checks;
    },
    links: LINKS,
    upgrade: upgradeDataWidgets
  });
  window.BondStats = api;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>upgradeDataWidgets()); else upgradeDataWidgets();
})();
