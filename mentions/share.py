# -*- coding: utf-8 -*-
"""Три независимых индекса доли. Считаются из mentions_data.db, одинаковым способом для всех брендов.
1) Доля поиска  — Google Trends (Узбекистан), все бренды в одной шкале через бренд-якорь.
2) Доля обсуждений — только публичные упоминания (scope=earned), уникальные тексты, сообщение с двумя брендами идёт обоим.
3) Доля отзывов в приложениях — новые отзывы Google Play и App Store за неделю (Dodo и Yandex исключены: приложения международные).
Порог: если за неделю по индексу меньше MIN_N наблюдений — доля не показывается (процент на малой выборке случаен)."""
import datetime as dt
MIN_N = 30
NAMES = {'bellissimo': 'Bellissimo', 'kfc': 'KFC', 'evos': 'EVOS', 'oqtepa': 'Oqtepa', 'dodo': 'Dodo', 'maxway': 'MaxWay', 'sariqbola': 'Sariq Bola',
         'hardees': "Hardee's", 'safia': 'Safia', 'uzum': 'Uzum Tezkor', 'yandex': 'Yandex Eats', 'papajohns': 'Papa Johns', 'apex': 'APEX', 'dominos': "Domino's"}

def windows(today, n):
    """n последних недельных окон, заканчивающихся вчера; [(старт, конец), ...] от старого к новому"""
    out = []
    for i in range(n - 1, -1, -1):
        end = today - dt.timedelta(days=1 + 7 * i); out.append((end - dt.timedelta(days=6), end))
    return out

def label(w): return w[1].strftime('%d.%m')

def search_share(db, today, n=12):
    wins = windows(today, n); rows = db.execute('SELECT date, brand, value FROM trends').fetchall()
    per = {}
    for d, b, v in rows:
        d = dt.date.fromisoformat(d)
        for i, (a, z) in enumerate(wins):
            if a <= d <= z: per.setdefault(b, [0.0] * n)[i] += v
    tot = [sum(per[b][i] for b in per) for i in range(n)]
    share = {b: [(100 * per[b][i] / tot[i]) if tot[i] else None for i in range(n)] for b in per}
    # недельные точки Google (шкала 0–100 по самому крупному бренду): если в среднем меньше 2 пунктов, целочисленное округление Google искажает долю
    low = [b for b in per if sum(per[b]) / max(n, 1) < 2.0]
    return {'wins': wins, 'share': share, 'low': low, 'ok': bool(rows)}

def _count_share(rows, wins, key_brand=0, key_date=1):
    n = len(wins); per = {}; tot = [0] * n
    for r in rows:
        d = dt.date.fromisoformat(r[key_date])
        for i, (a, z) in enumerate(wins):
            if a <= d <= z: per.setdefault(r[key_brand], [0] * n)[i] += 1; tot[i] += 1
    share = {b: [(100 * per[b][i] / tot[i]) if tot[i] >= MIN_N else None for i in range(n)] for b in per}
    return {'wins': wins, 'count': per, 'total': tot, 'share': share}

import re as _re
from sentiment import norm as _norm
_PROMO = _re.compile(r"promo\s*-?\s*kod|promokod|promocod|promakod|pramakod|pramokod|promo code|промокод")
def is_promo_spam(text):
    """ролики и посты-«промокоды» (реферальные шорты с хештегами): это реклама, а не обсуждение"""
    n = _norm(text or ''); return bool(_PROMO.search(n)) or n.count('#') >= 3

def talk_share(db, today, n=4):
    """Только публикации (видео, посты), без комментариев к ним (иначе одно видео считается дважды) и без промокод-спама."""
    wins = windows(today, n)
    raw = db.execute("SELECT brand, date, thash, text FROM items WHERE scope='earned' AND source IN ('yt','tg') AND kind IN ('video','mention','post') AND date>=?",
                     [str(wins[0][0])]).fetchall()
    seen = set(); rows = []
    for b, d, h, t in raw:
        if is_promo_spam(t) or (b, h) in seen: continue
        seen.add((b, h)); rows.append((b, d, h))
    res = _count_share(rows, wins)
    res['by_src'] = dict(db.execute("SELECT source, COUNT(*) FROM items WHERE scope='earned' AND kind IN ('video','mention','post') AND date>=? GROUP BY source", [str(wins[0][0])]).fetchall())
    res['spam'] = sum(1 for b, d, h, t in raw if is_promo_spam(t))
    res['all4'] = {}
    for b, d, h in rows: res['all4'][b] = res['all4'].get(b, 0) + 1
    return res

def review_share(db, today, n=4):
    wins = windows(today, n)
    rows = db.execute("SELECT brand, date, id FROM items WHERE source IN ('play','appstore') AND scope IN ('owned','app_review') AND date>=?", [str(wins[0][0])]).fetchall()
    res = _count_share(rows, wins)
    neg = db.execute("SELECT brand, COUNT(*), SUM(rating<=2) FROM items WHERE source IN ('play','appstore') AND scope IN ('owned','app_review') AND date>=? GROUP BY brand", [str(wins[0][0])]).fetchall()
    res['neg'] = {b: (c, (100 * s / c) if c else None) for b, c, s in neg}
    # если по неделям данных мало — доля за все 4 недели вместе
    allc = {b: sum(v) for b, v in res['count'].items()}; t = sum(allc.values())
    res['all4'] = {b: 100 * c / t for b, c in allc.items()} if t >= MIN_N else {}
    res['all4_n'] = t
    return res

def ig_table(db):
    last = db.execute("SELECT MAX(date) FROM snap WHERE source='igc'").fetchone()[0]
    if not last: return []
    d = {}
    for k, v in db.execute("SELECT key, value FROM snap WHERE source='igc' AND date=?", [last]):
        b, m = k.split(':'); d.setdefault(b, {})[m] = v
    out = []
    for b, m in d.items():
        f = m.get('followers') or 0; p = m.get('posts30') or 0
        eng = (m.get('likes30', 0) + m.get('comments30', 0))
        out.append({'brand': b, 'followers': f, 'posts': p, 'eng_per_1000': (1000 * eng / f) if f else None, 'comments_per_post': (m.get('comments30', 0) / p) if p else None, 'date': last})
    return sorted(out, key=lambda x: -(x['eng_per_1000'] or 0))
