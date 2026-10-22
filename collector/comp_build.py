#!/usr/bin/env python3
"""Competitor dashboard builder.
Reads  RAW/comp_adlib_*.json, comp_tg_*.json, comp_apps_*.json  (daily snapshots from Chrome)
Writes SITE/data/comp.json (everything except images) and SITE/data/thumbs.json (id -> data URL)
Keeps STORE/thumbs_store.json so thumbnails are captured once and reused.
Usage: python3 comp_build.py RAW_DIR SITE_DIR
"""
import json, re, sys, glob, os, datetime as dt, collections

RAW = sys.argv[1] if len(sys.argv) > 1 else 'raw'
SITE = sys.argv[2] if len(sys.argv) > 2 else 'site_comp'
STORE = os.path.join(os.path.dirname(os.path.abspath(RAW)), 'thumbs_store.json')
os.makedirs(os.path.join(SITE, 'data'), exist_ok=True)

BRANDS = {
    'bellissimo': {'name': 'Bellissimo', 'color': '#7d4cdb', 'own': 1},
    'kfc': {'name': 'KFC', 'color': '#e4002b'},
    'evos': {'name': 'EVOS', 'color': '#1f9d55'},
    'oqtepa': {'name': 'Oqtepa', 'color': '#f5b400'},
    'dodo': {'name': 'Dodo Pizza', 'color': '#ff6900'},
    'maxway': {'name': 'MaxWay', 'color': '#0a84ff'},
    'uzum': {'name': 'Uzum Tezkor', 'color': '#ff2d92'},
    'yandex': {'name': 'Yandex Eats', 'color': '#5f6b7a'},
    'sariqbola': {'name': 'Sariq Bola Pizza', 'color': '#00b8d9'},
    'hardees': {'name': "Hardee's", 'color': '#6d4c41'},
    'safia': {'name': 'Safia', 'color': '#9e9d24'},
}

SURR = re.compile(r"[\ud800-\udfff]")
def clean(x):
    """Drop half-emoji left when a browser script cut text mid-character (lone surrogates break utf-8)."""
    if isinstance(x, str): return SURR.sub('', x)
    if isinstance(x, list): return [clean(v) for v in x]
    if isinstance(x, dict): return {k: clean(v) for k, v in x.items()}
    return x

def day(ts):
    return dt.datetime.fromtimestamp(ts + 5 * 3600, dt.timezone.utc).date().isoformat() if ts else None

HIRE = re.compile(r"kuryer|курьер|вакан|ishchi|lavozim|ish o.rni|работник|в команду|hiring|daromad|зарплат|xodim|qabul ochildi|kadrlar|\bish(ga|ni) ", re.I)
def goal(a):
    l = (a.get('link') or '').lower(); t = (a.get('body') or '') + ' ' + (a.get('title') or '')
    if 'franchise' in l or re.search(r"франшиз|franshiza|shaxsiy biznes", t, re.I):
        return 'Франшиза'
    if 'paperform' in l or '-hr.' in l or 'hr_bot' in l or 'jbot' in l:
        return 'Найм'
    if 'play.google' in l or 'itunes.apple' in l or 'apps.apple' in l or 'onelink' in l or 'app.link' in l:
        return 'Приложение'
    if HIRE.search(t):
        return 'Найм'
    if 't.me/' in l:
        return 'Telegram-бот'
    if 'yandex' in l and 'maps' in l or '/maps' in l:
        return 'Филиал / карта'
    if 'instagram' in l:
        return 'Instagram'
    if 'wa.me' in l or 'whatsapp' in l:
        return 'WhatsApp'
    if not l or l.startswith('http://fb.me') or l.startswith('fb.me'):
        return 'Охват / бренд'
    return 'Сайт'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rules import tags, primary, prices, price_items, codes, lang, plural, ru_part  # noqa: E402

