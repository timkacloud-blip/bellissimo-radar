# -*- coding: utf-8 -*-
"""Фрагмент для вкладки «Упоминания» радара: те же карточки/плитки/таблицы, что в основном дашборде. Без внешних зависимостей."""
import html, datetime as dt
from collections import Counter
from share import search_share, talk_share, review_share, ig_table, NAMES, label, MIN_N

def e(s): return html.escape(str(s))
SER = ['var(--s2)', 'var(--s4)', 'var(--s3)', 'var(--s1)', 'var(--s5)', 'var(--s6)']
BELL = 'var(--bad)'
def col(b, i): return 'var(--acc)' if b == 'bellissimo' else SER[i % len(SER)]
def pct(v): return '–' if v is None else (f'{v:.0f}%' if v >= 10 else f'{v:.1f}%')
def nm(b): return NAMES.get(b, b)

INFO = {
 'search': 'Сколько людей ищут бренд в Google в Узбекистане. Не зависит от нашей рекламы и постов, поэтому самый честный показатель интереса. Не складывается с другими долями.',
 'talk': 'Сколько раз бренд упомянули на чужих площадках (YouTube, Telegram). Наши посты, реклама и комментарии под ними не считаются.',
 'rev': 'Кто сколько новых отзывов получает в Google Play и App Store. Показывает, о чьём приложении люди пишут чаще.',
}
def card(title, sub, body, cls='c12', right='', info=''):
    i = f'<span class="info" title="{e(info)}">ⓘ</span>' if info else ''
    return f'<div class="card {cls}"><div class="chd"><h2>{e(title)}</h2>{i}<span class="sub">{sub}</span>{("<div class=right>" + right + "</div>") if right else ""}</div>{body}</div>'

def tile(k, v, d='', st=''):
    return f'<div class="tile {st}"><div class="k">{e(k)}</div><div class="v">{v}</div><div class="d">{d}</div></div>'

def trim(wins, share, count=None, total=None):
    keep = [i for i in range(len(wins)) if any((share[b][i] is not None) for b in share if i < len(share[b]))]
    if not keep: return None
    return ([wins[i] for i in keep], {b: [v[i] for i in keep] for b, v in share.items()},
            ({b: [v[i] for i in keep] for b, v in count.items()} if count else None), ([total[i] for i in keep] if total else None))

def last_val(v): return next((x for x in reversed(v) if x is not None), None)

def table(first, wins, share, brands, count=None, total=None, flag=None, rank=True):
    """таблица долей: место, значения по неделям, изменение к прошлой неделе; наша строка подсвечена, редкие бренды серые"""
    t = trim(wins, share, count, total)
    if not t: return ('<div class="empty">Пока мало данных: долю покажем, когда за неделю наберётся хотя бы %d наблюдений.</div>' % MIN_N), []
    w, sh, ct, tt = t
    order = [b for b in sorted(brands, key=lambda b: -(last_val(sh.get(b, [None])) or 0)) if any(v is not None for v in sh.get(b, [None]))]
    rows = ''
    for pos, b in enumerate(order, 1):
        v = sh[b]; cells = ''.join(f'<td>{pct(x)}' + (f' <span class="note">({ct[b][i]})</span>' if ct and x is not None else '') + '</td>' for i, x in enumerate(v))
        d = ''
        if len(v) >= 2 and v[-1] is not None and v[-2] is not None:
            dd = v[-1] - v[-2]; d = f'<span class="{"cg" if dd > 0.4 else "cb" if dd < -0.4 else "note"}">{"▲" if dd > 0.4 else "▼" if dd < -0.4 else "•"} {dd:+.1f} п.п.</span>'
        cls = ('me ' if b == 'bellissimo' else '') + ('dim' if flag and b in flag else '')
        mark = ' <span class="pill p-mute">мало данных</span>' if flag and b in flag else ''
        rows += f'<tr class="{cls}"><td>{pos}</td><td>{e(nm(b))}{mark}</td>{cells}<td>{d}</td></tr>'
    foot = (f'<tr><td></td><td class="note">наблюдений</td>' + ''.join(f'<td class="note">{x}</td>' for x in tt) + '<td></td></tr>') if tt else ''
    return (f'<div class="tbl"><table><tr><th>#</th><th>{first}</th>' + ''.join(f'<th>неделя по {label(x)}</th>' for x in w) + f'<th>за неделю</th></tr>{rows}{foot}</table></div>'), order

