#!/usr/bin/env python3
"""Competitor collector without Chrome. Writes raw/comp_<src>_<date>.json.
Usage: python3 comp_collect.py ios|play|tg|adlib|all
Each source is independent: one failing never blocks the others. Exit code 0 always; status in raw/status_<date>.json."""
import json, os, re, sys, time, base64, io, datetime as dt, urllib.request, urllib.parse, urllib.error, html as H

HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, '..', 'data', 'raw'); os.makedirs(RAW, exist_ok=True)
D = dt.datetime.now(dt.timezone(dt.timedelta(hours=5))).date().isoformat()   # Tashkent date
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
IOS = {'bellissimo': 1507547994, 'kfc': 6733229176, 'evos': 1595897228, 'oqtepa': 6744400909, 'dodo': 894649641, 'maxway': 1565502018,
       'uzum': 1665523197, 'yandex': 1078986931, 'sariqbola': 6471396712, 'hardees': 6754248343, 'safia': 1554545839}
PLAY = {'bellissimo': 'uz.bellissimo.app', 'kfc': 'com.uz.kfc', 'evos': 'uz.makfood.service.evos', 'oqtepa': 'com.foodpicasso.oqte', 'dodo': 'ru.dodopizza.app',
        'maxway': 'uz.udevs.maxway_client_mobile', 'uzum': 'uz.uzum.tezkor', 'yandex': 'ru.foodfox.client', 'sariqbola': 'com.sariqbola.pizza',
        'hardees': 'uz.delever.hardees_client_mobile', 'safia': 'com.safiabakerycafe.app'}
TG = {'evos': 'evosuzbekistan', 'uzum': 'uzumtezkor', 'safia': 'safiabakery'}
FB = {'kfc': '226532888134790', 'evos': '724281141038118', 'oqtepa': '663390706861149', 'dodo': '970998829605608', 'maxway': '188972370974607',
      'uzum': '114113428222838', 'bellissimo': '1583758965232483', 'sariqbola': '1186378094551532', 'hardees': '343399528859123', 'safia': '393096854203863'}


def get(url, data=None, headers=None, timeout=40):
    h = {'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9'}; h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r: return r.read().decode('utf-8', 'replace')


def save(src, obj):
    p = os.path.join(RAW, f'comp_{src}_{D}.json'); json.dump(obj, open(p, 'w'), ensure_ascii=False); return p


def status(src, ok, msg):
    p = os.path.join(RAW, f'status_{D}.json'); s = json.load(open(p)) if os.path.exists(p) else {}
    s[src] = {'ok': ok, 'msg': msg, 'at': dt.datetime.now().strftime('%H:%M')}; json.dump(s, open(p, 'w'), ensure_ascii=False, indent=1)
    print(src, 'OK' if ok else 'FAIL', msg, flush=True)


def ios():
    out = {'date': D, 'ios': {}, 'ios_chart': [], 'ios_chart_ids': []}
    h = get('https://apps.apple.com/uz/iphone/charts/6023')
    for tag in re.findall(r'<a\s[^>]*>', h):
        m = re.search(r'href="[^"]*/app/[^"]*?id(\d+)', tag)
        if not m or m.group(1) in out['ios_chart_ids']: continue
        out['ios_chart_ids'].append(m.group(1)); out['ios_chart'].append(H.unescape((re.search(r'aria-label="([^"]*)"', tag) or [None, ''])[1]).strip()[:22])
    for b, i in IOS.items():
        for t in range(3):
            time.sleep(6)
            try: p = get(f'https://apps.apple.com/uz/app/id{i}')
            except Exception: continue
            g = lambda rx: (re.search(rx, p) or [None, None])[1]
            out['ios'][b] = [int(g(r'"totalNumberOfRatings":(\d+)') or 0), float(g(r'"ratingAverage":([\d.]+)') or 0), g(r'"ratingCounts":\[([^\]]*)\]'), None, g(r'Version ([\d.]+)')]
            break
    if len(out['ios']) < 8 or len(out['ios_chart_ids']) < 10: raise RuntimeError(f"мало данных: {len(out['ios'])} прил., чарт {len(out['ios_chart_ids'])}")
    save('ios', out); return f"{len(out['ios'])} прил., чарт {len(out['ios_chart_ids'])}"


