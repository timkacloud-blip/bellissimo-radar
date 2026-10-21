"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=n=>n==null||!isFinite(n)?"—":Math.round(n).toLocaleString("ru-RU");
const kfmt=n=>n==null?"—":n>=1e6?(n/1e6).toFixed(n>=1e7?0:1)+" млн":n>=1e4?Math.round(n/1e3)+" тыс":fmt(n);
const ls={get(k,d){try{return localStorage.getItem(k)??d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const S={tab:ls.get("cr.tab","boss"),lang:"all",brands:new Set(),goal:"",tag:"",fmt:"",sort:"new",q:"",hire:false,limit:60};
let D=null, TH={}, thumbsLoaded=false;

async function load(u,tries=4){ for(let i=0;i<tries;i++){ try{ const r=await fetch(u,{cache:"no-cache"}); if(r.ok) return await r.json() }catch(e){} await new Promise(r=>setTimeout(r,600*(i+1))) } throw new Error("Не удалось загрузить "+u) }
const B=b=>D.brands[b]||{name:b,color:"#888"};
const dot=b=>`<i class="bdot" style="background:${B(b).color}"></i>`;
const bname=b=>dot(b)+esc(B(b).name);
const daysAgo=d=>Math.round((new Date(D.info.date)-new Date(d))/864e5);
const ORDER=["bellissimo","kfc","evos","oqtepa","dodo","maxway","sariqbola","hardees","safia","uzum","yandex"];
function dedupe(A){ const m=new Map(); A.forEach(a=>{ const k=a.b+"|"+(a.body||a.title||a.id).slice(0,80); const x=m.get(k); if(x){ x.sim++; const dmax=Math.max(x.days||0,a.days||0), smin=[x.start,a.start].filter(Boolean).sort()[0]; if(!TH[x.id]&&TH[a.id]) Object.assign(x,a,{sim:x.sim}); x.days=dmax; if(smin) x.start=smin } else m.set(k,Object.assign({},a,{sim:0})) }); return [...m.values()] }
const active=()=>D.ads.filter(a=>a.active&&(S.lang==="all"||a.lang===S.lang));

function rise(root){ if(matchMedia("(prefers-reduced-motion: reduce)").matches) return; [...root.children].forEach((el,i)=>{ el.classList.remove("rise"); void el.offsetWidth; el.style.animationDelay=(i*45)+"ms"; el.classList.add("rise") }) }

// ---------- cards ----------
function adCard(a){
  const t=TH[a.id], n=a.start&&daysAgo(a.start)<7;
  const txt=a.body||a.title||(a.catalog?"Каталожная реклама (товары из фида)":"");
  return `<article class="ad${n?" new":""}">
    <div class="im">${t?`<img loading="lazy" src="${t}" alt="Креатив ${esc(B(a.b).name)}">`:`<div class="ph">${thumbsLoaded?"нет превью":"загружаю превью…"}</div>`}
      <div class="bt"><span class="pill">${esc(B(a.b).name)}</span>${n?'<span class="pill">новое</span>':""}${a.fmt?`<span class="pill">${a.fmt==="DCO"?"DCO":a.fmt==="VIDEO"?"видео":"фото"}</span>`:""}</div></div>
    <div class="bd">
      <div class="tags">${a.offer&&a.offer!=="Без оффера"&&a.offer!=="Найм"?`<span class="pill p-good">${esc(a.offer)}</span>`:""}<span class="pill p-acc">${esc(a.goal)}</span>${a.tags.filter(x=>x!=="Цена"&&x!==a.offer).slice(0,2).map(x=>`<span class="pill p-mute">${esc(x)}</span>`).join("")}</div>
      <div class="tx" title="Нажмите, чтобы раскрыть">${esc(txt)}</div>
      <div class="meta"><span>с ${esc(a.start||"?")} · ${a.days??"?"} дн.</span><span>${a.n>1?"вариантов: "+a.n:"1 вариант"}${a.sim?` · +${a.sim} похож.`:""} · ${esc(a.lang)}</span></div>
      <div class="meta"><span>${a.prices.length?a.prices.map(p=>fmt(p)).join(" / ")+" сум":""}</span><a href="https://www.facebook.com/ads/library/?id=${a.id}" target="_blank" rel="noopener">в Ad Library ↗</a></div>
    </div></article>`;
}
document.addEventListener("click",e=>{ const t=e.target.closest(".ad .tx"); if(t) t.classList.toggle("open") });

// ---------- tabs ----------
function renderOv(){
  const A=active(), L=D.info.date, ios=(D.apps[L]||D.apps[Object.keys(D.apps).pop()]||{}).ios||{};
  const tiles=ORDER.filter(b=>D.brands[b]).map(b=>{
    const x=A.filter(a=>a.b===b), n7=dedupe(x.filter(a=>a.start&&daysAgo(a.start)<7)).length, tot=(D.daily[L]||{})[b];
    const ch=ios[b]&&ios[b][3]; const own=B(b).own;
    return `<div class="tile${own?" st-good":""}"><div class="k">${bname(b)}</div><div class="v">${tot?fmt(tot.total):"—"}</div>
      <div class="d"><span>объявл. · ${dedupe(x).length} разных сообщений</span>${n7?`<span class="pill p-acc">+${n7} новых за 7 дн</span>`:""}</div>
      <div class="d">${ch?`App Store #${ch}`:""}${D.tg[b]&&D.tg[b].subs?` · TG ${kfmt(D.tg[b].subs)}`:""}</div></div>` }).join("");
  $("#ov-tiles").innerHTML=tiles;
  const lv={bad:"p-bad",warn:"p-warn",good:"p-good",acc:"p-acc",mute:"p-mute"}, lt={bad:"угроза",warn:"внимание",good:"плюс",acc:"новое",mute:"факт"};
  $("#ov-ins").innerHTML=D.insights.filter(i=>!i.b||!B(i.b).own||i.lvl!=="mute").map(i=>`<div class="srow"><span class="pill ${lv[i.lvl]}">${lt[i.lvl]}</span><div><div class="t">${i.b?dot(i.b):""}<b>${esc(i.t)}</b></div><div class="m">${esc(i.m)}</div></div></div>`).join("")||'<div class="empty">Пока нечего сказать</div>';
  // share of voice
  const day=D.daily[L]||{}, tot=ORDER.reduce((s,b)=>s+((day[b]||{}).total||0),0), mx=Math.max(...ORDER.map(b=>(day[b]||{}).total||0));
  $("#ov-sov").innerHTML=ORDER.filter(b=>day[b]).sort((x,y)=>day[y].total-day[x].total).map(b=>`<div class="brow"><span>${bname(b)}</span><div class="bbar"><i class="grow" data-tip="${esc(B(b).name)}: ${fmt(day[b].total)} объявлений" style="width:${100*day[b].total/mx}%;background:${B(b).color}"></i></div><span class="num" style="text-align:right">${fmt(day[b].total)} объявл. · ${dedupe(A.filter(a=>a.b===b)).length} сообщ. · ${Math.round(100*day[b].total/tot)}%</span></div>`).join("");
  $("#ov-sov-n").textContent="Объявления — как считает Meta: каждый вариант картинки, языка и копия в другой группе — отдельное объявление. Сообщения — разные по тексту объявления, похожие склеены в одну карточку галереи. Число объявлений ≠ бюджет.";
  // observed history: only days we actually snapshotted (no back-filling)
  const days=Object.keys(D.daily).sort().slice(-30), first=days[0];
  const mxd=Math.max(1,...days.map(d=>ORDER.reduce((s,b)=>s+(((D.daily[d]||{})[b]||{}).total||0),0)));
  const W=640,H=200,bw=W/Math.max(days.length,7);
  let svg=`<svg class="cad" viewBox="0 0 ${W} ${H+22}" role="img" aria-label="Активные объявления по дням">`;
  days.forEach((d,i)=>{ let y=H; ORDER.forEach(b=>{ const v=(((D.daily[d]||{})[b]||{}).total)||0; if(!v) return; const h=v/mxd*(H-14); y-=h; svg+=`<rect x="${i*bw+5}" y="${y}" width="${bw-10}" height="${h}" rx="3" fill="${B(b).color}" data-tip="${B(b).name}: ${v} объявл. (${d})"></rect>` });
    const s=ORDER.reduce((t,b)=>t+(((D.daily[d]||{})[b]||{}).total||0),0); svg+=`<text x="${i*bw+bw/2}" y="${y-3}" text-anchor="middle">${s}</text><text x="${i*bw+bw/2}" y="${H+15}" text-anchor="middle">${d.slice(8,10)}.${d.slice(5,7)}</text>` });
  if(days.length<7) svg+=`<text x="${W-8}" y="24" text-anchor="end">данные копятся с ${first.slice(8,10)}.${first.slice(5,7)} — что было раньше, Meta не показывает</text>`;
  $("#ov-cad").innerHTML=svg+"</svg>";
  $("#ov-cad-leg").innerHTML=ORDER.filter(b=>A.some(a=>a.b===b)).map(b=>`<span><i style="background:${B(b).color}"></i>${esc(B(b).name)}</span>`).join("");
  $("#ov-goal-leg").innerHTML=ORDER.filter(b=>A.some(a=>a.b===b)).map(b=>`<span><i style="background:${B(b).color}"></i>${esc(B(b).name)}</span>`).join("");
  // goals
  const AU=dedupe(A), goals=[...new Set(AU.map(a=>a.goal))]; const G={}; AU.forEach(a=>{ (G[a.goal]=G[a.goal]||{}); G[a.goal][a.b]=(G[a.goal][a.b]||0)+1 });
  const gt=g=>Object.values(G[g]).reduce((s,v)=>s+v,0); const gm=Math.max(...goals.map(gt));
  $("#ov-goal").innerHTML=goals.sort((x,y)=>gt(y)-gt(x)).map(g=>`<div class="brow"><span>${esc(g)}</span><div class="bbar">${ORDER.filter(b=>G[g][b]).map(b=>`<i data-tip="${esc(B(b).name)}: ${G[g][b]}" style="width:${100*G[g][b]/gm}%;background:${B(b).color}"></i>`).join("")}</div><span class="num" style="text-align:right">${gt(g)}</span></div>`).join("");
  const nw=dedupe(A.filter(a=>a.start&&daysAgo(a.start)<7&&!B(a.b).own&&a.goal!=="Найм")).sort((x,y)=>y.start.localeCompare(x.start));
  $("#ov-new-sub").textContent=nw.length+" уникальных у конкурентов · без найма и наших";
  $("#ov-new").innerHTML=nw.slice(0,24).map(adCard).join("")||'<div class="empty">Новых нет</div>';
}

function fillSelect(el,label,vals){ const cur=el.value; el.innerHTML=`<option value="">${label}</option>`+vals.map(v=>`<option${v===cur?" selected":""}>${esc(v)}</option>`).join("") }
function renderAds(){
  const A0=active();
  if(!$("#f-brand").children.length){
    $("#f-brand").innerHTML=ORDER.filter(b=>A0.some(a=>a.b===b)).map(b=>`<button class="chip" data-b="${b}" aria-pressed="false">${bname(b)} <span class="note" style="margin-left:5px">${A0.filter(a=>a.b===b).length}</span></button>`).join("");
    fillSelect($("#f-goal"),"Любая цель",[...new Set(A0.map(a=>a.goal))].sort());
    fillSelect($("#f-tag"),"Любая механика",[...new Set(A0.flatMap(a=>a.tags))].sort());
  }
  const q=S.q.trim().toLowerCase();
  let A=A0.filter(a=>(!S.brands.size||S.brands.has(a.b))&&(!S.goal||a.goal===S.goal)&&(!S.tag||a.tags.includes(S.tag))&&(!S.fmt||a.fmt===S.fmt)&&(S.hire||S.goal==="Найм"||a.goal!=="Найм")&&(!q||(a.body+" "+a.title+" "+a.link).toLowerCase().includes(q)));
  const so={new:(x,y)=>(y.start||"").localeCompare(x.start||""),long:(x,y)=>(y.days||0)-(x.days||0),ver:(x,y)=>y.n-x.n}[S.sort]; if(!S.raw) A=dedupe(A); A.sort(so);
  $("#ads-sub").textContent=`${A.length} групп${S.hire?"":" · найм скрыт"}`;
  $("#ads-gal").innerHTML=A.slice(0,S.limit).map(adCard).join("")||'<div class="empty">Ничего не найдено — ослабьте фильтры</div>';
  $("#ads-more").hidden=A.length<=S.limit;
  const LG=dedupe(A0.filter(a=>(a.days||0)>=30&&a.goal!=="Найм").sort((x,y)=>y.days-x.days)).sort((x,y)=>y.days-x.days).slice(0,40);
  $("#ads-long").innerHTML=LG.length?`<table><thead><tr><th>Креатив</th><th style="text-align:left">Бренд</th><th>Дней</th><th>Цель</th><th style="text-align:left">Текст</th><th></th></tr></thead><tbody>${LG.map(a=>`<tr><td>${TH[a.id]?`<img src="${TH[a.id]}" alt="" loading="lazy" style="width:64px;height:80px;object-fit:cover;border-radius:8px;display:block">`:'<div style="width:64px;height:80px;border-radius:8px;background:var(--bg2)"></div>'}</td><td style="text-align:left">${bname(a.b)}</td><td><b>${a.days}</b></td><td>${esc(a.goal)}</td><td class="name" style="text-align:left;white-space:normal;max-width:560px">${esc((a.body||a.title||"без текста — только картинка").split(/-{3,}|—{3,}|_{3,}/)[0].slice(0,180))}</td><td><a href="https://www.facebook.com/ads/library/?id=${a.id}" target="_blank" rel="noopener" style="color:var(--acc);text-decoration:none;font-size:12px">открыть ↗</a></td></tr>`).join("")}</tbody></table>`:'<div class="empty">Нет объявлений старше 30 дней</div>';
}

function renderOff(){
  const A=active().filter(a=>a.goal!=="Найм"), tags=[...new Set(A.map(a=>a.offer))].filter(t=>t!=="Цена").sort((x,y)=>(x==="Без оффера"||x==="Каталог товаров")-(y==="Без оффера"||y==="Каталог товаров")||x.localeCompare(y));
  const brands=ORDER.filter(b=>A.some(a=>a.b===b));
  const cnt=(b,t)=>A.filter(a=>a.b===b&&a.offer===t).length, mx=Math.max(1,...brands.flatMap(b=>tags.map(t=>cnt(b,t))));
  $("#off-mx").innerHTML=`<table class="matrix"><thead><tr><th>Бренд</th>${tags.map(t=>`<th>${esc(t)}</th>`).join("")}<th>Всего групп</th></tr></thead><tbody>${brands.map(b=>`<tr><td>${bname(b)}</td>${tags.map(t=>{const v=cnt(b,t); return `<td>${v?`<span class="mcell" style="background:color-mix(in srgb,${B(b).color} ${15+70*v/mx}%,transparent);color:${v/mx>.5?"#fff":"var(--fg)"}">${v}</span>`:'<span class="note">·</span>'}</td>`}).join("")}<td>${A.filter(a=>a.b===b).length}</td></tr>`).join("")}</tbody></table>`;
  const PR=[]; brands.forEach(b=>{ const seen=new Set(); A.filter(a=>a.b===b).sort((x,y)=>(y.start||"").localeCompare(x.start||"")).forEach(a=>a.prices.forEach(p=>{ if(seen.has(p)) return; seen.add(p); PR.push({b,p,a}) })) });
  PR.sort((x,y)=>ORDER.indexOf(x.b)-ORDER.indexOf(y.b)||x.p-y.p);
  $("#off-pr").innerHTML=PR.length?`<table><thead><tr><th>Бренд</th><th>Цена, сум</th><th style="text-align:left">За что (начало объявления)</th><th>Старт</th></tr></thead><tbody>${PR.map(x=>`<tr><td>${bname(x.b)}</td><td><b>${fmt(x.p)}</b></td><td style="text-align:left;white-space:normal;max-width:420px">${esc((x.a.body||x.a.title||"").split(/-{3,}|—{3,}|_{3,}/)[0].slice(0,110))}</td><td>${esc(x.a.start||"")}</td></tr>`).join("")}</tbody></table>`:'<div class="empty">Цен не найдено</div>';
  const C={}; active().forEach(a=>a.codes.forEach(c=>{ (C[c]=C[c]||{b:a.b,n:0,src:"Meta"}); C[c].n++ }));
  (D.tg_posts||[]).forEach(p=>(p.txt||"").match(/\b[A-Z]{3,}\d{2,}\b/g)?.forEach(c=>{ (C[c]=C[c]||{b:p.b,n:0,src:"Telegram"}); C[c].n++ }));
  const cs=Object.entries(C).sort((x,y)=>y[1].n-x[1].n);
  $("#off-codes").innerHTML=cs.length?`<table><thead><tr><th>Код</th><th>Бренд</th><th>Где</th><th>Упоминаний</th></tr></thead><tbody>${cs.map(([c,x])=>`<tr><td><b>${esc(c)}</b></td><td>${bname(x.b)}</td><td>${x.src}</td><td>${x.n}</td></tr>`).join("")}</tbody></table>`:'<div class="empty">Промокодов не найдено</div>';
  const seen=new Set(), U=[]; A.slice().sort((x,y)=>(y.start||"").localeCompare(x.start||"")).forEach(a=>{ const k=a.b+(a.body||"").slice(0,70); if(!a.body||seen.has(k)) return; seen.add(k); U.push(a) });
  $("#off-list").innerHTML=`<table><thead><tr><th>Старт</th><th>Бренд</th><th style="text-align:left">Механики</th><th style="text-align:left">Текст</th></tr></thead><tbody>${U.slice(0,80).map(a=>`<tr><td>${esc(a.start)}</td><td>${bname(a.b)}</td><td style="text-align:left;white-space:normal">${a.tags.filter(t=>t!=="Цена").map(t=>`<span class="pill p-mute">${esc(t)}</span>`).join(" ")}</td><td style="text-align:left;white-space:normal;max-width:640px">${esc(a.body.slice(0,240))}</td></tr>`).join("")}</tbody></table>`;
}

function renderApp(){
  const ds=Object.keys(D.apps).sort(), L=ds[ds.length-1], P=ds.length>1?D.apps[ds[ds.length-2]]:null, a=D.apps[L]||{};
  const dl=(b,i,k)=>{ if(!P||!P[k]||!P[k][b]) return ""; const v=a[k][b][i]-P[k][b][i]; return v?` <span class="${v>0?"up":"dn"}">${v>0?"+":""}${fmt(v)}</span>`:"" };
  const ios=a.ios||{};
  const rows=ORDER.filter(b=>ios[b]).sort((x,y)=>(+ios[x][3]||999)-(+ios[y][3]||999));
  $("#app-ios").innerHTML=`<table><thead><tr><th>Приложение</th><th>Место</th><th>Оценок</th><th>Средняя</th><th>5★ → 1★</th><th>Версия</th></tr></thead><tbody>${rows.map(b=>{ const v=ios[b], h=(v[2]||"").split(",").map(Number), hm=Math.max(1,...h);
    const chg=P&&P.ios&&P.ios[b]&&P.ios[b][3]&&v[3]?(+P.ios[b][3])-(+v[3]):0;
    return `<tr><td>${bname(b)}${b==="yandex"?'':""}</td><td><b>#${v[3]||"—"}</b>${chg?` <span class="${chg>0?"up":"dn"}">${chg>0?"↑":"↓"}${Math.abs(chg)}</span>`:""}</td><td>${fmt(v[0])}${dl(b,0,"ios")}</td><td>${v[1]?(+v[1]).toFixed(1):"—"}</td><td><div class="hist5" title="${h.join(" / ")}">${h.map(x=>`<i style="height:${100*x/hm}%"></i>`).join("")}</div></td><td>${esc(v[4]||"—")}</td></tr>` }).join("")}</tbody></table>`;
  const ch=a.ios_chart||[], our=/kfc|bellissimo|evos|oqtepa|dodo|maxway|uzum|yandex|sariq|hardee|safia/i;
  $("#app-ch-sub").textContent="на "+L;
  $("#app-chart").innerHTML=ch.map((n,i)=>`<span class="n">${i+1}</span><span class="${our.test(n)?"hl":""}">${/bellissimo/i.test(n)?"★ ":""}${esc(n)}</span>`).join("");
  const pl=a.play||{};
  $("#app-play").innerHTML=`<table><thead><tr><th>Приложение</th><th>Рейтинг</th><th>Отзывов</th><th>Установок</th><th>Обновлено</th></tr></thead><tbody>${ORDER.filter(b=>pl[b]).sort((x,y)=>pl[y][1]-pl[x][1]).map(b=>{const v=pl[b]; return `<tr><td>${bname(b)}${["dodo","yandex"].includes(b)?' <span class="note">(весь мир)</span>':""}</td><td>${(+v[0]).toFixed(2)}</td><td>${fmt(v[1])}${dl(b,1,"play")}</td><td>${esc(v[2])}</td><td>${esc(v[3]||"—")}</td></tr>`}).join("")}</tbody></table>`;
}

function renderTg(){
  $("#tg-tiles").innerHTML=Object.entries(D.tg).map(([b,c])=>`<div class="tile"><div class="k">${bname(b)}</div><div class="v">${kfmt(c.subs)}</div><div class="d">@${esc(c.handle)} · ${fmt(c.photos)} фото · ${fmt(c.videos)} видео</div></div>`).join("")+
    `<div class="tile"><div class="k">Нет каналов</div><div class="v" style="font-size:15px">KFC, Oqtepa, MaxWay, Dodo, Sariq Bola, Hardee's</div><div class="d">публичных каналов нет или они заброшены</div></div>`;
  $("#tg-posts").innerHTML=(D.tg_posts||[]).slice(0,40).map(p=>`<div class="post"><div class="w">${bname(p.b)}<span>${esc((p.t||"").slice(0,16).replace("T"," "))}</span><span>👁 ${esc(p.v)}</span>${p.tags.filter(t=>t!=="Цена").map(t=>`<span class="pill p-mute">${esc(t)}</span>`).join("")}<a href="https://t.me/${esc(p.id)}" target="_blank" rel="noopener" style="color:var(--acc);text-decoration:none">открыть ↗</a></div><div>${esc(p.txt||(p.img?"[фото]":p.vid?"[видео]":"—"))}</div></div>`).join("")||'<div class="empty">Нет постов</div>';
}

function renderMe(){
  const L=D.info.date, day=D.daily[L]||{};
  $("#me-br").innerHTML=`<table><thead><tr><th>Бренд</th><th>Объявлений</th><th>Групп</th><th>Подписчиков страницы</th></tr></thead><tbody>${ORDER.filter(b=>D.brands[b]).map(b=>`<tr><td>${bname(b)}</td><td>${day[b]?fmt(day[b].total):"—"}</td><td>${day[b]?fmt(day[b].groups):"—"}</td><td>${fmt(B(b).likes)}</td></tr>`).join("")}</tbody></table>`;
  $("#me-upd").textContent=`Снимков: ${D.info.dates.length} (${D.info.dates[0]} — ${L}). Собрано ${D.info.built} UTC. Обновляется ежедневно утром.`;
}


// ---------- leadership + journal ----------
let J={events:[],coverage:{}};
const TYP={offer:"Оффер",open:"Открытие",ads:"Реклама",wave:"Новые креативы",app:"Приложение",rating:"Рейтинг и топ",hire:"Найм",other:"Другое"};
const dfmt=x=>x?x.slice(8,10)+"."+x.slice(5,7):"—";
const dago=(d,n)=>{ const t=new Date(Date.now()+5*3600e3); t.setUTCDate(t.getUTCDate()-n); return t.toISOString().slice(0,10)>d };
function evRow(e){ const lv=e.imp==="high"?"p-acc":"p-mute";
  return `<div class="srow"><span class="pill ${lv}">${esc(TYP[e.type]||e.type)}</span><div><div class="t">${dot(e.b)}<b>${esc(B(e.b).name)}</b> · ${dfmt(e.date)} · ${esc(e.title)}</div>${e.detail?`<div class="m">${esc(e.detail.slice(0,200))}</div>`:""}<div class="m">${esc(e.src||"")}${e.link?` · <a href="${esc(e.link)}" target="_blank" rel="noopener" style="color:var(--acc);text-decoration:none">открыть ↗</a>`:""}</div></div></div>` }
function renderBoss(){
  const cov=J.coverage||{}, last7=d=>!dago(d,7), ad=(cov.adlib||[]).filter(last7).length;
  $("#boss-cov").textContent=`Реклама Meta собрана за ${ad} из последних 7 дней · приложения и Telegram — ежедневно. Сравнение идёт только по реальным снимкам.`;
  const top=J.events.filter(e=>e.imp==="high"&&e.b!=="bellissimo"&&last7(e.date));
  $("#boss-top").innerHTML=top.slice(0,8).map(evRow).join("")||'<div class="empty">За 7 дней крупных изменений у конкурентов не было</div>';
  const ds=Object.keys(D.daily).sort(), now=ds[ds.length-1], wk=[...ds].reverse().find(d=>dago(d,6)&&d<now)||ds[0];
  const T=d=>ORDER.reduce((s,b)=>s+(((D.daily[d]||{})[b]||{}).total||0),0);
  const rows=ORDER.filter(b=>(D.daily[now]||{})[b]).sort((x,y)=>D.daily[now][y].total-D.daily[now][x].total).map(b=>{ const n=D.daily[now][b].total, o=((D.daily[wk]||{})[b]||{}).total, ch=o?Math.round(100*(n-o)/o):null;
    return `<tr><td>${bname(b)}</td><td><b>${fmt(n)}</b></td><td>${o==null?"—":fmt(o)}</td><td>${ch==null||wk===now?"—":`<span class="${ch>0?"up":ch<0?"dn":""}">${ch>0?"+":""}${ch}%</span>`}</td><td>${(100*n/Math.max(1,T(now))).toFixed(0)}%</td></tr>` }).join("");
  $("#boss-ads").innerHTML=`<table><thead><tr><th>Бренд</th><th>Сейчас</th><th>${wk===now?"Неделю назад":dfmt(wk)}</th><th>Изменение</th><th>Доля</th></tr></thead><tbody>${rows}</tbody></table><p class="note">Доля — от всех активных объявлений брендов в радаре на ${dfmt(now)}.</p>`;
  const off=J.events.filter(e=>(e.type==="offer")&&!dago(e.date,14));
  const by={}; off.forEach(e=>{ (by[e.b]=by[e.b]||[]).push(e) });
  $("#boss-off").innerHTML=Object.keys(by).length?`<table><thead><tr><th>Бренд</th><th>Дата</th><th style="text-align:left">Оффер</th><th>Где</th></tr></thead><tbody>${ORDER.filter(b=>by[b]).flatMap(b=>by[b].slice(0,3).map(e=>`<tr><td>${bname(b)}</td><td>${dfmt(e.date)}</td><td style="text-align:left;white-space:normal;max-width:640px"><b>${esc(e.title.replace(/^(Новый оффер|Акция в Telegram)\s*·?\s*/,"")||"")}</b> ${esc(e.detail.slice(0,150))}</td><td>${e.link?`<a href="${esc(e.link)}" target="_blank" rel="noopener" style="color:var(--acc);text-decoration:none">${esc(e.src)} ↗</a>`:esc(e.src)}</td></tr>`)).join("")}</tbody></table>`:'<div class="empty">Новых офферов за 14 дней не найдено</div>';
  if(J.note&&J.note.text){ $("#boss-note-card").hidden=false; $("#boss-note").textContent=J.note.text; $("#boss-note-d").textContent="от "+dfmt(J.note.date) }
}
function renderJr(){
  const per=+$("#jr-per").value, bb=$("#jr-b").value, tt=$("#jr-t").value, hi=$("#jr-hi").checked, own=$("#jr-own").checked;
  if($("#jr-b").options.length<2){ $("#jr-b").innerHTML+=ORDER.filter(b=>J.events.some(e=>e.b===b)).map(b=>`<option value="${b}">${esc(B(b).name)}</option>`).join(""); $("#jr-t").innerHTML+=Object.keys(TYP).filter(t=>J.events.some(e=>e.type===t)).map(t=>`<option value="${t}">${TYP[t]}</option>`).join("") }
  const E=J.events.filter(e=>!dago(e.date,per)&&(!bb||e.b===bb)&&(!tt||e.type===tt)&&(!hi||e.imp==="high")&&(!own||e.b!=="bellissimo"));
  $("#jr-sub").textContent=E.length+" событий · снимки рекламы с "+dfmt((J.coverage.adlib||[])[0]);
  $("#jr-list").innerHTML=E.map(evRow).join("")||'<div class="empty">Событий нет</div>';
}
["#jr-per","#jr-b","#jr-t","#jr-hi","#jr-own"].forEach(s=>$(s).addEventListener("change",()=>renderJr()));
function renderMn(){ const p=document.getElementById("p-mn"); if(p.dataset.ok) return; p.innerHTML='<div class="empty">Загружаю…</div>';
  const RAW="https://raw.githubusercontent.com/timkacloud-blip/bellissimo-radar/main/site/", q="?"+Date.now();
  const getJson=u=>fetch(u).then(r=>{ if(!r.ok) throw 0; return r.json() });
  const getData=()=>getJson(RAW+"mentions_data.json"+q).catch(()=>getJson("mentions_data.json"+q));
  const getJs=()=>window.renderMentions?Promise.resolve():new Promise((ok,no)=>{ const s=document.createElement("script"); s.src="mentions.js"+q; s.onload=ok; s.onerror=no; document.head.appendChild(s) });
  Promise.all([getData(),getJs()]).then(([d])=>{ window.renderMentions(p,d); p.dataset.ok=1 }).catch(()=>{ p.innerHTML='<div class="empty">Данные упоминаний пока не опубликованы.</div>' }) }
const R={mn:renderMn,boss:renderBoss,jr:renderJr,ov:renderOv,ads:renderAds,off:renderOff,app:renderApp,tg:renderTg,me:renderMe};
function show(t){ S.tab=R[t]?t:"boss"; ls.set("cr.tab",S.tab); $$("#tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.t===S.tab)); $$(".panel").forEach(p=>p.hidden=p.id!=="p-"+S.tab); R[S.tab](); rise($("#p-"+S.tab)) }
function rerender(){ R[S.tab]() }

$("#tabs").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b) show(b.dataset.t) });
$("#lang").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; S.lang=b.dataset.v; $$("#lang button").forEach(x=>x.setAttribute("aria-pressed",x===b)); $("#f-brand").innerHTML=""; rerender() });
$("#f-brand").addEventListener("click",e=>{ const b=e.target.closest(".chip"); if(!b) return; const k=b.dataset.b; S.brands.has(k)?S.brands.delete(k):S.brands.add(k); b.setAttribute("aria-pressed",S.brands.has(k)); S.limit=60; renderAds() });
[["#f-goal","goal"],["#f-tag","tag"],["#f-fmt","fmt"],["#f-sort","sort"]].forEach(([s,k])=>$(s).addEventListener("change",e=>{ S[k]=e.target.value; S.limit=60; renderAds() }));
$("#f-raw").addEventListener("change",e=>{ S.raw=e.target.checked; renderAds() });
$("#f-hire").addEventListener("change",e=>{ S.hire=e.target.checked; renderAds() });
let qt; $("#f-q").addEventListener("input",e=>{ clearTimeout(qt); qt=setTimeout(()=>{ S.q=e.target.value; S.limit=60; renderAds() },200) });
$("#ads-more").addEventListener("click",()=>{ S.limit+=60; renderAds() });

(async()=>{
  try{ D=await load("data/comp.json") }catch(e){ $("#stamp").textContent=e.message; return }
  const ad_=D.info.date, ap_=Object.keys(D.apps||{}).sort().pop()||"—", f_=x=>x&&x.length>=10?x.slice(8,10)+"."+x.slice(5,7):x; $("#stamp").textContent=`Реклама на ${f_(ad_)} · приложения на ${f_(ap_)} · Telegram на ${f_(Object.keys(D.tg_hist||{}).sort().pop()||"—")} · обновлено ${f_(D.info.built.slice(0,10))} ${D.info.built.slice(11,16)} UTC`;
  try{ J=await load("data/journal.json") }catch(e){}
  $$("#lang button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v==="all"));
  show(S.tab);
  try{ TH=await load("data/thumbs.json") }catch(e){ TH={} }
  thumbsLoaded=true; if(S.tab==="ov"||S.tab==="ads") rerender();
})();

(()=>{ const tip=document.createElement("div"); tip.id="tip"; document.body.appendChild(tip);
  document.addEventListener("mouseover",e=>{ const t=e.target.closest("[data-tip]"); if(!t){ tip.style.display="none"; return } tip.textContent=t.getAttribute("data-tip"); tip.style.display="block" });
  document.addEventListener("mousemove",e=>{ if(tip.style.display!=="block") return; const x=Math.min(e.clientX+12, innerWidth-tip.offsetWidth-8); tip.style.left=x+"px"; tip.style.top=(e.clientY+14)+"px" });
  document.addEventListener("touchstart",e=>{ const t=e.target.closest("[data-tip]"); if(!t){ tip.style.display="none"; return } tip.textContent=t.getAttribute("data-tip"); tip.style.display="block"; const r=t.getBoundingClientRect(); tip.style.left=Math.min(r.left, innerWidth-tip.offsetWidth-8)+"px"; tip.style.top=(r.bottom+6)+"px" },{passive:true});
})();