def line_svg(share, wins, order, shown, w=900, h=220):
    t = trim(wins, share)
    if not t: return ''
    wins, share = t[0], t[1]
    pad = 36; n = len(wins); mx = max([v for b in shown for v in share.get(b, []) if v is not None] + [1]); mx = min(100, mx * 1.15)
    xs = lambda i: pad + (w - pad - 14) * i / max(n - 1, 1); ys = lambda v: 8 + (h - 8) * (1 - v / mx)
    o = [f'<svg viewBox="0 0 {w} {h+28}" style="width:100%;height:auto" role="img" aria-label="Доля поиска по неделям">']
    for k in range(5):
        y = 8 + (h - 8) * k / 4
        o.append(f'<line x1="{pad}" x2="{w-8}" y1="{y:.0f}" y2="{y:.0f}" stroke="var(--line)"/><text x="{pad-6}" y="{y+4:.0f}" fill="var(--fg2)" font-size="11" text-anchor="end">{mx*(4-k)/4:.0f}%</text>')
    for j, b in enumerate(order):
        pts = [(xs(i), ys(v)) for i, v in enumerate(share.get(b, [])) if v is not None]
        if len(pts) < 2: continue
        vis = '' if b in shown else ' style="display:none"'
        o.append(f'<path data-b="{b}"{vis} d="M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + f'" fill="none" stroke="{col(b, j)}" stroke-width="{3 if b == "bellissimo" else 2}" stroke-linejoin="round"><title>{e(nm(b))}</title></path>')
    for i in range(0, n, max(1, n // 6)): o.append(f'<text x="{xs(i):.0f}" y="{h+18}" fill="var(--fg2)" font-size="11" text-anchor="middle">{label(wins[i])}</text>')
    o.append('</svg>')
    return ''.join(o)

def days_chart(series, labels, w=900, h=190):
    n = len(series)
    if not n: return ''
    pad = 30; bw = (w - pad - 8) / n; mx = max([sum(s) for s in series] + [1])
    C = ('var(--good)', 'var(--fg3)', 'var(--bad)')
    o = [f'<svg viewBox="0 0 {w} {h+26}" style="width:100%;height:auto" role="img" aria-label="Упоминания по дням">']
    for i in range(4):
        y = 6 + (h - 6) * i / 3
        o.append(f'<line x1="{pad}" x2="{w-4}" y1="{y:.0f}" y2="{y:.0f}" stroke="var(--line)"/><text x="{pad-5}" y="{y+4:.0f}" fill="var(--fg2)" font-size="11" text-anchor="end">{round(mx*(3-i)/3)}</text>')
    for i, (p, u, ng) in enumerate(series):
        x = pad + i * bw; y0 = h
        for v, c in ((ng, C[2]), (u, C[1]), (p, C[0])):
            hh = (h - 6) * v / mx
            if hh > 0: o.append(f'<rect x="{x+1:.1f}" y="{y0-hh:.1f}" width="{max(bw-2,1):.1f}" height="{hh:.1f}" rx="2" fill="{c}"><title>{e(labels[i])}</title></rect>'); y0 -= hh
    for i in range(0, n, max(1, n // 8)): o.append(f'<text x="{pad + i*bw + bw/2:.0f}" y="{h+18}" fill="var(--fg2)" font-size="11" text-anchor="middle">{e(labels[i])}</text>')
    o.append('</svg>')
    return ''.join(o) + '<div class="legend" style="margin-top:6px"><span><i style="background:var(--good)"></i>позитив</span><span><i style="background:var(--fg3)"></i>нейтрал</span><span><i style="background:var(--bad)"></i>негатив</span></div>'

SRC = {'ig': 'Instagram (наш)', 'ads': 'Под рекламой', 'play': 'Google Play', 'appstore': 'App Store', 'tg': 'Telegram', 'media': 'СМИ', 'yt': 'YouTube'}
CSS = '''<style>
#p-mn tr.me td{background:var(--acc-soft);font-weight:650}#p-mn tr.dim td{opacity:.55}
#p-mn .info{color:var(--fg3);cursor:help;font-size:13px}#p-mn .cg{color:var(--good)}#p-mn .cb{color:var(--bad)}
#p-mn .verdict{display:grid;gap:8px;font-size:14px}#p-mn .verdict p{margin:0}#p-mn details summary{cursor:pointer;color:var(--fg2);padding:4px 0}
#p-mn details .post{margin-left:6px}#p-mn .post a{color:var(--acc)}#p-mn .alert{display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--line)}
#p-mn .seg{display:inline-flex;gap:2px;background:var(--bg2);border-radius:10px;padding:2px}#p-mn .seg button{border:0;background:none;border-radius:8px;padding:4px 10px;cursor:pointer;color:var(--fg2);font-size:12px}
#p-mn .seg button[aria-pressed="true"]{background:var(--card-solid);color:var(--fg)}
</style>'''

def fragment(db, today, TZ):
    D = lambda n: str(today - dt.timedelta(days=n))
    rows = [dict(r) for r in db.execute("SELECT * FROM items WHERE kind!='video' AND date>=?", [D(120)])]
    own = [r for r in rows if r['brand'] == 'bellissimo']
    per = lambda a, b: [r for r in own if D(b) <= r['date'] <= D(a)]
    cur, prev = per(0, 6), per(7, 13)
    neg = lambda rs: sum(r['sentiment'] == 'neg' for r in rs)
    ns = lambda rs: (100 * neg(rs) / len(rs)) if rs else 0
    def dl(a, b, unit='', inv=True):
        d = a - b
        if d == 0: return '<span class="note">без изменений</span>'
        good = (d < 0) == inv
        return f'<span class="pill {"p-good" if good else "p-bad"}">{d:+.0f}{unit}</span><span class="note">к прошлой неделе</span>'
    stat = {x['source']: x['last_run'][:10] for x in map(dict, db.execute('SELECT * FROM status'))}
    when = lambda *srcs: 'данные на ' + max((stat.get(s, '') for s in srcs), default='')[5:].replace('-', '.')[::-1][::-1] if any(stat.get(s) for s in srcs) else ''
    def dm(*srcs):
        d = max((stat.get(s, '') for s in srcs), default='')
        return f' · данные на {d[8:10]}.{d[5:7]}' if d else ''
    snaps = {}
    for d, s_, k, v in db.execute("SELECT date, source, key, value FROM snap WHERE key='score' ORDER BY date"): snaps[s_] = (d, v)
    ratings = {}
    for d, s_, k, v in db.execute("SELECT date, source, key, value FROM snap WHERE key='ratings' ORDER BY date"): ratings[s_] = v
    g = lambda s_: f'★ {snaps[s_][1]:.2f}' if s_ in snaps else '—'
    verdict = []; alerts = []
    # ---- данные по долям (считаем заранее, чтобы собрать вывод) ----
    s = search_share(db, today, 12)
    t = talk_share(db, today, 4); src = t.get('by_src') or {}
    r = review_share(db, today, 4)
    srch_html = ''; chips = ''
    if s['ok']:
        top = sorted(s['share'], key=lambda b: -(last_val(s['share'][b]) or 0))
        shown = (['bellissimo'] if 'bellissimo' in s['share'] and 'bellissimo' not in top[:6] else []) + top[:6]
        order = top
        svgs = ''.join(f'<div class="mn-svg" data-n="{n}"{"" if n == 12 else " hidden"}>{line_svg({b: v[-n:] for b, v in s["share"].items()}, s["wins"][-n:], order, shown)}</div>' for n in (4, 8, 12))
        seg = '<div class="seg" id="mn-seg">' + ''.join(f'<button data-n="{n}" aria-pressed="{"true" if n == 12 else "false"}">{n} нед.</button>' for n in (4, 8, 12)) + '</div>'
        chips = '<div class="chips" id="mn-chips" style="margin:6px 0 10px">' + ''.join(f'<button class="chip" data-b="{b}" aria-pressed="{"true" if b in shown else "false"}">{e(nm(b))}</button>' for b in order) + '</div>'
        tbl, ordr = table('Бренд', s['wins'][-4:], {b: v[-4:] for b, v in s['share'].items()}, list(s['share']), flag=s['low'])
        srch_html = card('Доля поиска', 'сколько людей ищут бренд в Google (Узбекистан)' + dm('trends'), chips + svgs + tbl + '<p class="note">Google отдаёт целые числа, поэтому у редких брендов точность низкая: они серые и не для сравнения.</p>', 'c12', seg, INFO['search'])
        if 'bellissimo' in ordr:
            p = ordr.index('bellissimo') + 1; v = s['share']['bellissimo']; ch = (v[-1] - v[-2]) if len(v) > 1 and v[-1] is not None and v[-2] is not None else None
            verdict.append(f'<p><b>Поиск:</b> Bellissimo на {p}-м месте из {len(ordr)}, доля {pct(v[-1])}' + (f', за неделю {ch:+.1f} п.п.' if ch is not None else '') + '</p>')
    else: srch_html = card('Доля поиска', '', '<div class="empty">Данных Google Trends пока нет.</div>', 'c12', '', INFO['search'])
    br = [b for b in t['count'] if b in NAMES]
    ttbl, tord = table('Бренд', t['wins'], t['share'], br, t['count'], t['total'])
    tot4 = sum(t['all4'].values())
    if not tord:
        rows_ = ''.join(f'<tr class="{"me" if b == "bellissimo" else ""}"><td>{e(nm(b))}</td><td>{n}</td></tr>' for b, n in sorted(t['all4'].items(), key=lambda x: -x[1]) if b in NAMES)
        ttbl = (f'<div class="empty">Доли пока нет: за неделю меньше {MIN_N} публикаций, процент на такой выборке случаен. Ниже число публикаций за 4 недели.</div>'
                f'<div class="tbl"><table><tr><th>Бренд</th><th>Публикаций</th></tr>{rows_}</table></div>')
    else:
        verdict.append(f'<p><b>Обсуждения:</b> наша доля {pct(last_val(t["share"].get("bellissimo", [None])))} (публикаций за 4 недели: {tot4}).</p>')
    talk_html = card('Доля обсуждений', f'чужие публикации в YouTube и Telegram за 4 недели: {tot4}' + dm('yt', 'tg'), ttbl + f'<p class="note">Не считаются: комментарии (иначе одно видео считается дважды) и ролики с промокодами и хештегами: {t.get("spam", 0)} шт. за 4 недели. Telegram ищется только в публичных каналах, поэтому охват пока мал.</p>', 'c6', '', INFO['talk'])
    if r['all4']:
        order = sorted(r['all4'], key=lambda b: -r['all4'][b])
        rows_ = ''.join(f'<tr class="{"me" if b == "bellissimo" else ""}"><td>{i + 1}</td><td>{e(nm(b))}</td><td>{sum(r["count"][b])}</td><td>{pct(r["all4"][b])}</td><td>{pct(r["neg"].get(b, (0, None))[1])}</td></tr>' for i, b in enumerate(order))
        body = f'<div class="tbl"><table><tr><th>#</th><th>Бренд</th><th>Отзывов</th><th>Доля</th><th>Негатив 1–2★</th></tr>{rows_}</table></div><p class="note">Google Play и App Store, 4 недели. Dodo и Yandex не входят: одно приложение на несколько стран.</p>'
        if 'bellissimo' in order:
            others = [r['neg'][b][1] for b in order if b != 'bellissimo' and b in r['neg'] and r['neg'][b][1] is not None and sum(r['count'][b]) >= 10]
            me = r['neg'].get('bellissimo', (0, None))[1]
            verdict.append(f'<p><b>Отзывы в приложениях:</b> у нас {sum(r["count"]["bellissimo"])} новых за 4 недели, негатив {pct(me)}' + (f' (у конкурентов в среднем {pct(sum(others) / len(others))})' if others and me is not None else '') + '.</p>')
    else: body = '<div class="empty">Отзывов меньше порога, данные накапливаются.</div>'
    rev_html = card('Доля новых отзывов', 'активность пользователей в приложениях' + dm('play', 'appstore'), body, 'c6', '', INFO['rev'])
    verdict.insert(0, f'<p><b>Репутация, 7 дней:</b> упоминаний {len(cur)}, негатив {ns(cur):.0f}%' + (f' (неделей раньше {ns(prev):.0f}%)' if prev else '') + '.</p>')
    # ---- тревоги ----
    if prev and neg(cur) >= 10 and ns(cur) - ns(prev) >= 5: alerts.append(('p-bad', f'Негатив вырос: {ns(prev):.0f}% → {ns(cur):.0f}% за неделю ({neg(cur)} негативных).'))
    base = [len(per(7 * i + 6, 7 * i + 0 + 6 - 6 + 7 * 0)) for i in range(0)]
    wk = [len(per(7 * i + 6, 7 * i)) for i in range(1, 5)]
    if wk and sum(wk) >= 40 and len(cur) > 2 * (sum(wk) / len(wk)): alerts.append(('p-warn', f'Всплеск упоминаний: {len(cur)} за неделю при среднем {sum(wk) / len(wk):.0f}.'))
    for src_ in ('play', 'appstore'):
        a = [x['rating'] for x in cur if x['source'] == src_ and x['rating']]; bb = [x['rating'] for x in prev if x['source'] == src_ and x['rating']]
        if len(a) >= 5 and bb and sum(a) / len(a) <= sum(bb) / len(bb) - 0.5: alerts.append(('p-bad', f'Оценка в {SRC[src_]} упала: {sum(bb)/len(bb):.1f} → {sum(a)/len(a):.1f}.'))
    for k, v in stat.items():
        pass
    bad = [x for x in db.execute('SELECT source FROM status WHERE ok=0')]
    if bad: alerts.append(('p-warn', 'Не собираются: ' + ', '.join(SRC.get(x[0], x[0]) for x in bad) + '. Цифры по ним могут быть неполными.'))
    al = ''.join(f'<div class="alert"><span class="pill {c}">внимание</span><span>{e(m)}</span></div>' for c, m in alerts) or '<div class="alert"><span class="pill p-good">спокойно</span><span>Резких изменений за неделю нет.</span></div>'
    out = [CSS, card('Главное', 'вывод по данным на сегодня', '<div class="verdict">' + ''.join(verdict) + '</div>', 'c7'), card('Что требует внимания', '', al, 'c5')]
    out.append('<div class="tiles">' + ''.join([
        tile('Упоминаний за 7 дней', len(cur), dl(len(cur), len(prev), inv=False)),
        tile('Доля негатива', f'{ns(cur):.0f}%', dl(ns(cur), ns(prev), '%'), 'st-bad' if ns(cur) >= 20 else 'st-warn' if ns(cur) >= 10 else 'st-good'),
        tile('Негативных', neg(cur), dl(neg(cur), neg(prev))),
        tile('Google Play', g('play_bellissimo'), 'наше приложение'),
        tile('App Store', g('appstore_bellissimo') if 'appstore_bellissimo' in snaps else g('appstore_uz'), 'наше приложение')]) + '</div>')
    out += [srch_html, talk_html, rev_html]
    brands = [b for b in NAMES if ('play_' + b) in snaps or ('appstore_' + b) in snaps or (b == 'bellissimo' and 'appstore_uz' in snaps)]
    rr = ''
    for b in sorted(brands, key=lambda b: (b != 'bellissimo', -(snaps.get('play_' + b, (0, 0))[1]))):
        ap = snaps.get('appstore_' + b) or (snaps.get('appstore_uz') if b == 'bellissimo' else None)
        cnt = ratings.get('appstore_' + b)
        rr += (f'<tr class="{"me" if b == "bellissimo" else ""}"><td>{e(nm(b))}</td><td>{("%.2f" % snaps["play_" + b][1]) if "play_" + b in snaps else "–"}</td>'
               f'<td>{("%.2f" % ap[1]) if ap else "–"}</td><td>{(format(int(cnt), ",").replace(",", " ") if cnt else "–")}</td></tr>')
    out.append(card('Рейтинги приложений', 'Google Play и App Store, Узбекистан' + dm('play', 'appstore'), f'<div class="tbl"><table><tr><th>Бренд</th><th>Play ★</th><th>App Store ★</th><th>Оценок в App Store</th></tr>{rr}</table></div>', 'c6'))
    ig = ig_table(db)
    if ig:
        rows_ = ''.join(f'<tr class="{"me" if x["brand"] == "bellissimo" else ""}"><td>{e(nm(x["brand"]))}</td><td>{int(x["followers"]):,}</td><td>{int(x["posts"])}</td><td>{x["eng_per_1000"]:.0f}</td><td>{x["comments_per_post"]:.0f}</td></tr>'.replace(',', ' ') for x in ig if x['eng_per_1000'] is not None)
        out.append(card('Instagram конкурентов', 'за 30 дней' + dm('igc'), f'<div class="tbl"><table><tr><th>Аккаунт</th><th>Подписчики</th><th>Постов</th><th>Реакций на 1000 подп.</th><th>Комментариев на пост</th></tr>{rows_}</table></div><p class="note">Это активность вокруг аккаунта, а не упоминания. У аккаунтов с розыгрышами комментарии накручены. Нет в таблице: KFC, Sariq Bola, Uzum Tezkor, Domino\'s (аккаунты не нашлись).</p>', 'c6'))
    # ---- наша репутация ----
    days = [D(i) for i in range(59, -1, -1)]
    cnt = {d: [0, 0, 0] for d in days}
    for r_ in own:
        if r_['date'] in cnt: cnt[r_['date']][{'pos': 0, 'neu': 1, 'neg': 2}[r_['sentiment']]] += 1
    first = next((i for i, d in enumerate(days) if sum(cnt[d])), None)
    if first is not None:
        ds = days[first:]
        out.append(card('Наши упоминания по дням', 'комментарии и отзывы про Bellissimo; дни до начала сбора не показаны', days_chart([tuple(cnt[d]) for d in ds], [d[5:] for d in ds])))
    tbl = ''
    for k, name in SRC.items():
        a = [x for x in cur if x['source'] == k]; b = [x for x in prev if x['source'] == k]
        if not a and not b: continue
        rt = [x['rating'] for x in a if x['rating']]
        tbl += f'<tr><td>{name}</td><td>{len(a)}</td><td>{len(b)}</td><td>{ns(a):.0f}%</td><td>{(sum(rt)/len(rt)):.1f}</td></tr>' if rt else f'<tr><td>{name}</td><td>{len(a)}</td><td>{len(b)}</td><td>{ns(a):.0f}%</td><td>–</td></tr>'
    out.append(card('По источникам', 'последние 7 дней', f'<div class="tbl"><table><tr><th>Источник</th><th>Эта неделя</th><th>Прошлая</th><th>Негатив</th><th>Ср. оценка</th></tr>{tbl}</table></div>', 'c12'))
    def themes_block(sent, title, sub, empty):
        def th(rs):
            c = Counter()
            for x in rs:
                if x['sentiment'] == sent:
                    for k in filter(None, (x['themes'] or '').split('|')): c[k] += 1
            return c
        tc, tp = th(cur), th(prev); month = per(0, 29)
        items = ''
        for k, n in tc.most_common(8):
            ex = [x for x in sorted(month, key=lambda x: -x['ts']) if x['sentiment'] == sent and k in (x['themes'] or '').split('|') and x['text']][:4]
            exh = ''.join(f'<div class="post"><div class="w"><span>{x["date"]}</span><span>{SRC.get(x["source"], x["source"])}</span>' + (f'<a href="{e(x["url"])}" target="_blank" rel="noopener">открыть ↗</a>' if x.get('url') else '') + f'</div><div>{e(x["text"][:220])}</div></div>' for x in ex)
            d = n - tp.get(k, 0)
            items += f'<details><summary><b>{e(k)}</b> · {n} <span class="note">(прошлая неделя {tp.get(k, 0)})</span> <span class="{"cb" if (d > 0) == (sent == "neg") and d != 0 else "cg" if d != 0 else "note"}">{d:+d}</span></summary>{exh}</details>'
        tot = sum(1 for x in cur if x['sentiment'] == sent); tagged = sum(tc.values())
        return card(title, sub + f' · с темой {min(tot, tagged)} из {tot}; нажми на тему, чтобы увидеть комментарии', items or f'<div class="empty">{empty}</div>', 'c6')
    out.append(themes_block('neg', 'О чём пишут плохо', 'за 7 дней, по словарю', 'нет негатива с темой'))
    out.append(themes_block('pos', 'За что хвалят', 'за 7 дней, по словарю', 'нет похвалы с темой'))
    ng = sorted([x for x in own if x['sentiment'] == 'neg' and x['text']], key=lambda x: -x['ts'])[:15]
    posts = ''.join(f'<div class="post"><div class="w"><span>{x["date"]}</span><span>{SRC.get(x["source"], x["source"])}</span>{("<span>" + "★" * x["rating"] + "</span>") if x["rating"] else ""}{("<span class=pill>" + e(x["themes"].replace("|", ", ")) + "</span>") if x["themes"] else ""}' + (f'<a href="{e(x["url"])}" target="_blank" rel="noopener">открыть ↗</a>' if x.get('url') else '') + f'</div><div>{e(x["text"][:260])}</div></div>' for x in ng)
    out.append(card('Свежий негатив', 'последние 15; где есть ссылка, можно ответить прямо в источнике', posts or '<div class="empty">пока нет</div>'))
    how = ('<p><b>Что здесь считается.</b> Три доли независимы: поиск в Google, чужие упоминания в YouTube и Telegram, новые отзывы в приложениях. Их нельзя складывать или усреднять: у каждой свой источник.</p>'
           '<p><b>Что не считается.</b> Наши посты, реклама и комментарии под ними в доли не входят. Instagram и комментарии к рекламе используются только для нашей репутации.</p>'
           '<p><b>Тональность</b> определяется по словарю (русский, узбекский латиницей и кириллицей), без нейросети. Точность по ручной проверке около 80%: для трендов хватает, отдельные комментарии лучше проверять глазами.</p>'
           f'<p><b>Порог.</b> Доля за неделю показывается, если набралось не меньше {MIN_N} наблюдений. Бренды с малым поиском в Google отмечены «мало данных».</p>')
    out.append(card('Как читать эту вкладку', 'нажми, чтобы раскрыть', f'<details><summary>Показать пояснения</summary>{how}</details>'))
    st = db.execute('SELECT * FROM status ORDER BY source').fetchall()
    srow = ''.join(f'<tr><td>{SRC.get(x["source"], {"igc": "Instagram конкурентов", "trends": "Google Trends"}.get(x["source"], x["source"]))}</td><td><span class="pill {"p-good" if x["ok"]==1 and not x["note"] else "p-bad" if x["ok"]==0 else "p-warn"}">{"работает" if x["ok"]==1 and not x["note"] else "ошибка" if x["ok"]==0 else "есть замечание" if x["ok"]==1 else "нет ключа"}</span></td><td>{x["last_run"]}</td><td style="white-space:normal;text-align:left">{e((x["note"] or "")[:140])}</td></tr>' for x in st)
    out.append(card('Состояние сборщиков', 'сбор идёт сам два раза в день', f'<div class="tbl"><table><tr><th>Источник</th><th>Статус</th><th>Последний запуск</th><th>Заметка</th></tr>{srow}</table></div>'))
    out.append(f'<p class="note" style="grid-column:1/-1">Обновлено {dt.datetime.now(TZ).strftime("%d.%m.%Y %H:%M")}.</p>')
    return ''.join(out)
