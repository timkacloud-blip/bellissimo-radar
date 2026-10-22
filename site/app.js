"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=n=>n==null||!isFinite(n)?"—":Math.round(n).toLocaleString("ru-RU");
const kfmt=n=>n==null?"—":n>=1e6?(n/1e6).toFixed(n>=1e7?0:1)+" млн":n>=1e4?Math.round(n/1e3)+" тыс":fmt(n);
const plural=(n,a,b,c)=>{ n=Math.abs(n)%100; const m=n%10; return n>10&&n<20?c:m===1?a:m>=2&&m<=4?b:c };
const ls={get(k,d){try{return localStorage.getItem(k)??d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const S={tab:"boss",lang:"all",brands:new Set(),goal:"",tag:"",fmt:"",sort:"new",q:"",hire:false,raw:true,nw:false,limit:24,prc:"",tgb:"",jr:{per:"30",b:"",t:"",hi:false,own:false}};
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
const sales=A=>A.filter(a=>a.goal!=="Найм");
const msgs=(b,A)=>dedupe(sales(A).filter(a=>a.b===b)).length;
function objCount(b){ // Meta's own counter for "all languages"; with a language filter, an estimate from what we collected
  if(S.lang==="all"){ const v=((D.daily[REF()]||{})[b]||{}).total; return {v:v==null?null:v,est:false} }
  const s=D.ads.filter(a=>a.active&&a.b===b&&inLang(a)).reduce((t,a)=>t+(a.n||1),0); return {v:s,est:true} }
const ofmt=o=>o.v==null?"—":(o.est?"≈":"")+fmt(o.v);

// ---------- generic table: sortable by click, "show more" ----------
// change as a count and a percent together: "−2 (−60%)"; percent only when the base is big enough not to be noise
const CTA_RU={"install now":"Установить приложение","download":"Установить приложение","install":"Установить приложение","order now":"Заказать","start order":"Заказать","shop now":"Заказать","see menu":"Смотреть меню","apply now":"Откликнуться (найм)","learn more":"Узнать подробнее","see details":"Узнать подробнее","visit instagram profile":"Перейти в Instagram","call now":"Позвонить","":"Без кнопки"};
const ctaRu=c=>CTA_RU[(c||"").toLowerCase()]||c;
function fchg(n,o){ const d=n-o; if(!d) return "0"; const sg=d>0?"+":"−", pc=o>=5?` (${sg}${Math.abs(Math.round(100*d/o))}%)`:""; return sg+Math.abs(d)+pc }
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
function insRows(id,I,step){ const lim=LIM[id]||step; return (I.slice(0,lim).map(i=>`<div class="srow"><span class="pill ${LV[i.lvl]}">${LT[i.lvl]}</span><div><div class="t">${i.b?dot(i.b):""}<b>${esc(i.t)}</b></div><div class="m">${esc(i.m)}</div></div></div>`).join("")||'<div class="empty">Пока нечего сказать</div>')+(I.length>lim?`<div class="more"><button class="btn ghost" data-more="${id}" data-step="${step}">Показать ещё ${I.length-lim}</button></div>`:"") }
const LV={bad:"p-bad",warn:"p-warn",good:"p-good",acc:"p-acc",mute:"p-mute"}, LT={bad:"угроза",warn:"присмотреться",good:"в нашу пользу",acc:"новое",mute:"факт"};
function syncLang(){ $$(".seg.lang button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===S.lang)) }
// how much of Meta's own ad counter we actually hold (copies behind the collected creatives)
function cov(b){ const c=((D.cover||D.daily[REF()]||{})[b])||{}; return c.total?{t:c.total,c:Math.min(c.covered||0,c.total),p:Math.min(c.covered||0,c.total)/c.total}:null }
function lowCov(th){ return ORDER.filter(b=>D.brands[b]).map(b=>({b,x:cov(b)})).filter(o=>o.x&&o.x.p<(th||.7)) }
function covPill(b){ const x=cov(b); if(!x) return '<span class="note">—</span>'; const c=x.p>=.95?"p-good":x.p>=.7?"p-warn":"p-bad";
  return `<span class="pill ${c}" data-tip="Мы видим тексты и картинки ${x.c} из ${x.t} объявлений Meta">${Math.round(100*x.p)}%</span>` }
function renderAds(){
  syncLang();
  const A=active(), L=REF(), bs=ORDER.filter(b=>D.brands[b]&&((D.daily[L]||{})[b]||D.ads.some(a=>a.b===b)));
  const nol=D.ads.filter(a=>a.active&&a.lang==="—").length;
  $("#lang-n").textContent=S.lang==="all"?"":`объявления без текста (${nol}) показываются при любом языке; число объявлений — оценка ≈`;
  // who advertises how much: one table instead of ten tiles
  const oc=Object.fromEntries(bs.map(b=>[b,objCount(b)])), tot=bs.reduce((s,b)=>s+(oc[b].v||0),0), mx=Math.max(1,...bs.map(b=>oc[b].v||0));
  $("#ov-sov-sub").textContent=S.lang==="all"?`активные объявления Meta на ${dfmt(L)}`:`≈ по собранным объявлениям, язык ${S.lang}`;
  $("#ov-sov").innerHTML=table("ov-sov",[{h:"Бренд",l:1},{h:"Доля",l:1},{h:"Объявлений"},{h:"Креативов",tip:"Карточки в галерее без найма. Одинаковые копии объявления Facebook объединяет сам, поэтому креативов меньше, чем объявлений"},{h:"Новых за 7 дней"},{h:"Найм",tip:"Сообщения о найме курьеров и персонала"},{h:"Охват текстов",tip:"Какую часть объявлений Meta мы видим с текстом. Ниже 70% — цифры по офферам, ценам и сообщениям этого бренда занижены"}],
    bs.map(b=>{ const x=A.filter(a=>a.b===b), m=x.filter(a=>a.goal!=="Найм").length, n7=sales(x).filter(a=>a.start&&dDiff(a.start,L)<7).length, hr=x.filter(a=>a.goal==="Найм").length, sh=tot?100*(oc[b].v||0)/tot:0;
      return {cls:B(b).own?"me":"",s:[B(b).name,sh,oc[b].v,m,n7,hr,(cov(b)||{}).p||0],c:[bname(b)+(B(b).own?'<span class="note" data-tip="Вся страница бренда: франшиза, найм, филиалы"> *</span>':""),
        `<div class="sbarw"><div class="sbar"><i style="width:${100*(oc[b].v||0)/mx}%;background:${B(b).color}"></i></div><span>${sh.toFixed(0)}%</span></div>`,`<b>${ofmt(oc[b])}</b>`,m,n7?`<span class="pill p-acc">+${n7}</span>`:'<span class="note">0</span>',hr||'<span class="note">0</span>',covPill(b)]} }).sort((x,y)=>(y.s[2]||0)-(x.s[2]||0)));
  // ad insights only; App Store lives in its own tab
  $("#ov-ins").innerHTML=insRows("ov-ins",D.insights.filter(i=>i.sec!=="app"&&!(i.b&&B(i.b).own&&i.lvl==="mute")),6);
  // ads by day: one row per brand, one column per real snapshot
  const dk=Object.keys(D.daily).sort().slice(-10);
  const dcols=[{h:"Бренд",l:1}].concat(dk.map((d,i)=>{ const g=i?dDiff(dk[i-1],d):0; return {h:dfmt(d)+(g>1?`<br><span class="note" data-tip="Между снимками нет данных за ${g-1} ${plural(g-1,"день","дня","дней")}: разница включает несколько дней">+${g} дн.</span>`:"")} })).concat([{h:`К ${dfmt(dk[0])}`,tip:"Изменение последнего значения к первому дню таблицы"}]);
  const drows=ORDER.filter(b=>D.brands[b]&&dk.some(d=>((D.daily[d]||{})[b]||{}).total!=null)).map(b=>{ const v=dk.map(d=>((D.daily[d]||{})[b]||{}).total), f=v.find(x=>x!=null), l=v[v.length-1];
    return {cls:B(b).own?"me":"",s:[B(b).name].concat(v.map(x=>x??null)).concat([l!=null&&f!=null?l-f:null]),c:[bname(b)].concat(v.map(x=>x==null?'<span class="note">—</span>':String(x))).concat([l!=null&&f!=null?`<span class="chg">${fchg(l,f)}</span>`:""])} });
  $("#ov-cad").innerHTML=`<div class="tbl scroll">${table("ov-cad",dcols,drows)}</div>`;
  // goals
  const bars=(el,keyf)=>{ const G={}; A.forEach(a=>{ const g=keyf(a); (G[g]=G[g]||{}); G[g][a.b]=(G[g][a.b]||0)+1 });
    const gt=g=>Object.values(G[g]).reduce((s,v)=>s+v,0), gs=Object.keys(G), gm=Math.max(1,...gs.map(gt));
    $(el).innerHTML=gs.sort((x,y)=>gt(y)-gt(x)).map(g=>`<div class="brow"><span>${esc(g)}</span><div class="bbar">${ORDER.filter(b=>G[g][b]).map(b=>`<i data-tip="${esc(B(b).name)}: ${G[g][b]} ${plural(G[g][b],"карточка","карточки","карточек")}" style="width:${100*G[g][b]/gm}%;background:${B(b).color}"></i>`).join("")}</div><span class="num">${gt(g)}</span></div>`).join("") };
  bars("#ov-cta",a=>ctaRu(a.cta)); bars("#ov-goal",a=>"→ "+a.goal);
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
  $("#f-brand").innerHTML=ORDER.filter(b=>A0.some(a=>a.b===b)).map(b=>`<button class="chip" data-b="${b}" aria-pressed="${S.brands.has(b)}">${bname(b)} <span class="cnt">${dedupe(base.filter(a=>a.b===b)).length}</span></button>`).join("");
  fillSelect($("#f-goal"),"Любая цель",[...new Set(A0.map(a=>a.goal))].sort(),S.goal);
  fillSelect($("#f-tag"),"Любая механика",[...new Set(A0.flatMap(a=>a.tags))].filter(t=>t!=="Цена").sort(),S.tag);
  $("#f-fmt").value=S.fmt; $("#f-sort").value=S.sort; $("#f-hire").checked=S.hire; $("#f-raw").checked=S.raw; $("#f-new").checked=S.nw; if($("#f-q").value!==S.q) $("#f-q").value=S.q;
  const q=S.q.trim().toLowerCase();
  let A=base.filter(a=>(!S.brands.size||S.brands.has(a.b))&&(!S.goal||a.goal===S.goal)&&(!S.tag||a.tags.includes(S.tag))&&(!S.fmt||a.fmt===S.fmt)&&(!S.nw||(a.start&&dDiff(a.start,REF())<7))&&(!q||((a.body||"")+" "+(a.title||"")+" "+(a.link||"")).toLowerCase().includes(q)));
  const so={new:(x,y)=>(y.start||"").localeCompare(x.start||""),long:(x,y)=>(y.days||0)-(x.days||0),ver:(x,y)=>(y.ntot||y.n)-(x.ntot||x.n)}[S.sort];
  A=S.raw?A.map(a=>Object.assign({},a,{sim:0,ntot:a.n||1})):dedupe(A); A.sort(so);
  const sel=S.brands.size?[...S.brands]:ORDER.filter(b=>D.brands[b]);
  const got=D.ads.filter(a=>a.active&&sel.includes(a.b)).reduce((s,a)=>s+(a.n||1),0), meta=sel.reduce((s,b)=>s+(((D.daily[REF()]||{})[b]||{}).total||0),0);
  $("#ads-sub").innerHTML=`${A.length} ${S.raw?plural(A.length,"карточка","карточки","карточек"):plural(A.length,"сообщение","сообщения","сообщений")}${S.hire?"":" · найм скрыт"}`+
    (meta>got?` · <span data-tip="Ad Library отдаёт не все объявления крупных брендов. Число объявлений — из счётчика Meta, тексты и картинки — из того, что удалось собрать.">собрано ${fmt(got)} из ${fmt(meta)} объявлений Meta ⓘ</span>`:"");
  $("#ads-gal").innerHTML=A.slice(0,S.limit).map(adCard).join("")||'<div class="empty">Ничего не найдено — ослабьте фильтры или нажмите «Сбросить фильтры»</div>';
  $("#ads-more").hidden=A.length<=S.limit; $("#ads-more").textContent=`Показать ещё (${Math.max(0,A.length-S.limit)})`;
  $("#f-reset").hidden=!(S.brands.size||S.goal||S.tag||S.fmt||S.q||S.hire||!S.raw||S.nw||S.sort!=="new");
}

// ---------- Офферы и цены ----------
function renderOff(){
  syncLang();
  const A0=active().filter(a=>a.goal!=="Найм"), tgc={}; (D.tg_posts||[]).forEach(p=>(p.codes||[]).forEach(c=>{ (tgc[p.b]=tgc[p.b]||new Set()).add(c) }));
  const top=(arr,n)=>{ const m={}; arr.forEach(x=>{ if(x) m[x]=(m[x]||0)+1 }); return Object.entries(m).sort((x,y)=>y[1]-x[1]).slice(0,n) };
  const sb=ORDER.filter(b=>A0.some(a=>a.b===b));
  $("#off-sum").innerHTML=table("off-sum",[{h:"Бренд",l:1},{h:"Карточек"},{h:"Главные механики",l:1,w:1},{h:"Цена от, сум",tip:"Минимальная цена, найденная в тексте рекламы. Категория по ближайшему слову, может ошибаться."},{h:"Промокоды",l:1,w:1},{h:"Кнопка",l:1,w:1},{h:"Куда ведёт",l:1,w:1}],
    sb.map(b=>{ const x=A0.filter(a=>a.b===b), n=x.length, mech=top(x.flatMap(a=>a.tags.filter(t=>t!=="Цена"&&t!=="Гарантия времени")),3), pr=(pi=>pi.filter(i=>!/^(Напиток|Другое|Кусочки \/ порции)$/.test(i.c))[0]||pi[0])(x.flatMap(a=>(a.pitems||[])).sort((p,q)=>p.p-q.p)),
        codes=new Set(x.flatMap(a=>a.codes||[])); (tgc[b]||[]).forEach(c=>codes.add(c)); const cb=top(x.map(a=>ctaRu(a.cta)),2), gl=top(x.map(a=>a.goal),2), cv=cov(b), thin=cv&&cv.p<.7;
      return {cls:B(b).own?"me":"",s:[B(b).name,n,mech.length?mech[0][1]:0,pr?pr.p:null,codes.size,cb.length?cb[0][1]:0,gl.length?gl[0][1]:0],
        c:[bname(b)+(thin?' <span class="note" data-tip="Реклама бренда собрана не полностью">⚠</span>':""),`<b>${n}</b>`,mech.map(([t,v])=>`<span class="pill p-mute">${esc(t)} · ${v}</span>`).join(" ")||'<span class="note">нет</span>',
          pr?`<b>${fmt(pr.p)}</b> <span class="note">${esc(pr.c)}</span>`:'<span class="note">нет цен в тексте</span>',[...codes].slice(0,4).map(c=>`<b>${esc(c)}</b>`).join(", ")+(codes.size>4?` <span class="note">+${codes.size-4}</span>`:"")||'<span class="note">нет</span>',
          cb.map(([t,v])=>`${esc(t)} <span class="note">${v}</span>`).join("<br>")||"—",gl.map(([t,v])=>`${esc(t)} <span class="note">${v}</span>`).join("<br>")||"—"]} }).sort((x,y)=>y.s[1]-x.s[1]));
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
    U.map(a=>({s:[a.start,B(a.b).name,a.offer,a.body],c:[dfmt(a.start),bname(a.b),a.tags.filter(t=>t!=="Цена").map(t=>`<span class="pill p-mute">${esc(t)}</span>`).join(" "),esc((a.ru||a.body).slice(0,240))]})),{limit:15});
  renderTg();
}

// ---------- Приложения ----------
function renderApp(){
  const ds=Object.keys(D.apps).sort(), b0=pickBase(ds), a=D.apps[b0.now]||{}, P=b0.span>0?D.apps[b0.wk]:null;
  $("#app-ins").innerHTML=insRows("app-ins",D.insights.filter(i=>i.sec==="app"),6);
  const ios=a.ios||{}, pio=(P&&P.ios)||{}, pl=a.play||{}, ppl=(P&&P.play)||{}, RK=(D.rank||{}).b||{};
  // arrows on the weekly average place, coloured from our side: we go up — green, a competitor goes up — red
  const mv=(b,now,was)=>{ if(!now||!was||now===was) return ""; const up=was-now, good=B(b).own?up>0:up<0; return ` <span class="${good?"up":"dn"}">${up>0?"↑":"↓"}${Math.abs(up)}</span>` };
  const gd=(n,o)=>n==null||o==null?"":n===o?"":` <span class="chg">${n>o?"+":"−"}${fmt(Math.abs(n-o))}</span>`;
  const bs=ORDER.filter(b=>ios[b]||pl[b]);
  $("#app-all").innerHTML=table("app-all",[{h:"Бренд",l:1},{h:"App Store: среднее место",tip:"Среднее место в чарте «Еда и напитки» за 7 дней. У Google Play публичного чарта категории нет, поэтому места там нет."},
      {h:"App Store: рейтинг"},{h:"App Store: оценок",tip:"В скобках — прирост за период таблицы. Это число оценок, не установки."},{h:"Google Play: рейтинг"},{h:"Google Play: оценок",tip:"В скобках — прирост за период таблицы. Это число оценок, не установки."},{h:"Google Play: установок"},{h:"Версия и обновление"}],
    bs.map(b=>{ const v=ios[b], p=pl[b], rk=RK[b]||{}, world=WORLD.includes(b), wn=world?' <span class="note" data-tip="Общее приложение для всех стран, цифры не про Узбекистан">(мир)</span>':"";
      const ig=v&&v[0]!=null&&pio[b]&&pio[b][0]!=null?v[0]-pio[b][0]:null, pg=p&&ppl[b]&&!world?p[1]-ppl[b][1]:null;
      return {cls:B(b).own?"me":"",s:[B(b).name,rk.avg??null,v&&v[1]?+v[1]:null,v?v[0]:null,p?+p[0]:null,p?p[1]:null,p?(parseInt(String(p[2]).replace(/\D/g,""))||null):null,""],c:[bname(b),
        rk.avg?`<b>#${rk.avg.toLocaleString("ru-RU")}</b>${rk.prev&&Math.abs(rk.prev-rk.avg)>=1?mv(b,Math.round(rk.avg),Math.round(rk.prev)):""}`:'<span class="note">вне топа</span>',
        v&&v[1]?(+v[1]).toFixed(1):"—", !v?"—":v[0]==null?'<span class="note" data-tip="Страница приложения не загрузилась при сборе">нет данных</span>':fmt(v[0])+gd(v[0],pio[b]&&pio[b][0]),
        p?(+p[0]).toFixed(1)+wn:"—", p?fmt(p[1])+(pg==null?"":gd(p[1],ppl[b][1])):"—", p?esc(p[2]):"—",
        `<span class="note">iOS</span> ${esc((v&&v[4])||"—")}<br><span class="note">Play</span> ${esc((p&&p[3])||"—")}`]} }).sort((x,y)=>(x.s[1]||999)-(y.s[1]||999)));
  const R0=D.rank||{}; $("#app-all-sub").innerHTML=`место за ${R0.cur?dfmt(R0.cur[0])+"–"+dfmt(R0.cur[1]):"неделю"}${R0.prev?`, стрелка — к ${R0.approx?"снимку "+dfmt(R0.prev[0])+' <span class="cw" data-tip="Предыдущей полной недели ещё нет, вывод предварительный">⚠</span>':"предыдущей неделе"}`:""} · прирост оценок за ${spanTxt(b0)}`;
  $("#app-ch-sub").textContent="App Store, на "+dfmt(b0.now);
  const ch=a.ios_chart||[], ids=a.ios_chart_ids||[];
  $("#app-chart").innerHTML=ch.map((n,i)=>{ const b=IOS_IDS[ids[i]], mn=!b&&/papa|apex|domino/i.test(n); return `<span class="n">${i+1}</span><span class="${b?"hl":mn?"rk-mn":""}">${b?dot(b):""}${b==="bellissimo"?"★ ":""}${esc(n)}</span>` }).join("");
  // reviews from the stores: new reviews and share of 1-2 star, same scheme for both stores
  loadMn().then(d=>{ if(!d||!d.rev) throw 0; const per=30, from=new Date(Date.now()-per*864e5).toISOString().slice(0,10), c={};
    d.rev.forEach(r=>{ if(r[0]<from) return; const k=r[1]; (c[k]=c[k]||{})[r[2]]=((c[k]||{})[r[2]]||[0,0]); c[k][r[2]][0]+=r[3]; c[k][r[2]][1]+=r[4] });
    const cell=x=>x&&x[0]?`${fmt(x[0])} <span class="note">· негатив ${Math.round(100*x[1]/x[0])}%</span>`:'<span class="note">0</span>';
    $("#app-rev").innerHTML=table("app-rev",[{h:"Бренд",l:1},{h:"App Store: новых отзывов"},{h:"Google Play: новых отзывов"}],
      ORDER.filter(b=>c[b]).map(b=>({cls:B(b).own?"me":"",s:[B(b).name,(c[b].appstore||[0])[0],(c[b].play||[0])[0]],c:[bname(b),cell(c[b].appstore),cell(c[b].play)]})).sort((x,y)=>(y.s[1]+y.s[2])-(x.s[1]+x.s[2])));
    $("#app-rev-sub").textContent=`за ${per} дней, негатив = оценки 1–2★`;
  }).catch(()=>{ $("#app-rev").innerHTML='<div class="empty">Отзывы пока не загрузились</div>' });
}

// ---------- Telegram ----------
const tgDelta=(n,o)=>n==null||o==null?"":Math.abs(n-o)>=200?` <span class="chg">${n>o?"+":"−"}${fmt(Math.abs(n-o))}</span>`:"";
function renderTg(){
  const tt=Object.keys(D.tg_hist||{}).sort(), bT=tt.length?pickBase(tt):null, old=bT?D.tg_hist[bT.wk]||{}:{};
  const none=ORDER.filter(b=>D.brands[b]&&!D.tg[b]&&!B(b).own).map(b=>B(b).name);
  $("#tg-sub").textContent=none.length?`есть у ${Object.keys(D.tg).length} брендов; нет публичного канала у ${none.join(", ")}`:"";
  $("#tg-tiles").innerHTML=Object.entries(D.tg).map(([b,c])=>`<span class="tgc">${bname(b)} <b>${kfmt(c.subs)}</b>${tgDelta(c.subs,old[b])} <a class="lnk" href="https://t.me/${esc(c.handle)}" target="_blank" rel="noopener">@${esc(c.handle)}</a></span>`).join("");
  const sel=$("#tg-b"); if(sel.options.length<2) sel.innerHTML+=Object.keys(D.tg).map(b=>`<option value="${b}">${esc(B(b).name)}</option>`).join(""); sel.value=S.tgb;
  const P=(D.tg_posts||[]).filter(p=>!S.tgb||p.b===S.tgb), lim=LIM["tg"]||8;
  $("#tg-posts").innerHTML=P.slice(0,lim).map(p=>`<div class="post"><div class="w">${bname(p.b)}<span>${dfmt((p.t||"").slice(0,10))} ${esc((p.t||"").slice(11,16))}</span><span>👁 ${esc(p.v)}</span>${p.tags.filter(t=>t!=="Цена").map(t=>`<span class="pill p-mute">${esc(t)}</span>`).join("")}<a class="lnk" href="https://t.me/${esc(p.id)}" target="_blank" rel="noopener">открыть ↗</a></div><div>${p.txt?esc(p.ru||p.txt):'<span class="note">'+(p.img?"фото без подписи":p.vid?"видео без подписи":"пост без текста (опрос, файл или репост)")+"</span>"}</div></div>`).join("")||'<div class="empty">Нет постов</div>';
  $("#tg-more").hidden=P.length<=lim; $("#tg-more").textContent=`Показать ещё (${Math.max(0,P.length-lim)})`;
}

// ---------- Как читать ----------
function renderMe(){
  const L=REF(), day=D.daily[L]||{}, dd=Object.keys(D.daily).sort(), aa=Object.keys(D.apps).sort(), tt=Object.keys(D.tg_hist||{}).sort(), AA=D.ads.filter(a=>a.active);
  $("#me-br").innerHTML=table("me-br",[{h:"Бренд",l:1},{h:"Объявлений в Meta"},{h:"Карточек в галерее"},{h:"Охват",tip:"Какую часть объявлений Meta мы видим с текстом и картинкой"},{h:"Подписчиков страницы"}],
    ORDER.filter(b=>D.brands[b]).map(b=>{ const cards=AA.filter(a=>a.b===b).length, t=day[b]?day[b].total:null, cv=cov(b);
      return {s:[B(b).name,t,cards,cv?cv.p:0,B(b).likes??null],c:[bname(b),fmt(t),fmt(cards),covPill(b),fmt(B(b).likes)]} }));
  const ex=ORDER.filter(b=>day[b]&&day[b].total>20).map(b=>({b,t:day[b].total,m:AA.filter(a=>a.b===b&&a.goal!=="Найм").length})).sort((x,y)=>y.t/Math.max(1,y.m)-x.t/Math.max(1,x.m))[0];
  $("#me-ex").textContent=ex?`Пример: у ${B(ex.b).name} ${ex.t} ${plural(ex.t,"объявление","объявления","объявлений")}, но всего ${ex.m} ${plural(ex.m,"карточка","карточки","карточек")} без найма.`:"";
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
  $("#me-upd").textContent=`Снимков рекламы: ${dd.length} (${dfmt(dd[0])} — ${dfmt(dd[dd.length-1])}). Радар обновляется каждое утро до начала рабочего дня${bm?`, последний раз — ${tashkent(bm)}`:""}. Упоминания обновляются на рабочем Mac: отзывы, Instagram, реклама и поиск в 09:30 и 18:30, СМИ и Telegram-каналы каждые 2 часа.`;
  if(!MN) loadMn().then(()=>{ if(S.tab==="me") renderMe() });
}

// ---------- Сводка ----------
const TYP={mention:"Упоминания",offer:"Оффер",open:"Открытие",ads:"Реклама",wave:"Новые креативы",app:"Приложение",rating:"Рейтинг и топ",hire:"Найм",other:"Другое"};
function evRow(e){ const lv=e.imp==="high"?"p-acc":"p-mute";
  return `<div class="srow"><span class="pill ${lv}">${esc(TYP[e.type]||e.type)}</span><div><div class="t">${dot(e.b)}<b>${esc(B(e.b).name)}</b> · ${dfmt(e.date)} · <b>${esc(e.title)}</b></div>${e.detail?`<div class="m">${esc(e.detail.slice(0,180))}${e.detail.length>180?"…":""}</div>`:""}<div class="m">${esc(e.src||"")}${e.link?` · <a class="lnk" href="${esc(e.link)}" target="_blank" rel="noopener">открыть ↗</a>`:""}</div></div></div>` }
const evKey=e=>e.b+"|"+e.type+"|"+String(e.detail||e.title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim().slice(0,60);
function topEvents(list,perBrand,max){ const seen=new Set(), cnt={}, out=[]; for(const e of list){ const k=evKey(e); if(seen.has(k)) continue; seen.add(k); cnt[e.b]=(cnt[e.b]||0)+1; if(cnt[e.b]>perBrand) continue; out.push(e); if(out.length>=max) break } return out }
function keyFindings(bD,sm){
  // "Главное за неделю": a few facts a manager can act on, ordered by importance. Each one links to where the detail is.
  const K=[], nm=b=>B(b).name, L=REF(), RK=(D.rank||{}).b||{}, me=(RK.bellissimo||{}).avg;
  const go=(t,label)=>` <span class="lnk" role="link" tabindex="0" data-go="${t}">${label||"подробнее"} →</span>`;
  // 1. a spike of negative mentions about us
  const neg=J.events.find(e=>e.type==="mention"&&e.b==="bellissimo"&&within(e.date,7));
  if(neg) K.push({lvl:"bad",h:`${neg.title} (${dfmt(neg.date)}).`,m:neg.detail+"."+go("mn","упоминания")});
  // 2. App Store: who is above us on a weekly average
  if(me){ const above=Object.entries(RK).filter(([b,x])=>b!=="bellissimo"&&x.avg&&x.avg<me).sort((x,y)=>x[1].avg-y[1].avg);
    const R0=D.rank, per=R0.cur?`${dfmt(R0.cur[0])}–${dfmt(R0.cur[1])}`:"неделю";
    K.push(above.length?{lvl:"bad",h:`В App Store в среднем выше нас: ${above.map(([b,x])=>`${nm(b)} (#${x.avg.toLocaleString("ru-RU")})`).join(", ")}.`,m:`Мы в среднем #${me.toLocaleString("ru-RU")} за ${per} в «Еда и напитки».`+go("app","приложения")}
                        :{lvl:"good",h:`В App Store мы в среднем выше всех конкурентов: #${me.toLocaleString("ru-RU")}.`,m:`Среднее место за ${per}.`+go("app","приложения")}) }
  // 3. the biggest change in competitors' Meta ads over the comparison window
  if(bD.span>0){ const ch=ORDER.filter(b=>D.brands[b]&&!B(b).own).map(b=>{ const n=((D.daily[bD.now]||{})[b]||{}).total, o=((D.daily[bD.wk]||{})[b]||{}).total; return {b,n,o,d:n!=null&&o?(n-o)/o:null} }).filter(x=>x.d!=null&&x.o>=10&&Math.abs(x.d)>=.3).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d));
    if(ch.length){ const x=ch[0], more=ch.slice(1,3).map(y=>`${nm(y.b)} ${fchg(y.n,y.o)}`).join(", ");
      K.push({lvl:"warn",h:`${nm(x.b)} ${x.d>0?"нарастил":"сократил"} рекламу в Meta: ${x.o} → ${x.n} объявлений (${fchg(x.n,x.o)}).`,m:`За ${dfmt(bD.wk)}→${dfmt(bD.now)}.${more?" Также: "+more+".":""} Объявления ≠ бюджет: Meta его не раскрывает.`+go("ads","реклама")}) }
    else K.push({lvl:"mute",h:"У конкурентов нет резких изменений в рекламе Meta.",m:`За ${dfmt(bD.wk)}→${dfmt(bD.now)} ни у кого объём не изменился на 30% и больше.`+go("ads","реклама")}) }
  // 4. new competitor offers this week, grouped by mechanic
  const thin=new Set(lowCov().map(o=>o.b));   // ad texts of these brands are a sample: no conclusions from them
  const off=topEvents(J.events.filter(e=>e.type==="offer"&&e.b!=="bellissimo"&&within(e.date,7)&&!(e.src==="Реклама Meta"&&thin.has(e.b))),3,40);
  if(off.length){ const by={}; off.forEach(e=>e.title.replace(/^Оффер:\s*/,"").split(" · ").map(m=>m.trim()).forEach(m=>{ if(!m||/^\d/.test(m)||/не распознана/.test(m)) return; (by[m]=by[m]||new Set()).add(nm(e.b)) }));
    const top=Object.entries(by).filter(x=>x[1].size>=2).sort((x,y)=>y[1].size-x[1].size)[0], brands=[...new Set(off.map(e=>nm(e.b)))];
    K.push({lvl:"acc",h:`${off.length} ${plural(off.length,"новый оффер","новых оффера","новых офферов")} у конкурентов за неделю${top?`, чаще всего — «${top[0]}» (${[...top[1]].join(", ")})`:""}.`,m:`Бренды: ${brands.join(", ")}.`+(thin.size?` Реклама ${[...thin].map(nm).join(", ")} собрана не полностью и сюда не входит (Telegram учтён).`:"")+go("off","офферы")}) }
  // 5. pizza prices in ads: ours vs competitors (the category where we compete directly)
  const P={}; D.ads.filter(a=>a.active&&a.goal!=="Найм"&&!thin.has(a.b)).forEach(a=>(a.pitems||[]).forEach(x=>{ if(x.c==="Пицца"&&(P[a.b]==null||x.p<P[a.b])) P[a.b]=x.p }));
  if(P.bellissimo&&Object.keys(P).length>1&&!thin.has("bellissimo")){ const L2=Object.entries(P).sort((x,y)=>x[1]-y[1]), cheaper=L2.filter(([b,p])=>b!=="bellissimo"&&p<P.bellissimo);
    K.push({lvl:cheaper.length?"warn":"mute",h:cheaper.length?`В рекламе пиццу дешевле нашей предлагает ${cheaper.map(([b])=>nm(b)).join(", ")}.`:`Наша цена на пиццу в рекламе — самая низкая среди конкурентов.`,
      m:"Минимальная цена в рекламе: "+L2.map(([b,p])=>`${nm(b)} — от ${fmt(p)}`).join(", ")+" сум. Это цены офферов, наборы могут отличаться."+(thin.size?` Не учтены (реклама собрана не полностью): ${[...thin].map(nm).join(", ")}.`:"")+go("off","цены")}) }
  return K.slice(0,4);
}
function renderBoss(){
  const nm=b=>B(b).name;
  const dd=Object.keys(D.daily).sort(), aa=Object.keys(D.apps).sort();
  const bD=pickBase(dd), bA=pickBase(aa), RK=(D.rank||{}).b||{}, R0=D.rank||{};
  const sm=MN&&window.mentionsSummary?window.mentionsSummary(MN,MCTX(),30):null;
  // key findings
  const K=keyFindings(bD,sm);
  $("#boss-key").innerHTML=K.map(k=>`<li class="k-${k.lvl}"><b>${esc(k.h)}</b><div class="m">${k.m}</div></li>`).join("")||'<div class="empty">Пока недостаточно данных</div>';
  $("#boss-key-sub").textContent=`на ${dfmt(REF())}, сравнение с ${dfmt(bD.wk)}`;
  // summary table: few columns, only what a manager needs
  // Google Trends: only a brand's own dynamics (last 4 weeks vs the 4 before). Levels between brands depend on how the query is worded, so no share and no ranking.
  const tr=b=>{ const v=((MN&&MN.trends)||[]).filter(r=>r[1]===b).sort((x,y)=>x[0].localeCompare(y[0])).map(r=>r[2]); if(v.length<8) return null;
    const a=v.slice(-4).reduce((s,x)=>s+x,0)/4, p=v.slice(-8,-4).reduce((s,x)=>s+x,0)/4; return p>=3?{d:(a-p)/p,a,p}:{d:null,a,p} };
  const pa=(D.apps[bA.now]||{}).play||{};
  const rows=ORDER.filter(b=>D.brands[b]).map(b=>{ const own=B(b).own;
    const n=((D.daily[bD.now]||{})[b]||{}).total, o=((D.daily[bD.wk]||{})[b]||{}).total;
    const series=dd.map(d=>`${dfmt(d)}: ${((D.daily[d]||{})[b]||{}).total??"—"}`).join(" · ");
    let ac=""; if(n!=null&&o!=null&&bD.span>0){ const d=n-o; ac=!d?' <span class="chg">0</span>':` <span class="${own?(d>0?"up":"dn"):"chg"}">${fchg(n,o)}</span>` }
    const r=RK[b]||{}, up=r.avg&&r.prev?r.prev-r.avg:0, good=own?up>0:up<0;
    const pp=pa[b], world=WORLD.includes(b), tb=tr(b);
    return {cls:own?"me":"",s:[nm(b),n??null,r.avg??null,pp?+pp[0]:null,tb&&tb.d!=null?tb.d:null],c:[
      bname(b),
      n!=null?`<b data-tip="${esc(series)}">${fmt(n)}</b>${own?'<span class="note" data-tip="Вся страница бренда: франшиза, найм, филиалы, а не только продажи"> *</span>':""}${ac}`:'<span class="note">нет в Meta</span>',
      r.avg?`<b>#${r.avg.toLocaleString("ru-RU")}</b>${Math.abs(up)>=1?` <span class="${good?"up":"dn"}">${up>0?"↑":"↓"}${Math.abs(Math.round(up))}</span>`:""}`:'<span class="note">вне топа</span>',
      pp?`★ ${(+pp[0]).toFixed(1)}${world?' <span class="note" data-tip="Общее приложение для всех стран">(мир)</span>':""}`:"—",
      MN?(tb?(tb.d==null?'<span class="note" data-tip="Слишком мало поисковых запросов, процент был бы шумом">мало запросов</span>':`<span class="chg" data-tip="Индекс Google Trends: последние 4 недели ${Math.round(tb.a)} против ${Math.round(tb.p)} в предыдущие 4">${tb.d>0?"+":"−"}${Math.abs(Math.round(100*tb.d))}%</span>`):'<span class="note" data-tip="Google Trends не ответил по этому бренду">нет данных</span>'):"…"]} });
  const cols=[{h:"Бренд",l:1},{h:`Реклама Meta, объявлений<br><span class="note">${spanTxt(bD)}</span>`},
    {h:`App Store, среднее место<br><span class="note">${R0.cur?dfmt(R0.cur[0])+"–"+dfmt(R0.cur[1]):""}${R0.approx?' <span class="cw" data-tip="Предыдущей полной недели ещё нет — стрелки предварительные">⚠</span>':""}</span>`,tip:"Среднее место в чарте «Еда и напитки» за 7 дней. Стрелка — к предыдущей неделе."},
    {h:`Google Play, рейтинг`},{h:`Интерес в Google, динамика<br><span class="note">4 недели к предыдущим 4</span>`,tip:"Как изменился поиск самого бренда в Google (Узбекистан). Бренды между собой не сравниваются: уровень зависит от написания запроса, в других словах короткие названия (KFC, Evos) ищут и в другом смысле."}];
  $("#boss-sum").innerHTML=table("boss-sum",cols,rows,{cls:"sum"});
  $("#boss-sum-sub").textContent=`данные на ${dfmt(REF())}`;
  $("#boss-sum-n").innerHTML=`Зелёный и красный — с нашей стороны (конкурент поднялся в App Store — красный). Серые изменения — просто факт. Проценты только при базе от 10 объявлений. * — вся страница Bellissimo, включая франшизу и найм. Наведите на число объявлений, чтобы увидеть все дни.`;
  // events
  const top=topEvents(J.events.filter(e=>e.imp==="high"&&e.b!=="bellissimo"&&within(e.date,7)),2,6);
  $("#boss-top").innerHTML=top.map(evRow).join("")||'<div class="empty">За 7 дней крупных изменений у конкурентов не было</div>';
  const us=[], ev7=topEvents(J.events.filter(e=>e.b==="bellissimo"&&within(e.date,7)),3,3), ia=(D.apps[bA.now]||{}).ios||{};
  if(sm){ const O=sm.O; us.push(`<div class="srow"><span class="pill p-mute">факт</span><div><div class="t"><b>Упоминания о нас за 30 дней: ${fmt(O.t)}, негатив ${O.t?Math.round(100*O.o.neg/O.t):0}%</b></div><div class="m">${dfmt(sm.a)}–${dfmt(sm.b)}: отзывы в магазинах, комментарии под нашими постами и рекламой. <span class="lnk" role="link" tabindex="0" data-go="mn">Подробнее →</span></div></div></div>`) }
  if(ia.bellissimo) us.push(`<div class="srow"><span class="pill p-mute">факт</span><div><div class="t"><b>App Store: в среднем #${(RK.bellissimo||{}).avg?.toLocaleString("ru-RU")||"—"} за неделю, сегодня #${ia.bellissimo[3]||"—"}, ★ ${ia.bellissimo[1]??"—"}</b></div><div class="m">Google Play: ★ ${pa.bellissimo?(+pa.bellissimo[0]).toFixed(2):"—"}, отзывов ${pa.bellissimo?fmt(pa.bellissimo[1]):"—"}</div></div></div>`);
  us.push(...ev7.map(evRow));
  $("#boss-us").innerHTML=us.join("")||'<div class="empty">Нет событий</div>';
  // offers 14 days
  const off=topEvents(J.events.filter(e=>e.type==="offer"&&within(e.date,14)),3,60).sort((x,y)=>ORDER.indexOf(x.b)-ORDER.indexOf(y.b)||(y.date||"").localeCompare(x.date||""));
  $("#boss-off").innerHTML=off.length?table("boss-off",[{h:"Бренд",l:1},{h:"Дата"},{h:"Оффер",l:1,w:1},{h:"Где",l:1}],
    off.map(e=>({cls:B(e.b).own?"me":"",s:[nm(e.b),e.date,e.title,e.src],c:[bname(e.b),dfmt(e.date),`<b>${esc(e.title.replace(/^Оффер:\s*/,""))}</b> <span class="note">${esc((e.detail||"").slice(0,140))}</span>`,e.link?`<a class="lnk" href="${esc(e.link)}" target="_blank" rel="noopener">${esc(e.src)} ↗</a>`:esc(e.src)]})),{limit:10}):'<div class="empty">Новых офферов за 14 дней не найдено</div>';
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

function renderSt(){
  const H=D.health, ic={ok:"p-good",warn:"p-warn",fail:"p-bad"}, tx={ok:"работает",warn:"замечание",fail:"сбой"};
  $("#st-sub").textContent=H?`проверено ${H.at} (Ташкент): ${H.n.ok} из ${H.checks.length}`:"";
  $("#st-checks").innerHTML=H?H.checks.map(c=>`<div class="srow"><span class="pill ${ic[c.st]}">${tx[c.st]}</span><div><div class="t"><b>${esc(c.name)}</b></div><div class="m">${esc(c.msg)}</div></div></div>`).join(""):'<div class="empty">Проверки появятся после ближайшего сбора</div>';
  const lab={igc:"Instagram конкурентов",trends:"Google Trends",tgw:"Telegram: список каналов",media:"Сайты СМИ",tg:"Telegram: поиск и наши каналы",ig:"Instagram (наш)",ads:"Под рекламой",play:"Google Play (отзывы)",appstore:"App Store (отзывы)",yt:"YouTube"};
  loadMn().then(d=>{ if(!d||!d.status) throw 0; $("#st-src").innerHTML=table("st-src",[{h:"Источник",l:1},{h:"Статус",l:1},{h:"Последний запуск",l:1},{h:"Заметка",l:1}],
    d.status.map(x=>{ const ok=x.ok===1&&!x.note; return {s:[lab[x.s]||x.s,ok?0:x.ok===0?2:1,x.at,x.note||""],c:[esc(lab[x.s]||x.s),`<span class="pill ${ok?"p-good":x.ok===0?"p-bad":"p-warn"}">${ok?"работает":x.ok===0?"ошибка":x.ok===1?"замечание":"нет ключа"}</span>`,esc(x.at||""),`<span class="note" style="white-space:normal;display:block;min-width:240px;max-width:520px">${esc((x.note||"").slice(0,220))}</span>`]} })) }).catch(()=>{ $("#st-src").innerHTML='<div class="empty">Не удалось загрузить состояние сбора упоминаний</div>' }) }
const R={mn:renderMn,boss:renderBoss,jr:renderJr,ads:renderAds,off:renderOff,app:renderApp,me:renderMe,st:renderSt};

// ---------- header: one place for freshness, in Tashkent time ----------
function freshStrip(){ const el=$("#fresh"); if(!D) return;
  const now=Date.now(), col=h=>h>54?"var(--bad)":h>30?"var(--warn)":"var(--good)";
  const it=(label,ms,okH,extra)=>{ if(ms==null||isNaN(ms)) return `<span><i class="fd" style="background:var(--fg3)"></i>${label}: нет данных</span>`; const h=Math.round((now-ms)/36e5);
    return `<span data-tip="${h>okH?`Не обновлялось ${h} ч — дольше обычного, цифры могут отставать`:"Данные свежие"}${extra?". "+extra:""}"><i class="fd" style="background:${col(h)}"></i>${label}: ${tashkent(ms)}${h>okH?` <b class="cw">${h} ч назад</b>`:""}</span>` };
  const ad=D.info.date, ap=Object.keys(D.apps||{}).sort().pop(), tg=Object.keys(D.tg_hist||{}).sort().pop();
  const same=ad===ap&&ap===tg, dts=same?`данные на ${dfmt(ad)}`:`реклама ${dfmt(ad)}, приложения ${dfmt(ap)}, Telegram ${dfmt(tg)}`;
  const mb=MN&&MN.built?Date.parse(MN.built.replace(" ","T")+"+05:00"):null;
  const H=D.health, hc=H?`<span data-tip="${esc((H.checks||[]).filter(c=>c.st!=="ok").map(c=>c.name+": "+c.msg).join(" • ")||"Все автопроверки пройдены")} (проверено ${esc(H.at)}, Ташкент)"><i class="fd" style="background:var(--${H.overall==="ok"?"good":H.overall==="warn"?"warn":"bad"})"></i>Проверки: ${H.n.ok} из ${H.checks.length}${H.n.fail?` <b class="cw">${H.n.fail} сбой</b>`:H.n.warn?` <b class="cw">${H.n.warn} замеч.</b>`:""}</span>`:""
  const mbad=((typeof MN!=="undefined"&&MN&&MN.status)||[]).filter(x=>x.ok!==1||(x.note&&String(x.note).trim()));
  const hc2=hc+(mbad.length?` <span data-tip="${esc(mbad.map(x=>x.s+": "+(x.note||"ошибка")).join(" • ").slice(0,600))}"><i class="fd" style="background:var(--warn)"></i>Сбор упоминаний: <b class="cw">${mbad.length} с замечаниями</b></span>`:"");
  el.innerHTML=it("Радар",builtMs(),30,"Реклама, приложения, Telegram — "+dts)+it("Упоминания",mb,14)+hc2+`<span class="note hide-m">время — Ташкент</span>` }
function covNote(t){ const p=$("#p-"+t); if(!p) return; let el=p.querySelector(":scope > .covnote");
  const dd=Object.keys(D.daily||{}).sort(), aa=Object.keys(D.apps||{}).sort(), tt=Object.keys(D.tg_hist||{}).sort();
  const CN={ads:`Снимки рекламы с ${dfmt(dd[0])} (${dd.length} ${plural(dd.length,"снимок","снимка","снимков")}). Объявления, выключенные до первого снимка, не видны. Bellissimo — вся страница бренда, включая франшизу и найм.`,
    off:`Данные об офферах с ${dfmt(dd[0])}: только активные объявления и публичные Telegram-каналы. Выключенные акции не видны.`,
    app:`Снимки с ${dfmt(aa[0])}. Рейтинг App Store округлён до 0,1. У Dodo и Yandex в Google Play общий мировой рейтинг.`,
    jr:`События с ${dfmt(dd[0])}: до первого снимка радар ничего не знает. Всплески негатива о нас берутся из «Упоминаний».`};
  const lc=lowCov(); if(lc.length&&(t==="ads"||t==="off")) CN[t]+=` Тексты собраны не полностью (Facebook не отдаёт часть объявлений): ${lc.map(o=>`${B(o.b).name} ${Math.round(100*o.x.p)}%`).join(", ")}. По этим брендам офферы, цены и число сообщений занижены.`;
  if(!CN[t]){ if(el) el.remove(); return }
  if(!el){ el=document.createElement("p"); el.className="note covnote"; p.prepend(el) }
  el.textContent="⚠ "+CN[t] }

// ---------- state in the address bar, so a view can be shared by link ----------
let urlLock=false;
function writeURL(){ if(urlLock) return; const p=new URLSearchParams();
  if(S.tab==="ads"){ if(S.brands.size) p.set("b",[...S.brands].join(",")); ["goal","tag","fmt","q"].forEach(k=>{ if(S[k]) p.set(k,S[k]) }); if(S.sort!=="new") p.set("sort",S.sort); if(S.hire) p.set("hire","1"); if(!S.raw) p.set("merge","1"); if(S.nw) p.set("new","1") }
  if((S.tab==="ads"||S.tab==="off")&&S.lang!=="all") p.set("lang",S.lang);
  if(S.tab==="off"&&S.prc) p.set("cat",S.prc);
  if(S.tab==="off"&&S.tgb) p.set("tg",S.tgb);
  if(S.tab==="jr"){ const f=S.jr; if(f.per!=="30") p.set("per",f.per); if(f.b) p.set("b",f.b); if(f.t) p.set("t",f.t); if(f.hi) p.set("hi","1"); if(!f.own) p.set("own","0") }
  const q=p.toString(), h="#"+S.tab+(q?"?"+q:""); if(location.hash!==h) history.replaceState(null,"",h) }
function readURL(){ const h=decodeURIComponent(location.hash.slice(1)); if(!h) return false; const [t,q]=h.split("?"), p=new URLSearchParams(q||"");
  if(t==="tg"){ S.tab="off"; S.tgb=p.get("b")||""; return true }
  if(t==="ov"){ S.tab="ads"; return true }
  if(!R[t]) return false; S.tab=t;
  if(t==="ads"){ S.brands=new Set((p.get("b")||"").split(",").filter(Boolean)); S.goal=p.get("goal")||""; S.tag=p.get("tag")||""; S.fmt=p.get("fmt")||""; S.q=p.get("q")||""; S.sort=p.get("sort")||"new"; S.hire=p.get("hire")==="1"; S.raw=p.get("merge")!=="1"; S.nw=p.get("new")==="1" }
  if(t==="ads"||t==="off") S.lang=["UZ","RU"].includes(p.get("lang"))?p.get("lang"):"all";
  if(t==="off"){ S.prc=p.get("cat")||""; S.tgb=p.get("tg")||"" }
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
window.addEventListener("hashchange",()=>{ if(readURL()) show(S.tab) });
document.addEventListener("click",e=>{ const b=e.target.closest(".seg.lang button"); if(!b) return; S.lang=b.dataset.v; S.limit=24; rerender() });
$("#f-brand").addEventListener("click",e=>{ const b=e.target.closest(".chip"); if(!b) return; const k=b.dataset.b; S.brands.has(k)?S.brands.delete(k):S.brands.add(k); S.limit=24; rerender() });
[["#f-goal","goal"],["#f-tag","tag"],["#f-fmt","fmt"],["#f-sort","sort"]].forEach(([s,k])=>$(s).addEventListener("change",e=>{ S[k]=e.target.value; S.limit=24; rerender() }));
[["#f-raw","raw"],["#f-hire","hire"],["#f-new","nw"]].forEach(([s,k])=>$(s).addEventListener("change",e=>{ S[k]=e.target.checked; S.limit=24; rerender() }));
let qt; $("#f-q").addEventListener("input",e=>{ clearTimeout(qt); qt=setTimeout(()=>{ S.q=e.target.value; S.limit=24; rerender() },200) });
$("#f-reset").addEventListener("click",()=>{ Object.assign(S,{brands:new Set(),goal:"",tag:"",fmt:"",sort:"new",q:"",hire:false,raw:true,nw:false,limit:24}); rerender() });
$("#ads-more").addEventListener("click",()=>{ S.limit+=24; rerender() });
$("#pr-cat").addEventListener("change",e=>{ S.prc=e.target.value; LIM["off-pr"]=0; rerender() });
$("#tg-b").addEventListener("change",e=>{ S.tgb=e.target.value; rerender() });
$("#tg-more").addEventListener("click",()=>{ LIM["tg"]=(LIM["tg"]||8)+15; rerender() });
$("#jr-more").addEventListener("click",()=>{ LIM["jr"]=(LIM["jr"]||30)+30; rerender() });
[["#jr-per","per"],["#jr-b","b"],["#jr-t","t"]].forEach(([s,k])=>$(s).addEventListener("change",e=>{ S.jr[k]=e.target.value; rerender() }));
[["#jr-hi","hi"],["#jr-own","own"]].forEach(([s,k])=>$(s).addEventListener("change",e=>{ S.jr[k]=e.target.checked; rerender() }));

// tabs row: fade on the side that has more tabs to scroll to
(()=>{ const t=$("#tabs"), f=()=>{ t.classList.toggle("fr",t.scrollLeft+t.clientWidth<t.scrollWidth-4); t.classList.toggle("fl",t.scrollLeft>4) }; t.addEventListener("scroll",f,{passive:true}); addEventListener("resize",f); setTimeout(f,50) })();

(async()=>{
  if(!readURL()) S.tab=R[ls.get("cr.tab","boss")]?ls.get("cr.tab","boss"):"boss";
  $$(".panel").forEach(p=>p.hidden=p.id!=="p-"+S.tab);
  try{ D=await load("data/comp.json") }catch(e){ $("#fresh").innerHTML=esc(e.message)+' <button id="retry" class="chip">Повторить</button>'; return }
  try{ J=await load("data/journal.json") }catch(e){}
  try{ D.health=await load("data/health.json",1) }catch(e){}
  show(S.tab);
  loadMn().then(()=>{ if(S.tab==="boss"||S.tab==="jr") rerender() });
})();

(()=>{ const tip=document.createElement("div"); tip.id="tip"; document.body.appendChild(tip);
  document.addEventListener("mouseover",e=>{ const t=e.target.closest("[data-tip]"); if(!t){ tip.style.display="none"; return } tip.textContent=t.getAttribute("data-tip"); tip.style.display="block" });
  document.addEventListener("mousemove",e=>{ if(tip.style.display!=="block") return; const x=Math.min(e.clientX+12, innerWidth-tip.offsetWidth-8); tip.style.left=Math.max(8,x)+"px"; tip.style.top=(e.clientY+14)+"px" });
  document.addEventListener("touchstart",e=>{ const t=e.target.closest("[data-tip]"); if(!t){ tip.style.display="none"; return } tip.textContent=t.getAttribute("data-tip"); tip.style.display="block"; const r=t.getBoundingClientRect(); tip.style.left=Math.max(8,Math.min(r.left, innerWidth-tip.offsetWidth-8))+"px"; tip.style.top=(r.bottom+6)+"px" },{passive:true});
})();
