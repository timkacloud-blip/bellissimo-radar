/* Вкладка «Упоминания»: все блоки считаются из одной таблицы фактов (mentions_data.json) по общему фильтру. */
(function(){
"use strict";
const E=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ad=(s,n)=>{const d=new Date(s+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const dm=s=>s?s.slice(8,10)+"."+s.slice(5,7):"";
const nd=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5)+1;
const fn=n=>n==null||isNaN(n)?"–":Math.round(n).toLocaleString("ru-RU").replace(/ /g," ");
const pc=v=>v==null?"–":(v>=10?v.toFixed(0):v.toFixed(1))+"%";
const sg=(v,u,d)=>v==null?"":`${v>0?"+":v<0?"−":""}${Math.abs(v).toFixed(d==null?1:d)}${u||""}`;
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
 rat:"Оценка приложения в магазине и как она изменилась за выбранный период. История копится с момента запуска сбора.",
 ig:"Рост подписчиков за период и активность вокруг аккаунтов. Это не упоминания, а размер и живость аккаунта. У аккаунтов с розыгрышами комментарии накручены."
};
const CSS=`#p-mn tr.me td{background:var(--acc-soft);font-weight:650}#p-mn .info{color:var(--fg3);cursor:help;font-size:13px}
#p-mn .verdict{display:grid;gap:8px;font-size:14px;margin:0;padding:0;background:none}#p-mn .verdict p{margin:0}#p-mn details summary{cursor:pointer;color:var(--fg2);padding:4px 0}
#p-mn details .post{margin-left:6px}#p-mn .post a{color:var(--acc)}#p-mn .alert{display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--line)}
#p-mn .seg{display:inline-flex;gap:2px;background:var(--bg2);border-radius:10px;padding:2px;flex-wrap:wrap}#p-mn .seg button{border:0;background:none;border-radius:8px;padding:5px 11px;cursor:pointer;color:var(--fg2);font-size:12px}
#p-mn .seg button[aria-pressed="true"]{background:var(--card-solid);color:var(--fg);box-shadow:0 1px 2px rgba(0,0,0,.12)}
#p-mn input[type=date]{background:var(--card-solid);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:4px 8px;font:inherit;font-size:12.5px}
#p-mn td .pill{font-weight:500}#p-mn .tbl td:nth-child(-n+2),#p-mn .tbl th:nth-child(-n+2){text-align:left}#p-mn .chip i{flex:none}#p-mn svg [data-tip]{cursor:default}#p-mn .tiles{margin-bottom:0}`;
if(!document.getElementById("mn-css")){const s=document.createElement("style");s.id="mn-css";s.textContent=CSS;document.head.appendChild(s)}
let D=null,P=null,M={from:null,to:null,preset:"30",brands:new Set(DEF),grp:"all"};
const IN=(d,a,b)=>d>=a&&d<=b;
const range=()=>{const L=nd(M.from,M.to),pt=ad(M.from,-1),pf=ad(pt,-(L-1));return{a:M.from,b:M.to,pa:pf,pb:pt,L}};
const nm=b=>D.names[b]||b;
const card=(t,sub,body,cls,right,info)=>`<div class="card ${cls||"c12"}"><div class="chd"><h2>${E(t)}</h2>${info?`<span class="info" data-tip="${E(info)}">ⓘ</span>`:""}<span class="sub">${sub||""}</span>${right?`<div class="right">${right}</div>`:""}</div>${body}</div>`;
const tile=(k,v,d,st)=>`<div class="tile ${st||""}"><div class="k">${E(k)}</div><div class="v">${v}</div><div class="d">${d||""}</div></div>`;
const dlt=(a,b,inv,u)=>{ if(a==null||b==null) return ""; const d=a-b; if(Math.abs(d)<(u==="★"?0.005:0.5)) return '<span class="note">без изменений</span>'; const good=(d<0)===!!inv; return `<span class="pill ${good?"p-good":"p-bad"}">${sg(d,u||"",u==="★"?2:0)}</span><span class="note">к прошлому периоду</span>`};
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

/* ---------- блоки ---------- */
function blocks(){const R=range(),out=[];
 const S=searchAgg(R.a,R.b),SP=searchAgg(R.pa,R.pb),T=talkAgg(R.a,R.b,M.grp),TP=talkAgg(R.pa,R.pb,M.grp),T0=talkAgg(R.a,R.b,"all");
 const O=ownAgg(R.a,R.b),OP=ownAgg(R.pa,R.pb);
 const rp=revAgg(R.a,R.b,"play"),rpp=revAgg(R.pa,R.pb,"play"),ra=revAgg(R.a,R.b,"appstore"),rap=revAgg(R.pa,R.pb,"appstore");
 const latest=(st,br)=>{const rows=D.rat.filter(r=>r[1]===br&&r[2]===st&&r[0]<=R.b);return rows.length?rows[rows.length-1]:null};
 const base=(st,br)=>{const rows=D.rat.filter(r=>r[1]===br&&r[2]===st&&r[0]>=R.a&&r[0]<=R.b);return rows.length>1?rows[0]:null};
 const ver=[],al=[];
 ver.push(`<p><b>Репутация за период:</b> наших упоминаний ${O.t}, негатив ${negPct(O).toFixed(0)}%${OP.t?` (в прошлом периоде ${negPct(OP).toFixed(0)}%)`:""}.</p>`);
 const sk=Object.keys(S.sh).filter(b=>!S.low[b]).sort((x,y)=>S.sh[y]-S.sh[x]);
 if(S.sh.bellissimo!=null&&sk.includes("bellissimo")){const p=sk.indexOf("bellissimo")+1,pv=SP.sh.bellissimo;ver.push(`<p><b>Поиск:</b> Bellissimo на ${p}-м месте из ${sk.length}, доля ${pc(S.sh.bellissimo)}${pv!=null?`, к прошлому периоду ${sg(S.sh.bellissimo-pv," п.п.")}`:""}</p>`)}
 if(T.ok&&T.sh.bellissimo!=null){const rk=Object.keys(T.sh).sort((x,y)=>T.c[y]-T.c[x]);ver.push(`<p><b>Обсуждения:</b> наша доля ${pc(T.sh.bellissimo)}, ${rk.indexOf("bellissimo")+1}-е место (публикаций всего ${T.tot}).</p>`)}else ver.push(`<p><b>Обсуждения:</b> публикаций за период ${T.tot}, для доли нужно не меньше ${D.min_n}.</p>`);
 if(rp.ok||ra.ok){const m=(st,x)=>x.c.bellissimo!=null?`${st}: наших отзывов ${x.c.bellissimo}`:"";ver.push(`<p><b>Отзывы в приложениях:</b> ${[m("Play",rp),m("App Store",ra)].filter(Boolean).join(", ")||"наших отзывов нет"}.</p>`)}
 if(OP.t&&O.o.neg>=10&&negPct(O)-negPct(OP)>=5)al.push(["p-bad",`Негатив вырос: ${negPct(OP).toFixed(0)}% → ${negPct(O).toFixed(0)}% (${O.o.neg} негативных).`]);
 const wk=[];for(let i=1;i<=4;i++){const x=ownAgg(ad(R.b,-7*i+1-6),ad(R.b,-7*i));wk.push(x.t)}if(R.L<=14&&wk.reduce((x,y)=>x+y,0)>=40&&O.t>2*(wk.reduce((x,y)=>x+y,0)/4)*(R.L/7))al.push(["p-warn",`Всплеск упоминаний: ${O.t} за ${R.L} дн. при обычных ${Math.round(wk.reduce((x,y)=>x+y,0)/4*(R.L/7))}.`]);
 const bad=D.status.filter(x=>x.ok===0);if(bad.length)al.push(["p-warn","Не собираются: "+bad.map(x=>SRC[x.s]||x.s).join(", ")+". Цифры по ним могут быть неполными."]);
 const old=D.status.filter(x=>x.ok===1&&D.today&&nd(x.at.slice(0,10),D.today)>3);if(old.length)al.push(["p-warn","Давно не обновлялись: "+old.map(x=>SRC[x.s]||x.s).join(", ")+"."]);
 out.push(card("Главное","вывод за выбранный период",`<div class="verdict">${ver.join("")}</div>`,"c7"));
 out.push(card("Что требует внимания","",al.map(([c,m])=>`<div class="alert"><span class="pill ${c}">внимание</span><span>${E(m)}</span></div>`).join("")||'<div class="alert"><span class="pill p-good">спокойно</span><span>Резких изменений нет.</span></div>',"c5"));
 const lp=latest("play","bellissimo"),la=latest("appstore","bellissimo"),bp=base("play","bellissimo"),ba=base("appstore","bellissimo");
 out.push('<div class="tiles">'+[
  tile("Наших упоминаний",O.t,dlt(O.t,OP.t,false)),
  tile("Доля негатива",negPct(O).toFixed(0)+"%",dlt(negPct(O),negPct(OP),true,"%"),negPct(O)>=20?"st-bad":negPct(O)>=10?"st-warn":"st-good"),
  tile("Негативных",O.o.neg,dlt(O.o.neg,OP.o.neg,true)),
  tile("Google Play",lp?"★ "+lp[3].toFixed(2):"—",bp&&lp?dlt(lp[3],bp[3],false,"★"):'<span class="note">наше приложение</span>'),
  tile("App Store",la?"★ "+la[3].toFixed(2):"—",ba&&la?dlt(la[3],ba[3],false,"★"):'<span class="note">наше приложение</span>')].join("")+"</div>");
 /* поиск */
 {const br=Object.keys(S.sh).sort((x,y)=>S.sh[y]-S.sh[x]);const shown=br.filter(sel);
  const wsh={};S.keys.forEach(k=>{const t=Object.values(S.w[k]).reduce((x,y)=>x+y,0);wsh[k]={};for(const b in S.w[k])wsh[k][b]=t?100*S.w[k][b]/t:null});
  const rows=br.filter(sel).map((b,i)=>row([br.indexOf(b)+1,dot(b)+E(nm(b))+(S.low[b]?' <span class="pill p-mute" data-tip="В среднем меньше 2 пунктов из 100: Google округляет до целых, доля неточная">мало данных</span>':""),pc(S.sh[b]),pp(S.sh[b],SP.sh[b]),`<span class="note">${S.sum[b].toFixed(0)}</span>`],b==="bellissimo")).join("");
  out.push(card("Доля поиска",`интерес к бренду в Google (Узбекистан), недель в периоде: ${S.n}`,(S.n?lineChart(S.keys,wsh,shown)+tbl(["#","Бренд","Доля","К прошлому периоду","Сумма индекса"],rows)+'<p class="note">Google Trends даёт индекс интереса (0–100), а не число запросов. Число запросов подключаем через Google Ads, тогда рядом появятся абсолютные цифры. Доля считается от всех 14 брендов, фильтр по брендам её не меняет.</p>':'<div class="empty">В выбранном периоде нет недель Google Trends.</div>'),"c12",`<span class="note">данные на ${dm((D.status.find(x=>x.s==="trends")||{at:""}).at.slice(0,10))}</span>`,INFO.search))}
 /* обсуждения */
 {const br=Object.keys(T0.c).sort((x,y)=>(T.c[y]||0)-(T.c[x]||0));
  const seg=`<div class="seg" id="mn-grp">${[["all","Всё"],["media","СМИ"],["people","Люди"],["region","Области"]].map(([k,t])=>`<button data-g="${k}" aria-pressed="${M.grp===k}">${t}</button>`).join("")}</div>`;
  const rows=br.filter(sel).map(b=>{const g=T.g[b]||{media:0,people:0,region:0,yt:0};return row([br.indexOf(b)+1,dot(b)+E(nm(b)),fn(T.c[b]||0),T.ok?pc(T.sh[b]):'<span class="note">нужно ≥'+D.min_n+'</span>',T.ok&&TP.ok?pp(T.sh[b],TP.sh[b]):'<span class="note">–</span>',`<span class="note" data-tip="СМИ и новостные каналы / чаты, блогеры и YouTube / областные каналы">${g.media} · ${g.people} · ${g.region}</span>`],b==="bellissimo")}).join("");
  out.push(card("Доля обсуждений",`чужие публикации за период: ${T.tot}`,(br.length?tbl(["#","Бренд","Публикаций","Доля","К прошлому периоду","СМИ · Люди · Области"],rows):'<div class="empty">Публикаций за период нет.</div>')+(T.ok?"":`<div class="empty">Доли пока нет: публикаций ${T.tot}, нужно не меньше ${D.min_n}. Процент на малой выборке случаен, показываем только число.</div>`)+'<p class="note">Считаются только чужие публикации: новостные каналы и сайты, чаты и блогеры, областные каналы, YouTube. Пересылки, комментарии, промокоды и наши посты не считаются. Одинаковый текст в разных каналах считается один раз.</p>',"c12",seg,INFO.talk))}
 /* отзывы по магазинам */
 const revCard=(t,st,x,xp,st2)=>{const br=Object.keys(x.c).filter(b=>!EXC.has(b)).sort((a,b2)=>x.c[b2]-x.c[a]);
  const rows=br.filter(sel).map(b=>row([br.indexOf(b)+1,dot(b)+E(nm(b)),fn(x.c[b]),x.ok?pc(x.sh[b]):'–',x.ok&&xp.ok?pp(x.sh[b],xp.sh[b]):'–',x.c[b]?pc(100*x.ng[b]/x.c[b]):"–"],b==="bellissimo")).join("");
  return card(t,`новых отзывов за период: ${x.tot}`,(br.length?tbl(["#","Бренд","Отзывов","Доля","К прошлому периоду","Негатив 1–2★"],rows):'<div class="empty">Отзывов за период нет.</div>')+(x.ok?"":`<div class="empty">Доли пока нет: отзывов ${x.tot}, нужно не меньше ${D.min_n}.</div>`),"c6",`<span class="note">данные на ${dm((D.status.find(s=>s.s===st2)||{at:""}).at.slice(0,10))}</span>`,INFO.rev)};
 out.push(revCard("Отзывы: Google Play","play",rp,rpp,"play"));out.push(revCard("Отзывы: App Store","appstore",ra,rap,"appstore"));
 /* рейтинги */
 {const brs=[...new Set(D.rat.map(r=>r[1]))].sort((x,y)=>(x!=="bellissimo")-(y!=="bellissimo")||(latest("play",y)?latest("play",y)[4]:0)-(latest("play",x)?latest("play",x)[4]:0));
  const cell=(st,b)=>{const l=latest(st,b),bs=base(st,b);if(!l)return"–";const d0=bs?l[3]-bs[3]:null,d=d0!=null&&Math.abs(d0)>=0.005?d0:null,dc0=bs&&l[4]!=null&&bs[4]!=null?l[4]-bs[4]:null,dc=dc0;return `★ ${l[3].toFixed(2)}${d!=null?` <span class="${d>0.004?"cg":d<-0.004?"cb":"note"}">${sg(d,"",2)}</span>`:""}${dc!=null&&dc!==0?` <span class="note" data-tip="Прирост числа оценок за период">${dc>=0?"+":"−"}${fn(Math.abs(dc))} оц.</span>`:""}`};
  const rows=brs.filter(sel).map(b=>row([dot(b)+E(nm(b)),cell("play",b),cell("appstore",b),fn((latest("appstore",b)||[])[4])],b==="bellissimo")).join("");
  out.push(card("Рейтинги приложений",`изменения с ${dm(R.a)}`,tbl(["Бренд","Google Play","App Store","Оценок в App Store"],rows)+'<p class="note">Зелёное и красное число рядом с оценкой: на сколько она изменилась за период. Пока в базе мало дней истории, изменения появятся по мере накопления.</p>',"c6","",INFO.rat))}
 /* instagram */
 {const brs=[...new Set(D.ig.map(r=>r[1]))];const L=b=>{const r=D.ig.filter(x=>x[1]===b&&x[0]<=R.b);return r.length?r[r.length-1]:null},B=b=>{const r=D.ig.filter(x=>x[1]===b&&x[0]>=R.a&&x[0]<=R.b);return r.length>1?r[0]:null};
  const rows=brs.filter(sel).sort((x,y)=>(L(y)?L(y)[2]:0)-(L(x)?L(x)[2]:0)).map(b=>{const l=L(b),bs=B(b);if(!l)return"";const g=bs&&l[2]&&bs[2]?l[2]-bs[2]:null;const eng=l[2]?1000*((l[4]||0)+(l[5]||0))/l[2]:null;return row([dot(b)+E(nm(b)),fn(l[2])+(g!=null?` <span class="${g>0?"cg":g<0?"cb":"note"}">${g>=0?"+":"−"}${fn(Math.abs(g))}</span>`:""),fn(l[3]),eng==null?"–":eng.toFixed(0),l[3]?(l[5]/l[3]).toFixed(0):"–"],b==="bellissimo")}).join("");
  out.push(card("Instagram конкурентов",`рост подписчиков с ${dm(R.a)}`,tbl(["Аккаунт","Подписчики и рост","Постов за 30 дн.","Реакций на 1000 подп.","Комм. на пост"],rows)+'<p class="note">Рост подписчиков начнёт показываться, когда накопится история по дням. В таблице нет KFC, Sariq Bola, Uzum Tezkor и Domino\'s: их аккаунты не нашлись.</p>',"c6","",INFO.ig))}
 /* по дням */
 out.push(card("Наши упоминания по дням",`комментарии и отзывы про Bellissimo, ${dm(R.a)} – ${dm(R.b)}`,daysChart(O.byd,R.a,R.b),"c12"));
 /* источники */
 {const keys=Object.keys(SRC).filter(k=>O.s[k]||OP.s[k]);const rows=keys.map(k=>{const a=O.s[k]||{n:0,neg:0},p=OP.s[k]||{n:0,neg:0};return row([`<b>${SRC[k]}</b>`,`<span class="note">${E(SRCD[k])}</span>`,fn(a.n),fn(p.n),a.n?pc(100*a.neg/a.n):"–"])}).join("");
  out.push(card("Откуда наши упоминания","только про Bellissimo, это не доли",tbl(["Источник","Что это","Этот период","Прошлый","Негатив"],rows),"c12"))}
 /* темы */
 const themeCard=(sent,title,empty)=>{const c={},p={};for(const[d,se,t,n]of D.themes){if(se!==sent)continue;if(IN(d,R.a,R.b))c[t]=(c[t]||0)+n;else if(IN(d,R.pa,R.pb))p[t]=(p[t]||0)+n}
  const ex=D.posts.filter(x=>x.e===sent&&IN(x.d,R.a,R.b));const tagged=ex.filter(x=>x.h).length;
  const items=Object.entries(c).sort((x,y)=>y[1]-x[1]).slice(0,8).map(([k,n])=>{const e2=ex.filter(x=>x.h.split("|").includes(k)).slice(0,4);const d=n-(p[k]||0);
   return `<details><summary><b>${E(k)}</b> · ${n} <span class="note">(прошлый период ${p[k]||0})</span> <span class="${d===0?"note":(d>0)===(sent==="neg")?"cb":"cg"}">${d>0?"+":""}${d}</span></summary>${e2.map(x=>`<div class="post"><div class="w"><span>${dm(x.d)}</span><span>${SRC[x.s]||x.s}</span>${x.u?`<a href="${E(x.u)}" target="_blank" rel="noopener">открыть ↗</a>`:""}</div><div>${E(x.t.slice(0,240))}</div></div>`).join("")}</details>`}).join("");
  return card(title,`за период, по словарю · с темой ${tagged} из ${ex.length} показанных`,items||`<div class="empty">${empty}</div>`,"c6")};
 out.push(themeCard("neg","О чём пишут плохо","нет негатива с темой"));out.push(themeCard("pos","За что хвалят","нет похвалы с темой"));
 /* свежий негатив */
 {const ng=D.posts.filter(x=>x.e==="neg"&&IN(x.d,R.a,R.b)).slice(0,15);
  out.push(card("Свежий негатив",`последние ${ng.length} за период; ссылки нет у отзывов в магазинах приложений`,ng.map(x=>`<div class="post"><div class="w"><span>${dm(x.d)}</span><span>${SRC[x.s]||x.s}</span>${x.r?`<span>${"★".repeat(x.r)}</span>`:""}${x.h?`<span class="pill">${E(x.h.replace(/\|/g,", "))}</span>`:""}${x.u?`<a href="${E(x.u)}" target="_blank" rel="noopener">открыть ↗</a>`:'<span class="pill p-mute" data-tip="Магазины приложений не дают ссылку на отдельный отзыв. Найти его можно в кабинете разработчика по дате и тексту">без ссылки</span>'}</div><div>${E(x.t.slice(0,300))}</div></div>`).join("")||'<div class="empty">Негатива за период нет.</div>',"c12"))}
 /* как читать */
 out.push(card("Как читать эту вкладку","нажми, чтобы раскрыть",`<details><summary>Показать пояснения</summary>
  <p><b>Фильтр сверху</b> работает на все блоки: период (кнопки или даты) и бренды. Бренды меняют только то, что показано в таблицах и на графике. Доли всегда считаются от всех 14 брендов, поэтому от выбора брендов не меняются.</p>
  <p><b>Три доли независимы</b> и не складываются: поиск (интерес людей в Google), обсуждения (чужие упоминания в СМИ, чатах, блогах, YouTube), отзывы (новые отзывы на приложения). У каждой свой источник и своя ошибка.</p>
  <p><b>Что не считается:</b> наши посты, реклама и комментарии под ними, пересылки, промокоды. Они идут только в блоки про нашу репутацию.</p>
  <p><b>«К прошлому периоду»</b> сравнивает с таким же по длине периодом сразу перед выбранным.</p>
  <p><b>Порог:</b> доля показывается, если набралось не меньше ${D.min_n} наблюдений за период. Иначе только число.</p>
  <p><b>Тональность</b> определяется по словарю (русский и узбекский), без нейросети. Точность около 80%: тренды надёжны, отдельные комментарии стоит проверять глазами.</p>
  <p><b>Недельные данные:</b> Google Trends отдаёт данные по неделям, поэтому в поиске период округляется до недель.</p></details>`,"c12"));
 /* сборщики */
 {const lab={igc:"Instagram конкурентов",trends:"Google Trends",tgw:"Telegram: наш список каналов",media:"Сайты СМИ",tg:"Telegram: поиск и наши каналы"};
  out.push(card("Состояние сборщиков","сбор идёт сам два раза в день",tbl(["Источник","Статус","Последний запуск","Заметка"],D.status.map(x=>`<tr><td>${E(SRC[x.s]||lab[x.s]||x.s)}</td><td><span class="pill ${x.ok===1&&!x.note?"p-good":x.ok===0?"p-bad":"p-warn"}">${x.ok===1&&!x.note?"работает":x.ok===0?"ошибка":x.ok===1?"есть замечание":"нет ключа"}</span></td><td>${E(x.at)}</td><td style="white-space:normal;text-align:left">${E(x.note)}</td></tr>`).join("")),"c12"))}
 out.push(`<p class="note" style="grid-column:1/-1">Обновлено ${E(D.built)}.</p>`);
 return out.join("")}

function barHtml(){const R=[["7","7 дней"],["30","30 дней"],["90","90 дней"],["all","Всё время"]];
 return `<div class="card c12" id="mn-bar"><div class="chd"><h2>Фильтр</h2><span class="sub">действует на все блоки вкладки</span></div>
 <div class="seg" id="mn-per" style="margin-bottom:8px">${R.map(([k,t])=>`<button data-p="${k}" aria-pressed="${M.preset===k}">${t}</button>`).join("")}</div>
 <span class="note" style="margin-left:8px">или даты:</span> <input type="date" id="mn-from" value="${M.from}" min="${P.min}" max="${D.today}"> <span class="note">–</span> <input type="date" id="mn-to" value="${M.to}" min="${P.min}" max="${D.today}">
 <div class="chips" id="mn-chips" style="margin-top:10px">${Object.keys(D.names).map(b=>`<button class="chip" data-b="${b}" aria-pressed="${sel(b)}">${dot(b)}${E(nm(b))}</button>`).join("")}<button class="chip" data-b="*" aria-pressed="false">все бренды</button></div></div>`}
function setPreset(k){M.preset=k;M.to=D.today;M.from=k==="all"?P.min:ad(D.today,-(+k-1));if(M.from<P.min)M.from=P.min}
function paint(root){root.querySelector("#mn-body").innerHTML=blocks();
 root.querySelectorAll("#mn-per button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.p===M.preset));
 root.querySelectorAll("#mn-chips .chip[data-b]").forEach(b=>{if(b.dataset.b!=="*")b.setAttribute("aria-pressed",sel(b.dataset.b))});
 root.querySelector("#mn-from").value=M.from;root.querySelector("#mn-to").value=M.to}
window.renderMentions=function(panel,data){D=data;
 const dates=[...D.trends.map(r=>r[0]),...D.own.map(r=>r[0]),...D.talk.map(r=>r[0]),...D.rev.map(r=>r[0])].sort();P={min:dates[0]||ad(D.today,-90)};
 setPreset("30");
 panel.innerHTML=barHtml()+'<div id="mn-body" style="display:contents"></div>';paint(panel);
 if(!panel.dataset.wired){panel.dataset.wired=1;
  panel.addEventListener("click",e=>{
   const p=e.target.closest("#mn-per button");if(p){setPreset(p.dataset.p);paint(panel);return}
   const g=e.target.closest("#mn-grp button");if(g){M.grp=g.dataset.g;paint(panel);return}
   const c=e.target.closest("#mn-chips .chip");if(c){if(c.dataset.b==="*"){Object.keys(D.names).forEach(b=>M.brands.add(b))}else if(M.brands.has(c.dataset.b))M.brands.delete(c.dataset.b);else M.brands.add(c.dataset.b);paint(panel)}});
  panel.addEventListener("change",e=>{if(e.target.id==="mn-from"||e.target.id==="mn-to"){let f=panel.querySelector("#mn-from").value,t=panel.querySelector("#mn-to").value;if(f&&t){if(f>t)[f,t]=[t,f];M.from=f;M.to=t;M.preset="custom";paint(panel)}}})}
};
})();
