#!/usr/bin/env python3
"""Daily self-check of the radar. Runs after the data is collected and the site is built.
Every check is listed in REGLAMENT.md with the same id. Result: SITE/data/health.json (shown on the site),
a readable report in the log, and a Telegram message when something is wrong (needs TG_BOT_TOKEN and TG_CHAT_ID).
Usage: python3 checks.py DATA_DIR SITE_DIR"""
import json, os, re, sys, glob, datetime as dt, urllib.request, urllib.parse

DATA, SITE = sys.argv[1], sys.argv[2]; RAW = os.path.join(DATA, 'raw')
TZ = dt.timezone(dt.timedelta(hours=5)); NOW = dt.datetime.now(TZ); TODAY = NOW.date()
OWN = 'bellissimo'
R = []   # {id, name, st: ok|warn|fail, msg}


def L(p):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return None


def snaps(kind):
    out = {}
    for f in sorted(glob.glob(os.path.join(RAW, f'comp_{kind}_*.json'))):
        d = re.search(r'(\d{4}-\d\d-\d\d)', f).group(1); x = L(f)
        if x: out[d] = x
    return out


def add(i, name, st, msg): R.append({'id': i, 'name': name, 'st': st, 'msg': msg})


def age_days(d): return (TODAY - dt.date.fromisoformat(d)).days


ad, ios, play, tg = snaps('adlib'), snaps('ios'), snaps('play'), snaps('tg')

# C1 freshness of each source
for k, name, s in (('adlib', 'Реклама Meta', ad), ('ios', 'App Store', ios), ('play', 'Google Play', play), ('tg', 'Telegram-каналы', tg)):
    if not s: add('C1', f'Свежесть: {name}', 'fail', 'нет ни одного снимка'); continue
    a = age_days(max(s))
    add('C1', f'Свежесть: {name}', 'ok' if a <= 0 else 'warn' if a == 1 else 'fail', f'последний снимок {max(s)}' + ('' if a <= 0 else f' ({a} дн. назад)'))

# C2 ads: every brand returned a counter
if ad:
    d = max(ad); B = ad[d].get('brands') or {}; miss = [b for b, x in B.items() if x.get('total') is None]
    add('C2', 'Реклама: счётчик Meta есть у всех брендов', 'ok' if not miss and len(B) >= 10 else 'fail', f'{len(B)} брендов' + (f', нет счётчика: {", ".join(miss)}' if miss else ''))
    # C3 coverage in ADS (copies behind collected creatives vs Meta counter)
    low = []
    for b, x in B.items():
        if x.get('total'):
            c = min(x['total'], sum(a.get('n') or 1 for a in x.get('ads') or [])); p = c / x['total']
            if p < .7: low.append(f'{b} {round(100 * p)}%')
    kept = [b for b, x in B.items() if x.get('list_empty')]
    low += [f'{b}: Facebook не отдал список, показаны объявления прошлых дней' for b in kept]
    add('C3', 'Реклама: охват текстов ≥ 70% по каждому бренду', 'ok' if not low else 'warn', 'все бренды выше 70%' if not low else 'ниже порога: ' + ', '.join(low) + ' — выводы по офферам и ценам этих брендов не делаются')
    # C4 sudden jump of a counter vs previous snapshot (could be a failed read, not a real change)
    ds = sorted(ad)
    if len(ds) > 1:
        prev = ad[ds[-2]].get('brands') or {}; jumps = []
        for b, x in B.items():
            o, n = (prev.get(b) or {}).get('total'), x.get('total')
            if o and n is not None and o >= 10 and abs(n - o) / o > .5: jumps.append(f'{b} {o}→{n}')
        add('C4', 'Реклама: нет подозрительных скачков счётчика (±50% за снимок)', 'ok' if not jumps else 'warn', 'скачков нет' if not jumps else 'проверить вручную: ' + ', '.join(jumps))

# C5/C6 apps
if ios:
    d = max(ios); x = ios[d]; bad = [b for b, v in (x.get('ios') or {}).items() if not v or not (v[0] or 0)]
    add('C5', 'App Store: рейтинги прочитаны у всех приложений', 'ok' if not bad and len(x.get('ios') or {}) >= 11 else 'warn', f'{len(x.get("ios") or {})} приложений' + (f', без данных: {", ".join(bad)}' if bad else ''))
    add('C6', 'App Store: чарт «Еда и напитки» прочитан', 'ok' if len(x.get('ios_chart_ids') or []) >= 20 else 'fail', f'{len(x.get("ios_chart_ids") or [])} позиций')
if play:
    d = max(play); x = play[d].get('play') or {}; bad = [b for b, v in x.items() if not v or not v[0]]
    add('C7', 'Google Play: рейтинги прочитаны у всех приложений', 'ok' if not bad and len(x) >= 11 else 'warn', f'{len(x)} приложений' + (f', без данных: {", ".join(bad)}' if bad else ''))