def play():
    out = {'date': D, 'play': {}}
    for b, p in PLAY.items():
        try: h = get(f'https://play.google.com/store/apps/details?id={p}&hl=en&gl=UZ')
        except Exception: continue
        g = lambda rx: (re.search(rx, h) or [None, None])[1]
        out['play'][b] = [float(g(r'"ratingValue":"([\d.]+)"') or 0), int(g(r'"ratingCount":"(\d+)"') or 0), g(r'>([\d.,]+[KMB]?\+)</div><div[^>]*>Downloads'), g(r'Updated on</div><div[^>]*>([^<]+)<')]
        time.sleep(1)
    if len(out['play']) < 8: raise RuntimeError(f"мало данных: {len(out['play'])}")
    save('play', out); return f"{len(out['play'])} прил."


def tg():
    out = {'date': D, 'ch': {}}
    for b, c in TG.items():
        h = get(f'https://t.me/s/{c}')
        cnt = dict((H.unescape(t), H.unescape(v)) for v, t in re.findall(r'class="counter_value">([^<]*)</span>\s*<span class="counter_type">([^<]*)<', h))
        posts = []
        for blk in re.split(r'(?=<div class="tgme_widget_message_wrap)', h)[1:]:
            pid = (re.search(r'data-post="([^"]+)"', blk) or [None, None])[1]
            if not pid: continue
            txt = re.search(r'class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', blk, re.S)
            txt = re.sub(r'\s+', ' ', H.unescape(re.sub(r'<br\s*/?>', ' ', re.sub(r'<(?!br)[^>]+>', '', txt.group(1))))).strip()[:500] if txt else ''
            posts.append({'id': pid, 't': (re.search(r'<time[^>]+datetime="([^"]+)"', blk) or [None, None])[1],
                          'v': (re.search(r'tgme_widget_message_views">([^<]*)<', blk) or [None, ''])[1], 'txt': txt,
                          'img': 'tgme_widget_message_photo_wrap' in blk, 'vid': 'tgme_widget_message_video' in blk})
        title = (re.search(r'tgme_channel_info_header_title"><span[^>]*>([^<]*)<', h) or [None, ''])[1]
        out['ch'][b] = {'handle': c, 'title': H.unescape(title), 'cnt': cnt, 'posts': posts}
    if not any(x['posts'] for x in out['ch'].values()): raise RuntimeError('нет постов')
    save('tg', out); return ' '.join(f"{b}:{x['cnt'].get('subscribers', '-')}/{len(x['posts'])}" for b, x in out['ch'].items())


def jget(h, key):
    k = h.find(key)
    if k < 0: return None
    i = h.find('{', k); d = 0; s = e = False
    for j in range(i, len(h)):
        c = h[j]
        if s:
            if e: e = False
            elif c == '\\': e = True
            elif c == '"': s = False
            continue
        if c == '"': s = True
        elif c == '{': d += 1
        elif c == '}':
            d -= 1
            if not d: return json.loads(h[i:j + 1])


def thumb(url):
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30).read())).convert('RGB')
        im.thumbnail((180, 320)); b = io.BytesIO(); im.save(b, 'JPEG', quality=60)
        return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
    except Exception: return ''


def row(L):
    a = L[0]; sn = a.get('snapshot') or {}; cd = (sn.get('cards') or [{}])[0] or {}; im = (sn.get('images') or [{}])[0] or {}; vd = (sn.get('videos') or [{}])[0] or {}
    return {'id': a.get('ad_archive_id'), 'start': a.get('start_date'), 'end': a.get('end_date'), 'n': a.get('collation_count') or len(L) or 1,
            'fmt': sn.get('display_format') or '', 'plat': '|'.join(a.get('publisher_platform') or []), 'cta': sn.get('cta_text') or cd.get('cta_text') or '',
            'link': (sn.get('link_url') or cd.get('link_url') or '')[:200], 'title': (sn.get('title') or cd.get('title') or '')[:200],
            'body': re.sub(r'\s+', ' ', ((sn.get('body') or {}).get('text') if isinstance(sn.get('body'), dict) else None) or cd.get('body') or '')[:600],
            'cards': len(sn.get('cards') or []), 'src': im.get('resized_image_url') or im.get('original_image_url') or vd.get('video_preview_image_url') or cd.get('resized_image_url') or cd.get('video_preview_image_url') or ''}