# ---------- Ad Library snapshots ----------
files = sorted(glob.glob(os.path.join(RAW, 'comp_adlib_*.json')))
store = json.load(open(STORE)) if os.path.exists(STORE) else {}
ads = {}          # id -> record
daily = collections.defaultdict(dict)   # date -> brand -> {total, groups}
dates = []
for f in files:
    d = clean(json.load(open(f))); D = re.search(r'(\d{4}-\d\d-\d\d)', os.path.basename(f)).group(1); dates.append(D)   # file name is the Tashkent date; the date inside can be UTC
    for b, B in d.get('brands', {}).items():
        if 'ads' not in B: continue
        g = B['ads']
        if g and all(len(a.get('ids') or []) >= min(a.get('n') or 1, 200) for a in g): cov = len({i for a in g for i in a['ids']})   # every copy listed: exact
        else: cov = sum(a.get('n') or 1 for a in g)
        if B.get('total') is not None: cov = min(cov, B['total'])   # copies behind the creatives we hold vs Meta's own counter
        daily[D][b] = {'total': B.get('total'), 'groups': len(B['ads']), 'covered': cov}
        for a in B['ads']:
            if a.get('thumb'): store[a['id']] = a['thumb']
            r = ads.get(a['id'])
            text = ((a.get('body') or '') + ' ' + (a.get('title') or '')).strip()
            if r is None:
                r = ads[a['id']] = {'id': a['id'], 'b': b, 'first': D}
            r.update({'last': D, 'start': day(a.get('start')), 'n': a.get('n', 1), 'fmt': a.get('fmt', ''),
                      'plat': a.get('plat', ''), 'cta': a.get('cta', ''), 'link': a.get('link', ''),
                      'title': '' if '{{' in (a.get('title') or '') else (a.get('title') or ''),
                      'body': '' if '{{' in (a.get('body') or '') else (a.get('body') or ''),
                      'cards': a.get('cards', 0), 'catalog': 1 if '{{' in text else 0})
            if b in BRANDS and a.get('likes') is not None:
                BRANDS[b]['likes'] = a['likes']
json.dump(store, open(STORE, 'w'))
last = dates[-1] if dates else None
for r in ads.values():
    text = (r['body'] + ' ' + r['title'])
    r['goal'] = goal(r); r['tags'] = tags(text); r['offer'] = 'Найм' if r['goal'] == 'Найм' else ('Каталог товаров' if r['catalog'] and not r['tags'] else 'Только видео/картинка' if not (r['body'] or r['title']) else primary(r['tags'])); r['pitems'] = price_items(text, r['goal'] == 'Найм'); r['prices'] = [x['p'] for x in r['pitems']]; r['codes'] = codes(text); r['lang'] = lang(text); r['ru'] = ru_part(r['body']) if r['lang'] == 'UZ' else ''
    r['active'] = 1 if r['last'] == last else 0
    end = r['last'] if r['active'] else r['last']
    r['days'] = (dt.date.fromisoformat(end) - dt.date.fromisoformat(r['start'])).days + 1 if r['start'] else None
    r['thumb'] = 1 if r['id'] in store else 0
    r['plat'] = ''.join(x[0] for x in r['plat'].split('|') if x)  # F I A M W T

# ---------- Apps ----------
apps = {}
for f in sorted(glob.glob(os.path.join(RAW, 'comp_apps_*.json')) + glob.glob(os.path.join(RAW, 'comp_ios_*.json')) + glob.glob(os.path.join(RAW, 'comp_play_*.json'))):
    x = json.load(open(f)); d = apps.setdefault(x['date'], {'date': x['date']})
    for k, v in x.items():
        if k != 'date' and v: d[k] = v
for d in apps.values():
    pl = d.get('play', {})
    if 'safia2' in pl:  # two Safia apps in Play: keep the bigger one
        alt = pl.pop('safia2')
        if alt and (not pl.get('safia') or (alt[1] or 0) > (pl['safia'][1] or 0)): pl['safia'] = alt
    # chart position must come from the Food & Drink chart itself (an app page shows its own category)
    IDS = {'1507547994': 'bellissimo', '6733229176': 'kfc', '1595897228': 'evos', '6744400909': 'oqtepa', '894649641': 'dodo',
           '1565502018': 'maxway', '1665523197': 'uzum', '1078986931': 'yandex', '6471396712': 'sariqbola', '6754248343': 'hardees', '1554545839': 'safia'}
    pos = {IDS[i]: str(k + 1) for k, i in enumerate(d.get('ios_chart_ids', [])) if i in IDS}
    for b, v in d.get('ios', {}).items():
        if not v: continue
        if not v[0] and not v[1]: v[0] = v[1] = v[2] = None   # page did not load: 0 ratings / 0.0 is a failed read, not real data
        if d.get('ios_chart_ids'): v[3] = pos.get(b)
        if v[2]: v[2] = ','.join(str(round(float(x))) for x in str(v[2]).split(','))
        if v[4] and '.' not in str(v[4]): v[4] = None   # regex sometimes catches a build number instead of a version

