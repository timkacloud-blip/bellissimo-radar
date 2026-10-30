/* Вкладка «Упоминания»: все блоки считаются из одной таблицы фактов (mentions_data.json) по общему фильтру. */
(function(){
"use strict";
const E=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ad=(s,n)=>{const d=new Date(s+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const dm=s=>s?s.slice(8,10)+"."+s.slice(5,7)+(s.slice(0,4)!==String(new Date().getFullYear())?"."+s.slice(2,4):""):"";
const nd=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5)+1;
const fn=n=>n==null||isNaN(n)?"–":Math.round(n).toLocaleString("ru-RU").replace(/ /g," ");
const pc=v=>v==null?"–":(v>=10?v.toFixed(0):v.toFixed(1))+"%";
const sg=(v,u,d)=>{if(v==null)return"";const k=d==null?1:d,a=Math.abs(v).toFixed(k);return (Number(a)===0?"":v>0?"+":"−")+a+(u||"")};
const COL={bellissimo:"var(--acc)",dodo:"#ff7a00",kfc:"#e5173f",evos:"#1e88ff",oqtepa:"#1fa35c",maxway:"#d4a700",sariqbola:"#8d6e3f",hardees:"#00a5b5",safia:"#e056a7",uzum:"#7cb342",yandex:"#78909c",papajohns:"#c2410c",dominos:"#2b6cb0",apex:"#a3a3a3"};
const DASH={uzum:"6 3",yandex:"6 3",papajohns:"6 3",dominos:"2 3",apex:"2 3",safia:"6 3"};
const DEF=["bellissimo","dodo","kfc","evos","oqtepa","maxway","papajohns","sariqbola"];
const SRC={ig:"Instagram (наш)",ads:"Под рекламой",play:"Google Play",appstore:"App Store",tg:"Telegram",yt:"YouTube",media:"СМИ"};
const SRCD={ig:"комментарии под нашими постами в Instagram",ads:"комментарии под нашей рекламой в Facebook и Instagram",play:"отзывы на наше приложение в Google Play",appstore:"отзывы на наше приложение в App Store",tg:"наш канал в Telegram и упоминания в каналах",yt:"наш канал и видео про нас на YouTube",media:"публикации сайтов СМИ"};
const GRP=t=>t==="media"||t==="news"?"media":t==="region"?"region":"people";
const GN={media:"СМИ",people:"Люди",region:"Области"};
const INFO={
 search:"Сколько людей ищут бренд в Google в Узбекистане. Это интерес людей, он не зависит от нашей рекламы. Google отдаёт индекс, а не число запросов. Доли считаются от суммы по всем 14 брендам.",
 talk:"Сколько раз бренд упомянули чужие: новостные сайты и каналы, чаты и блогеры, области, YouTube. Наши посты, реклама, комментарии под ними, пересылки и промокоды не считаются. Доля = упоминания бренда / упоминания всех брендов за период.",
 rev:"Сколько новых отзывов получило приложение в магазине. Показывает, о чьём приложении люди пишут чаще. Dodo и Yandex не входят: их приложение одно на несколько стран.",
 rat:"Оценка приложения в магазине и как она изменилась за выбранный период. Данные из вкладки «Приложения», снимки ежедневно с 14.10. Рейтинг App Store округлён до 0,1.",
 ig:"Рост подписчиков за период и активность вокруг аккаунтов. Это не упоминания, а размер и живость аккаунта. У аккаунтов с розыгрышами комментарии накручены."
};
const CSS=`#p-mn tr.me td{background:var(--acc-soft);font-weight:650}#p-mn .info{color:var(--fg3);cursor:help;font-size:13px}
#p-mn .verdict{display:grid;gap:8px;font-size:14px;margin:0;padding:0;background:none}#p-mn .verdict p{margin:0}#p-mn details summary{cursor:pointer;color:var(--fg2);padding:4px 0}
#p-mn details .post{margin-left:6px}#p-mn .post a{color:var(--acc)}#p-mn .alert{display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--line)}
#p-mn .mnnav{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 4px}#p-mn .mnnav a{border:1px solid var(--line);background:var(--card-solid);border-radius:999px;padding:5px 11px;font-size:12.5px;color:var(--fg2);text-decoration:none}#p-mn .mnnav a:hover{color:var(--fg);border-color:var(--fg3)}
#p-mn .seg{display:inline-flex;gap:2px;background:var(--bg2);border-radius:10px;padding:2px;flex-wrap:wrap}#p-mn .seg button{border:0;background:none;border-radius:8px;padding:5px 11px;cursor:pointer;color:var(--fg2);font-size:12px}
#p-mn .seg button[aria-pressed="true"]{background:var(--card-solid);color:var(--fg);box-shadow:0 1px 2px rgba(0,0,0,.12)}
#p-mn input[type=date]{background:var(--card-solid);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:4px 8px;font:inherit;font-size:12.5px}
#p-mn .fctl{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}#p-mn .tbl{overflow-x:auto}#p-mn .fctl select{flex:1 1 150px;min-width:0}#p-mn .fctl select,#p-mn .fctl input{background:var(--card-solid);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:5px 8px;font:inherit;font-size:12.5px;max-width:100%}#p-mn .fctl input{flex:1;min-width:160px}
#p-mn .fitem{border-top:1px solid var(--line);padding:10px 0}#p-mn .fh{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px}#p-mn .ft{margin:6px 0 4px;font-size:13.5px;line-height:1.45;overflow-wrap:anywhere}#p-mn .ft mark{background:var(--acc-soft);color:inherit;border-radius:3px;padding:0 2px}
#p-mn .fm{font-size:12px;color:var(--fg2)}#p-mn .fm a{color:var(--acc)}#p-mn .fm summary{color:var(--fg2)}#p-mn h2.sect{font-size:17px}
#p-mn .mnwhere>div{min-width:0}@media (max-width:700px){#p-mn .mnwhere{grid-template-columns:1fr!important}}
#p-mn td .pill{font-weight:500}#p-mn .tbl td:nth-child(-n+2),#p-mn .tbl th:nth-child(-n+2){text-align:left}#p-mn .chip i{flex:none}#p-mn svg [data-tip]{cursor:default}#p-mn .tiles{margin-bottom:0}`;
if(!document.getElementById("mn-css")){const s=document.createElement("style");s.id="mn-css";s.textContent=CSS;document.head.appendChild(s)}
let D=null,P=null,M={from:null,to:null,preset:"30",brands:new Set(DEF),grp:"all"};
const IN=(d,a,b)=>d>=a&&d<=b;
const range=()=>{const L=nd(M.from,M.to),pt=ad(M.from,-1),pf=ad(pt,-(L-1));return{a:M.from,b:M.to,pa:pf,pb:pt,L}};
const nm=b=>D.names[b]||b;
const PL=()=>{const R=range();return dm(R.pa)+"–"+dm(R.pb)};
const CV=()=>D.cov||{own:{},talk:{},rev_comp:{}};
const prevOk=(srcs,R)=>srcs.every(k=>{const c=(CV().own||{})[k];return !c||c<=R.pa});
const RB=[[/^Упоминания сторонними/,"bad","не готово","Telegram прочитан не полностью, СМИ не подключены: цифры занижены и между брендами не сравнимы"],[/^Интерес в Google/,"warn","динамика","Динамика самого бренда надёжна, сравнение брендов между собой нет"],[/^Отзывы:/,"good","надёжно","Каждый отзыв из магазина, с датой и ссылкой"],[/^Рейтинги приложений/,"good","надёжно","Данные вкладки «Приложения», ежедневные снимки"],[/^Наши упоминания по дням/,"good","надёжно","Комментарии и отзывы про Bellissimo из наших источников"],[/^Откуда наши упоминания/,"good","надёжно",""],[/^Instagram конкурентов/,"warn","предварительно","История подписчиков копится с 20.10"],[/^(О чём пишут плохо|За что хвалят)/,"warn","по словарю","Темы и тональность определяются по словарю, ошибаются на сарказме и шутках"],[/^Свежий негатив/,"warn","по словарю","Тональность по словарю: часть записей может быть не негативом"]];
const badge=t=>{const r=RB.find(x=>x[0].test(t));return r?`<span class="pill p-${r[1]}" ${r[3]?`data-tip="${E(r[3])}"`:""} style="margin-left:6px">${r[2]}</span>`:""};
const card=(t,sub,body,cls,right,info)=>`<div class="card ${cls||"c12"}"><div class="chd"><h2>${E(t)}</h2>${badge(t)}${info?`<span class="info" data-tip="${E(info)}">ⓘ</span>`:""}<span class="sub">${sub||""}</span>${right?`<div class="right">${right}</div>`:""}</div>${body}</div>`;
const tile=(k,v,d,st)=>`<div class="tile ${st||""}"><div class="k">${E(k)}</div><div class="v">${v}</div><div class="d">${d||""}</div></div>`;
const dlt=(a,b,inv,u)=>{ if(a==null||b==null) return ""; const d=a-b; if(Math.abs(d)<(u==="★"?0.005:0.5)) return '<span class="note">без изменений к '+PL()+'</span>'; const good=(d<0)===!!inv; return `<span class="pill ${good?"p-good":"p-bad"}">${sg(d,u||"",u==="★"?2:0)}</span><span class="note">к ${PL()}</span>`};
const pp=(v,p)=>{ if(v==null||p==null) return '<span class="note">–</span>'; const d=v-p; return `<span class="${d>0.4?"cg":d<-0.4?"cb":"note"}">${d>0.4?"▲":d<-0.4?"▼":"•"} ${sg(d," п.п.")}</span>` };
const lastLE=(rows,keyfn,date)=>{let best=null;for(const r of rows){const k=keyfn(r);if(k<=date&&(!best||k>keyfn(best)))best=r}return best};

/* ---------- расчёты по периоду ---------- */
function searchWeeks(a,b){const w={};for(const[d,br,v]of D.trends)if(IN(d,ad(a,-6),b)){(w[d]=w[d]||{})[br]=v}return w}
function searchAgg(a,b){const w=searchWeeks(a,b),keys=Object.keys(w).sort(),sum={};for(const k of keys)for(const br in w[k])sum[br]=(sum[br]||0)+w[k][br];const tot=Object.values(sum).reduce((x,y)=>x+y,0);const sh={};for(const br in sum)sh[br]=tot?100*sum[br]/tot:null;const low={};for(const br in sum)low[br]=sum[br]/Math.max(keys.length,1)<2;return{w,keys,sum,sh,low,n:keys.length}}
function talkAgg(a,b,grp){const c={},g={};let tot=0;for(const[d,br,src,ty,n]of D.talk){if(!IN(d,a,b))continue;const gr=GRP(ty);if(src==="yt"){} if(grp!=="all"&&gr!==grp)continue;c[br]=(c[br]||0)+n;tot+=n;const k=(g[br]=g[br]||{media:0,people:0,region:0,yt:0});k[gr]+=n;if(src==="yt")k.yt+=n}const ok=tot>=D.min_n;const sh={};for(const br in c)sh[br]=ok?100*c[br]/tot:null;return{c,g,tot,ok,sh}}
const EXC=new Set(["dodo","yandex"]);
function revAgg(a,b,st){const c={},ng={};let tot=0;for(const[d,br,s,n,x]of D.rev){if(s!==st||!IN(d,a,b))continue;c[br]=(c[br]||0)+n;ng[br]=(ng[br]||0)+x;if(!EXC.has(br))tot+=n}const ok=tot>=D.min_n;const sh={};for(const br in c)sh[br]=(ok&&!EXC.has(br))?100*c[br]/tot:null;return{c,ng,tot,ok,sh}}
function ownAgg(a,b){const o={pos:0,neu:0,neg:0},s={};const byd={};for(const[d,src,se,n]of D.own){if(!IN(d,a,b))continue;o[se]=(o[se]||0)+n;const k=(s[src]=s[src]||{n:0,neg:0});k.n+=n;if(se==="neg")k.neg+=n;(byd[d]=byd[d]||{pos:0,neu:0,neg:0})[se]+=n}return{o,t:o.pos+o.neu+o.neg,s,byd}}
const negPct=x=>x.t?100*x.o.neg/x.t:0;

/* ---------- графики ---------- */
function lineChart(weeks,sh,brands){const W=900,H=230,pad=38,n=weeks.length;if(n<2)return'<div class="empty">Для линии нужно минимум две недели в периоде.</div>';
 let mx=1;for(const br of brands)for(const k of weeks){const v=sh[k]&&sh[k][br];if(v!=null&&v>mx)mx=v}mx=Math.min(100,Math.ceil(mx*1.12/5)*5);
 const X=i=>pad+(W-pad-14)*i/(n-1),Y=v=>10+(H-10)*(1-v/mx);let o=`<svg viewBox="0 0 ${W} ${H+30}" style="width:100%;height:auto" role="img" aria-label="Доля поиска по неделям">`;
 for(let k=0;k<5;k++){const y=10+(H-10)*k/4;o+=`<line x1="${pad}" x2="${W-8}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${pad-6}" y="${y+4}" fill="var(--fg2)" font-size="11" text-anchor="end">${Math.round(mx*(4-k)/4)}%</text>`}
 brands.forEach(br=>{const pts=[];weeks.forEach((k,i)=>{const v=sh[k]&&sh[k][br];if(v!=null)pts.push([X(i),Y(v),v,k])});if(pts.length<1)return;
  o+=`<path d="M${pts.map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" L")}" fill="none" stroke="${COL[br]||"var(--fg3)"}" stroke-width="${br==="bellissimo"?3:2}" stroke-linejoin="round" ${DASH[br]?`stroke-dasharray="${DASH[br]}"`:""}/>`;
  pts.forEach(p=>{o+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="9" fill="transparent" data-tip="${E(nm(br))} · неделя ${dm(p[3])} · ${p[2].toFixed(1)}%"/><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${COL[br]||"var(--fg3)"}" pointer-events="none"/>`})});
 const step=Math.max(1,Math.round(n/7));weeks.forEach((k,i)=>{if(i%step===0||i===n-1)o+=`<text x="${X(i)}" y="${H+20}" fill="var(--fg2)" font-size="11" text-anchor="middle">${dm(k)}</text>`});return `<div style="overflow-x:auto"><div style="min-width:560px">${o}</svg></div></div>`}
function daysChart(byd,a,b){const ds=[];for(let d=a;d<=b;d=ad(d,1))ds.push(d);const first=ds.findIndex(d=>byd[d]);const days=first<0?[]:ds.slice(first);if(!days.length)return'<div class="empty">В этом периоде упоминаний нет.</div>';
 const W=900,H=190,pad=34,bw=(W-pad-8)/days.length;let mx=1;days.forEach(d=>{const x=byd[d];if(x)mx=Math.max(mx,x.pos+x.neu+x.neg)});
 let o=`<svg viewBox="0 0 ${W} ${H+28}" style="width:100%;height:auto" role="img" aria-label="Упоминания по дням">`;
 for(let i=0;i<4;i++){const y=6+(H-6)*i/3;o+=`<line x1="${pad}" x2="${W-4}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${pad-5}" y="${y+4}" fill="var(--fg2)" font-size="11" text-anchor="end">${Math.round(mx*(3-i)/3)}</text>`}
 days.forEach((d,i)=>{const x=byd[d]||{pos:0,neu:0,neg:0},X=pad+i*bw;let y0=H;const tot=x.pos+x.neu+x.neg;[[x.neg,"var(--bad)"],[x.neu,"var(--fg3)"],[x.pos,"var(--good)"]].forEach(([v,c])=>{const h=(H-6)*v/mx;if(h>0){o+=`<rect x="${(X+1).toFixed(1)}" y="${(y0-h).toFixed(1)}" width="${Math.max(bw-2,1).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${c}"/>`;y0-=h}});
  o+=`<rect x="${X.toFixed(1)}" y="6" width="${bw.toFixed(1)}" height="${H-6}" fill="transparent" data-tip="${dm(d)} · всего ${tot}: позитив ${x.pos}, нейтрал ${x.neu}, негатив ${x.neg}"/>`});
 const step=Math.max(1,Math.round(days.length/8));days.forEach((d,i)=>{if(i%step===0)o+=`<text x="${pad+i*bw+bw/2}" y="${H+18}" fill="var(--fg2)" font-size="11" text-anchor="middle">${dm(d)}</text>`});
 return `<div style="overflow-x:auto"><div style="min-width:560px">${o}</svg></div></div>`+'<div class="legend" style="margin-top:6px"><span><i style="background:var(--good)"></i>позитив</span><span><i style="background:var(--fg3)"></i>нейтрал</span><span><i style="background:var(--bad)"></i>негатив</span></div>'}
const dot=b=>`<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${COL[b]||"var(--fg3)"};margin-right:6px"></i>`;
const row=(cells,me)=>`<tr class="${me?"me":""}">${cells.map(c=>`<td>${c}</td>`).join("")}</tr>`;
const tbl=(head,rows)=>`<div class="tbl"><table><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr>${rows}</table></div>`;
const sel=b=>M.brands.has(b);


/* ---------- лента публикаций (как в iMAS, но с разметкой) ---------- */
const CATS=["Акция бренда","Пресса и PR","Мнение","Партнёры и ориентиры","Найм","Промокод","Упоминание"];
const CATC={"Акция бренда":"#ff9f0a","Пресса и PR":"#0a84ff","Мнение":"#ff375f","Партнёры и ориентиры":"#30b0c7","Найм":"#8e8e93","Промокод":"#af52de","Упоминание":"#a2a2a7"};
const CATD={"Акция бренда":"Бренд рассказывает об акции или продукте: наши и чужие посевы в каналах, новости об акциях",
 "Пресса и PR":"СМИ и бизнес-каналы: интервью, премии, рейтинги, новости компании","Мнение":"Люди пишут от себя: хвалят, ругают, спрашивают",
 "Партнёры и ориентиры":"Бренд назван как ориентир («рядом с …») или в списке партнёров кешбэка","Найм":"Вакансии: курьеры, кассиры, повара",
 "Промокод":"Промокоды и реферальные ролики: часто чужие аккаунты раздают коды за вознаграждение","Упоминание":"Остальное: бренд просто назван"};
const SRCF={tg:"Telegram",media:"СМИ",yt:"YouTube"};
let F={b:"bellissimo",cat:"",src:"",reg:"",q:"",sort:"new",lim:25,promo:false};
// comparison with the previous period only where every source was already collected then (channels and media were added later)
const feedFrom=()=>{const m={};(D.feed||[]).forEach(x=>{if(!m[x.src]||x.d<m[x.src])m[x.src]=x.d});return Object.values(m).sort().pop()||"9999"};
const fk=x=>(x.t||"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").slice(0,120);
const kfmt=n=>n==null?"":n>=1e6?(n/1e6).toFixed(n>=1e7?0:1).replace(".",",")+" млн":n>=1e3?Math.round(n/1e3)+" тыс":String(n);
function feedIn(R,brands){return (D.feed||[]).filter(x=>IN(x.d,R.a,R.b)&&x.b.some(b=>brands.has(b)))}
function feedGroups(list){const g=new Map();list.forEach(x=>{const k=fk(x);const y=g.get(k);if(y){y.items.push(x);y.reach+=x.r||0;y.views+=x.v||0}else g.set(k,{k,items:[x],reach:x.r||0,views:x.v||0,x})});return [...g.values()]}
function feedSummary(R){const sel=new Set([...M.brands]);const OWN=new Set(["Акция бренда","Найм","Промокод"]);const all=feedIn(R,sel),P0=feedIn({a:R.pa,b:R.pb},sel);
 const by=b=>all.filter(x=>x.b.includes(b)),org=L=>L.filter(x=>!OWN.has(x.cat)),byp=b=>org(P0.filter(x=>x.b.includes(b)));
 const brs=[...sel].filter(b=>by(b).length||byp(b).length).sort((x,y)=>org(by(y)).length-org(by(x)).length||by(y).length-by(x).length);
 const rows=brs.map((b,i)=>{const A=by(b),L=org(A),own=A.length-L.length,reach=L.reduce((s,x)=>s+(x.r||0),0),views=L.reduce((s,x)=>s+(x.v||0),0),pl=byp(b).length,c={};A.forEach(x=>c[x.cat]=(c[x.cat]||0)+1);
  const bar=`<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;min-width:120px;background:var(--bg2)">${CATS.filter(k=>c[k]).map(k=>`<i data-tip="${E(k)}: ${c[k]}" style="width:${100*c[k]/A.length}%;background:${CATC[k]}"></i>`).join("")}</div>`;
  const cmp=R.pa>=feedFrom();
  return row([i+1,dot(b)+E(nm(b)),`<b>${fn(L.length)}</b>`,!cmp?'<span class="note" data-tip="Источники подключались позже: в прошлом периоде данных меньше, сравнение было бы ложным">–</span>':pl?`<span class="${L.length>pl?"cg":L.length<pl?"cb":"note"}">${sg(L.length-pl,"",0)||"0"}</span>`:'<span class="note">–</span>',own?`<span class="note" data-tip="Акции бренда, вакансии и промокоды: это делает сам бренд">${fn(own)}</span>`:"–",reach?kfmt(reach):"–",views?kfmt(views):"–",bar],b==="bellissimo")}).join("");
 const leg=CATS.map(k=>`<span class="note" style="margin-right:10px" data-tip="${E(CATD[k])}"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${CATC[k]};margin-right:4px"></i>${k}</span>`).join("");
 return card("Публикации о брендах",`Telegram-каналы и чаты, сайты СМИ, YouTube · ${dm(R.a)}–${dm(R.b)} · бренды из фильтра`,
  (rows?tbl(["#","Бренд","Пишут о бренде","К "+PL(),"Активность бренда","Охват","Просмотры","Все публикации по типам"],rows):'<div class="empty">За период публикаций нет.</div>')+`<p style="margin-top:8px">${leg}</p><p class="note">«Пишут о бренде» — пресса, мнения, упоминания, ориентиры: то, что о бренде пишут другие. «Активность бренда» — его акции в каналах, вакансии и промокоды; это зависит от бюджета бренда, а не от того, как о нём говорят. Каналы подбираются одинаково для всех брендов: по городам и темам (новости, работа, базар, еда), а не по бренду. Охват — сумма подписчиков каналов (как в iMAS).</p>`,"c12","","Считаются чужие публикации: новостные и областные каналы, чаты, каналы вакансий, бизнес-каналы, сайты СМИ, YouTube. Наши посты и комментарии под ними сюда не входят.")}
function feedWhere(R){const fb=F.b==="*"?new Set([...M.brands]):new Set([F.b]);const L=feedIn(R,fb);if(!L.length)return"";
 const ch={};L.forEach(x=>{const k=(x.src==="tg"?"@":"")+(x.ch||SRCF[x.src]);const y=ch[k]=ch[k]||{n:0,r:x.r,reg:x.reg,src:x.src,ch:x.ch};y.n++;if(x.r)y.r=x.r});
 const top=Object.entries(ch).sort((a,b)=>b[1].n-a[1].n||(b[1].r||0)-(a[1].r||0)).slice(0,12);
 const reg={};L.forEach(x=>{const k=x.reg||"не указан";reg[k]=(reg[k]||0)+1});const lg={};L.forEach(x=>{lg[x.lg]=(lg[x.lg]||0)+1});
 const LG={"uzb":"узбекский (лат.)","ўзб":"узбекский (кир.)","рус":"русский","eng":"английский","—":"без текста"};
 const bars=(o,lab)=>{const tot=Object.values(o).reduce((a,b)=>a+b,0);return Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<div style="display:grid;grid-template-columns:140px 1fr 40px;gap:8px;align-items:center;margin:3px 0"><span class="note">${E(lab?lab[k]||k:k)}</span><div style="height:8px;border-radius:4px;background:var(--bg2)"><div style="height:8px;border-radius:4px;width:${100*n/tot}%;background:var(--acc)"></div></div><span>${n}</span></div>`).join("")};
 const t=tbl(["Канал / источник","Регион","Подписчиков","Публикаций"],top.map(([k,y])=>row([y.src==="tg"&&y.ch?`<a href="https://t.me/${E(y.ch)}" target="_blank" rel="noopener">${E(k)}</a>`:E(k),E(y.reg||"–"),y.r?kfmt(y.r):"–",y.n])).join(""));
 return card("Где писали",`${F.b==="*"?"бренды из фильтра":nm(F.b)} · ${L.length} публикаций`,`<div style="display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:18px" class="mnwhere"><div>${t}</div><div><h3 style="font-size:13px;margin:0 0 6px">Регионы</h3>${bars(reg)}<h3 style="font-size:13px;margin:14px 0 6px">Языки</h3>${bars(lg,LG)}</div></div>`,"c12")}
function feedList(R){const fb=F.b==="*"?new Set([...M.brands]):new Set([F.b]);let L=feedIn(R,fb);
 const q=F.q.trim().toLowerCase();const npromo=L.filter(x=>x.cat==="Промокод").length;if(F.cat)L=L.filter(x=>x.cat===F.cat);else if(!F.promo)L=L.filter(x=>x.cat!=="Промокод");if(F.src)L=L.filter(x=>x.src===F.src);if(F.reg)L=L.filter(x=>x.reg===F.reg);if(q)L=L.filter(x=>(x.t+" "+x.ch).toLowerCase().includes(q));
 let G=feedGroups(L);G.sort(F.sort==="reach"?(a,b)=>b.reach-a.reach:(a,b)=>b.x.ts-a.x.ts);
 const regs=[...new Set(feedIn(R,fb).map(x=>x.reg).filter(Boolean))].sort();
 const brOpts=[...new Set([...M.brands])].map(b=>`<option value="${b}" ${F.b===b?"selected":""}>${E(nm(b))}</option>`).join("");
 const ctl=`<div class="fctl"><select id="ff-b" aria-label="Бренд">${brOpts}<option value="*" ${F.b==="*"?"selected":""}>Все бренды из фильтра</option></select>
  <select id="ff-cat" aria-label="Тип"><option value="">Все типы</option>${CATS.map(k=>`<option ${F.cat===k?"selected":""}>${k}</option>`).join("")}</select>
  <select id="ff-src" aria-label="Источник"><option value="">Все источники</option>${Object.entries(SRCF).map(([k,t])=>`<option value="${k}" ${F.src===k?"selected":""}>${t}</option>`).join("")}</select>
  <select id="ff-reg" aria-label="Регион"><option value="">Все регионы</option>${regs.map(r=>`<option ${F.reg===r?"selected":""}>${E(r)}</option>`).join("")}</select>
  <select id="ff-sort" aria-label="Сортировка"><option value="new" ${F.sort==="new"?"selected":""}>Сначала новые</option><option value="reach" ${F.sort==="reach"?"selected":""}>Сначала с большим охватом</option></select>
  <input id="ff-q" type="search" placeholder="Поиск по тексту и каналу" value="${E(F.q)}"> <button class="chip" id="ff-csv">Скачать CSV</button></div>
  ${!F.cat&&npromo?`<p class="note" style="margin:-4px 0 8px">${F.promo?`Промокоды показаны (${npromo}).`:`Скрыто ${npromo} промокодов и реферальных роликов.`} <button class="chip" id="ff-promo">${F.promo?"Скрыть":"Показать"}</button></p>`:""}`;
 const hl=t=>{let h=E(t);const rx=new RegExp("("+[...fb].map(b=>({bellissimo:"bell?i?ss?imo|бел+и+с+имо",oqtepa:"oq ?tepa|окт[еэ]па",kfc:"kfc|кфс",evos:"evos|эвос",dodo:"dodo|додо",safia:"safi[ay]|сафи[яа]",uzum:"uzum|узум",yandex:"yandex|яндекс",maxway:"max ?way|макс ?в[еэ]й",sariqbola:"sariq ?bola|сари[кқ] бола",papajohns:"papa ?john|папа ?джон",apex:"apex|апекс",dominos:"domino|доминос",hardees:"hardee|хардис"})[b]||b).join("|")+")","gi");return h.replace(rx,"<mark>$1</mark>")};
 const it=g=>{const x=g.x,n=g.items.length,t=new Date(x.ts*1e3+5*36e5).toISOString().slice(11,16),neg=x.s==="neg",pos=x.s==="pos";
  const chs=g.items.map(y=>y.src==="tg"&&y.ch?`<a href="${E(y.u)}" target="_blank" rel="noopener">@${E(y.ch)}</a>${y.r?` <span class="note">${kfmt(y.r)}</span>`:""}`:E(y.ch||SRCF[y.src])).join(" · ");
  return `<div class="fitem"><div class="fh"><span class="pill" style="background:${CATC[x.cat]}22;color:${CATC[x.cat]}" data-tip="${E(CATD[x.cat])}">${E(x.cat)}</span>${x.k?`<span class="pill p-mute">${E(x.k)}</span>`:""}${neg?'<span class="pill p-bad">негатив</span>':pos?'<span class="pill p-good">позитив</span>':""}
   ${x.b.map(b=>dot(b)+E(nm(b))).join(" ")} <span class="note">${dm(x.d)} ${t} · ${SRCF[x.src]}${x.reg?" · "+E(x.reg):""}</span></div>
   <div class="ft">${hl((x.t||"").slice(0,420))}${(x.t||"").length>420?"…":""}</div>
   <div class="fm">${n>1?`<details><summary>в ${n} ${n<5?"каналах":"каналах"} · охват ${g.reach?kfmt(g.reach):"–"}${g.views?" · 👁 "+kfmt(g.views):""}</summary>${chs}</details>`:`${chs}${x.v?` · 👁 ${kfmt(x.v)}`:""}${x.u&&x.src!=="tg"?` · <a href="${E(x.u)}" target="_blank" rel="noopener">открыть ↗</a>`:""}`}</div></div>`};
 window.__mnFeedRows=L;
 return card("Лента публикаций",`${L.length} публикаций, ${G.length} разных текстов · одинаковый текст в разных каналах показан один раз`,ctl+(G.length?G.slice(0,F.lim).map(it).join("")+(G.length>F.lim?`<div class="more"><button class="btn ghost" id="ff-more">Показать ещё ${Math.min(25,G.length-F.lim)} из ${G.length-F.lim}</button></div>`:""):'<div class="empty">Ничего не нашлось. Измените фильтры.</div>'),"c12")}
function feedCsv(){const L=window.__mnFeedRows||[];const q=v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"';
 const lines=[["Дата","Бренды","Тип","Тональность","Источник","Канал","Регион","Язык","Подписчиков","Просмотры","Ссылка","Текст"].map(q).join(",")].concat(L.map(x=>[x.d,x.b.map(nm).join(", "),x.cat,x.s,SRCF[x.src],x.ch,x.reg,x.lg,x.r||"",x.v||"",x.u,x.t].map(q).join(",")));
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+lines.join("\n")],{type:"text/csv"}));a.download="упоминания_"+range().a+"_"+range().b+".csv";document.body.appendChild(a);a.click();a.remove()}
/* ---------- блоки ---------- */
function blocks(){const R=range(),out=[];
 const S=searchAgg(R.a,R.b),SP=(CV().trends&&CV().trends>ad(R.pa,6)?{sh:{},sum:{},low:{},n:0}:searchAgg(R.pa,R.pb)),T=talkAgg(R.a,R.b,M.grp),TP=talkAgg(R.pa,R.pb,M.grp),T0=talkAgg(R.a,R.b,"all");
 const O=ownAgg(R.a,R.b),OP=ownAgg(R.pa,R.pb);
 const EFF=st=>{const c=(CV().rev_comp||{})[st];return c&&c>R.a?c:R.a},NOREV={c:{},ng:{},tot:0,ok:false,sh:{}},PV=st=>{const c=(CV().rev_comp||{})[st];return !c||c<=R.pa?revAgg(R.pa,R.pb,st):NOREV},rp=revAgg(EFF("play"),R.b,"play"),rpp=PV("play"),ra=revAgg(EFF("appstore"),R.b,"appstore"),rap=PV("appstore");
 const latest=(st,br)=>{const rows=D.rat.filter(r=>r[1]===br&&r[2]===st&&r[0]<=R.b);return rows.length?rows[rows.length-1]:null};
 const base=(st,br)=>{const rows=D.rat.filter(r=>r[1]===br&&r[2]===st&&r[0]>=R.a&&r[0]<=R.b);return rows.length>1&&nd(rows[0][0],rows[rows.length-1][0])>=3?rows[0]:null};
 const PLB=PL(),OKP=prevOk(Object.keys(O.s),R),NOC='<span class="note" data-tip="За прошлый период у части источников данных нет: сбор начался позже. Сравнение было бы ложным.">нет сравнения: за '+PLB+' данные неполные</span>';
 const ver=[],al=[];
 ver.push(`<p><b>Репутация за период:</b> отзывов и комментариев о нас ${O.t}, негатив ${negPct(O).toFixed(0)}%${OP.t&&OKP?` (за ${PLB}: ${negPct(OP).toFixed(0)}%)`:""}.</p>`);
 const sk=Object.keys(S.sh).filter(b=>!S.low[b]).sort((x,y)=>S.sh[y]-S.sh[x]);
 if(D.feed){const sb=new Set(["bellissimo"]),a=feedIn(R,sb),p=feedIn({a:R.pa,b:R.pb},sb),cats={};a.forEach(x=>cats[x.cat]=(cats[x.cat]||0)+1);const top=Object.entries(cats).sort((x,y)=>y[1]-x[1]).slice(0,3).map(([k,n])=>`${k.toLowerCase()} ${n}`).join(", ");
  ver.push(`<p><b>Публикации о нас:</b> ${a.length}${p.length?` (за ${PLB}: ${p.length})`:""}, охват каналов ${kfmt(a.reduce((s2,x)=>s2+(x.r||0),0))||"–"}${top?`; больше всего: ${top}`:""}.</p>`)}
 else if(T.ok&&T.sh.bellissimo!=null){const rk=Object.keys(T.sh).sort((x,y)=>T.c[y]-T.c[x]);ver.push(`<p><b>Обсуждения:</b> наша доля ${pc(T.sh.bellissimo)}, ${rk.indexOf("bellissimo")+1}-е место (публикаций всего ${T.tot}).</p>`)}else ver.push(`<p><b>Обсуждения:</b> публикаций за период ${T.tot}, для доли нужно не меньше ${D.min_n}.</p>`);
 if(rp.ok||ra.ok){const m=(st,x)=>x.c.bellissimo!=null?`${st}: наших отзывов ${x.c.bellissimo}`:"";ver.push(`<p><b>Отзывы в приложениях:</b> ${[m("Play",rp),m("App Store",ra)].filter(Boolean).join(", ")||"наших отзывов нет"}.</p>`)}
 if(OKP&&OP.t&&O.o.neg>=10&&negPct(O)-negPct(OP)>=5)al.push(["p-bad",`Негатив вырос: ${negPct(OP).toFixed(0)}% → ${negPct(O).toFixed(0)}% (${O.o.neg} негативных).`]);
 const wk=[];for(let i=1;i<=4;i++){const x=ownAgg(ad(R.b,-7*i+1-6),ad(R.b,-7*i));wk.push(x.t)}if(R.L<=14&&wk.reduce((x,y)=>x+y,0)>=40&&O.t>2*(wk.reduce((x,y)=>x+y,0)/4)*(R.L/7))al.push(["p-warn",`Всплеск упоминаний: ${O.t} за ${R.L} дн. при обычных ${Math.round(wk.reduce((x,y)=>x+y,0)/4*(R.L/7))}.`]);
 const IMP={yt:"YouTube не собирается (исчерпан лимит запросов), видео и комментарии оттуда пока не входят в долю обсуждений.",ads:"Часть комментариев под рекламой не собирается (нет разрешения Meta), негатив под рекламой может быть занижен.",trends:"Google Trends ответил не по всем брендам, в поиске возможны пропуски."};
 D.status.filter(x=>x.s!=="trends"&&(x.ok===0||(x.s==="ads"&&/ошибок: [1-9]/.test(x.note||"")))).forEach(x=>al.push(["p-warn",IMP[x.s]||((SRC[x.s]||x.s)+" не собирается, цифры могут быть неполными.")]));
 const tg=(CV().tgw)||{};if(tg.total&&!tg.full)al.push(["p-warn",`Telegram: прочитано ${tg.read} из ${tg.total} каналов, доля обсуждений пока неполная.`]);
 if(CV().media_on===false)al.push(["p-warn","Сайты СМИ ещё не подключены: в доле обсуждений новостных сайтов пока нет."]);
 if(false)0;const old=D.status.filter(x=>x.ok===1&&D.today&&nd(x.at.slice(0,10),D.today)>3);if(old.length)al.push(["p-warn","Давно не обновлялись: "+old.map(x=>SRC[x.s]||x.s).join(", ")+"."]);
 if(D.feed){out.push(feedSummary(R));out.push(feedList(R));out.push(feedWhere(R));out.push(`<h2 class="sect" style="grid-column:1/-1;margin:18px 0 0">Голос клиентов: комментарии и отзывы о нас</h2>`)}
 out.push(card("Главное","вывод за выбранный период",`<div class="verdict">${ver.join("")}</div>`,"c7"));
 out.push(card("Что требует внимания","",al.map(([c,m])=>`<div class="alert"><span class="pill ${c}">внимание</span><span>${E(m)}</span></div>`).join("")||'<div class="alert"><span class="pill p-good">спокойно</span><span>Резких изменений нет.</span></div>',"c5"));
 const lp=latest("play","bellissimo"),la=latest("appstore","bellissimo"),bp=base("play","bellissimo"),ba=base("appstore","bellissimo");
 out.push('<div class="tiles">'+[
  tile("Наших упоминаний",O.t,OKP?dlt(O.t,OP.t,false):NOC),
  tile("Доля негатива",negPct(O).toFixed(0)+"%",OKP?dlt(negPct(O),negPct(OP),true,"%"):NOC,negPct(O)>=20?"st-bad":negPct(O)>=10?"st-warn":"st-good"),
  tile("Негативных",O.o.neg,OKP?dlt(O.o.neg,OP.o.neg,true):NOC),
  tile("Google Play",lp?"★ "+lp[3].toFixed(2):"—",bp&&lp?dlt(lp[3],bp[3],false,"★"):'<span class="note">наше приложение</span>'),
  tile("App Store",la?"★ "+la[3].toFixed(1):"—",ba&&la?dlt(la[3],ba[3],false,"★"):'<span class="note">наше приложение</span>')].join("")+"</div>");
 /* полнота данных */
 {const c=CV(),f=d=>d?`<span class="${d>R.a?"cw":""}">${dm(d)}${d>R.a?" ⚠":""}</span>`:"–",tg=c.tgw||{};
  const rowsC=[["Google Trends (поиск)",f(c.trends),"данные по неделям, год назад"],
   ["Наши комментарии в Instagram",f((c.own||{}).ig),"под нашими постами"],["Комментарии под рекламой",f((c.own||{}).ads),"Facebook и Instagram"],
   ["Отзывы Google Play: наши / конкурентов",f((c.own||{}).play)+" / "+f((c.rev_comp||{}).play),"у конкурентов история короче, доли считаются с общей даты"],
   ["Отзывы App Store: наши / конкурентов",f((c.own||{}).appstore)+" / "+f((c.rev_comp||{}).appstore),""],
   ["Рейтинги приложений (вкладка «Приложения»)",f(c.rat),"ежедневные снимки Google Play и App Store"],["Instagram конкурентов",f(c.ig),"история копится с запуска, рост виден с этой даты"],
   ["Telegram: поиск и список каналов",f((c.talk||{}).tg),tg.total?(tg.full?"список из "+tg.total+" каналов прочитан":`прочитано ${tg.read} из ${tg.total} каналов, идёт сбор`):""],
   ["YouTube",f((c.talk||{}).yt),"видео и комментарии, собирается по лимиту запросов"],
   ["Сайты СМИ",c.media_on?f((c.talk||{}).media):"не подключены","лента новостных сайтов"]];
  out.push(card("Полнота данных","⚠ значит, что данные начинаются позже начала выбранного периода и цифры за ранние даты неполные",tbl(["Источник","Данные с","Заметка"],rowsC.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td class="note" style="white-space:normal;text-align:left">${r[2]}</td></tr>`).join("")),"c12"))}
 /* поиск: только динамика каждого бренда относительно самого себя, без долей и мест. Скрыто: Google Trends почти не видит поиск по этим брендам в Узбекистане */
 if(!window.TRENDS_ON) out.push(card("Поиск в Google","временно убран",'<p class="note">Google Trends по Узбекистану почти не видит запросы по этим брендам: у Bellissimo 76 дней из 90 с нулём, а KFC раздут чужими запросами (игра «KFC The Vault», «kfc near me»). Индекс показывал шум. Вернём, когда будут реальные объёмы поиска из Планировщика ключевых слов Google Ads.</p>',"c4"));
 else {const br=Object.keys(S.sh).sort((x,y)=>(x==="bellissimo"?-1:0)-(y==="bellissimo"?-1:0)||nm(x).localeCompare(nm(y),"ru"));const shown=br.filter(sel);
  const mean={};br.forEach(b=>{const v=S.keys.map(k=>S.w[k][b]||0);mean[b]=v.length?v.reduce((x,y)=>x+y,0)/v.length:0});
  const wsh={};S.keys.forEach(k=>{wsh[k]={};br.forEach(b=>{wsh[k][b]=mean[b]?100*(S.w[k][b]||0)/mean[b]:null})});
  const chg=b=>{const o=SP.sum[b],n=S.sum[b];if(!o||o<10||n==null)return'<span class="note" data-tip="В прошлом периоде слишком мало запросов или данных нет, процент был бы шумом">–</span>';const d=(n-o)/o;return`<span class="chg">${d>0?"+":"−"}${Math.abs(Math.round(100*d))}%</span>`};
  const rows=shown.map(b=>row([dot(b)+E(nm(b))+(S.low[b]?' <span class="pill p-mute" data-tip="В среднем меньше 2 пунктов из 100: Google округляет до целых, динамика неточная">мало данных</span>':""),chg(b)],b==="bellissimo")).join("");
  out.push(card("Интерес в Google: динамика каждого бренда",`поиск самого бренда в Google (Узбекистан), недель в периоде: ${S.n}`,(S.n?tbl(["Бренд","К "+PLB],rows)+'<p class="note"><b>Бренды между собой не сравниваются и места не присваиваются:</b> уровень зависит от написания запроса (проверено 22.10: «Evos» одним словом и в нашей формулировке отличаются в 5 раз), а короткие названия (KFC, Evos, Safia) ищут и в другом смысле. Надёжно только изменение интереса к одному бренду во времени. Google Trends даёт индекс интереса (0–100), а не число запросов.</p>':'<div class="empty">В выбранном периоде нет недель Google Trends.</div>'),"c12",`<span class="note">данные на ${dm((D.status.find(x=>x.s==="trends")||{at:""}).at.slice(0,10))}</span>`,INFO.search))}
 /* обсуждения */
 {const br=Object.keys(T0.c).sort((x,y)=>(T.c[y]||0)-(T.c[x]||0));
  const seg=`<div class="seg" id="mn-grp">${[["all","Всё"],["media","СМИ"],["people","Люди"],["region","Области"]].map(([k,t])=>`<button data-g="${k}" aria-pressed="${M.grp===k}">${t}</button>`).join("")}</div>`;
  const rows=br.filter(sel).map((b,i)=>{const g=T.g[b]||{media:0,people:0,region:0,yt:0};return row([i+1,dot(b)+E(nm(b)),fn(T.c[b]||0),T.ok?pc(T.sh[b]):'<span class="note">нужно ≥'+D.min_n+'</span>',T.ok&&TP.ok?pp(T.sh[b],TP.sh[b]):'<span class="note">–</span>',`<span class="note" data-tip="СМИ и новостные каналы / чаты, блогеры и YouTube / областные каналы">${g.media} · ${g.people} · ${g.region}</span>`],b==="bellissimo")}).join("");
  out.push(card("Упоминания сторонними людьми вне наших ресурсов",`публикации СМИ, чатов, блогеров, YouTube и областных каналов за период: ${T.tot}`,(br.length?tbl(["#","Бренд","Публикаций","Доля","К "+PLB,"СМИ · Люди · Области"],rows):'<div class="empty">Публикаций за период нет.</div>')+(T.ok?"":`<div class="empty">Доли пока нет: публикаций ${T.tot}, нужно не меньше ${D.min_n}. Процент на малой выборке случаен, показываем только число.</div>`)+'<p class="note">Считаются только чужие публикации: новостные каналы и сайты, чаты и блогеры, областные каналы, YouTube. Пересылки, комментарии, промокоды и наши посты не считаются. Одинаковый текст в разных каналах считается один раз.</p>',"c12",seg,INFO.talk))}
 /* отзывы по магазинам */
 const revCard=(t,st,x,xp,st2)=>{const ef=EFF(st),short=ef!==R.a;const br=Object.keys(x.c).filter(b=>!EXC.has(b)).sort((a,b2)=>x.c[b2]-x.c[a]);
  const rows=br.filter(sel).map((b,i)=>row([i+1,dot(b)+E(nm(b)),fn(x.c[b]),x.ok?pc(x.sh[b]):'–',x.ok&&xp.ok?pp(x.sh[b],xp.sh[b]):'–',x.c[b]?pc(100*x.ng[b]/x.c[b]):"–"],b==="bellissimo")).join("");
  return card(t,`новых отзывов за период: ${x.tot}`,(br.length?tbl(["#","Бренд","Отзывов","Доля","К "+PLB,"Негатив 1–2★"],rows):'<div class="empty">Отзывов за период нет.</div>')+(x.ok?"":`<div class="empty">Доли пока нет: отзывов ${x.tot}, нужно не меньше ${D.min_n}.</div>`)+(short?`<p class="note">⚠ Для честного сравнения взяты отзывы с ${dm(ef)}: у конкурентов история в этом магазине начинается позже, чем у нас.</p>`:""),"c6",`<span class="note">данные на ${dm((D.status.find(s=>s.s===st2)||{at:""}).at.slice(0,10))}</span>`,INFO.rev)};
 /* instagram */
 {const brs=[...new Set(D.ig.map(r=>r[1]))];const L=b=>{const r=D.ig.filter(x=>x[1]===b&&x[0]<=R.b);return r.length?r[r.length-1]:null},B=b=>{const r=D.ig.filter(x=>x[1]===b&&x[0]>=R.a&&x[0]<=R.b);return r.length>1&&nd(r[0][0],r[r.length-1][0])>=3?r[0]:null};
  const rows=brs.filter(sel).sort((x,y)=>(L(y)?L(y)[2]:0)-(L(x)?L(x)[2]:0)).map(b=>{const l=L(b),bs=B(b);if(!l)return"";const g=bs&&l[2]&&bs[2]?l[2]-bs[2]:null;const eng=l[2]?1000*((l[4]||0)+(l[5]||0))/l[2]:null;return row([dot(b)+E(nm(b)),fn(l[2])+(g!=null?` <span class="${g>0?"cg":g<0?"cb":"note"}">${g>=0?"+":"−"}${fn(Math.abs(g))}</span>`:""),fn(l[3]),eng==null?"–":eng.toFixed(0),l[3]?(l[5]/l[3]).toFixed(0):"–"],b==="bellissimo")}).join("");
  out.push(card("Instagram конкурентов",(CV().ig&&CV().ig>R.a?`история с ${dm(CV().ig)}: рост виден с ${dm(CV().ig)}`:`рост подписчиков с ${dm(R.a)}`),tbl(["Аккаунт","Подписчики и рост","Постов за 30 дн.","Реакций на 1000 подп.","Комм. на пост"],rows)+'<p class="note">Рост подписчиков считается с первого дня, который у нас сохранён (см. заголовок). В таблице нет KFC, Sariq Bola, Uzum Tezkor и Domino\'s: их аккаунты не нашлись.</p>',"c6","",INFO.ig))}
 /* по дням */
 out.push(card("Наши упоминания по дням",`комментарии и отзывы про Bellissimo, ${dm(R.a)} – ${dm(R.b)}`,daysChart(O.byd,R.a,R.b),"c12"));
 /* источники */
 {const keys=Object.keys(SRC).filter(k=>O.s[k]||OP.s[k]);const rows=keys.map(k=>{const a=O.s[k]||{n:0,neg:0},p=OP.s[k]||{n:0,neg:0};const c0=(CV().own||{})[k],incl=c0&&c0>R.pa;return row([`<b>${SRC[k]}</b>`,`<span class="note">${E(SRCD[k])}</span>`,c0?`<span class="${c0>R.a?"cw":"note"}">${dm(c0)}${c0>R.a?" ⚠":""}</span>`:"–",fn(a.n),incl?`<span class="note" data-tip="Сбор этого источника начался позже, за ${PLB} данных нет или они неполные">нет данных</span>`:fn(p.n),a.n?pc(100*a.neg/a.n):"–"])}).join("");
  out.push(card("Откуда наши упоминания","только про Bellissimo, это не доли",tbl(["Источник","Что это","Данные с","Этот период","К "+PLB,"Негатив"],rows),"c12"))}
 /* темы */
 const themeCard=(sent,title,empty)=>{const c={},p={};for(const[d,se,t,n]of D.themes){if(se!==sent)continue;if(IN(d,R.a,R.b))c[t]=(c[t]||0)+n;else if(IN(d,R.pa,R.pb))p[t]=(p[t]||0)+n}
  const ex=D.posts.filter(x=>x.e===sent&&IN(x.d,R.a,R.b));const tagged=ex.filter(x=>x.h).length;
  const items=Object.entries(c).sort((x,y)=>y[1]-x[1]).slice(0,8).map(([k,n])=>{const e2=ex.filter(x=>x.h.split("|").includes(k)).slice(0,4);const d=n-(p[k]||0);
   return `<details><summary><b>${E(k)}</b> · ${n} <span class="note">${OKP?`(за ${PLB}: ${p[k]||0})</span> <span class="${d===0?"note":(d>0)===(sent==="neg")?"cb":"cg"}">${d>0?"+":""}${d}</span>`:"</span>"}</summary>${e2.map(x=>`<div class="post"><div class="w"><span>${dm(x.d)}</span><span>${SRC[x.s]||x.s}</span>${x.u?`<a href="${E(x.u)}" target="_blank" rel="noopener">открыть ↗</a>`:""}</div><div>${E(x.t.slice(0,240))}</div></div>`).join("")}</details>`}).join("");
  return card(title,`за период, по словарю · тема определена у ${tagged} из ${ex.length} комментариев`,items||`<div class="empty">${empty}</div>`,"c6")};
 out.push(themeCard("neg","О чём пишут плохо","нет негатива с темой"));out.push(themeCard("pos","За что хвалят","нет похвалы с темой"));
 /* свежий негатив */
 {const ng=D.posts.filter(x=>x.e==="neg"&&IN(x.d,R.a,R.b)).slice(0,15);
  out.push(card("Свежий негатив",`последние ${ng.length} за период; ссылки нет у отзывов в магазинах приложений`,ng.map(x=>`<div class="post"><div class="w"><span>${dm(x.d)}</span><span>${SRC[x.s]||x.s}</span>${x.r?`<span>${"★".repeat(x.r)}</span>`:""}${x.h?`<span class="pill">${E(x.h.replace(/\|/g,", "))}</span>`:""}${x.u?`<a href="${E(x.u)}" target="_blank" rel="noopener">открыть ↗</a>`:'<span class="pill p-mute" data-tip="Магазины приложений не дают ссылку на отдельный отзыв. Найти его можно в кабинете разработчика по дате и тексту">без ссылки</span>'}</div><div>${E(x.t.slice(0,300))}</div></div>`).join("")||'<div class="empty">Негатива за период нет.</div>',"c12"))}
 /* как читать */
 out.push(card("Как читать эту вкладку","нажми, чтобы раскрыть",`<details><summary>Показать пояснения</summary>
  <p><b>Фильтр сверху</b> работает на все блоки: период и бренды.</p>
  <p><b>Публикации о брендах и лента</b> — чужие публикации: областные, новостные, бизнес-каналы и каналы вакансий в Telegram (сейчас ${Object.keys((D.feed||[]).reduce((m,x)=>(x.src==="tg"&&x.ch&&(m[x.ch]=1),m),{})).length} каналов с упоминаниями), сайты СМИ, YouTube. Наши посты и комментарии под ними сюда не входят.</p>
  <p><b>Тип публикации</b> ставится правилами: акция бренда, пресса и PR, мнение, партнёры и ориентиры («рядом с …», кешбэк), найм, промокод, просто упоминание. Наведите на тип, чтобы увидеть пояснение.</p>
  <p><b>Охват</b> — подписчики канала, где вышла публикация, как в iMAS. Это не число людей, которые её увидели: для Telegram рядом показаны просмотры поста.</p>
  <p><b>Одинаковый текст</b> в нескольких каналах (посев) в ленте показан одной карточкой, внутри список каналов.</p>
  <p><b>Голос клиентов</b> — комментарии под нашими постами и рекламой, отзывы в магазинах приложений. Тональность определяется по словарю (русский и узбекский), без нейросети: точность около 80%, тренды надёжны, отдельные комментарии стоит читать.</p>
  <p><b>«К прошлому периоду»</b> показывается, только если в прошлом периоде все источники уже собирались. Иначе прочерк: сравнение было бы ложным.</p>
  <p><b>Уведомления:</b> после каждого сбора бот пишет в Telegram о новых заметных публикациях о нас (негатив, мнения, пресса, крупные каналы), об акциях конкурентов в больших каналах и о всплеске негатива.</p></details>`,"c12"));
 out.push(`<p class="note" style="grid-column:1/-1">Обновлено ${E(D.built)}.</p>`);
 const h2=x=>(x.match(/<h2>([^<]*)<\/h2>/)||[])[1]||"";
 const drop=/^(Упоминания сторонними людьми|Поиск в Google)/, last=/^(Полнота данных|Instagram конкурентов|Как читать)/;
 const keep=out.filter(x=>!drop.test(h2(x)));
 return keep.filter(x=>!last.test(h2(x))).concat(keep.filter(x=>last.test(h2(x)))).join("")}

function barHtml(){const R=[["7","7 дней"],["30","30 дней"],["90","90 дней"],["all","Всё время"]];
 return `<div class="card c12" id="mn-bar"><div class="chd"><h2>Фильтр</h2><span class="sub">действует на все блоки вкладки</span></div>
 <div class="seg" id="mn-per" style="margin-bottom:8px">${R.map(([k,t])=>`<button data-p="${k}" aria-pressed="${M.preset===k}">${t}</button>`).join("")}</div>
 <span class="note" style="margin-left:8px">или даты:</span> <input type="date" id="mn-from" value="${M.from}" min="${P.min}" max="${D.today}"> <span class="note">–</span> <input type="date" id="mn-to" value="${M.to}" min="${P.min}" max="${D.today}">
 <div class="note" id="mn-pnote" style="margin-top:10px"></div><div class="chips" id="mn-chips" style="margin-top:10px">${Object.keys(D.names).map(b=>`<button class="chip" data-b="${b}" aria-pressed="${sel(b)}">${dot(b)}${E(nm(b))}</button>`).join("")}<button class="chip" data-b="*" aria-pressed="false">все бренды</button></div></div>`}
function setPreset(k){M.preset=k;M.to=D.today;M.from=k==="all"?P.min:ad(D.today,-(+k-1));if(M.from<P.min)M.from=P.min}
function paint(root){root.querySelector("#mn-body").innerHTML=blocks();
 root.querySelectorAll("#mn-per button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.p===M.preset));
 root.querySelectorAll("#mn-chips .chip[data-b]").forEach(b=>{if(b.dataset.b!=="*")b.setAttribute("aria-pressed",sel(b.dataset.b))});
 {const R=range();root.querySelector("#mn-pnote").innerHTML=`Период: <b>${dm(R.a)}–${dm(R.b)}</b> (${R.L} дн.). Сравниваем с: <b>${dm(R.pa)}–${dm(R.pb)}</b> (предыдущие ${R.L} дн.).`}root.querySelector("#mn-from").value=M.from;root.querySelector("#mn-to").value=M.to
 {const body=root.querySelector("#mn-body"),skip=/^(Как пользоваться|Служебное|Как читать)/,cards=[...body.querySelectorAll(":scope > .card")];const items=[];
  cards.forEach((c,i)=>{const h=c.querySelector("h2");if(!h)return;c.id="mnc-"+i;if(!skip.test(h.textContent.trim()))items.push([c.id,h.textContent.trim()])});
  if(items.length>3){const nav=document.createElement("div");nav.className="mnnav";nav.innerHTML='<span class="note">Перейти к:</span>'+items.map(x=>`<a href="#${x[0]}" data-go="${x[0]}">${E(x[1])}</a>`).join("");body.prepend(nav)}}
 {const cv=CV(),tg=cv.tgw||{},body=root.querySelector("#mn-body");if(!(tg.full&&cv.media_on))body.querySelectorAll(":scope > .card").forEach(c=>{const h=c.querySelector("h2");if(h&&/^Доля обсуждений/.test(h.textContent)&&!c.querySelector(".draft")){const kids=[...c.children].filter(x=>!x.classList.contains("chd"));const d=document.createElement("details");d.className="draft";d.innerHTML="<summary>Черновик: Telegram прочитан "+(tg.read||0)+" из "+(tg.total||"?")+" каналов, СМИ "+(cv.media_on?"подключены":"не подключены")+". Показать цифры</summary>";kids.forEach(k=>d.appendChild(k));c.appendChild(d)}})}}
const EXTRA_COL={papajohns:"#c2410c",dominos:"#2b6cb0",apex:"#8d8d8d"};
let CTX=null;
function ratFromApps(apps){const rows=[];Object.keys(apps||{}).sort().forEach(d=>{const a=apps[d]||{};for(const b in a.play||{}){const v=a.play[b];if(v&&v[0]!=null)rows.push([d,b,"play",+v[0],v[1]])}for(const b in a.ios||{}){const v=a.ios[b];if(v&&v[0]!=null)rows.push([d,b,"appstore",+v[1],v[0]])}});return rows}
function applyCtx(ctx){CTX=ctx||null;Object.assign(COL,EXTRA_COL);if(!ctx)return;
 if(ctx.brands)for(const b in ctx.brands)if(ctx.brands[b].color)COL[b]=ctx.brands[b].color;
 if(ctx.apps){const r=ratFromApps(ctx.apps);if(r.length){D.rat=r;D.cov=D.cov||{};D.cov.rat=r[0][0]}}}
window.mentionsSummary=function(data,ctx,days){const keep=D;D=data;try{applyCtx(ctx);const b=D.today,a=ad(b,-((days||30)-1));return{a,b,S:searchAgg(a,b),T:talkAgg(a,b,"all"),O:ownAgg(a,b),cov:CV(),names:D.names,rat:D.rat}}finally{D=keep}};
window.renderMentions=function(panel,data,ctx){D=data;applyCtx(ctx);
 const dates=[...D.trends.map(r=>r[0]),...D.own.map(r=>r[0]),...D.talk.map(r=>r[0]),...D.rev.map(r=>r[0])].sort();P={min:dates[0]||ad(D.today,-90)};
 setPreset("30");
 panel.innerHTML=barHtml()+'<div id="mn-body" style="display:contents"></div>';paint(panel);
 if(!panel.dataset.wired){panel.dataset.wired=1;
  let qt=null;panel.addEventListener("input",e=>{if(e.target.id!=="ff-q")return;clearTimeout(qt);qt=setTimeout(()=>{F.q=e.target.value;F.lim=25;const pos=e.target.selectionStart;paint(panel);const i=panel.querySelector("#ff-q");if(i){i.focus();try{i.setSelectionRange(pos,pos)}catch(_){}}},350)});
  panel.addEventListener("click",e=>{const go=e.target.closest(".mnnav a[data-go]");if(go){e.preventDefault();const t=panel.querySelector("#"+go.dataset.go);if(t)t.scrollIntoView({behavior:"smooth",block:"start"});return}
   const p=e.target.closest("#mn-per button");if(p){setPreset(p.dataset.p);paint(panel);return}
   const g=e.target.closest("#mn-grp button");if(g){M.grp=g.dataset.g;paint(panel);return}
   if(e.target.id==="ff-more"){F.lim+=25;paint(panel);return}
   if(e.target.id==="ff-csv"){feedCsv();return}
   if(e.target.id==="ff-promo"){F.promo=!F.promo;F.lim=25;paint(panel);return}
   const c=e.target.closest("#mn-chips .chip");if(c){if(c.dataset.b==="*"){Object.keys(D.names).forEach(b=>M.brands.add(b))}else if(M.brands.has(c.dataset.b))M.brands.delete(c.dataset.b);else M.brands.add(c.dataset.b);paint(panel)}});
  panel.addEventListener("change",e=>{const fm={"ff-b":"b","ff-cat":"cat","ff-src":"src","ff-reg":"reg","ff-sort":"sort"}[e.target.id];if(fm){F[fm]=e.target.value;F.lim=25;if(fm==="b")F.reg="";paint(panel);return}if(e.target.id==="mn-from"||e.target.id==="mn-to"){let f=panel.querySelector("#mn-from").value,t=panel.querySelector("#mn-to").value;if(f&&t){if(f>t)[f,t]=[t,f];M.from=f;M.to=t;M.preset="custom";paint(panel)}}})}
};
})();