def adlib():
    store = os.path.join(HERE, '..', 'data', 'thumbs_store.json')
    known = set(json.load(open(store))) if os.path.exists(store) else set()
    out = {'date': D, 'ts': int(time.time() * 1000), 'brands': {}}
    for b, pid in FB.items():
        h = get(f'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=UZ&view_all_page_id={pid}&search_type=page&media_type=all')
        r = jget(h, '"search_results_connection":')
        if not r: out['brands'][b] = {'err': 'no data'}; continue
        lsd = (re.search(r'"LSD",\[\],\{"token":"([^"]+)"', h) or [None, ''])[1]
        ads = [row(e['node']['collated_results']) for e in r.get('edges', []) if e['node'].get('collated_results')]
        cur = r['page_info']['end_cursor'] if r.get('page_info', {}).get('has_next_page') else None; pages = 0; perr = ''
        while cur and len(ads) < 150 and pages < 6:
            pages += 1
            v = {"activeStatus": "active", "adType": "ALL", "bylines": [], "collationToken": None, "contentLanguages": [], "countries": ["UZ"], "cursor": cur, "excludedIDs": None,
                 "first": 30, "isTargetedCountry": False, "location": None, "mediaType": "all", "multiCountryFilterMode": None, "pageIDs": [], "potentialReachInput": None,
                 "publisherPlatforms": [], "queryString": "", "regions": None, "searchType": "page", "sessionID": "s" + str(int(time.time())), "sortData": None, "source": None,
                 "startDate": None, "v": "e0570a", "viewAllPageID": pid}
            body = urllib.parse.urlencode({'av': '0', '__user': '0', '__a': '1', '__comet_req': '1', 'lsd': lsd, 'fb_api_caller_class': 'RelayModern',
                                           'fb_api_req_friendly_name': 'AdLibrarySearchPaginationQuery', 'server_timestamps': 'true', 'variables': json.dumps(v), 'doc_id': '24922295957467452'}).encode()
            try:
                t = get('https://www.facebook.com/api/graphql/', data=body, headers={'content-type': 'application/x-www-form-urlencoded', 'x-fb-lsd': lsd})
                c = json.loads(t.split('\n')[0])['data']['ad_library_main']['search_results_connection']
            except Exception as e: perr = str(e)[:80]; break
            ads += [row(e['node']['collated_results']) for e in c.get('edges', []) if e['node'].get('collated_results')]
            cur = c['page_info']['end_cursor'] if c.get('page_info', {}).get('has_next_page') else None
        out['brands'][b] = {'total': r.get('count'), 'ads': ads, 'pages': pages, 'perr': perr}
        time.sleep(2)
    n = 0
    for B in out['brands'].values():
        for a in B.get('ads', []):
            if a['src'] and a['id'] not in known and n < 400:
                a['thumb'] = thumb(a['src']); n += 1
            a.pop('src', None)
    ok = sum(1 for B in out['brands'].values() if B.get('ads'))
    if ok < 7: raise RuntimeError(f'собрано только {ok} брендов из {len(FB)}')
    save('adlib', out); return ' '.join(f"{b}:{B.get('total', '-')}" for b, B in out['brands'].items())


if __name__ == '__main__':
    which = sys.argv[1:] or ['all']
    for name, fn in [('ios', ios), ('play', play), ('tg', tg), ('adlib', adlib)]:
        if ('all' in which and name != 'adlib') or name in which:
            try: status(name, True, fn())
            except Exception as e: status(name, False, str(e)[:200])