# ---------- App Store place: weekly average (one day in the chart is noise) ----------
def week_rank(apps):
    ds = sorted(d for d in apps if apps[d].get('ios_chart_ids'))
    if not ds: return {}
    last = dt.date.fromisoformat(ds[-1]); age = lambda d: (last - dt.date.fromisoformat(d)).days
    cur = [d for d in ds if age(d) < 7]; prev = [d for d in ds if 7 <= age(d) < 14]
    if not prev: prev = [d for d in ds if d not in cur][:3]
    approx = len(prev) < 3   # fewer than 3 snapshots is not yet a weekly average
    def avg(days, b):
        v = [int(apps[d]['ios'][b][3]) for d in days if (apps[d].get('ios') or {}).get(b) and apps[d]['ios'][b][3]]
        return (round(sum(v) / len(v), 1), len(v)) if v else (None, 0)
    out = {'cur': [cur[0], cur[-1]] if cur else None, 'prev': [prev[0], prev[-1]] if prev else None, 'approx': approx, 'b': {}}
    for b in BRANDS:
        a, n = avg(cur, b); pa, pn = avg(prev, b)
        today = (apps[ds[-1]].get('ios') or {}).get(b)
        out['b'][b] = {'avg': a, 'n': n, 'of': len(cur), 'prev': pa, 'today': int(today[3]) if today and today[3] else None}
    return out
RANK = week_rank(apps)
fp = lambda v: f"{v:g}".replace('.', ',')

# ---------- Telegram ----------
tg = {}
for f in sorted(glob.glob(os.path.join(RAW, 'comp_tg_*.json'))):
    d = clean(json.load(open(f))); tg[d['date']] = d['ch']
tg_posts = {}
for D, ch in tg.items():
    for b, c in ch.items():
        for p in c.get('posts', []):
            if p.get('id'):
                q = dict(p); q['b'] = b; q['tags'] = tags(p.get('txt', '')); q['prices'] = prices(p.get('txt', '')); q['codes'] = codes(p.get('txt', '')); q['ru'] = ru_part(p.get('txt', ''))
                tg_posts[p['id']] = q
tg_last = tg[max(tg)] if tg else {}

def num(s):
    if s is None: return None
    s = str(s).replace(',', '').strip(); m = 1
    if s.endswith('K'): m, s = 1e3, s[:-1]
    elif s.endswith('M'): m, s = 1e6, s[:-1]
    try: return round(float(s) * m)
    except: return None

