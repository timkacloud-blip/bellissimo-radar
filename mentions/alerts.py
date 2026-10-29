#!/usr/bin/env python3
"""Telegram alerts after each mentions run (every ~2 h): new notable publications about Bellissimo, competitors' promos in big
channels, and a spike of negative comments about us. Remembers what was sent (snap: alert/last) so nothing is sent twice.
The first run only sets the mark. Usage: alerts.py DB  (needs TG_BOT_TOKEN, TG_CHAT_ID)"""
import os, sys, re, sqlite3, json, urllib.request, urllib.parse, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import feed as F
from share import NAMES

TZ = dt.timezone(dt.timedelta(hours=5)); NOW = dt.datetime.now(TZ)
db = sqlite3.connect(sys.argv[1])
row = db.execute("SELECT value FROM snap WHERE date='alert' AND source='alert' AND key='last'").fetchone()
mark = int(NOW.strftime('%Y%m%d%H%M'))
db.execute("INSERT OR REPLACE INTO snap VALUES ('alert','alert','last',?)", (mark,)); db.commit()
if not row: print('first run: mark set, nothing sent'); sys.exit()
last = str(int(row[0])); last = f'{last[:4]}-{last[4:6]}-{last[6:8]} {last[8:10]}:{last[10:12]}'
fresh = (NOW - dt.timedelta(hours=48)).timestamp()

new_ids = {i.split('#')[0] for (i,) in db.execute("SELECT id FROM items WHERE seen>? AND scope='earned' AND source IN ('tg','media','yt')", (last,))}
feed = [x for x in F.build(db, NOW.date(), NAMES, days=3) if x['id'] in new_ids and x['ts'] >= fresh]
seen_txt = set(); ours, comp = [], []
for x in sorted(feed, key=lambda x: -(x['r'] or 0)):
    k = re.sub(r'\W+', ' ', x['t'].lower())[:100]
    if k in seen_txt: continue
    seen_txt.add(k)
    if 'bellissimo' in x['b']:
        if x['cat'] in ('Промокод', 'Найм'): continue
        if x['s'] == 'neg' or x['cat'] in ('Мнение', 'Пресса и PR') or (x['r'] or 0) >= 20000: ours.append(x)
    elif x['cat'] == 'Акция бренда' and (x['r'] or 0) >= 50000: comp.append(x)

# spike of negative comments and reviews about us: last 24 h against the daily average of the 14 days before
d1 = (NOW - dt.timedelta(days=1)).strftime('%Y-%m-%d'); d15 = (NOW - dt.timedelta(days=15)).strftime('%Y-%m-%d')
neg24 = db.execute("SELECT COUNT(*) FROM items WHERE brand='bellissimo' AND sentiment='neg' AND scope='owned' AND date>=?", (d1,)).fetchone()[0]
neg14 = db.execute("SELECT COUNT(*) FROM items WHERE brand='bellissimo' AND sentiment='neg' AND scope='owned' AND date>=? AND date<?", (d15, d1)).fetchone()[0] / 14
spike_sent = db.execute("SELECT 1 FROM snap WHERE date='alert' AND source='alert' AND key=?", ('spike' + d1,)).fetchone()

def short(x, n=160):
    t = re.sub(r'\s+', ' ', x['t']).strip(); return t[:n] + ('…' if len(t) > n else '')
def where(x):
    return (('@' + x['ch']) if x['src'] == 'tg' and x['ch'] else (x['ch'] or {'yt': 'YouTube', 'media': 'СМИ'}.get(x['src'], ''))) + (f" ({F_k(x['r'])})" if x['r'] else '')
def F_k(n): return f'{n / 1e6:.1f} млн'.replace('.', ',') if n >= 1e6 else f'{round(n / 1e3)} тыс' if n >= 1e3 else str(n)

lines = []
if ours:
    lines.append('🟣 О нас: новые публикации')
    for x in ours[:8]: lines.append(f"• {x['cat']}{' · негатив' if x['s'] == 'neg' else ''} — {where(x)}\n  {short(x)}\n  {x['u']}")
if neg24 >= 8 and neg24 > 2 * max(neg14, 1) and not spike_sent:
    lines.append(f'🔴 Негатив о нас за сутки: {neg24} (обычно около {round(neg14)} в день). Смотреть: вкладка «Упоминания» → «Свежий негатив»')
    db.execute("INSERT OR REPLACE INTO snap VALUES ('alert','alert',?,1)", ('spike' + d1,)); db.commit()
if comp:
    lines.append('🟠 Акции конкурентов в крупных каналах')
    for x in comp[:5]: lines.append(f"• {', '.join(NAMES.get(b, b) for b in x['b'])} — {where(x)}\n  {short(x, 120)}\n  {x['u']}")
print('\n'.join(lines) or 'nothing new')
tok, chat = os.environ.get('TG_BOT_TOKEN'), os.environ.get('TG_CHAT_ID')
if lines and tok and chat:
    text = 'Радар · упоминания\n\n' + '\n'.join(lines)
    urllib.request.urlopen(urllib.request.Request(f'https://api.telegram.org/bot{tok}/sendMessage', urllib.parse.urlencode(
        {'chat_id': chat, 'text': text[:3900], 'disable_web_page_preview': 'true'}).encode()), timeout=20)
    print('sent')
