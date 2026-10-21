// Competitor Ad Library collector. Run on any facebook.com tab. Saves comp_adlib_<date>.json to Downloads.
// Set globalThis.__KNOWN (array of ad ids that already have thumbnails) before running to skip them.
const P={kfc:"226532888134790",evos:"724281141038118",oqtepa:"663390706861149",dodo:"970998829605608",maxway:"188972370974607",uzum:"114113428222838",bellissimo:"1583758965232483",sariqbola:"1186378094551532",hardees:"343399528859123",safia:"393096854203863"};
const SID=crypto.randomUUID(), MAXADS=150, KNOWN=new Set(globalThis.__KNOWN||[]), DOC="24922295957467452";
function jget(h,key){ const k=h.indexOf(key); if(k<0) return null; let i=h.indexOf('{',k),d=0,s=false,e=false,j=i;
  for(;j<h.length;j++){const c=h[j]; if(s){ if(e) e=false; else if(c==='\\') e=true; else if(c==='"') s=false; continue } if(c==='"') s=true; else if(c==='{') d++; else if(c==='}'){ d--; if(!d) break } }
  return JSON.parse(h.slice(i,j+1)) }
async function th(src){ try{ const bm=await createImageBitmap(await fetch(src).then(r=>r.blob())); const c=document.createElement('canvas'); const sc=180/bm.width; c.width=180; c.height=Math.min(320,Math.round(bm.height*sc)); c.getContext('2d').drawImage(bm,0,0,180,Math.round(bm.height*sc)); return c.toDataURL('image/jpeg',.6) }catch(e){ return '' } }
function row(L){ const a=L[0], sn=a.snapshot||{}, cd=(sn.cards||[])[0]||{}, im=(sn.images||[])[0]||{}, vd=(sn.videos||[])[0]||{};
  return {id:a.ad_archive_id, start:a.start_date, end:a.end_date, n:a.collation_count||L.length||1, fmt:sn.display_format||'', plat:(a.publisher_platform||[]).join('|'),
    cta:sn.cta_text||cd.cta_text||'', link:(sn.link_url||cd.link_url||'').slice(0,200), title:(sn.title||cd.title||'').slice(0,200),
    body:((sn.body&&sn.body.text)||cd.body||'').replace(/\s+/g,' ').slice(0,600), cards:(sn.cards||[]).length,
    src:im.resized_image_url||im.original_image_url||vd.video_preview_image_url||cd.resized_image_url||cd.video_preview_image_url||'', likes:sn.page_like_count, page:sn.page_name} }
async function brand(b,pid){
  const h=await fetch('/ads/library/?active_status=active&ad_type=all&country=UZ&view_all_page_id='+pid+'&search_type=page&media_type=all',{credentials:'include'}).then(r=>r.text());
  const r=jget(h,'"search_results_connection":'); if(!r) return {err:'no data'};
  const dt=(h.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/)||[])[1], lsd=(h.match(/"LSD",\[\],\{"token":"([^"]+)"/)||[])[1], uid=(h.match(/"USER_ID":"(\d+)"/)||[])[1]||'0'; let js=0; for(const c of (dt||'')) js+=c.charCodeAt(0);
  const ads=[]; for(const ed of r.edges||[]) if(ed.node.collated_results?.length) ads.push(row(ed.node.collated_results));
  let cur=r.page_info&&r.page_info.has_next_page?r.page_info.end_cursor:null, pages=0, perr='';
  while(cur && ads.length<MAXADS && pages<6){ pages++;
    const v={activeStatus:"active",adType:"ALL",bylines:[],collationToken:null,contentLanguages:[],countries:["UZ"],cursor:cur,excludedIDs:null,first:30,isTargetedCountry:false,location:null,mediaType:"all",multiCountryFilterMode:null,pageIDs:[],potentialReachInput:null,publisherPlatforms:[],queryString:"",regions:null,searchType:"page",sessionID:SID,sortData:null,source:null,startDate:null,v:"e0570a",viewAllPageID:pid};
    const body=new URLSearchParams({av:uid,__user:uid,__a:'1',__comet_req:'1',fb_dtsg:dt||'',jazoest:'2'+js,lsd:lsd||'',fb_api_caller_class:'RelayModern',fb_api_req_friendly_name:'AdLibrarySearchPaginationQuery',server_timestamps:'true',variables:JSON.stringify(v),doc_id:DOC});
    let t; try{ t=await fetch('/api/graphql/',{method:'POST',credentials:'include',headers:{'content-type':'application/x-www-form-urlencoded','x-fb-lsd':lsd||''},body}).then(r=>r.text()) }catch(e){ perr=String(e); break }
    let j; try{ j=JSON.parse(t.split('\n')[0]) }catch(e){ perr='parse:'+t.slice(0,80); break }
    const c=j?.data?.ad_library_main?.search_results_connection; if(!c){ perr='shape:'+t.slice(0,120); break }
    for(const ed of c.edges||[]) if(ed.node.collated_results?.length) ads.push(row(ed.node.collated_results));
    cur=c.page_info&&c.page_info.has_next_page?c.page_info.end_cursor:null }
  return {total:r.count, ads, pages, perr} }
globalThis.__ST='run';
(async()=>{ try{
const out={date:new Date(Date.now()+5*3600e3).toISOString().slice(0,10), ts:Date.now(), brands:{}};
await Promise.all(Object.entries(P).map(async([b,p])=>{ try{ out.brands[b]=await brand(b,p) }catch(e){ out.brands[b]={err:String(e).slice(0,80)} } }));
let nt=0; const MAXT=globalThis.__MAXT??400; const Q=[];
for(const B of Object.values(out.brands)) for(const a of B.ads||[]){ if(a.src && !KNOWN.has(a.id) && Q.length<MAXT) Q.push(a) }
for(let i=0;i<Q.length;i+=8){ await Promise.all(Q.slice(i,i+8).map(async a=>{ a.thumb=await th(a.src); if(a.thumb) nt++ })); globalThis.__ST='thumbs '+i+'/'+Q.length }
for(const B of Object.values(out.brands)) for(const a of B.ads||[]) delete a.src;
if(!globalThis.__NODL){ globalThis.__DL={url:URL.createObjectURL(new Blob([JSON.stringify(out)],{type:'application/json'})),name:'comp_adlib_'+out.date+'.json'}; globalThis.__save=()=>{ const el=document.createElement('a'); el.href=globalThis.__DL.url; el.download=globalThis.__DL.name; document.body.appendChild(el); el.click(); el.remove(); return 'saved '+globalThis.__DL.name }; globalThis.__save(); }
globalThis.__ST='OK '+Object.entries(out.brands).map(([b,B])=>b+':'+(B.total??'-')+'/'+(B.ads||[]).length+(B.perr?'('+B.perr.slice(0,60)+')':'')+(B.err||'')).join(' ')+' thumbs:'+nt;
}catch(e){ globalThis.__ST='ERR '+e } })();
'started';
