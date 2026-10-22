# -*- coding: utf-8 -*-
"""Единая таблица фактов для вкладки «Упоминания». Все блоки в браузере считаются из этого JSON, поэтому цифры в блоках не расходятся.
Здесь только выборка и дедупликация; доли, периоды и пороги считает mentions.js по выбранному фильтру."""
import json, datetime as dt
from share import NAMES, MIN_N, is_promo_spam

TYPE = lambda p: 'media' if (p or '').startswith('w:media') else (p[2:] if (p or '').startswith('w:') else 'search')

def build(db, today, TZ):
    db.row_factory = None
    since = str(today - dt.timedelta(days=400))
    # 1) обсуждения: только чужие публикации (earned), без комментариев и промокод-спама, уникальные тексты
    seen = set(); talk = {}
    for b, d, h, t, src, p in db.execute("SELECT brand,date,thash,text,source,parent FROM items WHERE scope='earned' AND source IN ('yt','tg','media') AND kind IN ('video','mention','post') AND date>=? ORDER BY ts", [since]):
        if b not in NAMES or is_promo_spam(t) or (b, h) in seen: continue
        seen.add((b, h)); k = (d, b, src, TYPE(p)); talk[k] = talk.get(k, 0) + 1
    # 2) отзывы приложений (Google Play и App Store отдельно)
    rev = [[d, b, s, n, int(ng or 0)] for d, b, s, n, ng in db.execute(
        "SELECT date,brand,source,COUNT(*),SUM(rating<=2) FROM items WHERE source IN ('play','appstore') AND scope IN ('owned','app_review') AND date>=? GROUP BY 1,2,3", [since]) if b in NAMES]
    # 3) рейтинги по дням
    rat = {}
    for d, s, k, v in db.execute("SELECT date,source,key,value FROM snap WHERE (source LIKE 'play_%' OR source LIKE 'appstore_%') AND key IN ('score','ratings')"):
        st, b = s.split('_', 1)
        if st == 'appstore' and b == 'uz': b = 'bellissimo'
        elif b in ('ru',): continue
        if b not in NAMES: continue
        rat.setdefault((d, b, st), {})[k] = v
    rat = [[d, b, st, m.get('score'), m.get('ratings')] for (d, b, st), m in sorted(rat.items())]
    # 4) Instagram конкурентов по дням
    ig = {}
    for d, k, v in db.execute("SELECT date,key,value FROM snap WHERE source='igc'"):
        b, m = k.split(':'); ig.setdefault((d, b), {})[m] = v
    ig = [[d, b, m.get('followers'), m.get('posts30'), m.get('likes30'), m.get('comments30')] for (d, b), m in sorted(ig.items()) if b in NAMES]
    # 5) Google Trends (недельные значения как отдал Google)
    trends = [[d, b, v] for d, b, v in db.execute("SELECT date,brand,value FROM trends ORDER BY date") if b in NAMES]
    # 6) наши упоминания: по дням и источникам, темы, примеры
    own = [[d, s, se, n] for d, s, se, n in db.execute("SELECT date,source,sentiment,COUNT(*) FROM items WHERE brand='bellissimo' AND kind!='video' AND date>=? GROUP BY 1,2,3", [since])]
    themes = {}
    for d, se, th in db.execute("SELECT date,sentiment,themes FROM items WHERE brand='bellissimo' AND kind!='video' AND themes!='' AND date>=?", [since]):
        for t in th.split('|'):
            if t: themes[(d, se, t)] = themes.get((d, se, t), 0) + 1
    themes = [[d, se, t, n] for (d, se, t), n in themes.items()]
    posts = []
    for d, s, se, th, r, u, t in db.execute("SELECT date,source,sentiment,themes,rating,url,text FROM items WHERE brand='bellissimo' AND kind!='video' AND text!='' AND sentiment IN ('neg','pos') AND date>=? ORDER BY ts DESC", [str(today - dt.timedelta(days=120))]):
        posts.append({'d': d, 's': s, 'e': se, 'h': th or '', 'r': r, 'u': u or '', 't': t[:300]})
    posts = [p for p in posts if p['e'] == 'neg'][:700] + [p for p in posts if p['e'] == 'pos'][:400]
    cov = {'own': dict(db.execute("SELECT source, MIN(date) FROM items WHERE brand='bellissimo' AND kind!='video' GROUP BY 1")),
           'talk': dict(db.execute("SELECT source, MIN(date) FROM items WHERE scope='earned' AND source IN ('yt','tg','media') AND kind IN ('video','mention','post') GROUP BY 1")),
           'rev_comp': dict(db.execute("SELECT source, MIN(date) FROM items WHERE source IN ('play','appstore') AND scope='app_review' GROUP BY 1")),
           'rat': (db.execute("SELECT MIN(date) FROM snap WHERE source LIKE 'play_%' OR source LIKE 'appstore_%'").fetchone() or [None])[0],
           'ig': (db.execute("SELECT MIN(date) FROM snap WHERE source='igc'").fetchone() or [None])[0],
           'trends': (db.execute("SELECT MIN(date) FROM trends").fetchone() or [None])[0]}
    try:
        import os
        total = len(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'telegram_watch.json'))))
    except Exception: total = 0
    read = db.execute("SELECT COUNT(*) FROM snap WHERE date='full' AND source='tgw' AND key!='all'").fetchone()[0]
    cov['tgw'] = {'read': read, 'total': total, 'full': bool(db.execute("SELECT 1 FROM snap WHERE date='full' AND source='tgw' AND key='all'").fetchone())}
    cov['media_on'] = bool(db.execute("SELECT 1 FROM status WHERE source='media' AND ok=1").fetchone())
    status = [dict(zip(('s', 'at', 'ok', 'n', 'note'), x)) for x in db.execute("SELECT source,last_run,ok,n_new,note FROM status ORDER BY source")]
    for x in status: x['note'] = (x['note'] or '')[:160]
    return {'built': dt.datetime.now(TZ).strftime('%Y-%m-%d %H:%M'), 'today': str(today), 'min_n': MIN_N, 'names': NAMES, 'mine': 'bellissimo',
            'talk': [[*k, n] for k, n in sorted(talk.items())], 'rev': rev, 'rat': rat, 'ig': ig, 'trends': trends,
            'cov': cov, 'own': own, 'themes': themes, 'posts': posts, 'status': status}

def write(db, today, TZ, path):
    json.dump(build(db, today, TZ), open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
