'use client';
import Link from 'next/link';
import {useEffect, useState} from 'react';
import {ArrowUpRight, Search, Shield, Layers, FileCheck2, ChevronRight, SlidersHorizontal, X, LockKeyhole} from 'lucide-react';
import {Button} from './ui/button';
import {CategoryArt, RiskTransferArt} from './category-art';
import {categories, type CategoryId} from '@/lib/categories';
import {date, millimetres, exactMoney as money, type Protocol} from '@/lib/protocol';

export function premiumRatio(premium: bigint, coverage: bigint) {
  if (!coverage) return '—';
  const hundredths = premium * 10000n / coverage;
  return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, '0')}%`;
}
export function marketStatus(event: Protocol['events'][number], now: bigint) {
  const status = event.resolution.status;
  if (status === 3) return 'Resolved YES';
  if (status === 4) return 'Resolved NO';
  if (status === 5) return 'Invalid';
  if (status === 2) return 'Resolving';
  if (now >= event.terms.observationEnd) return 'Awaiting data';
  if (now >= event.terms.purchaseCutoff) return 'Closed';
  return 'Open';
}
export function MarketStatusBadge({status}: {status: string}) {
  return <span className={`market-status status-${status.toLowerCase().replaceAll(' ', '-')}`}><i/>{status}</span>;
}
export function LoadingSkeleton() {
  return <div className="market-grid" role="status" aria-label="Loading onchain markets">{[0,1,2].map(i=><div className="market-skeleton" key={i}><div/><span/><span/><span/></div>)}</div>;
}
export function Home({data,loading}: {data?: Protocol; loading: boolean}) {
  const capacity = data?.vaults.reduce((sum,v)=>sum+v.availableCapacity,0n);
  return <>
    <section className="editorial-hero">
      <div className="hero-copy"><div className="hero-context"><span className="monad-mark"/>Risk, backed by capital.</div><h1>Underwrite<br/>uncertainty.</h1><p>An onchain marketplace for transferring, pricing, and underwriting real-world risk.</p><div className="hero-buttons"><Button asChild><Link href="/explore/">Explore markets <ArrowUpRight size={17}/></Link></Button><Button asChild variant="outline"><Link href="/underwrite/">Start underwriting</Link></Button></div><div className="hero-assurance"><LockKeyhole size={14}/> Fully collateralized. Settled onchain.</div></div>
      <div className="hero-visual"><RiskTransferArt/><span className="diagram-caption">Risk transfer architecture · conceptual illustration</span></div>
    </section>
    <div className="platform-strip"><span><span className="monad-mark"/>Built on Monad Testnet</span><span>Fixed conditional payouts</span><span>Inspectable evidence</span><span>Mock funds only</span></div>
    <MarketDiscovery data={data} loading={loading} compact/>
    <section className="capital-invitation"><div><Layers size={25}/><h2>Put capital behind<br/>the risks you understand.</h2><p>Invited underwriters reserve capital against defined outcomes. Earn contractual premiums at settlement and accept the corresponding claim risk.</p><Button asChild variant="outline"><Link href="/underwrite/">Explore underwriting <ArrowUpRight size={16}/></Link></Button></div><div className="capital-summary"><span>Available underwriting capacity</span><strong>{money(capacity)} <small>mUSDC</small></strong><p>Read from the configured vault contracts.</p><div className="capital-rule"><Shield size={18}/><span>Every purchased policy reserves its full maximum claim.</span></div><div className="capital-rule"><LockKeyhole size={18}/><span>Capital remains locked until the epoch closes. Claims can reduce your capital.</span></div></div></section>
    <section className="how-section" id="how-it-works"><div className="section-heading"><h2>A defined path from risk to settlement.</h2><span className="muted">How Aegis works</span></div><div className="explain-grid">{[
      {icon:Shield,title:'Choose your risk',text:'Review the event, observation window, trigger, and governing dataset before you commit.',href:'/explore/',link:'Find a market'},
      {icon:Layers,title:'Purchase protection',text:'Pay a quoted premium for a fixed conditional payout. The vault reserves the entire claim at purchase.',href:'/buy/',link:'Review protection'},
      {icon:FileCheck2,title:'Inspect the settlement',text:'A trusted authority commits evidence. The contract applies the agreed rules; anyone can finalize and settle.',href:'/resolution/',link:'Follow the evidence'},
    ].map((step,i)=><div className="explain-card" key={step.title}><div className="step-header"><span className="step-number">0{i+1}</span><step.icon size={22}/></div><h3>{step.title}</h3><p>{step.text}</p><Link href={step.href}>{step.link}<ChevronRight size={15}/></Link></div>)}</div></section>
  </>;
}

export function MarketDiscovery({data,loading,compact=false}: {data?: Protocol; loading: boolean; compact?: boolean}) {
  const [category,setCategory]=useState<CategoryId|'all'>('all');
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('all');
  const [mode,setMode]=useState('live');
  const [sort,setSort]=useState('soonest');
  const [location,setLocation]=useState('all');
  const [filtersOpen,setFiltersOpen]=useState(false);
  const selected=categories.find(c=>c.id===category);
  const events=(data?.events||[]).filter(e=>{
    const title=`${e.weather?.displayName||"Unverified location"} rainfall event ${e.id} weather ${millimetres(e.terms.thresholdMilliMm)} mm`;
    return (location==='all'||e.weather?.city===location)&&(!selected||selected.available)&&title.toLowerCase().includes(search.toLowerCase())&&(status==='all'||marketStatus(e,data!.now)===status)&&(mode==='live'?e.terms.mode===0:e.terms.mode===1);
  }).sort((a,b)=>sort==='soonest'?Number(a.terms.observationStart-b.terms.observationStart):Number(b.id-a.id));
  const shown=compact?events.slice(0,3):events;
  const clear=()=>{setSearch('');setStatus('all');setLocation('all');setSort('soonest');};
  return <section className="market-discovery" id="markets">
    <div className="section-heading discovery-heading"><div><h2>{compact?'A marketplace for real-world risk.':'Explore risk markets'}</h2><p>Defined events. Transparent terms. Capital you can inspect.</p></div>{compact?<Link className="text-link" href="/explore/">View all markets <ArrowUpRight size={16}/></Link>:<span className="market-count">{loading?'Reading contracts…':data?`${events.length} ${mode==='live'?'live-data':'demonstration'} markets`:'Market data unavailable'}</span>}</div>
    <div className="category-tabs" role="tablist" aria-label="Risk categories"><button role="tab" aria-selected={category==='all'} onClick={()=>setCategory('all')} className={category==='all'?'active':''}><SlidersHorizontal size={16}/>All categories</button>{categories.map(c=><button role="tab" aria-selected={category===c.id} onClick={()=>setCategory(c.id)} className={category===c.id?'active':''} key={c.id}><c.icon size={17}/>{c.name}{!c.available&&<span>Upcoming</span>}</button>)}</div>
    {selected&&<div className={`category-banner banner-${selected.id}`} style={{'--category-accent':selected.accent} as React.CSSProperties}><div><span className="category-subject">{selected.subject}</span><h3>{selected.title}</h3><p>{selected.description}</p><span className="category-availability">{selected.available?'Weather contracts implemented':'Upcoming category · No markets available'}</span></div><CategoryArt category={selected.id}/><small className="art-caption">Illustrative category artwork</small></div>}
    {(!selected||selected.available)&&<>
      <div className="discovery-toolbar"><label className="search-field"><Search size={18}/><input aria-label="Search markets" placeholder="Search markets, locations, or triggers" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="Clear search" onClick={()=>setSearch('')}><X size={15}/></button>}</label><div className="mode-switch" aria-label="Market mode"><button className={mode==='live'?'active':''} onClick={()=>setMode('live')}>Live-data</button><button className={mode==='demo'?'active':''} onClick={()=>setMode('demo')}>Demo replay</button></div><button className={`filter-toggle ${filtersOpen?'active':''}`} aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={17}/>Filters</button></div>
      {filtersOpen&&<div className="filter-row"><label>Status<select aria-label="Market status" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{['Open','Closed','Awaiting data','Resolving','Resolved YES','Resolved NO','Invalid'].map(s=><option key={s}>{s}</option>)}</select></label><label>Location<select aria-label="Market location" value={location} onChange={e=>setLocation(e.target.value)}><option value="all">All locations</option><option value="pune">Pune, India</option><option value="mumbai">Mumbai, India</option></select></label><label>Sort by<select aria-label="Market sort" value={sort} onChange={e=>setSort(e.target.value)}><option value="soonest">Observation: soonest</option><option value="newest">Newest registered</option></select></label><Button variant="ghost" onClick={clear}>Reset filters</Button></div>}
      {mode==='demo'&&<div className="simulation-label">Testnet demonstration · Synthetic precommitted outcomes. These are demonstrations, not future insurable risks or verified historical observations.</div>}
      {loading?<LoadingSkeleton/>:shown.length?<div className="market-grid">{shown.map(event=><MarketCard key={event.id.toString()} event={event} data={data!}/>)}</div>:<div className="market-empty"><div className="empty-symbol"><Search size={23}/></div><h3>{search||status!=='all'?'No markets match these filters.':`No ${mode==='live'?'live-data':'demonstration'} markets registered yet.`}</h3><p>{data?'Only events registered in the configured contracts appear here. New markets become available when their terms and funded quotes are published.':'The contract connection has not returned market data. Retry the connection using refresh above.'}</p>{(search||status!=='all')?<Button variant="outline" onClick={clear}>Clear filters</Button>:<Link className="text-link" href="/resolution/">Inspect resolution rules <ArrowUpRight size={15}/></Link>}</div>}
    </>}
    {category==='all'&&<div className="category-catalog">{categories.map(c=><button key={c.id} onClick={()=>setCategory(c.id)} style={{'--category-accent':c.accent} as React.CSSProperties}><CategoryArt category={c.id}/><span className="catalog-title"><c.icon size={17}/>{c.name}<ArrowUpRight size={14}/></span><span className="catalog-status">{c.available?'Contracts implemented':'Upcoming category'}</span></button>)}</div>}
    {selected&&!selected.available&&<div className="upcoming-note"><LockKeyhole size={17}/><p>{selected.name} is part of the Aegis roadmap. No protection contracts, quotes, liquidity, or trading activity are available in this category.</p></div>}
  </section>;
}

export function MarketCard({event:e,data}: {event:Protocol['events'][number]; data:Protocol}) {
  const quotes=data.quotes.filter(q=>q.eventId===e.id&&q.status===1&&q.expiry>data.now);
  const quote=quotes.find(q=>{const v=data.vaults.find(v=>v.id===q.vaultId);return v&&v.phase===1&&v.availableCapacity>=q.coverage;})||quotes[0];
  const capacity=data.vaults.filter(v=>quotes.some(q=>q.vaultId===v.id)).reduce((sum,v)=>sum+v.availableCapacity,0n);
  return <Link className="market-card" href={`/market/?event=${e.id}`}>
    <div className="market-card-header"><div className="market-thumbnail"><CategoryArt category="weather"/></div><div><span className="market-category">Weather</span><span className="market-location">{e.weather?.displayName||"Unverified location"}, India</span></div><ArrowUpRight size={17}/></div>
    <h3>Will rainfall reach {millimetres(e.terms.thresholdMilliMm)} mm?</h3><p className="market-observation">{e.weather?.observationDate||date(e.terms.observationStart)}</p>
    {e.terms.mode===1&&<span className="demo-tag">{e.weather?.mode==='historical-replay'?'Historical replay':'Synthetic demonstration'}</span>}
    <div className="market-quote"><div><span>Fixed coverage</span><strong>{money(quote?.coverage)} <small>mUSDC</small></strong></div><div><span>Quoted premium</span><strong>{money(quote?.premium)} <small>mUSDC</small></strong></div></div>
    <div className="market-detail-row"><span>Premium / coverage</span><strong>{quote?premiumRatio(quote.premium,quote.coverage):'No quote'}</strong></div><div className="market-detail-row"><span>Quoted vault capacity</span><strong>{money(capacity)} mUSDC</strong></div>
    <div className="market-detail-row"><span>Purchase cutoff</span><strong>{date(e.terms.purchaseCutoff)}</strong></div><div className="market-card-footer"><MarketStatusBadge status={marketStatus(e,data.now)}/><span>ERA5 <ChevronRight size={13}/></span></div>
  </Link>;
}

export function MarketDetail({data,children}: {data?:Protocol; children: (id?: bigint)=>React.ReactNode}) {
  const [id,setId]=useState<string>();
  useEffect(()=>{const raw=new URLSearchParams(window.location.search).get('event');if(raw&&/^\d+$/.test(raw))setId(raw);},[]);
  const event=data?.events.find(e=>e.id.toString()===id);
  if(!event)return <><Link className="text-link" href="/explore/">Back to markets</Link><div className="market-empty"><h2>{data?'Market not found.':'Reading market terms…'}</h2><p>Select an onchain event from Explore to inspect its exact terms and quotes.</p></div></>;
  return <><Link className="text-link" href="/explore/">Back to markets</Link><div className="market-detail-heading"><div><span className="category-subject">Weather / {event.weather?.displayName||"Unverified location"}, India</span><h1>Will rainfall reach<br/>{millimetres(event.terms.thresholdMilliMm)} mm?</h1><p>{date(event.terms.observationStart)} — {date(event.terms.observationEnd)}</p></div><div className="detail-category-art"><CategoryArt category="weather"/><span>Illustrative contours · Not observed data</span></div></div><div className="detail-status"><MarketStatusBadge status={marketStatus(event,data!.now)}/><span>Event #{event.id.toString()}</span><span>ERA5 daily rainfall</span>{event.terms.mode===1&&<span className="demo-tag">{event.weather?.mode==='historical-replay'?'HISTORICAL REPLAY — TESTNET DEMONSTRATION':'Synthetic demonstration'}</span>}</div>{children(event.id)}</>;
}

