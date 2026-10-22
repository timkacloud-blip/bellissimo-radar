#!/usr/bin/env python3
"""Строит site/index.html из mentions.db. Без интернета и без Claude. Запуск: python3 build_dashboard.py"""
import os, sqlite3, html, datetime as dt
from collections import Counter, defaultdict
HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get('MENTIONS_DB') or os.path.join(HERE, 'mentions_data.db')
db = sqlite3.connect(DB); db.row_factory = sqlite3.Row
TZ = dt.timezone(dt.timedelta(hours=5))
today = dt.datetime.now(TZ).date()
SRC = {'ig': 'Instagram (наш)', 'ads': 'Под рекламой', 'play': 'Google Play', 'appstore': 'App Store', 'tg': 'Telegram', 'media': 'СМИ', 'yt': 'YouTube'}
COL = {'pos': '#2a9d8f', 'neu': '#b8bcc4', 'neg': '#e5484d'}
rows = [dict(r) for r in db.execute("SELECT * FROM items WHERE kind!='video' AND date>=?", [str(today - dt.timedelta(days=120))])]
own = [r for r in rows if r['brand'] == 'bellissimo']
D = lambda n: str(today - dt.timedelta(days=n))
def e(s): return html.escape(str(s))

def stacked(series, labels, title, w=860, h=210):
    """series: list of (pos,neu,neg) на период; рисуем столбики + линию доли негатива."""
    n = len(series); pad = 34; bw = (w - pad - 10) / max(n, 1)
    mx = max([sum(s) for s in series] + [1])
    out = [f'<svg viewBox="0 0 {w} {h+34}" class="ch" role="img" aria-label="{e(title)}">']
    for i in range(5):
        y = 6 + (h - 6) * i / 4
        out.append(f'<line x1="{pad}" x2="{w-4}" y1="{y:.0f}" y2="{y:.0f}" class="gl"/><text x="{pad-5}" y="{y+4:.0f}" class="ax" text-anchor="end">{round(mx*(4-i)/4)}</text>')
    pts = []
    for i, (p, u, ng) in enumerate(series):
        x = pad + i * bw; y0 = h
        for v, c in ((ng, 'neg'), (u, 'neu'), (p, 'pos')):
            hh = (h - 6) * v / mx
            if hh > 0: out.append(f'<rect x="{x+1:.1f}" y="{y0-hh:.1f}" width="{max(bw-2,1):.1f}" height="{hh:.1f}" fill="{COL[c]}"><title>{e(labels[i])}: {c} {v}</title></rect>'); y0 -= hh
        tot = p + u + ng
        pts.append((x + bw / 2, ng / tot if tot else None))
    # линия доли негатива (скользящее среднее по 3 точкам)
    sm = []
    for i in range(n):
        win = [series[j] for j in range(max(0, i-2), i+1)]; t = sum(sum(s) for s in win); ng = sum(s[2] for s in win)
        sm.append((pts[i][0], ng / t if t else None))
    path = ' '.join(f"{'M' if k == 0 or sm[k-1][1] is None else 'L'}{x:.1f},{h - (h-6)*v:.1f}" for k, (x, v) in enumerate(sm) if v is not None)
    if path: out.append(f'<path d="{path}" fill="none" stroke="#111" stroke-width="1.6" stroke-dasharray="4 3"/>')
    step = max(1, n // 8)
    for i in range(0, n, step): out.append(f'<text x="{pad + i*bw + bw/2:.0f}" y="{h+16}" class="ax" text-anchor="middle">{e(labels[i])}</text>')
    out.append('</svg>'); return ''.join(out)

def bucket(rs, keyfn, keys):
    c = {k: [0, 0, 0] for k in keys}
    for r in rs:
        k = keyfn(r)
        if k in c: c[k][{'pos': 0, 'neu': 1, 'neg': 2}[r['sentiment']]] += 1
    return [tuple(c[k]) for k in keys]

days = [D(i) for i in range(59, -1, -1)]
daily = bucket(own, lambda r: r['date'], days)
weeks = []
for i in range(11, -1, -1):
    s = today - dt.timedelta(days=today.weekday() + 7 * i); weeks.append(s)
wk = lambda r: str(dt.date.fromisoformat(r['date']) - dt.timedelta(days=dt.date.fromisoformat(r['date']).weekday()))
weekly = bucket(own, wk, [str(w) for w in weeks])

def period(a, b): return [r for r in own if D(b) <= r['date'] <= D(a)]
cur, prev = period(0, 6), period(7, 13)
def negshare(rs): return (100 * sum(r['sentiment'] == 'neg' for r in rs) / len(rs)) if rs else 0
def delta(a, b, unit='', inv=False):
    d = a - b; cls = 'bad' if (d > 0) != inv and d != 0 else 'good' if d != 0 else ''
    return f'<span class="d {cls}">{d:+.0f}{unit} к прошлой неделе</span>'

# таблица по источникам (за 7 дней)
tbl = []
for k, name in SRC.items():
    a = [r for r in cur if r['source'] == k]; b = [r for r in prev if r['source'] == k]
    rt = [r['rating'] for r in a if r['rating']]
    tbl.append(f"<tr><td>{name}</td><td>{len(a)}</td><td>{len(b)}</td><td>{negshare(a):.0f}%</td><td>{(sum(rt)/len(rt)):.1f}</td></tr>" if rt else
               f"<tr><td>{name}</td><td>{len(a)}</td><td>{len(b)}</td><td>{negshare(a):.0f}%</td><td>–</td></tr>")

# темы негатива: эта неделя против прошлой
def themes(rs): 
    c = Counter()
    for r in rs:
        if r['sentiment'] == 'neg':
            for t in filter(None, (r['themes'] or '').split('|')): c[t] += 1
    return c
tc, tp = themes(cur), themes(prev)
trows = ''.join(f"<tr><td>{e(t)}</td><td>{n}</td><td>{tp.get(t,0)}</td></tr>" for t, n in tc.most_common(8)) or '<tr><td colspan=3>нет негатива с темой</td></tr>'

# рейтинги магазинов
snaps = [dict(r) for r in db.execute("SELECT * FROM snap WHERE key='score' ORDER BY date")]
snap_html = ''.join(f"<div class=k><b>{e(SRC.get(s['source'], s['source']))}</b>{s['value']:.2f}<small>{s['date']}</small></div>" for s in
                    {x['source']: x for x in snaps}.values())

from share_view import share_html
brand_html = share_html(db, today)

# свежий негатив
neg = sorted([r for r in own if r['sentiment'] == 'neg' and r['text']], key=lambda r: -r['ts'])[:25]
neg_html = ''.join(f"<li><small>{r['date']} · {SRC.get(r['source'], r['source'])}{' · ' + '★'*r['rating'] if r['rating'] else ''}"
                   f"{' · ' + e(r['themes'].replace('|', ', ')) if r['themes'] else ''}</small><br>{e(r['text'][:260])}</li>" for r in neg)

status = ''.join(f"<tr><td>{SRC.get(s['source'], s['source'])}</td><td class='{'good' if s['ok']==1 and not s['note'] else 'bad' if s['ok']==0 else 'warn'}'>"
                 f"{'работает' if s['ok']==1 else 'ошибка' if s['ok']==0 else 'нет ключа'}</td><td>{s['last_run']}</td><td>{e(s['note'] or '')}</td></tr>"
                 for s in map(dict, db.execute('SELECT * FROM status ORDER BY source')))

page = f"""<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Упоминания Bellissimo</title><style>
:root{{--bg:#fff;--fg:#14171a;--mut:#6b7280;--line:#e5e7eb;--card:#f7f8fa}}
@media(prefers-color-scheme:dark){{:root{{--bg:#111316;--fg:#eceef1;--mut:#9aa1ab;--line:#2a2e35;--card:#1a1d22}}svg path[stroke="#111"]{{stroke:#eee}}}}
body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 -apple-system,Segoe UI,Roboto,sans-serif}}
main{{max-width:940px;margin:0 auto;padding:20px 16px 60px}}h1{{font-size:22px;margin:0 0 4px}}h2{{font-size:16px;margin:30px 0 8px}}
.sub{{color:var(--mut);font-size:13px}}.row{{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}}
.k{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;min-width:150px;font-size:26px;font-weight:600}}
.k b{{display:block;font-size:12px;font-weight:500;color:var(--mut)}}.k small{{display:block;font-size:11px;font-weight:400;color:var(--mut)}}
.d{{font-size:12px;font-weight:400;display:block;color:var(--mut)}}.d.bad,.bad{{color:#e5484d}}.d.good,.good{{color:#2a9d8f}}.warn{{color:#b7791f}}
table{{border-collapse:collapse;width:100%;font-size:14px}}td,th{{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}}th{{color:var(--mut);font-weight:500}}
svg.ch{{width:100%;height:auto}}.gl{{stroke:var(--line)}}.ax{{fill:var(--mut);font-size:11px}}h3{{font-size:14px;margin:22px 0 4px}}tr.me td{{font-weight:600}}.lg2{{font-size:12px;color:var(--mut)}}.lg2 span{{margin-right:12px}}.lg2 i{{display:inline-block;width:10px;height:3px;margin-right:4px;vertical-align:middle}}small{{color:var(--mut)}}li{{margin:0 0 10px}}ul{{padding-left:18px}}
.lg span{{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 12px}}</style><main>
<h1>Упоминания Bellissimo</h1><div class="sub">Обновлено {dt.datetime.now(TZ).strftime('%d.%m.%Y %H:%M')} · тональность считается по словарю, не вручную</div>
<div class="row">
<div class="k"><b>Упоминаний за 7 дней</b>{len(cur)}{delta(len(cur), len(prev))}</div>
<div class="k"><b>Доля негатива</b>{negshare(cur):.0f}%{delta(negshare(cur), negshare(prev), '%')}</div>
<div class="k"><b>Негативных</b>{sum(r['sentiment']=='neg' for r in cur)}{delta(sum(r['sentiment']=='neg' for r in cur), sum(r['sentiment']=='neg' for r in prev))}</div>
{snap_html}</div>
<h2>По дням, 60 дней</h2><div class="lg sub"><span style="background:{COL['pos']}"></span>позитив<span style="background:{COL['neu']}"></span>нейтрал<span style="background:{COL['neg']}"></span>негатив<span style="background:#111"></span>доля негатива (среднее за 3 дня)</div>
{stacked(daily, [d[5:] for d in days], 'Упоминания по дням')}
<h2>По неделям, 12 недель</h2>{stacked(weekly, [str(w)[5:] for w in weeks], 'Упоминания по неделям')}
<h2>По источникам, последние 7 дней</h2><table><tr><th>Источник</th><th>Эта неделя</th><th>Прошлая</th><th>Негатив</th><th>Ср. оценка</th></tr>{''.join(tbl)}</table>
<h2>О чём негатив</h2><table><tr><th>Тема</th><th>Эта неделя</th><th>Прошлая</th></tr>{trows}</table>
{brand_html}
<h2>Свежий негатив</h2><ul>{neg_html or '<li>пока нет</li>'}</ul>
<h2>Состояние сборщиков</h2><table><tr><th>Источник</th><th>Статус</th><th>Последний запуск</th><th>Заметка</th></tr>{status}</table>
</main></html>"""
os.makedirs(os.path.join(HERE, 'site'), exist_ok=True)
open(os.path.join(HERE, 'site', 'index.html'), 'w').write(page)
from view_radar import fragment
open(os.path.join(HERE, 'site', 'mentions_frag.html'), 'w').write(fragment(db, today, TZ))
import facts, shutil
facts.write(db, today, TZ, os.path.join(HERE, 'site', 'mentions_data.json'))
shutil.copy(os.path.join(HERE, 'mentions.js'), os.path.join(HERE, 'site', 'mentions.js'))
print('ok: site/index.html, упоминаний за 7д:', len(cur))