# ---------- Insights (rule based, no LLM) ----------
# lvl is always from Bellissimo's point of view: bad = threat to us, warn = watch, good = in our favour, acc = new, mute = fact
ins = []
def msgkey(r): return (r.get('body') or r.get('title') or r['id'])[:80]
if last:
    L = dt.date.fromisoformat(last)
    for b in BRANDS:
        A = [r for r in ads.values() if r['b'] == b and r['active']]
        if not A: continue
        cv = (daily.get(last) or {}).get(b) or {}
        sample = f" По {cv['covered']} из {cv['total']} объявлений (остальные Facebook не отдал)." if cv.get('total') and cv.get('covered', 0) < cv['total'] else ''
        new7 = [r for r in A if r['goal'] != 'Найм' and r['start'] and (L - dt.date.fromisoformat(r['start'])).days < 7]
        _seen = set(); new7 = [r for r in new7 if not (msgkey(r) in _seen or _seen.add(msgkey(r)))]
        n_msg = len({msgkey(r) for r in A if r['goal'] != 'Найм'})
        nm = BRANDS[b]['name']; own = BRANDS[b].get('own')
        if new7 and not own:
            g = collections.Counter(r['goal'] for r in new7).most_common(2)
            ins.append({'sec': 'ads', 'b': b, 'lvl': 'acc', 't': f"{nm}: {len(new7)} {plural(len(new7), 'новое сообщение', 'новых сообщения', 'новых сообщений')} в рекламе за 7 дней",
                        'm': 'Куда ведут: ' + ', '.join(f"{k} — {v}" for k, v in g) + '.' + sample})
        offers = collections.Counter(r['offer'] for r in A if r['offer'] not in ('Найм', 'Без оффера', 'Цена', 'Каталог товаров', 'Только видео/картинка'))
        if offers and not own:
            ins.append({'sec': 'ads', 'b': b, 'lvl': 'mute', 't': f"{nm}: чаще всего — " + ', '.join(k for k, _ in offers.most_common(3)),
                        'm': f"среди {n_msg} {plural(n_msg, 'активного сообщения', 'активных сообщений', 'активных сообщений')}." + sample})
        hire = len({msgkey(r) for r in A if r['goal'] == 'Найм'})
        if hire >= 3 and hire / max(n_msg + hire, 1) > .3 and not own:
            ins.append({'sec': 'ads', 'b': b, 'lvl': 'mute', 't': f"{nm}: {hire} {plural(hire, 'сообщение', 'сообщения', 'сообщений')} о найме в рекламе (и {n_msg} о продажах)",
                        'm': 'Ищут курьеров и персонал. В счёт сообщений найм не входит.'})
    if apps:
        a = apps[max(apps)]; ch = a.get('ios_chart', []); R = RANK.get('b', {})
        me = (R.get('bellissimo') or {}).get('avg')
        span = (f"{RANK['prev'][0][8:]}.{RANK['prev'][0][5:7]}" + (f"–{RANK['prev'][1][8:]}.{RANK['prev'][1][5:7]}" if RANK['prev'][1] != RANK['prev'][0] else '') if RANK.get('prev') else '')
        if me:
            above = sorted((x['avg'], b) for b, x in R.items() if x['avg'] and b != 'bellissimo' and x['avg'] < me)
            if above:
                ins.append({'sec': 'app', 'b': above[0][1], 'lvl': 'bad', 't': f"В среднем выше нас в App Store (мы #{fp(me)}): " + ', '.join(f"{BRANDS[b]['name']} #{fp(p)}" for p, b in above),
                            'm': 'Среднее место в чарте «Еда и напитки» за последние 7 дней.'})
        for b, x in R.items():
            if not (x['avg'] and x['prev']): continue
            up = x['prev'] - x['avg']
            if abs(up) < 3: continue
            if b == 'bellissimo': lvl = 'good' if up > 0 else 'bad'
            elif up > 0: lvl = 'bad' if me and x['avg'] < me <= x['prev'] else 'warn'
            else: lvl = 'good'
            ins.append({'sec': 'app', 'b': b, 'lvl': lvl, 't': f"{BRANDS[b]['name']}: в среднем #{fp(x['prev'])} → #{fp(x['avg'])} в App Store",
                        'm': f"{'поднялся' if up > 0 else 'опустился'} на {fp(round(abs(up), 1))} — среднее за 7 дней против " + (f"снимка {span} (предыдущая неделя ещё не накопилась, вывод предварительный)" if RANK.get('approx') else 'среднего за предыдущие 7 дней')})
        known = ('kfc', 'bellissimo', 'evos', 'oqtepa', 'dodo', 'maxway', 'uzum', 'yandex', 'sariq', 'hardee', 'safia')
        newcomers = [n for n in ch[:10] if not any(k in n.lower() for k in known)]
        if newcomers:
            ins.append({'sec': 'app', 'b': None, 'lvl': 'mute', 't': 'Не в списке конкурентов, но в топ-10 App Store: ' + ', '.join(newcomers), 'm': 'Стоит решить, добавлять ли их в радар'})
ORDER_LVL = {'bad': 0, 'warn': 1, 'acc': 2, 'good': 3, 'mute': 4}
ins.sort(key=lambda i: ORDER_LVL.get(i['lvl'], 9))

out = {
    'info': {'date': last, 'dates': dates, 'built': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d %H:%M'), 'n_ads': len(ads)},
    'brands': BRANDS,
    'daily': daily,
    'ads': sorted(ads.values(), key=lambda r: (r['start'] or ''), reverse=True),
    'apps': apps,
    'tg': {b: {'handle': c.get('handle'), 'title': c.get('title'), 'subs': num((c.get('cnt') or {}).get('subscribers')), 'photos': num((c.get('cnt') or {}).get('photos')), 'videos': num((c.get('cnt') or {}).get('videos'))} for b, c in tg_last.items()},
    'tg_hist': {D: {b: num((c.get('cnt') or {}).get('subscribers')) for b, c in ch.items()} for D, ch in tg.items()},
    'tg_posts': sorted(tg_posts.values(), key=lambda p: p.get('t') or '', reverse=True),
    'insights': ins,
    'rank': RANK,
    'cover': {b: v for b, v in (daily.get(last) or {}).items()},
}
out = clean(out)
json.dump(out, open(os.path.join(SITE, 'data', 'comp.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
active_ids = {r['id'] for r in ads.values()}
json.dump({k: v for k, v in store.items() if k in active_ids}, open(os.path.join(SITE, 'data', 'thumbs.json'), 'w'), separators=(',', ':'))
print('ads', len(ads), 'active', sum(r['active'] for r in ads.values()), 'thumbs', sum(r['thumb'] for r in ads.values()), 'insights', len(ins), 'dates', dates)
