#!/usr/bin/env python3
"""Competitor event journal. Recomputed from daily snapshots in DATA/raw on every build (deterministic),
plus manual entries from DATA/journal_manual.json. Writes SITE/data/journal.json.
Usage: python3 journal.py DATA_DIR SITE_DIR"""
import json, os, re, sys, glob, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rules import gist, plural, prices as offer_prices  # noqa: E402
DATA, SITE = sys.argv[1], sys.argv[2]; RAW = os.path.join(DATA, 'raw')
NAMES = {'bellissimo': 'Bellissimo', 'kfc': 'KFC', 'evos': 'EVOS', 'oqtepa': 'Oqtepa', 'dodo': 'Dodo Pizza', 'maxway': 'MaxWay', 'uzum': 'Uzum Tezkor',
         'yandex': 'Yandex Eats', 'sariqbola': 'Sariq Bola', 'hardees': "Hardee's", 'safia': 'Safia'}
IOS_ID = {'bellissimo': '1507547994', 'kfc': '6733229176', 'evos': '1595897228', 'oqtepa': '6744400909', 'dodo': '894649641', 'maxway': '1565502018',
          'uzum': '1665523197', 'yandex': '1078986931', 'sariqbola': '6471396712', 'hardees': '6754248343', 'safia': '1554545839'}
PROMO = re.compile(r"\d+\s*\+\s*\d|\d{1,2}\s?%|скидк|акци|aksiya|chegirma|бесплат|bepul|в подарок|sovg.a|промокод|promokod|bonus|бонус", re.I)
OPEN = re.compile(r"открыл|открыт[иь]е|новый филиал|ochildi|yangi filial|ochilish|скоро открыт|tez orada ochil", re.I)
HIRE = re.compile(r"ваканс|требуют|ищем (курьер|повар|сотрудник)|kuryer.*(kerak|ishga)|ishga taklif|bo'sh ish|vakansiya|приглашаем на работу", re.I)
PRICE = re.compile(r"(\d{1,3}(?:[\s\u00a0\u202f.,]?\d{3}))\s*(?:сум|so[‘'’`]?m|sum)", re.I)

def L(p):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return None
def snaps(kind):
    out = {}
    for f in sorted(glob.glob(os.path.join(RAW, f'comp_{kind}_*.json'))):
        d = re.search(r'(\d{4}-\d\d-\d\d)', f).group(1); x = L(f)
        if x: out[d] = x
    return out
def head(a): return re.split(r'-{3,}|—{3,}|_{3,}', (a.get('body') or a.get('title') or ''))[0].strip()
def key(t): return re.sub(r'[^\w]+', ' ', t.lower())[:70].strip()
def tsd(x):
    try: return dt.datetime.fromtimestamp(int(x) + 5 * 3600, dt.timezone.utc).date().isoformat()
    except Exception: return str(x or '')[:10]
def prices(t):
    return offer_prices(t or '')

E = []
def ev(date, b, typ, title, detail='', src='', link='', imp='mid', ref=''):
    E.append({'date': date, 'b': b, 'type': typ, 'title': title, 'detail': detail[:300], 'src': src, 'link': link, 'imp': imp, 'ref': ref})

# ---- Meta Ad Library
ad = snaps('adlib'); days = sorted(ad); seen = set(); seen_ids = set(); base = days[0] if days else None
for i, d in enumerate(days):
    prev = days[i - 1] if i else None
    for b, B in (ad[d].get('brands') or {}).items():
        ads = B.get('ads') or []
        if prev:
            pt = ((ad[prev].get('brands') or {}).get(b) or {}).get('total'); t = B.get('total')
            if pt and t is not None and abs(t - pt) >= 5 and abs(t - pt) / pt >= .3:
                ev(d, b, 'ads', ('Резкий рост' if t > pt else 'Резкий спад') + f' рекламы: {pt} → {t} {plural(t, "объявление", "объявления", "объявлений")}',
                   f'активные объявления в Meta, снимки {prev[8:]}.{prev[5:7]} и {d[8:]}.{d[5:7]}', 'Ad Library', '', 'high')
            new = [a for a in ads if a.get('id') not in seen_ids and tsd(a.get('start')) > prev]
            if len(new) >= 5: ev(d, b, 'wave', f'Новая волна креативов: {len(new)} новых объявлений', '; '.join(head(a)[:60] for a in new[:3]), 'Ad Library', '', 'mid', new[0].get('id', ''))
        for a in ads:
            h = head(a); k = (b, key(h)); seen_ids.add(a.get('id'))
            if not h or k in seen: continue
            seen.add(k)
            if prev and (PROMO.search(h) or prices(h)) and tsd(a.get('start')) >= (dt.date.fromisoformat(d) - dt.timedelta(days=14)).isoformat():
                p = prices(h); typ = 'open' if OPEN.search(h) else 'hire' if HIRE.search(h) else 'offer'
                ev(tsd(a.get('start')) if tsd(a.get('start')) > prev else d, b, typ,
                   ('Оффер: ' + gist(h, p[0] if p else None)) if typ == 'offer' else {'open': 'Открытие', 'hire': 'Найм'}[typ],
                   h, 'Реклама Meta', f"https://www.facebook.com/ads/library/?id={a.get('id')}", 'high' if typ in ('offer', 'open') else 'mid', a.get('id', ''))

