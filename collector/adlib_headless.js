// Ad Library collector in headless Chromium (no login).
// Facebook cuts paging off with "Rate limit exceeded", so instead of paging we ask for the same brand with different
// filters (sort order, media type, platform, language). Each filter gives a different first page; ads are merged by id
// into a store (data/adlib_store.json), so the picture grows run after run. Coverage is measured in ADS (sum of the
// copies behind each creative group) against Meta's own counter.
// Usage: node adlib_headless.js RAW_DIR THUMBS_STORE_JSON
const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path');
const [,,RAW,THUMBS]=process.argv;
const STORE=path.join(path.dirname(RAW),'adlib_store.json');
const TZ=5*3600e3, D=new Date(Date.now()+TZ).toISOString().slice(0,10);
const CARRY_DAYS=3, LIMIT=28*60e3, T0=Date.now();
const P={kfc:"226532888134790",evos:"724281141038118",oqtepa:"663390706861149",dodo:"970998829605608",maxway:"188972370974607",uzum:"114113428222838",bellissimo:"1583758965232483",sariqbola:"1186378094551532",hardees:"343399528859123",safia:"393096854203863"};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const load=(f,d)=>{ try{ return JSON.parse(fs.readFileSync(f,'utf8')) }catch(e){ return d } };
function status(ok,msg){ const p=path.join(RAW,'status_'+D+'.json'); const s=load(p,{}); s.adlib={ok,msg,at:new Date(Date.now()+TZ).toISOString().slice(11,16),by:'server'}; fs.writeFileSync(p,JSON.stringify(s,null,1)); console.log('adlib',ok?'OK':'FAIL',msg) }

// ---- filters: [name, query string]
const MEDIA={all:'media_type=all',image:'media_type=image',video:'media_type=video'};
const ASC='&sort_data[direction]=asc&sort_data[mode]=relevancy_monthly_grouped';
const PL=k=>'&publisher_platforms[0]='+k;
const V=[['base',MEDIA.all],['asc',MEDIA.all+ASC],['video',MEDIA.video],['image',MEDIA.image],['instagram',MEDIA.all+PL('instagram')],['facebook',MEDIA.all+PL('facebook')],
  ['video-asc',MEDIA.video+ASC],['image-asc',MEDIA.image+ASC],['instagram-asc',MEDIA.all+PL('instagram')+ASC],['facebook-asc',MEDIA.all+PL('facebook')+ASC],
  ['ig-video',MEDIA.video+PL('instagram')],['ig-image',MEDIA.image+PL('instagram')],['fb-video',MEDIA.video+PL('facebook')],['fb-image',MEDIA.image+PL('facebook')],
  ['ru',MEDIA.all+'&content_languages[0]=ru'],['uz',MEDIA.all+'&content_languages[0]=uz'],['ru-asc',MEDIA.all+'&content_languages[0]=ru'+ASC],['uz-asc',MEDIA.all+'&content_languages[0]=uz'+ASC]];

function jget(h,key){ const k=h.indexOf(key); if(k<0) return null; let i=h.indexOf('{',k),d=0,s=false,e=false,j=i;
  for(;j<h.length;j++){const c=h[j]; if(s){ if(e) e=false; else if(c==='\\') e=true; else if(c==='"') s=false; continue } if(c==='"') s=true; else if(c==='{') d++; else if(c==='}'){ d--; if(!d) break } }
  try{ return JSON.parse(h.slice(i,j+1)) }catch(e){ return null } }
function row(L){ const a=L[0], sn=a.snapshot||{}, cd=(sn.cards||[])[0]||{}, im=(sn.images||[])[0]||{}, vd=(sn.videos||[])[0]||{};
  return {id:a.ad_archive_id, start:a.start_date, end:a.end_date, n:a.collation_count||L.length||1, fmt:sn.display_format||'', plat:(a.publisher_platform||[]).join('|'),
    cta:sn.cta_text||cd.cta_text||'', link:(sn.link_url||cd.link_url||'').slice(0,200), title:(sn.title||cd.title||'').slice(0,200),
    body:((sn.body&&sn.body.text)||cd.body||'').replace(/\s+/g,' ').slice(0,600), cards:(sn.cards||[]).length,
    src:im.resized_image_url||im.original_image_url||vd.video_preview_image_url||cd.resized_image_url||cd.video_preview_image_url||'', likes:sn.page_like_count, page:sn.page_name} }