# C8 telegram channels
if tg:
    d = max(tg); ch = tg[d].get('ch') or {}; prev = tg[sorted(tg)[-2]].get('ch') if len(tg) > 1 else {}
    gone = [b for b in (prev or {}) if b not in ch]; nosub = [b for b, c in ch.items() if not (c.get('cnt') or {}).get('subscribers')]
    add('C8', 'Telegram: все каналы читаются, подписчики видны', 'ok' if not gone and not nosub and ch else 'warn', f'{len(ch)} каналов' + (f', пропали: {", ".join(gone)}' if gone else '') + (f', без подписчиков: {", ".join(nosub)}' if nosub else ''))

# C9 mentions collected on the Mac: the time the Mac itself exported (mentions_data.json is rebuilt every 2 h on GitHub, so its time says nothing about the Mac)
NAME9 = 'Упоминания: Mac выгружал данные за последние 30 ч'
mac = L(os.path.join(DATA, 'mentions_mac.json'))
if mac and mac.get('at'):
    try:
        h = (NOW - dt.datetime.fromisoformat(mac['at'].replace(' ', 'T')).replace(tzinfo=TZ)).total_seconds() / 3600
        add('C9', NAME9, 'ok' if h <= 30 else 'warn' if h <= 54 else 'fail', f'последняя выгрузка {round(h)} ч назад ({mac["at"]})')
    except Exception: add('C9', NAME9, 'warn', 'не удалось разобрать время выгрузки')
    # C12 every Mac source ran recently (one source can stall while the others keep working)
    SRC = {'ig': 'Instagram', 'ads': 'комментарии к рекламе', 'igc': 'комментарии Instagram', 'yt': 'YouTube', 'tg': 'Telegram-комментарии', 'tgw': 'Telegram-чаты'}
    old, errs = [], []
    for r in mac.get('status') or []:
        try: hh = (NOW - dt.datetime.fromisoformat(str(r[1]).replace(' ', 'T')).replace(tzinfo=TZ)).total_seconds() / 3600
        except Exception: continue
        if hh > 72: old.append(f'{SRC.get(r[0], r[0])} {round(hh / 24)} дн.')
        if re.search(r'ошибок: [1-9]', str(r[4] if len(r) > 4 else '')): errs.append(f'{SRC.get(r[0], r[0])}: {re.search(r"ошибок: \d+", str(r[4])).group(0)}')
    add('C12', 'Упоминания: каждый источник Mac обновлялся за 3 дня, без ошибок доступа', 'ok' if not old and not errs else 'warn',
        'все источники свежие' if not old and not errs else '; '.join((['давно не обновлялись: ' + ', '.join(old)] if old else []) + errs))
else:
    add('C9', NAME9, 'fail', 'нет файла data/mentions_mac.json')

# C10 the built site is consistent with the data
c = L(os.path.join(SITE, 'data', 'comp.json')); j = L(os.path.join(SITE, 'data', 'journal.json'))
ok = bool(c) and c['info']['date'] == (max(ad) if ad else None) and len(c.get('ads') or []) > 0
add('C10', 'Сайт собран из последних данных', 'ok' if ok else 'fail', f'comp.json: {len(c["ads"])} объявлений, дата {c["info"]["date"]}' if c else 'comp.json не собрался')
add('C11', 'Журнал событий собран', 'ok' if j and j.get('events') else 'fail', f'{len(j["events"])} событий' if j else 'journal.json не собрался')

n = {s: sum(1 for r in R if r['st'] == s) for s in ('ok', 'warn', 'fail')}
overall = 'fail' if n['fail'] else 'warn' if n['warn'] else 'ok'
out = {'at': NOW.strftime('%Y-%m-%d %H:%M'), 'overall': overall, 'n': n, 'checks': R}
os.makedirs(os.path.join(SITE, 'data'), exist_ok=True)
json.dump(out, open(os.path.join(SITE, 'data', 'health.json'), 'w', encoding='utf-8'), ensure_ascii=False)
ICON = {'ok': 'OK  ', 'warn': 'WARN', 'fail': 'FAIL'}
print(f'health {overall}: {n["ok"]} ok, {n["warn"]} warn, {n["fail"]} fail')
for r in R: print(f'  [{ICON[r["st"]]}] {r["id"]} {r["name"]} — {r["msg"]}')

# Telegram message only when something is wrong
tok, chat = os.environ.get('TG_BOT_TOKEN'), os.environ.get('TG_CHAT_ID')
if overall != 'ok' and tok and chat:
    lines = [f'Radar {NOW.strftime("%d.%m %H:%M")}: {"есть сбои" if overall == "fail" else "есть замечания"}'] + [f'{"🔴" if r["st"] == "fail" else "🟡"} {r["name"]}: {r["msg"]}' for r in R if r['st'] != 'ok']
    try:
        urllib.request.urlopen(urllib.request.Request(f'https://api.telegram.org/bot{tok}/sendMessage', urllib.parse.urlencode({'chat_id': chat, 'text': '\n'.join(lines)[:3500]}).encode()), timeout=20)
        print('telegram sent')
    except Exception as e: print('telegram failed', e)