# ---- App Store
ios = snaps('ios'); dd = sorted(ios)
for i in range(1, len(dd)):
    a, c = ios[dd[i - 1]], ios[dd[i]]
    for b in NAMES:
        x, y = (a.get('ios') or {}).get(b), (c.get('ios') or {}).get(b)
        if x and y:
            if x[4] and y[4] and x[4] != y[4]: ev(dd[i], b, 'app', f'Обновление iOS-приложения: {x[4]} → {y[4]}', '', 'App Store', f'https://apps.apple.com/uz/app/id{IOS_ID[b]}')
            if x[1] and y[1] and abs(y[1] - x[1]) >= .1: ev(dd[i], b, 'rating', f'Рейтинг в App Store: {x[1]:.1f} → {y[1]:.1f}', '', 'App Store', '', 'mid')
        ra = (a.get('ios_chart_ids') or []); rc = (c.get('ios_chart_ids') or []); i_ = IOS_ID[b]
        pa = ra.index(i_) + 1 if i_ in ra else None; pc = rc.index(i_) + 1 if i_ in rc else None
        if pa and pc and abs(pa - pc) >= 5: ev(dd[i], b, 'rating', f'Место в топе App Store: #{pa} → #{pc}', 'категория «Еда и напитки», Узбекистан', 'App Store')
        elif bool(pa) != bool(pc) and (pa or pc) and (pa or pc) <= 20: ev(dd[i], b, 'rating', 'Попал в топ App Store' if pc else 'Выпал из топа App Store', f'было #{pa or "—"}, стало #{pc or "—"}', 'App Store')

# ---- Google Play
pl = snaps('play'); dd = sorted(pl)
for i in range(1, len(dd)):
    for b in NAMES:
        x, y = (pl[dd[i - 1]].get('play') or {}).get(b), (pl[dd[i]].get('play') or {}).get(b)
        if x and y:
            if x[3] and y[3] and x[3] != y[3]: ev(dd[i], b, 'app', 'Обновление Android-приложения', f'дата обновления в Google Play: {y[3]}', 'Google Play')
            if x[0] and y[0] and abs(y[0] - x[0]) >= .1: ev(dd[i], b, 'rating', f'Рейтинг в Google Play: {x[0]:.1f} → {y[0]:.1f}', '', 'Google Play')

# ---- Telegram
tg = snaps('tg'); tbase = min(tg) if tg else None; tseen = set()
for d in sorted(tg):
    for b, ch in (tg[d].get('ch') or {}).items():
        for p in ch.get('posts') or []:
            if p['id'] in tseen: continue
            tseen.add(p['id']); t = p.get('txt') or ''; pd = (p.get('t') or d)[:10]
            if pd < (dt.date.fromisoformat(tbase) - dt.timedelta(days=7)).isoformat(): continue
            typ = 'open' if OPEN.search(t) else 'hire' if HIRE.search(t) else 'offer' if (PROMO.search(t) or prices(t)) else None
            if not typ: continue
            pr = prices(t)
            ev(pd, b, typ, ('Оффер: ' + gist(t, pr[0] if pr else None)) if typ == 'offer' else {'open': 'Открытие', 'hire': 'Найм'}[typ],
               t[:240], 'Telegram', 'https://t.me/' + p['id'], 'high' if typ in ('offer', 'open') else 'mid')

# ---- manual
for m in (L(os.path.join(DATA, 'journal_manual.json')) or []):
    m = dict(m); m.setdefault('src', 'Вручную'); m.setdefault('imp', 'high'); m.setdefault('detail', ''); m.setdefault('link', ''); m.setdefault('ref', ''); E.append(m)

# dedupe same brand/type/title on same day
u = {}; [u.setdefault((e['date'], e['b'], e['type'], e['title'][:60], e['detail'][:60]), e) for e in E]
E = sorted(u.values(), key=lambda e: (e['date'], e['imp'] == 'high'), reverse=True)
cov = {'adlib': sorted(ad), 'ios': sorted(ios), 'play': sorted(pl), 'tg': sorted(tg), 'baseline': base}
json.dump({'built': dt.datetime.now(dt.timezone.utc).isoformat()[:16], 'coverage': cov, 'events': E, 'note': L(os.path.join(DATA, 'boss_note.json'))}, open(os.path.join(SITE, 'data', 'journal.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('journal', len(E), 'events;', sum(e['imp'] == 'high' for e in E), 'high')