(async()=>{ try{
  const store=load(STORE,{});                       // {brand: {id: row + first/last seen}}
  const seen={}, totals={}, tried={}, stale={}, log=[];
  for(const b of Object.keys(P)){ store[b]=store[b]||{}; seen[b]=new Set(); tried[b]=0; stale[b]=0 }
  // a fuller file for today (e.g. a weekly export from Chrome) is merged in, never thrown away
  const old=load(path.join(RAW,'comp_adlib_'+D+'.json'),null);
  if(old) for(const [b,B] of Object.entries(old.brands||{})) for(const a of (B.ads||[])){ if(!store[b]) continue; store[b][a.id]=Object.assign({},store[b][a.id]||{},a,{first:(store[b][a.id]||{}).first||D,last:D}); seen[b].add(a.id) }

  const br=await chromium.launch(); const p=await br.newPage({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',locale:'en-US'});
  const one=async(id,q)=>{
    let doc=''; const on=async r=>{ try{ if(r.request().resourceType()==='document'&&r.url().includes('/ads/library/')){ const x=await r.text(); if(x.includes('search_results_connection')) doc=x } }catch(e){} };
    p.on('response',on);
    await p.goto('https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=UZ&view_all_page_id='+id+'&search_type=page&'+q,{timeout:45000,waitUntil:'domcontentloaded'}).catch(()=>{});
    for(let i=0;i<14&&!doc;i++) await sleep(1000);
    p.off('response',on);
    const r=doc&&jget(doc,'"search_results_connection":'); if(!r) return null;
    return {count:r.count, groups:(r.edges||[]).filter(ed=>ed.node&&ed.node.collated_results&&ed.node.collated_results.length).map(ed=>row(ed.node.collated_results))} };
  const covered=b=>Math.min(totals[b]||0,[...seen[b]].reduce((s,id)=>s+((store[b][id]||{}).n||1),0));
  const done=b=>totals[b]!=null && covered(b)>=totals[b];

  let fails=0, abort=false;
  outer: for(let vi=0;vi<V.length;vi++){
    const order=Object.keys(P).filter(b=>vi===0||(!done(b)&&stale[b]<4)).sort((a,b)=>(covered(a)/(totals[a]||1))-(covered(b)/(totals[b]||1)));
    for(const b of order){
      if(Date.now()-T0>LIMIT){ console.log('time limit'); break outer }
      let r=await one(P[b],V[vi][1]);
      if(!r){ await sleep(30000); r=await one(P[b],V[vi][1]) }
      if(!r){ fails++; log.push(b+' '+V[vi][0]+': no data'); console.log(b,V[vi][0],'NO DATA'); if(fails>=6){ abort=true; break outer } await sleep(60000*Math.min(fails,3)); continue }
      fails=0; tried[b]++;
      if(V[vi][0]==='base') totals[b]=r.count;
      let neu=0; for(const a of r.groups){ const was=store[b][a.id]; if(!seen[b].has(a.id)) neu++;
        store[b][a.id]=Object.assign({},was||{},a,{n:Math.max(a.n||1,(was||{}).n||1),first:(was||{}).first||D,last:D}); seen[b].add(a.id) }
      stale[b]=neu?0:stale[b]+1;
      console.log(b,V[vi][0],'count='+r.count,'groups='+r.groups.length,'new='+neu,'covered='+covered(b)+'/'+totals[b]);
      await sleep(4000);
    } }

  // snapshot = everything seen today + what was seen in the last days and has not ended
  const cut=new Date(Date.now()+TZ-CARRY_DAYS*86400e3).toISOString().slice(0,10), now=Date.now()/1000;
  const known=load(THUMBS,{}); const out={date:D, ts:Date.now(), source:'server', brands:{}};
  let withData=0, Q=[];
  for(const b of Object.keys(P)){
    const ads=Object.values(store[b]).filter(a=>seen[b].has(a.id)||(a.last>=cut&&!(a.end&&a.end<now)));
    for(const id of Object.keys(store[b])) if(!seen[b].has(id)&&store[b][id].last<cut) delete store[b][id];   // not seen for days: gone
    if(!tried[b]&&!ads.length){ out.brands[b]={err:'no data'}; continue }
    if(tried[b]) withData++;
    const cov=Math.min(totals[b]||0,ads.reduce((s,a)=>s+(a.n||1),0));
    out.brands[b]={total:totals[b]??null, ads:ads.map(a=>Object.assign({},a)), covered:cov, carried:ads.filter(a=>!seen[b].has(a.id)).length, variants:tried[b], pages:tried[b], complete:totals[b]!=null&&cov>=totals[b]};
    for(const a of out.brands[b].ads) if(a.src&&!known[a.id]&&Q.length<400) Q.push(a);
  }
  if(withData<7){ status(false,'Facebook не отдал страницы: '+withData+' из 10'+(abort?' (лимит запросов)':'')); fs.writeFileSync(STORE,JSON.stringify(store)); await br.close(); process.exit(0) }

  // thumbnails for creatives that do not have one yet (made inside the page: fbcdn images are not reachable from outside)
  try{
    await p.goto('https://www.facebook.com/ads/library/',{timeout:45000,waitUntil:'domcontentloaded'}).catch(()=>{});
    for(let i=0;i<Q.length;i+=8){
      const res=await p.evaluate(async srcs=>Promise.all(srcs.map(async src=>{ try{ const bm=await createImageBitmap(await fetch(src).then(r=>r.blob())); const c=document.createElement('canvas'); const sc=180/bm.width; c.width=180; c.height=Math.min(320,Math.round(bm.height*sc)); c.getContext('2d').drawImage(bm,0,0,180,Math.round(bm.height*sc)); return c.toDataURL('image/jpeg',.6) }catch(e){ return '' } })), Q.slice(i,i+8).map(a=>a.src));
      Q.slice(i,i+8).forEach((a,j)=>{ if(res[j]) a.thumb=res[j] }) }
  }catch(e){ console.log('thumbs failed',String(e).slice(0,80)) }
  for(const B of Object.values(out.brands)) for(const a of B.ads||[]) delete a.src;
  for(const b of Object.keys(store)) for(const a of Object.values(store[b])) delete a.src;

  fs.writeFileSync(STORE,JSON.stringify(store));
  fs.writeFileSync(path.join(RAW,'comp_adlib_'+D+'.json'),JSON.stringify(out));
  status(true, Object.entries(out.brands).map(([b,B])=>b+':'+(B.total??'-')+'/'+(B.covered??0)).join(' ')+(abort?' (остановлено: лимит запросов)':''));
  await br.close(); process.exit(0)
}catch(e){ status(false,String(e).slice(0,200)); process.exit(0) } })();
