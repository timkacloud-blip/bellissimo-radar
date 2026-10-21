"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=n=>n==null||!isFinite(n)?"—":Math.round(n).toLocaleString("ru-RU");
const kfmt=n=>n==null?"—":n>=1e6?(n/1e6).toFixed(n>=1e7?0:1)+" млн":n>=1e4?Math.round(n/1e3)+" тыс":fmt(n);
const plural=(n,a,b,c)=>{ n=Math.abs(n)%100; const m=n%10; return n>10&&n<20?c:m===1?a:m>=2&&m<=4?b:c };
const ls={get(k,d){try{return localStorage.getItem(k)??d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const S={tab:"boss",lang:"all",brands:new Set(),goal:"",tag:"",fmt:"",sort:"new",q:"",hire:false,raw:false,nw:false,limit:24,prc:"",tgb:"",jr:{per:"30",b:"",t:"",hi:false,own:true}};
let D=null, TH={}, thumbsLoaded=false, J={events:[],coverage:{}}, MN=null, MNP=null;
const LIM={}, TS={};   // "show more" limits and table sort state, by table id

async function load(u,tries=4){ for(let i=0;i<tries;i++){ try{ const r=await fetch(u,{cache:"no-cache"}); if(r.ok) return await r.json() }catch(e){} await new Promise(r=>setTimeout(r,600*(i+1))) } throw new Error("Не удалось загрузить "+u) }
const EXTRA_B={papajohns:{name:"Papa Johns",color:"#c2410c"},dominos:{name:"Domino's",color:"#2b6cb0"},apex:{name:"APEX",color:"#8d8d8d"}};
const B=b=>(D&&D.brands[b])||EXTRA_B[b]||{name:b,color:"#888"};
const dot=b=>`<i class="bdot" style="background:${B(b).color}"></i>`;
const bname=b=>dot(b)+esc(B(b).name);
const ORDER=["bellissimo","kfc","evos","oqtepa","dodo","maxway","sariqbola","hardees","safia","uzum","yandex"];
const IOS_IDS={"1507547994":"bellissimo","6733229176":"kfc","1595897228":"evos","6744400909":"oqtepa","894649641":"dodo","1565502018":"maxway","1665523197":"uzum","1078986931":"yandex","6471396712":"sariqbola","6754248343":"hardees","1554545839":"safia"};
const WORLD=["dodo","yandex"];

// ---------- dates: everything is measured from the date of the data, not from the viewer's clock ----------
const dDiff=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5);
const REF=()=>D.info.date;
const within=(d,n)=>!!d&&dDiff(d,REF())<n;
const dfmt=x=>x?x.slice(8,10)+"."+x.slice(5,7):"—";
function pickBase(ds){ const now=ds[ds.length-1], wk=[...ds].reverse().find(d=>dDiff(d,now)>=7)||ds[0]; return {now,wk,span:dDiff(wk,now)} }
const spanTxt=b=>b.span>=7?`${dfmt(b.wk)}→${dfmt(b.now)}`:`${dfmt(b.wk)}→${dfmt(b.now)} <span class="cw" data-tip="Снимка недельной давности ещё нет, сравниваем с самым ранним: прошло ${b.span} ${plural(b.span,"день","дня","дней")}">⚠ ${b.span} дн.</span>`;
const tashkent=ms=>{ const d=new Date(ms+5*36e5).toISOString(); return d.slice(8,10)+"."+d.slice(5,7)+" "+d.slice(11,16) };
const builtMs=()=>D&&D.info&&D.info.built?Date.parse(D.info.built.replace(" ","T")+"Z"):null;

// ---------- language, messages, counts ----------
// ads without text ("—") have no language, so they stay visible under any language filter
const inLang=a=>S.lang==="all"||a.lang===S.lang||a.lang==="—";
const active=()=>D.ads.filter(a=>a.active&&inLang(a));
const txtKey=a=>(a.body||a.title||"").slice(0,80);
function dedupe(A,imgGroup){ const m=new Map(); A.forEach(a=>{ const t=txtKey(a), k=a.b+"|"+(t||(imgGroup?"img|"+(a.start||"")+"|"+(a.fmt||""):a.id)); const x=m.get(k);
  if(x){ x.sim++; x.ntot+=(a.n||1); const dmax=Math.max(x.days||0,a.days||0), smin=[x.start,a.start].filter(Boolean).sort()[0]; if(!TH[x.id]&&TH[a.id]) Object.assign(x,a,{sim:x.sim,ntot:x.ntot}); x.days=dmax; if(smin) x.start=smin }
  else m.set(k,Object.assign({},a,{sim:0,ntot:a.n||1})) }); return [...m.values()] }
const msgs=(b,A)=>dedupe(A.filter(a=>a.b===b)).length;
function objCount(b){ // Meta's own counter for "all languages"; with a language filter, an estimate from what we collected
  if(S.lang==="all"){ const v=((D.daily[REF()]||{})[b]||{}).total; return {v:v==null?null:v,est:false} }
  const s=D.ads.filter(a=>a.active&&a.b===b&&inLang(a)).reduce((t,a)=>t+(a.n||1),0); return {v:s,est:true} }
const ofmt=o=>o.v==null?"—":(o.est?"≈":"")+fmt(o.v);

// ---------- generic table: sortable by click, "show more" ----------
function table(id,cols,rows,o={}){
  const st=TS[id];
  if(st) rows=rows.slice().sort((x,y)=>{ const a=x.s[st.c], b=y.s[st.c]; if(a==null&&b==null) return 0; if(a==null) return 1; if(b==null) return -1;
    return st.d*(typeof a==="number"&&typeof b==="number"?a-b:String(a).localeCompare(String(b),"ru")) });
  const lim=o.limit?(LIM[id]||o.limit):1e9;
  const cl=c=>[c.l?"l":"",c.w?"w":""].filter(Boolean).join(" ");
  const th=cols.map((c,i)=>`<th data-tc="${i}" class="${cl(c)}${st&&st.c===i?(st.d>0?" sa":" sd"):""}"${c.tip?` data-tip="${esc(c.tip)}"`:""}>${c.h}</th>`).join("");
  const tb=rows.slice(0,lim).map(r=>`<tr${r.cls?` class="${r.cls}"`:""}${r.st?` style="${r.st}"`:""}>${r.c.map((c,i)=>`<td class="${cl(cols[i])}">${c}</td>`).join("")}</tr>`).join("");
  return `<table class="${o.cls||""}" data-tid="${id}" data-num="${rows.length&&rows[0].s?rows[0].s.map(v=>typeof v==="number"?1:0).join(""):""}"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`+
    (rows.length>lim?`<div class="more"><button class="btn ghost" data-more="${id}" data-step="${o.limit}">Показать ещё ${Math.min(o.limit,rows.length-lim)} из ${rows.length-lim}</button></div>`:"");
}
document.addEventListener("click",e=>{
  const th=e.target.closest("th[data-tc]");
  if(th){ const t=th.closest("table"), id=t.dataset.tid, c=+th.dataset.tc, num=(t.dataset.num||"")[c]==="1", st=TS[id];
    TS[id]=st&&st.c===c?{c,d:-st.d}:{c,d:num?-1:1}; rerender(); return }
  const m=e.target.closest("[data-more]"); if(m){ const id=m.dataset.more; LIM[id]=(LIM[id]||+m.dataset.step)+(+m.dataset.step); rerender(); return }
  const g=e.target.closest("[data-go]"); if(g){ show(g.dataset.go); window.scrollTo({top:0}); return }
  if(e.target.closest("#retry")){ location.reload(); return }
  const tm=e.target.closest(".ad .txm"); if(tm){ const tx=tm.parentElement.querySelector(".tx"); const o=tx.classList.toggle("open"); tm.textContent=o?"Свернуть ▴":"Весь текст ▾"; tx.setAttribute("aria-expanded",o); return }
  const t=e.target.closest(".ad .tx"); if(t){ const o=t.classList.toggle("open"); t.setAttribute("aria-expanded",o); const b=t.parentElement.querySelector(".txm"); if(b) b.textContent=o?"Свернуть ▴":"Весь текст ▾" }
});
document.addEventListener("keydown",e=>{ if((e.key==="Enter"||e.key===" ")&&e.target.matches(".ad .tx,th[data-tc]")){ e.preventDefault(); e.target.click() } });

function rise(root){ if(matchMedia("(prefers-reduced-motion: reduce)").matches) return; [...root.children].forEach((el,i)=>{ el.classList.remove("rise"); void el.offsetWidth; el.style.animationDelay=(i*45)+"ms"; el.classList.add("rise") }) }

// ---------- ad card ----------
function adCard(a){
  const t=TH[a.id], n=a.start&&dDiff(a.start,REF())<7;
  const txt=a.body||a.title||(a.catalog?"Каталожная реклама (товары из фида)":"Без текста — только картинка или видео");
  return `<article class="ad${n?" new":""}">
    <div class="im">${t?`<img loading="lazy" src="${t}" alt="Креатив ${esc(B(a.b).name)}">`:`<div class="ph">${thumbsLoaded?"нет превью":"загружаю превью…"}</div>`}
      <div class="bt"><span class="pill">${esc(B(a.b).name)}</span>${n?'<span class="pill">новое</span>':""}${a.fmt?`<span class="pill">${a.fmt==="DCO"?"DCO":a.fmt==="VIDEO"?"видео":"фото"}</span>`:""}</div></div>
    <div class="bd">
      <div class="tags">${a.offer&&a.offer!=="Без оффера"&&a.offer!=="Найм"?`<span class="pill p-good">${esc(a.offer)}</span>`:""}<span class="pill p-acc">${esc(a.goal)}</span>${a.tags.filter(x=>x!=="Цена"&&x!==a.offer).slice(0,2).map(x=>`<span class="pill p-mute">${esc(x)}</span>`).join("")}</div>
      <div class="tx" tabindex="0" role="button" aria-expanded="false">${esc(txt)}</div>${txt.length>150?'<button class="txm">Весь текст ▾</button>':""}
      <div class="meta"><span>с ${dfmt(a.start)} · ${a.days??"?"} ${plural(a.days||0,"день","дня","дней")}</span><span>${a.ntot>1?a.ntot+" "+plural(a.ntot,"объявление","объявления","объявлений"):"1 объявление"} · ${esc(a.lang)}</span></div>
      <div class="meta"><span>${a.prices.length?a.prices.map(p=>fmt(p)).join(" / ")+" сум":""}</span><a href="https://www.facebook.com/ads/library/?id=${a.id}" target="_blank" rel="noopener">в Ad Library ↗</a></div>
    </div></article>`;
}

// ---------- Реклама (overview + gallery) ----------
const LV={bad:"p-bad",warn:"p-warn",good:"p-good",acc:"p-acc",mute:"p-mute"}, LT={bad:"угроза",warn:"присмотреться",good:"в нашу пользу",acc:"новое",mute:"факт"};
function syncLang(){ $$(".seg.lang button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===S.lang)) }
function renderAds(){
  syncLang();
  const A=active(), L=REF(), ios=((D.apps[Object.keys(D.apps).sort().pop()]||{}).ios)||{}, bs=ORDER.filter(b=>D.brands[b]&&((D.daily[L]||{})[b]||D.ads.some(a=>a.b===b)));
  const nol=D.ads.filter(a=>a.active&&a.lang==="—").length;
  $("#lang-n").textContent=S.lang==="all"?"":`объявления без текста (${nol}) показываются при любом языке; число объявлений — оценка ≈`;
  // tiles
  $("#ov-tiles").innerHTML=bs.map(b=>{ const x=A.filter(a=>a.b===b), o=objCount(b), m=dedupe(x).length, n7=dedupe(x.filter(a=>a.start&&dDiff(a.start,L)<7)).length, ch=ios[b]&&ios[b][3], own=B(b).own;
    return `<div class="tile${own?" st-good":""}"><div class="k">${bname(b)}</div><div class="v">${ofmt(o)}${own?'<span class="note" data-tip="Вся страница бренда: франшиза, найм, филиалы"> *</span>':""}</div>
      <div class="d"><span>${plural(o.v||0,"объявление","объявления","объявлений")} · ${m} ${plural(m,"сообщение","сообщения","сообщений")}</span>${n7?`<span class="pill p-acc">+${n7} ${plural(n7,"новое","новых","новых")} за 7 дн</span>`:""}</div>
      <div class="d">${ch?`App Store #${ch}`:""}${D.tg[b]&&D.tg[b].subs?`${ch?" · ":""}TG ${kfmt(D.tg[b].subs)}`:""}</div></div>` }).join("");
  // insights
  const I=D.insights.filter(i=>!(i.b&&B(i.b).own&&i.lvl==="mute"));
  $("#ov-ins").innerHTML=I.slice(0,LIM["ov-ins"]||8).map(i=>`<div class="srow"><span class="pill ${LV[i.lvl]}">${LT[i.lvl]}</span><div><div class="t">${i.b?dot(i.b):""}<b>${esc(i.t)}</b></div><div class="m">${esc(i.m)}</div></div></div>`).join("")||'<div class="empty">Пока нечего сказать</div>';
  if(I.length>(LIM["ov-ins"]||8)) $("#ov-ins").insertAdjacentHTML("beforeend",`<div class="more"><button class="btn ghost" data-more="ov-ins" data-step="8">Показать ещё ${I.length-(LIM["ov-ins"]||8)}</button></div>`);
  // share of ads
  const oc=Object.fromEntries(bs.map(b=>[b,objCount(b)])), tot=bs.reduce((s,b)=>s+(oc[b].v||0),0), mx=Math.max(1,...bs.map(b=>oc[b].v||0));
  $("#ov-sov-sub").textContent=S.lang==="all"?`активные объявления Meta на ${dfmt(L)}`:`≈ по собранным объявлениям, язык ${S.lang}`;
  $("#ov-sov").innerHTML=bs.filter(b=>oc[b].v).sort((x,y)=>oc[y].v-oc[x].v).map(b=>{ const m=msgs(b,A); return `<div class="brow"><span>${bname(b)}</span><div class="bbar"><i class="grow" data-tip="${esc(B(b).name)}: ${ofmt(oc[b])} объявл., ${m} сообщ." style="width:${100*oc[b].v/mx}%;background:${B(b).color}"></i></div><span class="num">${Math.round(100*oc[b].v/Math.max(1,tot))}% · ${ofmt(oc[b])}</span></div>` }).join("");
  // ads by day: a slot for every calendar day, empty slots where there was no snapshot
  const ks=Object.keys(D.daily).sort(), days=[]; if(ks.length){ let d=new Date(ks[0]); const end=new Date(ks[ks.length-1]); while(d<=end){ days.push(d.toISOString().slice(0,10)); d=new Date(+d+864e5) } }
  const dd=days.slice(-30), sum=d=>ORDER.reduce((s,b)=>s+(((D.daily[d]||{})[b]||{}).total||0),0), mxd=Math.max(1,...dd.map(sum));
  const W=640,H=200,bw=W/Math.max(dd.length,7);
  let svg=`<svg class="cad" viewBox="0 0 ${W} ${H+22}" role="img" aria-label="Активные объявления по дням">`;
  dd.forEach((d,i)=>{ const x=i*bw+5, w=bw-10, lab=`<text x="${i*bw+bw/2}" y="${H+15}" text-anchor="middle">${dfmt(d)}</text>`;
    if(!D.daily[d]){ svg+=`<rect class="gap" x="${x}" y="14" width="${w}" height="${H-14}" rx="3" data-tip="${dfmt(d)}: снимка не было"></rect>${lab}`; return }
    let y=H; ORDER.forEach(b=>{ const v=((D.daily[d][b]||{}).total)||0; if(!v) return; const h=v/mxd*(H-14); y-=h; svg+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${B(b).color}" data-tip="${esc(B(b).name)}: ${v} объявл. (${dfmt(d)})"></rect>` });
    svg+=`<text x="${i*bw+bw/2}" y="${y-3}" text-anchor="middle">${sum(d)}</text>${lab}` });
  $("#ov-cad").innerHTML=svg+"</svg>";
  $("#ov-cad-leg").innerHTML=ORDER.filter(b=>(D.daily[L]||{})[b]).map(b=>`<span><i style="background:${B(b).color}"></i>${esc(B(b).name)}</span>`).join("");
  // goals
  const AU=dedupe(A), G={}; AU.forEach(a=>{ (G[a.goal]=G[a.goal]||{}); G[a.goal][a.b]=(G[a.goal][a.b]||0)+1 });
  const gt=g=>Object.values(G[g]).reduce((s,v)=>s+v,0), goals=Object.keys(G), gm=Math.max(1,...goals.map(gt));
  $("#ov-goal").innerHTML=goals.sort((x,y)=>gt(y)-gt(x)).map(g=>`<div class="brow"><span>${esc(g)}</span><div class="bbar">${ORDER.filter(b=>G[g][b]).map(b=>`<i data-tip="${esc(B(b).name)}: ${G[g][b]} ${plural(G[g][b],"сообщение","сообщения","сообщений")}" style="width:${100*G[g][b]/gm}%;background:${B(b).color}"></i>`).join("")}</div><span class="num">${gt(g)}</span></div>`).join("");
  renderGallery(A);
  // long-lived
  const LG=dedupe(A.filter(a=>(a.days||0)>=30&&a.goal!=="Найм"),true).sort((x,y)=>y.days-x.days);
  $("#ads-long").innerHTML=LG.length?table("ads-long",[{h:"Креатив",l:1},{h:"Бренд",l:1},{h:"Дней"},{h:"Объявл."},{h:"Цель",l:1},{h:"Текст",l:1,w:1},{h:""}],
    LG.map(a=>({s:[null,B(a.b).name,a.days,a.ntot,a.goal,txtKey(a),null],c:[TH[a.id]?`<img class="lthumb" src="${TH[a.id]}" alt="" loading="lazy">`:'<div class="lthumb"></div>',bname(a.b),`<b>${a.days}</b>`,a.ntot,esc(a.goal),
      esc((a.body||a.title||"без текста — только картинка").split(/-{3,}|—{3,}|_{3,}/)[0].slice(0,180)),`<a class="lnk" href="https://www.facebook.com/ads/library/?id=${a.id}" target="_blank" rel="noopener">открыть ↗</a>`]})),{limit:10}):'<div class="empty">Нет объявлений старше 30 дней</div>';
}
function fillSelect(el,label,vals,cur){ el.innerHTML=`<option value="">${label}</option>`+vals.map(v=>`<option${v===cur?" selected":""}>${esc(v)}</option>`).join("") }
function renderGallery(A0){
  const base=A0.filter(a=>S.hire||S.goal==="Найм"||a.goal!=="Найм");
  $("#f-brand").innerHTML=ORDER.filter(b=>A0.some(a=>a.b===b)).map(b=>`<button class="chip" data-b="${b}" aria-pressed="${S.brands.has(b)}">${bname(b)} <span class="cnt">${msgs(b,base)}</span></button>`).join("");
  fillSelect($("#f-goal"),"Любая цель",[...new Set(A0.map(a=>a.goal))].sort(),S.goal);
  fillSelect($("#f-tag"),"Любая механика",[...new Set(A0.flatMap(a=>a.tags))].filter(t=>t!=="Цена").sort(),S.tag);
  $("#f-fmt").value=S.fmt; $("#f-sort").value=S.sort; $("#f-hire").checked=S.hire; $("#f-raw").checked=S.raw; $("#f-new").checked=S.nw; if($("#f-q").value!==S.q) $("#f-q").value=S.q;
  const q=S.q.trim().toLowerCase();
  let A=base.filter(a=>(!S.brands.size||S.brands.has(a.b))&&(!S.goal||a.goal===S.goal)&&(!S.tag||a.tags.includes(S.tag))&&(!S.fmt||a.fmt===S.fmt)&&(!S.nw||(a.start&&dDiff(a.start,REF())<7))&&(!q||((a.body||"")+" "+(a.title||"")+" "+(a.link||"")).toLowerCase().includes(q)));
  const so={new:(x,y)=>(y.start||"").localeCompare(x.start||""),long:(x,y)=>(y.days||0)-(x.days||0),ver:(x,y)=>(y.ntot||y.n)-(x.ntot||x.n)}[S.sort];
  A=S.raw?A.map(a=>Object.assign({},a,{sim:0,ntot:a.n||1})):dedupe(A); A.sort(so);
  const sel=S.brands.size?[...S.brands]:ORDER.filter(b=>D.brands[b]);
  const got=D.ads.filter(a=>a.active&&sel.includes(a.b)).reduce((s,a)=>s+(a.n||1),0), meta=sel.reduce((s,b)=>s+(((D.daily[REF()]||{})[b]||{}).total||0),0);
  $("#ads-sub").innerHTML=`${A.length} ${S.raw?plural(A.length,"объявление","объявления","объявлений"):plural(A.length,"сообщение","сообщения","сообщений")}${S.hire?"":" · найм скрыт"}`+
    (meta>got?` · <span data-tip="Ad Library отдаёт не все объявления крупных брендов. Число объявлений — из счётчика Meta, тексты и картинки — из того, что удалось собрать.">собрано ${fmt(got)} из ${fmt(meta)} объявлений Meta ⓘ</span>`:"");
  $("#ads-gal").innerHTML=A.slice(0,S.limit).map(adCard).join("")||'<div class="empty">Ничего не найдено — ослабьте фильтры или нажмите «Сбросить фильтры»</div>';
  $("#ads-more").hidden=A.length<=S.limit; $("#ads-more").textContent=`Показать ещё (${Math.max(0,A.length-S.limit)})`;
  $("#f-reset").hidden=!(S.brands.size||S.goal||S.tag||S.fmt||S.q||S.hire||S.raw||S.nw||S.sort!=="new");
}

// ---------- Офферы и цены ----------
function renderOff(){
  syncLang();
  const A=dedupe(active().filter(a=>a.goal!=="Найм")), brands=ORDER.filter(b=>A.some(a=>a.b===b));
  const tags=[...new Set(A.map(a=>a.offer))].filter(t=>t!=="Цена").sort((x,y)=>(x==="Без оффера"||x==="Каталог товаров"||x==="Только видео/картинка")-(y==="Без оффера"||y==="Каталог товаров"||y==="Только видео/картинка")||x.localeCompare(y));
  const cnt=(b,t)=>A.filter(a=>a.b===b&&a.offer===t).length, mx=Math.max(1,...brands.flatMap(b=>tags.map(t=>cnt(b,t))));
  $("#off-mx").innerHTML=table("off-mx",[{h:"Бренд",l:1},...tags.map(t=>({h:esc(t)})),{h:"Всего"}],brands.map(b=>{ const v=tags.map(t=>cnt(b,t)), tot=A.filter(a=>a.b===b).length;
    return {s:[B(b).name,...v,tot],c:[bname(b),...v.map(x=>x?`<span class="mcell" style="background:color-mix(in srgb,${B(b).color} ${15+70*x/mx}%,transparent);color:${x/mx>.5?"#fff":"var(--fg)"}">${x}</span>`:'<span class="note">·</span>'),`<b>${tot}</b>`]} }),{cls:"matrix"});
  // prices by category
  const PR=[], seen=new Set();
  A.slice().sort((x,y)=>(y.start||"").localeCompare(x.start||"")).forEach(a=>(a.pitems||a.prices.map(p=>({p,c:"Другое",t:""}))).forEach(x=>{ const k=a.b+"|"+x.p+"|"+x.c; if(seen.has(k)) return; seen.add(k); PR.push({b:a.b,a,...x}) }));
  const cats=[...new Set(PR.map(x=>x.c))].sort((x,y)=>(x==="Другое")-(y==="Другое")||x.localeCompare(y,"ru"));
  fillSelect($("#pr-cat"),"Все категории",cats,S.prc); if(S.prc&&!cats.includes(S.prc)) S.prc="";
  const P=PR.filter(x=>!S.prc||x.c===S.prc).sort((x,y)=>cats.indexOf(x.c)-cats.indexOf(y.c)||x.p-y.p);
  $("#off-pr").innerHTML=P.length?table("off-pr",[{h:"Категория",l:1},{h:"Бренд",l:1},{h:"Цена, сум"},{h:"Что в тексте",l:1,w:1},{h:"Старт"}],
    P.map(x=>({s:[x.c,B(x.b).name,x.p,x.t,x.a.start],cls:B(x.b).own?"me":"",c:[esc(x.c),bname(x.b),`<b>${fmt(x.p)}</b>`,esc(x.t||(x.a.body||x.a.title||"").slice(0,110)),dfmt(x.a.start)]})),{limit:15}):'<div class="empty">Цен не найдено</div>';
  // promo codes: counted in messages, not in copies
  const C={}; const add=(c,b,k,src)=>{ const x=C[c]=C[c]||{b,m:new Set(),src:new Set()}; x.m.add(k); x.src.add(src) };
  A.forEach(a=>a.codes.forEach(c=>add(c,a.b,txtKey(a)||a.id,"Meta")));
  (D.tg_posts||[]).forEach(p=>(p.codes||(p.txt||"").match(/\b[A-Z]{3,}\d{2,}\b/g)||[]).forEach(c=>add(c,p.b,p.id,"Telegram")));
  const cs=Object.entries(C);
  $("#off-codes").innerHTML=cs.length?table("off-codes",[{h:"Код",l:1},{h:"Бренд",l:1},{h:"Где",l:1},{h:"Сообщений",tip:"В скольких разных сообщениях встречается код (копии одного объявления считаются один раз)"}],
    cs.sort((x,y)=>y[1].m.size-x[1].m.size).map(([c,x])=>({s:[c,B(x.b).name,[...x.src].join(", "),x.m.size],c:[`<b>${esc(c)}</b>`,bname(x.b),[...x.src].join(", "),x.m.size]})),{limit:10}):'<div class="empty">Промокодов не найдено</div>';
  const U=A.filter(a=>a.body).sort((x,y)=>(y.start||"").localeCompare(x.start||""));
  $("#off-list").innerHTML=table("off-list",[{h:"Старт"},{h:"Бренд",l:1},{h:"Механики",l:1,w:1},{h:"Текст",l:1,w:1}],
    U.map(a=>({s:[a.start,B(a.b).name,a.offer,a.body],c:[dfmt(a.start),bname(a.b),a.tags.filter(t=>t!=="Цена").map(t=>`<span class="pill p-mute">${esc(t)}</span>`).join(" "),esc(a.body.slice(0,240))]})),{limit:15});
}

// ---------- Приложения ----------
function renderApp(){
  const ds=Object.keys(D.apps).sort(), b0=pickBase(ds), a=D.apps[b0.now]||{}, P=b0.span>0?D.apps[b0.wk]:null;
  const ios=a.ios||{}, pio=(P&&P.ios)||{};
  $("#app-ios-sub").innerHTML=`изменения за ${spanTxt(b0)}`;
  // place arrows coloured from our side: we go up — green, a competitor goes up — red
  const mv=(b,now,was)=>{ if(!now||!was||now===was) return ""; const up=was-now, good=B(b).own?up>0:up<0; return ` <span class="${good?"up":"dn"}">${up>0?"↑":"↓"}${Math.abs(up)}</span>` };
  $("#app-ios").innerHTML=table("app-ios",[{h:"Приложение",l:1},{h:"Место"},{h:"Оценок"},{h:"+ за период"},{h:"Средняя"},{h:"Доля 1★",tip:"Какая часть всех оценок — одна звезда"},{h:"Версия"}],
    ORDER.filter(b=>ios[b]).map(b=>{ const v=ios[b], h=v[2]?String(v[2]).split(",").map(Number):[], tot=h.reduce((s,x)=>s+(x||0),0)||0, one=tot?100*(h[4]||0)/tot:null, pl=v[3]?+v[3]:null, plo=pio[b]&&pio[b][3]?+pio[b][3]:null, gr=pio[b]&&v[0]!=null&&pio[b][0]!=null?v[0]-pio[b][0]:null;
      return {cls:B(b).own?"me":"",s:[B(b).name,pl,v[0]??null,gr,v[1]?+v[1]:null,one,v[4]||""],c:[bname(b),pl?`<b>#${pl}</b>${mv(b,pl,plo)}`:"—",v[0]==null?'<span class="note" data-tip="Страница приложения не загрузилась при сборе">нет данных</span>':fmt(v[0]),gr==null?"—":gr?(gr>0?"+":"−")+fmt(Math.abs(gr)):"0",v[1]?(+v[1]).toFixed(1):"—",one==null?"—":one.toFixed(0)+"%",esc(v[4]||"—")]} }).sort((x,y)=>(x.s[1]||999)-(y.s[1]||999)));
  $("#app-ch-sub").textContent="на "+dfmt(b0.now);
  const ch=a.ios_chart||[], ids=a.ios_chart_ids||[];
  $("#app-chart").innerHTML=ch.map((n,i)=>{ const b=IOS_IDS[ids[i]], mn=!b&&/papa|apex|domino/i.test(n); return `<span class="n">${i+1}</span><span class="${b?"hl":mn?"rk-mn":""}">${b?dot(b):""}${b==="bellissimo"?"★ ":""}${esc(n)}</span>` }).join("");
  const pl=a.play||{}, ppl=(P&&P.play)||{};
  $("#app-play-sub").innerHTML=`рейтинг, отзывы, установки · изменения за ${spanTxt(b0)}`;
  $("#app-play").innerHTML=table("app-play",[{h:"Приложение",l:1},{h:"Рейтинг"},{h:"Отзывов"},{h:"+ за период"},{h:"Установок"},{h:"Обновлено"}],
    ORDER.filter(b=>pl[b]).map(b=>{ const v=pl[b], gr=ppl[b]&&!WORLD.includes(b)?v[1]-ppl[b][1]:null;
      return {cls:B(b).own?"me":"",s:[B(b).name,+v[0],v[1],gr,parseInt(String(v[2]).replace(/\D/g,""))||null,v[3]||""],c:[bname(b)+(WORLD.includes(b)?' <span class="note" data-tip="Общее приложение для всех стран, цифры не про Узбекистан">(весь мир)</span>':""),(+v[0]).toFixed(2),fmt(v[1]),gr==null?"—":gr?(gr>0?"+":"−")+fmt(Math.abs(gr)):"0",esc(v[2]),esc(v[3]||"—")]} }).sort((x,y)=>y.s[2]-x.s[2]));
}

// ---------- Telegram ----------
const tgDelta=(n,o)=>n==null||o==null?"":Math.abs(n-o)>=200?` <span class="chg">${n>o?"+":"−"}${fmt(Math.abs(n-o))}</span>`:"";
function renderTg(){
  const tt=Object.keys(D.tg_hist||{}).sort(), bT=tt.length?pickBase(tt):null, old=bT?D.tg_hist[bT.wk]||{}:{};
  const none=ORDER.filter(b=>D.brands[b]&&!D.tg[b]&&!B(b).own).map(b=>B(b).name);
  $("#tg-tiles").innerHTML=Object.entries(D.tg).map(([b,c])=>`<div class="tile"><div class="k">${bname(b)}</div><div class="v">${kfmt(c.subs)}${tgDelta(c.subs,old[b])}</div><div class="d"><a class="lnk" href="https://t.me/${esc(c.handle)}" target="_blank" rel="noopener">@${esc(c.handle)}</a> · ${fmt(c.photos)} фото · ${fmt(c.videos)} видео</div></div>`).join("")+
    (none.length?`<div class="tile"><div class="k">Без публичного канала</div><div class="v small">${esc(none.join(", "))}</div><div class="d">в радаре нет их официального канала</div></div>`:"");
  const sel=$("#tg-b"); if(sel.options.length<2) sel.innerHTML+=Object.keys(D.tg).map(b=>`<option value="${b}">${esc(B(b).name)}</option>`).join(""); sel.value=S.tgb;
  const P=(D.tg_posts||[]).filter(p=>!S.tgb||p.b===S.tgb), lim=LIM["tg"]||15;
  $("#tg-posts").innerHTML=P.slice(0,lim).map(p=>`<div class="post"><div class="w">${bname(p.b)}<span>${dfmt((p.t||"").slice(0,10))} ${esc((p.t||"").slice(11,16))}</span><span>👁 ${esc(p.v)}</span>${p.tags.filter(t=>t!=="Цена").map(t=>`<span class="pill p-mute">${esc(t)}</span>`).join("")}<a class="lnk" href="https://t.me/${esc(p.id)}" target="_blank" rel="noopener">открыть ↗</a></div><div>${esc(p.txt||(p.img?"[фото]":p.vid?"[видео]":"—"))}</div></div>`).join("")||'<div class="empty">Нет постов</div>';
  $("#tg-more").hidden=P.length<=lim; $("#tg-more").textContent=`Показать ещё (${Math.max(0,P.length-lim)})`;
}

// ---------- Как читать ----------
function renderMe(){
  const L=REF(), day=D.daily[L]||{}, dd=Object.keys(D.daily).sort(), aa=Object.keys(D.apps).sort(), tt=Object.keys(D.tg_hist||{}).sort(), AA=D.ads.filter(a=>a.active);
  $("#me-br").innerHTML=table("me-br",[{h:"Бренд",l:1},{h:"Объявлений в Meta"},{h:"Собрано в галерею"},{h:"Сообщений"},{h:"Подписчиков страницы"}],
    ORDER.filter(b=>D.brands[b]).map(b=>{ const got=AA.filter(a=>a.b===b).reduce((s,a)=>s+(a.n||1),0), m=msgs(b,AA), t=day[b]?day[b].total:null;
      return {s:[B(b).name,t,got,m,B(b).likes??null],c:[bname(b),fmt(t),fmt(got),fmt(m),fmt(B(b).likes)]} }));
  const ex=ORDER.filter(b=>day[b]&&day[b].total>20).map(b=>({b,t:day[b].total,m:msgs(b,AA)})).sort((x,y)=>y.t/Math.max(1,y.m)-x.t/Math.max(1,x.m))[0];
  $("#me-ex").textContent=ex?`Пример: у ${B(ex.b).name} ${ex.t} ${plural(ex.t,"объявление","объявления","объявлений")}, но всего ${ex.m} ${plural(ex.m,"сообщение","сообщения","сообщений")}.`:"";
  const c=(MN&&MN.cov)||null, f=x=>x?dfmt(x)+(x.slice(0,4)!==REF().slice(0,4)?"."+x.slice(2,4):""):"—", tg=(c&&c.tgw)||{};
  const R1=[["Реклама Meta (Ad Library)",f(dd[0]),"каждое утро","Все активные объявления страниц брендов в Узбекистане. Бюджетов и охвата нет."],
    ["App Store: чарт, оценки",f(aa[0]),"каждое утро","Место в «Еда и напитки», число и средняя оценок, версия."],
    ["Google Play: рейтинг, отзывы",f(aa[0]),"каждое утро","Рейтинг, число отзывов, порог установок, дата обновления."],
    ["Telegram: официальные каналы",f(tt[0]),"каждое утро","Подписчики (с точностью до 100) и посты брендов с публичным каналом."]];
  const R2=c?[["Google Trends (интерес в Google)",f(c.trends),"раз в неделю","Индекс 0–100, не число запросов."],
    ["Telegram: чужие каналы и чаты",f((c.talk||{}).tg),"каждые 2 часа",`Прочитано ${tg.read||0} из ${tg.total||"?"} каналов${tg.full?"":", первичный проход не закончен"}. Только публичные каналы.`],
    ["Сайты СМИ",c.media_on?"подключены":"не подключены","каждые 2 часа","Ленты новостных сайтов (RSS), хранят только последние записи."],
    ["Отзывы в магазинах, наши",f((c.own||{}).play),"утром и вечером","Тексты отзывов Google Play и App Store."],
    ["Отзывы в магазинах, конкурентов",f((c.rev_comp||{}).play)+" / "+f((c.rev_comp||{}).appstore),"утром и вечером","Play / App Store. У конкурентов история короче."],
    ["Комментарии под нашими постами",f((c.own||{}).ig),"утром и вечером","Instagram и Facebook."],
    ["Комментарии под нашей рекламой",f((c.own||{}).ads),"утром и вечером","Часть комментариев Meta не отдаёт, негатив может быть занижен."],
    ["YouTube",f((c.talk||{}).yt),"утром и вечером","Собирается по лимиту запросов, часто недоступен."],
    ["Instagram конкурентов: подписчики",f(c.ig),"каждый день","Только число подписчиков, рост виден с этой даты."]]:[["Данные «Упоминаний» загружаются…","","",""]];
  const rows=[...R1.map(r=>["Радар",...r]),...R2.map(r=>["Упоминания",...r])];
  $("#me-src").innerHTML=table("me-src",[{h:"Источник",l:1,w:1},{h:"Данные с"},{h:"Обновление"},{h:"Что и ограничения",l:1,w:1}],rows.map(r=>({s:[r[1],r[2],r[3],r[4]],c:[`${esc(r[1])} <span class="note">· ${r[0]}</span>`,esc(r[2]),esc(r[3]),esc(r[4])]})));
  const bm=builtMs();
  $("#me-upd").textContent=`Снимков рекламы: ${dd.length} (${dfmt(dd[0])} — ${dfmt(dd[dd.length-1])}). Радар обновляется каждое утро около 09:10 по Ташкенту${bm?`, последний раз — ${tashkent(bm)}`:""}. Упоминания обновляются на рабочем Mac: отзывы, Instagram, реклама и поиск в 09:30 и 18:30, СМИ и Telegram-каналы каждые 2 часа.`;
  if(!MN) loadMn().then(()=>{ if(S.tab==="me") renderMe() });
}

// ---------- Сводка ----------
const TYP={mention:"Упоминания",offer:"Оффер",open:"Открытие",ads:"Реклама",wave:"Новые креативы",app:"Приложение",rating:"Рейтинг и топ",hire:"Найм",other:"Другое"};
function evRow(e){ const lv=e.imp==="high"?"p-acc":"p-mute";
  return `<div class="srow"><span class="pill ${lv}">${esc(TYP[e.type]||e.type)}</span><div><div class="t">${dot(e.b)}<b>${esc(B(e.b).name)}</b> · ${dfmt(e.date)} · <b>${esc(e.title)}</b></div>${e.detail?`<div class="m">${esc(e.detail.slice(0,180))}${e.detail.length>180?"…":""}</div>`:""}<div class="m">${esc(e.src||"")}${e.link?` · <a class="lnk" href="${esc(e.link)}" target="_blank" rel="noopener">открыть ↗</a>`:""}</div></div></div>` }
const evKey=e=>e.b+"|"+e.type+"|"+String(e.detail||e.title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim().slice(0,60);
function topEvents(list,perBrand,max){ const seen=new Set(), cnt={}, out=[]; for(const e of list){ const k=evKey(e); if(seen.has(k)) continue; seen.add(k); cnt[e.b]=(cnt[e.b]||0)+1; if(cnt[e.b]>perBrand) continue; out.push(e); if(out.length>=max) break } return out }
function renderBoss(){
  const nm=b=>B(b).name;
  const dd=Object.keys(D.daily).sort(), aa=Object.keys(D.apps).sort(), tt=Object.keys(D.tg_hist||{}).sort();
  const bD=pickBase(dd), bA=pickBase(aa), bT=tt.length?pickBase(tt):null;
  const sm=MN&&window.mentionsSummary?window.mentionsSummary(MN,MCTX(),30):null;
  const rank=sh=>{ const o=Object.keys(sh).filter(k=>sh[k]!=null).sort((x,y)=>sh[y]-sh[x]); return b=>o.indexOf(b)+1 }, rk=sm?rank(sm.S.sh):null;
  const brands=[...ORDER.filter(b=>D.brands[b]),"papajohns","dominos","apex"];
  const ia=(D.apps[bA.now]||{}).ios||{}, ib=(D.apps[bA.wk]||{}).ios||{}, pa=(D.apps[bA.now]||{}).play||{}, pb=(D.apps[bA.wk]||{}).play||{};
  const rows=brands.map(b=>{ const own=B(b).own, radar=!!D.brands[b];
    const n=((D.daily[bD.now]||{})[b]||{}).total, o=((D.daily[bD.wk]||{})[b]||{}).total;
    const series=dd.map(d=>`${dfmt(d)}: ${((D.daily[d]||{})[b]||{}).total??"—"}`).join(" · ");
    let ac=""; if(n!=null&&o!=null&&bD.span>0){ const d=n-o; ac=!d?' <span class="chg">0</span>':` <span class="${own?(d>0?"up":"dn"):"chg"}">${d>0?"+":"−"}${o>=10?Math.abs(Math.round(100*d/o))+"%":Math.abs(d)+" шт."}</span>` }
    const pl=ia[b]&&ia[b][3]?+ia[b][3]:null, plo=ib[b]&&ib[b][3]?+ib[b][3]:null, up=pl&&plo?plo-pl:0, good=own?up>0:up<0;
    const pp=pa[b], ppo=pb[b], world=WORLD.includes(b), rg=pp&&ppo&&!world?pp[1]-ppo[1]:null;
    const ts=(D.tg[b]||{}).subs, tso=bT&&D.tg_hist[bT.wk]?D.tg_hist[bT.wk][b]:null;
    const sh=sm&&sm.S.sh[b]!=null?sm.S.sh[b]:null;
    return {cls:own?"me":"",st:radar?"":"opacity:.7",s:[nm(b),n??null,pl,pp?+pp[0]:null,ts??null,sh],c:[
      `${dot(b)}${esc(nm(b))}${radar?"":'<sup class="note" data-tip="Радар этот бренд не отслеживает, есть только в «Упоминаниях»">°</sup>'}`,
      n!=null?`<b data-tip="${esc(series)}">${fmt(n)}</b>${own?'<span class="note" data-tip="Вся страница бренда: франшиза, найм, филиалы, а не только продажи"> *</span>':""}${ac}`:"—",
      pl?`<b>#${pl}</b>${up?` <span class="${good?"up":"dn"}">${up>0?"↑":"↓"}${Math.abs(up)}</span>`:""}`:"—",
      pp?`★ ${(+pp[0]).toFixed(2)}${world?' <span class="note" data-tip="Общее приложение для всех стран">(мир)</span>':rg?` <span class="chg">+${fmt(rg)} отз.</span>`:""}`:"—",
      ts?`${kfmt(ts)}${tgDelta(ts,tso)}`:(radar?'<span class="note">нет канала</span>':"—"),
      sm?(sh!=null?`${sh.toFixed(sh<10?1:0)}% <span class="note">#${rk(b)}</span>`:'<span class="note" data-tip="Google Trends не ответил по этому бренду">нет данных</span>'):"…"]} });
  const cols=[{h:"Бренд",l:1},{h:`Реклама Meta, объявл.<br><span class="note">${spanTxt(bD)}</span>`},{h:`App Store, место<br><span class="note">${spanTxt(bA)}</span>`},{h:`Google Play<br><span class="note">${spanTxt(bA)}</span>`},{h:`Telegram, подписчики<br><span class="note">${bT?spanTxt(bT):""}</span>`},{h:`Поиск Google, доля<br><span class="note">${sm?`${dfmt(sm.a)}–${dfmt(sm.b)}`:""}</span>`}];
  $("#boss-sum").innerHTML=table("boss-sum",cols,rows,{cls:"sum"});
  $("#boss-sum-sub").textContent=`данные на ${dfmt(REF())}`;
  $("#boss-sum-n").innerHTML=`Цветом отмечено только то, что ясно для нас: наши изменения и места в App Store (конкурент поднялся — красный). Остальные изменения серые. Проценты — только если было 10+ объявлений, иначе разница в штуках. Наведите на число объявлений, чтобы увидеть все дни. * — вся страница Bellissimo, включая франшизу и найм. ° — бренд есть только в «Упоминаниях». Публикации о брендах — во вкладке «Упоминания»: Telegram и СМИ пока читаются не полностью.`;
  // events
  const top=topEvents(J.events.filter(e=>e.imp==="high"&&e.b!=="bellissimo"&&within(e.date,7)),2,8);
  $("#boss-top").innerHTML=top.map(evRow).join("")||'<div class="empty">За 7 дней крупных изменений у конкурентов не было</div>';
  const us=[], ev7=topEvents(J.events.filter(e=>e.b==="bellissimo"&&within(e.date,7)),4,4);
  if(sm){ const O=sm.O; us.push(`<div class="srow"><span class="pill p-mute">факт</span><div><div class="t"><b>Упоминания о нас за 30 дней: ${fmt(O.t)}, негатив ${O.t?Math.round(100*O.o.neg/O.t):0}%</b></div><div class="m">${dfmt(sm.a)}–${dfmt(sm.b)}: отзывы в магазинах, комментарии под нашими постами и рекламой. <span class="lnk" role="link" tabindex="0" data-go="mn">Подробнее ↗</span></div></div></div>`) }
  if(ia.bellissimo) us.push(`<div class="srow"><span class="pill p-mute">факт</span><div><div class="t"><b>App Store: место #${ia.bellissimo[3]||"—"}, ${ia.bellissimo[1]} ★</b></div><div class="m">Google Play: ★ ${pa.bellissimo?(+pa.bellissimo[0]).toFixed(2):"—"}, отзывов ${pa.bellissimo?fmt(pa.bellissimo[1]):"—"}</div></div></div>`);
  us.push(...ev7.map(evRow));
  $("#boss-us").innerHTML=us.join("")||'<div class="empty">Нет событий</div>';
  // ratings growth
  const v=(d,k,b,i)=>{ const x=((D.apps[d]||{})[k]||{})[b]; return x?x[i]:null };
  const gr=ORDER.filter(b=>D.brands[b]&&!WORLD.includes(b)).map(b=>{ const p1=v(bA.now,"play",b,1),p0=v(bA.wk,"play",b,1),i1=v(bA.now,"ios",b,0),i0=v(bA.wk,"ios",b,0);
    const pg=p1!=null&&p0!=null?p1-p0:null, ig=i1!=null&&i0!=null?i1-i0:null; return {b,pg,ig,t:(pg||0)+(ig||0)} }).sort((x,y)=>y.t-x.t);
  const mx=Math.max(1,...gr.map(x=>x.t)), sg=x=>x==null?"—":(x>0?"+":x<0?"−":"")+fmt(Math.abs(x));
  $("#boss-gr").innerHTML=`<div class="bars">${gr.map(x=>`<div class="brow"><span>${bname(x.b)}</span><div class="bbar"><i class="grow" data-tip="${esc(nm(x.b))}: ${sg(x.pg)} в Google Play, ${sg(x.ig)} в App Store" style="width:${100*Math.max(0,x.t)/mx}%;background:${B(x.b).color}"></i></div><span class="num"><b>${sg(x.t)}</b> <span class="note">Play ${sg(x.pg)} · iOS ${sg(x.ig)}</span></span></div>`).join("")}</div>`;
  $("#boss-gr-sub").innerHTML=`новые оценки за ${spanTxt(bA)}`;
  $("#boss-gr-n").textContent="Dodo и Yandex не показаны: у них общее приложение на весь мир.";
  // offers 14 days
  const off=topEvents(J.events.filter(e=>e.type==="offer"&&within(e.date,14)),3,60).sort((x,y)=>ORDER.indexOf(x.b)-ORDER.indexOf(y.b)||(y.date||"").localeCompare(x.date||""));
  $("#boss-off").innerHTML=off.length?table("boss-off",[{h:"Бренд",l:1},{h:"Дата"},{h:"Оффер",l:1,w:1},{h:"Где",l:1}],
    off.map(e=>({cls:B(e.b).own?"me":"",s:[nm(e.b),e.date,e.title,e.src],c:[bname(e.b),dfmt(e.date),`<b>${esc(e.title.replace(/^Оффер:\s*/,""))}</b> <span class="note">${esc((e.detail||"").slice(0,140))}</span>`,e.link?`<a class="lnk" href="${esc(e.link)}" target="_blank" rel="noopener">${esc(e.src)} ↗</a>`:esc(e.src)]})),{limit:12}):'<div class="empty">Новых офферов за 14 дней не найдено</div>';
  if(J.note&&J.note.text){ $("#boss-note-card").hidden=false; $("#boss-note").textContent=J.note.text; $("#boss-note-d").textContent="от "+dfmt(J.note.date) }
  if(!MN) loadMn().then(()=>{ if(S.tab==="boss") renderBoss() });
}

// ---------- Журнал ----------
const SRCN={play:"Google Play",appstore:"App Store",ig:"Instagram",fb:"Facebook",ads:"реклама"};
function mnEvents(){ if(!MN||!J||J._mn||!MN.own) return; J._mn=1;
  const by={}; MN.own.forEach(([d,s,se,n])=>{ if(se!=="neg") return; ((by[d]=by[d]||{}).t=(by[d].t||0)+n); by[d][s]=(by[d][s]||0)+n });
  const days=Object.keys(by).sort(), ev=[];
  days.forEach(d=>{ const prev=days.filter(x=>x<d&&dDiff(x,d)<=14).map(x=>by[x].t), avg=prev.length?prev.reduce((a,b)=>a+b,0)/prev.length:0, n=by[d].t;
    if(n>=8&&n>=1.8*Math.max(avg,1)){ const src=Object.keys(by[d]).filter(k=>k!=="t").map(k=>(SRCN[k]||k)+" "+by[d][k]).join(", ");
      ev.push({date:d,b:"bellissimo",type:"mention",imp:"high",title:`Негатив у нас: ${n} за день`+(avg?` (обычно около ${Math.round(avg)})`:""),detail:"Источники: "+src,src:"Упоминания"}) } });
  J.events=J.events.concat(ev).sort((a,b)=>(b.date||"").localeCompare(a.date||"")); }
function renderJr(){
  const jb=$("#jr-b"), jt=$("#jr-t");
  if(jb.options.length<2){ jb.innerHTML+=ORDER.filter(b=>J.events.some(e=>e.b===b)).map(b=>`<option value="${b}">${esc(B(b).name)}</option>`).join(""); jt.innerHTML+=Object.keys(TYP).filter(t=>J.events.some(e=>e.type===t)).map(t=>`<option value="${t}">${TYP[t]}</option>`).join("") }
  const f=S.jr; $("#jr-per").value=f.per; jb.value=f.b; jt.value=f.t; $("#jr-hi").checked=f.hi; $("#jr-own").checked=f.own;
  const E=J.events.filter(e=>within(e.date,+f.per)&&(!f.b||e.b===f.b)&&(!f.t||e.type===f.t)&&(!f.hi||e.imp==="high")&&(!f.own||e.b!=="bellissimo")), lim=LIM["jr"]||30;
  $("#jr-sub").textContent=`${E.length} ${plural(E.length,"событие","события","событий")} · снимки рекламы с ${dfmt((J.coverage.adlib||[])[0])}`;
  $("#jr-list").innerHTML=E.slice(0,lim).map(evRow).join("")||'<div class="empty">Событий нет</div>';
  $("#jr-more").hidden=E.length<=lim; $("#jr-more").textContent=`Показать ещё (${Math.max(0,E.length-lim)})`;
}

// ---------- Упоминания ----------
const RAWU="https://raw.githubusercontent.com/timkacloud-blip/bellissimo-radar/main/site/";
const MCTX=()=>({brands:Object.assign({},EXTRA_B,D.brands),apps:D.apps});
function loadMn(){ if(!MNP){ const q="?"+Date.now(), g=u=>fetch(u).then(r=>{ if(!r.ok) throw 0; return r.json() });
  const js=window.renderMentions?Promise.resolve():new Promise((ok,no)=>{ const s=document.createElement("script"); s.src="mentions.js"+q; s.onload=ok; s.onerror=no; document.head.appendChild(s) });
  MNP=Promise.all([g(RAWU+"mentions_data.json"+q).catch(()=>g("mentions_data.json"+q)),js]).then(([d])=>{ MN=d; mnEvents(); try{ freshStrip() }catch(e){} return d }).catch(()=>null) } return MNP }
function renderMn(){ const p=$("#p-mn"); if(p.dataset.ok) return; p.innerHTML='<div class="empty">Загружаю…</div>';
  loadMn().then(d=>{ if(!d) throw 0; window.renderMentions(p,d,MCTX()); p.dataset.ok=1 }).catch(()=>{ p.innerHTML='<div class="empty">Не удалось загрузить данные упоминаний. <button id="retry" class="chip">Повторить</button></div>' }) }

const R={mn:renderMn,boss:renderBoss,jr:renderJr,ads:renderAds,off:renderOff,app:renderApp,tg:renderTg,me:renderMe};

// ---------- header: one place for freshness, in Tashkent time ----------
function freshStrip(){ const el=$("#fresh"); if(!D) return;
  const now=Date.now(), col=h=>h>54?"var(--bad)":h>30?"var(--warn)":"var(--good)";
  const it=(label,ms,okH,extra)=>{ if(ms==null||isNaN(ms)) return `<span><i class="fd" style="background:var(--fg3)"></i>${label}: нет данных</span>`; const h=Math.round((now-ms)/36e5);
    return `<span data-tip="${h>okH?`Не обновлялось ${h} ч — дольше обычного, цифры могут отставать`:"Данные свежие"}${extra?". "+extra:""}"><i class="fd" style="background:${col(h)}"></i>${label}: ${tashkent(ms)}${h>okH?` <b class="cw">${h} ч назад</b>`:""}</span>` };
  const ad=D.info.date, ap=Object.keys(D.apps||{}).sort().pop(), tg=Object.keys(D.tg_hist||{}).sort().pop();
  const same=ad===ap&&ap===tg, dts=same?`данные на ${dfmt(ad)}`:`реклама ${dfmt(ad)}, приложения ${dfmt(ap)}, Telegram ${dfmt(tg)}`;
  const mb=MN&&MN.built?Date.parse(MN.built.replace(" ","T")+"+05:00"):null;
  el.innerHTML=it("Радар",builtMs(),30,"Реклама, приложения, Telegram — "+dts)+it("Упоминания",mb,14)+`<span class="note hide-m">время — Ташкент</span>` }
function covNote(t){ const p=$("#p-"+t); if(!p) return; let el=p.querySelector(":scope > .covnote");
  const dd=Object.keys(D.daily||{}).sort(), aa=Object.keys(D.apps||{}).sort(), tt=Object.keys(D.tg_hist||{}).sort();
  const CN={ads:`Снимки рекламы с ${dfmt(dd[0])} (${dd.length} ${plural(dd.length,"снимок","снимка","снимков")}). Объявления, выключенные до первого снимка, не видны. Bellissimo — вся страница бренда, включая франшизу и найм.`,
    off:`Данные об офферах с ${dfmt(dd[0])}: только активные объявления и публичные Telegram-каналы. Выключенные акции не видны.`,
    app:`Снимки с ${dfmt(aa[0])}. Рейтинг App Store округлён до 0,1. У Dodo и Yandex в Google Play общий мировой рейтинг.`,
    tg:`Снимки с ${dfmt(tt[0])}. Только официальные каналы брендов. Разговоры в чужих каналах — во вкладке «Упоминания».`,
    jr:`События с ${dfmt(dd[0])}: до первого снимка радар ничего не знает. Всплески негатива о нас берутся из «Упоминаний».`};
  if(!CN[t]){ if(el) el.remove(); return }
  if(!el){ el=document.createElement("p"); el.className="note covnote"; p.prepend(el) }
  el.textContent="⚠ "+CN[t] }

// ---------- state in the address bar, so a view can be shared by link ----------
let urlLock=false;
function writeURL(){ if(urlLock) return; const p=new URLSearchParams();
  if(S.tab==="ads"){ if(S.brands.size) p.set("b",[...S.brands].join(",")); ["goal","tag","fmt","q"].forEach(k=>{ if(S[k]) p.set(k,S[k]) }); if(S.sort!=="new") p.set("sort",S.sort); if(S.hire) p.set("hire","1"); if(S.raw) p.set("raw","1"); if(S.nw) p.set("new","1") }
  if((S.tab==="ads"||S.tab==="off")&&S.lang!=="all") p.set("lang",S.lang);
  if(S.tab==="off"&&S.prc) p.set("cat",S.prc);
  if(S.tab==="tg"&&S.tgb) p.set("b",S.tgb);
  if(S.tab==="jr"){ const f=S.jr; if(f.per!=="30") p.set("per",f.per); if(f.b) p.set("b",f.b); if(f.t) p.set("t",f.t); if(f.hi) p.set("hi","1"); if(!f.own) p.set("own","0") }
  const q=p.toString(), h="#"+S.tab+(q?"?"+q:""); if(location.hash!==h) history.replaceState(null,"",h) }
function readURL(){ const h=decodeURIComponent(location.hash.slice(1)); if(!h) return false; const [t,q]=h.split("?"), p=new URLSearchParams(q||"");
  if(!R[t]) return false; S.tab=t;
  if(t==="ads"){ S.brands=new Set((p.get("b")||"").split(",").filter(Boolean)); S.goal=p.get("goal")||""; S.tag=p.get("tag")||""; S.fmt=p.get("fmt")||""; S.q=p.get("q")||""; S.sort=p.get("sort")||"new"; S.hire=p.get("hire")==="1"; S.raw=p.get("raw")==="1"; S.nw=p.get("new")==="1" }
  if(t==="ads"||t==="off") S.lang=["UZ","RU"].includes(p.get("lang"))?p.get("lang"):"all";
  if(t==="off") S.prc=p.get("cat")||"";
  if(t==="tg") S.tgb=p.get("b")||"";
  if(t==="jr") S.jr={per:p.get("per")||"30",b:p.get("b")||"",t:p.get("t")||"",hi:p.get("hi")==="1",own:p.get("own")!=="0"};
  return true }

let thumbsP=null;
function ensureThumbs(){ if(thumbsP) return; thumbsP=load("data/thumbs.json").then(x=>{ TH=x }).catch(()=>{ TH={} }).then(()=>{ thumbsLoaded=true; if(S.tab==="ads") rerender() }) }
function show(t){ S.tab=R[t]?t:"boss"; ls.set("cr.tab",S.tab);
  $$("#tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.t===S.tab)); $("#help").classList.toggle("on",S.tab==="me");
  const ab=$(`#tabs button[data-t="${S.tab}"]`); if(ab) ab.scrollIntoView({block:"nearest",inline:"center"});
  $$(".panel").forEach(p=>p.hidden=p.id!=="p-"+S.tab);
  if(D){ freshStrip(); covNote(S.tab); if(S.tab==="ads") ensureThumbs(); R[S.tab](); rise($("#p-"+S.tab)) }
  writeURL() }
function rerender(){ if(D){ R[S.tab](); writeURL() } }

$("#tabs").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b) show(b.dataset.t) });
$("#help").addEventListener("click",()=>show("me"));
window.addEventListener("hashchange",()=>{ if(readURL()){ urlLock=true; show(S.tab); urlLock=false } });
document.addEventListener("click",e=>{ const b=e.target.closest(".seg.lang button"); if(!b) return; S.lang=b.dataset.v; S.limit=24; rerender() });
$("#f-brand").addEventListener("click",e=>{ const b=e.target.closest(".chip"); if(!b) return; const k=b.dataset.b; S.brands.has(k)?S.brands.delete(k):S.brands.add(k); S.limit=24; rerender() });
[["#f-goal","goal"],["#f-tag","tag"],["#f-fmt","fmt"],["#f-sort","sort"]].forEach(([s,k])=>$(s).addEventListener("change",e=>{ S[k]=e.target.value; S.limit=24; rerender() }));
[["#f-raw","raw"],["#f-hire","hire"],["#f-new","nw"]].forEach(([s,k])=>$(s).addEventListener("change",e=>{ S[k]=e.target.checked; S.limit=24; rerender() }));
let qt; $("#f-q").addEventListener("input",e=>{ clearTimeout(qt); qt=setTimeout(()=>{ S.q=e.target.value; S.limit=24; rerender() },200) });
$("#f-reset").addEventListener("click",()=>{ Object.assign(S,{brands:new Set(),goal:"",tag:"",fmt:"",sort:"new",q:"",hire:false,raw:false,nw:false,limit:24}); rerender() });
$("#ads-more").addEventListener("click",()=>{ S.limit+=24; rerender() });
$("#pr-cat").addEventListener("change",e=>{ S.prc=e.target.value; LIM["off-pr"]=0; rerender() });
$("#tg-b").addEventListener("change",e=>{ S.tgb=e.target.value; rerender() });
$("#tg-more").addEventListener("click",()=>{ LIM["tg"]=(LIM["tg"]||15)+15; rerender() });
$("#jr-more").addEventListener("click",()=>{ LIM["jr"]=(LIM["jr"]||30)+30; rerender() });
[["#jr-per","per"],["#jr-b","b"],["#jr-t","t"]].forEach(([s,k])=>$(s).addEventListener("change",e=>{ S.jr[k]=e.target.value; rerender() }));
[["#jr-hi","hi"],["#jr-own","own"]].forEach(([s,k])=>$(s).addEventListener("change",e=>{ S.jr[k]=e.target.checked; rerender() }));

// tabs row: fade on the side that has more tabs to scroll to
(()=>{ const t=$("#tabs"), f=()=>{ t.classList.toggle("fr",t.scrollLeft+t.clientWidth<t.scrollWidth-4); t.classList.toggle("fl",t.scrollLeft>4) }; t.addEventListener("scroll",f,{passive:true}); addEventListener("resize",f); setTimeout(f,50) })();

(async()=>{
  if(!readURL()) S.tab=R[ls.get("cr.tab","boss")]&&ls.get("cr.tab","boss")!=="ov"?ls.get("cr.tab","boss"):"boss";
  $$(".panel").forEach(p=>p.hidden=p.id!=="p-"+S.tab);
  try{ D=await load("data/comp.json") }catch(e){ $("#fresh").innerHTML=esc(e.message)+' <button id="retry" class="chip">Повторить</button>'; return }
  try{ J=await load("data/journal.json") }catch(e){}
  show(S.tab);
  loadMn().then(()=>{ if(S.tab==="boss"||S.tab==="jr") rerender() });
})();

(()=>{ const tip=document.createElement("div"); tip.id="tip"; document.body.appendChild(tip);
  document.addEventListener("mouseover",e=>{ const t=e.target.closest("[data-tip]"); if(!t){ tip.style.display="none"; return } tip.textContent=t.getAttribute("data-tip"); tip.style.display="block" });
  document.addEventListener("mousemove",e=>{ if(tip.style.display!=="block") return; const x=Math.min(e.clientX+12, innerWidth-tip.offsetWidth-8); tip.style.left=Math.max(8,x)+"px"; tip.style.top=(e.clientY+14)+"px" });
  document.addEventListener("touchstart",e=>{ const t=e.target.closest("[data-tip]"); if(!t){ tip.style.display="none"; return } tip.textContent=t.getAttribute("data-tip"); tip.style.display="block"; const r=t.getBoundingClientRect(); tip.style.left=Math.max(8,Math.min(r.left, innerWidth-tip.offsetWidth-8))+"px"; tip.style.top=(r.bottom+6)+"px" },{passive:true});
})();
