// Ad Library collector in headless Chromium (no login). Usage: node adlib_headless.js collect.js RAW_DIR STORE_JSON
// Gets total active ads + first pages of creatives per brand. Never overwrites a fuller file for the same day (e.g. weekly Chrome export).
const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path');
const [,,COLLECT,RAW,STORE]=process.argv;
const D=new Date(Date.now()+5*3600e3).toISOString().slice(0,10);
const P={kfc:"226532888134790",evos:"724281141038118",oqtepa:"663390706861149",dodo:"970998829605608",maxway:"188972370974607",uzum:"114113428222838",bellissimo:"1583758965232483",sariqbola:"1186378094551532",hardees:"343399528859123",safia:"393096854203863"};
function status(ok,msg){ const p=path.join(RAW,'status_'+D+'.json'); let s={}; try{s=JSON.parse(fs.readFileSync(p,'utf8'))}catch(e){} s.adlib={ok,msg,at:new Date(Date.now()+5*3600e3).toISOString().slice(11,16),by:'server'}; fs.writeFileSync(p,JSON.stringify(s,null,1)); console.log('adlib',ok?'OK':'FAIL',msg) }
(async()=>{ try{
  let src=fs.readFileSync(COLLECT,'utf8').replace('if(!globalThis.__NODL){','globalThis.__OUT=out; if(!globalThis.__NODL){');
  src=src.replace(/await Promise\.all\(Object\.entries\(P\)\.map\(async\(\[b,p\]\)=>\{ try\{ out\.brands\[b\]=await brand\(b,p\) \}catch\(e\)\{ out\.brands\[b\]=\{err:String\(e\)\.slice\(0,80\)\} \} \}\)\);/,
    'for(const [b,p] of Object.entries(P)){ try{ out.brands[b]=await brand(b,p) }catch(e){ out.brands[b]={err:String(e).slice(0,80)} } await new Promise(r=>setTimeout(r,3000)) }');
  if(src.includes('Promise.all(Object.entries(P)')) throw new Error('seq patch failed');
  src=src.replace("pages<6","pages<2");
  src=src.replace("cur=c.page_info&&c.page_info.has_next_page?c.page_info.end_cursor:null }","cur=c.page_info&&c.page_info.has_next_page?c.page_info.end_cursor:null; await new Promise(r=>setTimeout(r,15000)) }");
  src=src.replace("let t; try{ t=await fetch('/api/graphql/',", "let t; if(Date.now()>globalThis.__DEADLINE){ perr='time'; break } try{ t=await fetch('/api/graphql/',");
  src=src.replace(/const h=await fetch\('\/ads\/library\/[^;]*;/, 'const h=globalThis.__HTML[b]||"";');
  if(!src.includes('globalThis.__HTML[b]')) throw new Error('patch failed');
  let known=[]; try{ known=Object.keys(JSON.parse(fs.readFileSync(STORE,'utf8'))) }catch(e){}
  const br=await chromium.launch(); const p=await br.newPage({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',locale:'en-US'});
  const H={}; let got=0;
  for(const [k,id] of Object.entries(P)){
    for(let t=0;t<3 && !(H[k]||'').includes('search_results_connection');t++){
      let doc=''; const on=async r=>{ try{ if(r.request().resourceType()==='document'&&r.url().includes('/ads/library/')){ const x=await r.text(); if(x.includes('search_results_connection')) doc=x } }catch(e){} };
      p.on('response',on);
      await p.goto('https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=UZ&view_all_page_id='+id+'&search_type=page&media_type=all',{timeout:60000}).catch(()=>{});
      await p.waitForTimeout(5000+3000*t); p.off('response',on); H[k]=doc||'' }
    if(H[k].includes('search_results_connection')) got++; console.log(k, H[k].includes('search_results_connection'));
  }
  if(got<7){ status(false,'Facebook не отдал страницы: '+got+' из 10'); await br.close(); process.exit(0) }
  await p.evaluate(([s,h,kn])=>{ globalThis.__HTML=h; globalThis.__KNOWN=kn; globalThis.__NODL=true; globalThis.__DEADLINE=Date.now()+8*60*1000; (0,eval)(s) }, [src,H,known]);
  let st=''; for(let i=0;i<200;i++){ await p.waitForTimeout(5000); st=await p.evaluate(()=>globalThis.__ST); if(/^(OK|ERR)/.test(st)) break }
  if(!st.startsWith('OK')){ status(false,st); await br.close(); process.exit(0) }
  const out=JSON.parse(await p.evaluate(()=>JSON.stringify(globalThis.__OUT))); out.source='server';
  const f=path.join(RAW,'comp_adlib_'+D+'.json'); const n=o=>Object.values(o.brands||{}).reduce((a,b)=>a+((b.ads||[]).length),0);
  let old=null; try{ old=JSON.parse(fs.readFileSync(f,'utf8')) }catch(e){}
  if(old && n(old)>=n(out)) status(true,'уже есть более полный файл за сегодня ('+n(old)+' объявл.)');
  else { fs.writeFileSync(f,JSON.stringify(out)); status(true, Object.entries(out.brands).map(([b,B])=>b+':'+(B.total??'-')+'/'+(B.ads||[]).length).join(' ')) }
  await br.close(); process.exit(0)
}catch(e){ status(false,String(e).slice(0,200)); process.exit(0) } })();
