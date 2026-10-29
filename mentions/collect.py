#!/usr/bin/env python3
"""Сборщик упоминаний и данных для долей. Запуск: python3 collect.py [источник ...]  (без аргументов — все).
Источники: ig, ads, play, appstore, igc, tg, yt, trends. Без ключа источник пропускается, остальные работают.
Данные — в mentions_data.db (SQLite), дубли не вставляются, история растёт по дням. Секреты не печатаются.

Правила учёта (чтобы доли были честными):
  scope=owned     — наши площадки и площадки брендов (комментарии, их каналы, отзывы своего приложения): для тональности, НЕ для доли
  scope=earned    — публичные упоминания, найденные одинаковым поиском по всем брендам: идёт в «долю обсуждений»
  scope=context   — комментарии под найденным видео, где сам комментарий бренд не называет: в долю не идёт
  scope=app_review— отзывы в Google Play (по всем брендам одинаково): доля отзывов
Сообщение с двумя брендами засчитывается обоим; одинаковые тексты (репосты) считаются один раз (thash)."""
import os, sys, re, json, time, sqlite3, hashlib, datetime as dt, urllib.request, urllib.parse, urllib.error, subprocess, importlib

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
CFG = json.load(open(os.path.join(HERE, 'config.json')))
DB = os.environ.get('MENTIONS_DB') or os.path.join(HERE, 'mentions_data.db')
TZ = dt.timezone(dt.timedelta(hours=5))
sys.path.insert(0, HERE)
from sentiment import analyze, norm

def need(mod, pipname=None):
    try: return __import__(mod)
    except ImportError:
        for extra in ([], ['--break-system-packages']):
            if subprocess.call([sys.executable, '-m', 'pip', 'install', '--user', '-q', *extra, pipname or mod]) == 0: break
        importlib.invalidate_caches()
        return __import__(mod)

ENV_SECRET = {'meta_token.txt': 'META_TOKEN', 'youtube_key.txt': 'YOUTUBE_KEY'}   # on GitHub the keys come from repo secrets
def secret(*paths):
    for p in paths:
        v = os.environ.get(ENV_SECRET.get(os.path.basename(p), ''), '').strip()
        if v: return v
        f = os.path.join(ROOT, p) if not os.path.isabs(p) else p
        if os.path.exists(f) and os.path.getsize(f) > 0: return open(f).read().strip()
    return None

def mask(s): return re.sub(r'(access_token|key)=[^&\s]+', r'\1=***', str(s))

db = sqlite3.connect(DB, timeout=600)
db.executescript("""
CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY, source TEXT, kind TEXT, brand TEXT, date TEXT, ts INTEGER,
  text TEXT, rating INTEGER, sentiment TEXT, themes TEXT, url TEXT, parent TEXT, seen TEXT);
CREATE INDEX IF NOT EXISTS i_date ON items(date); CREATE INDEX IF NOT EXISTS i_src ON items(source, date);
CREATE TABLE IF NOT EXISTS status(source TEXT PRIMARY KEY, last_run TEXT, ok INTEGER, n_new INTEGER, note TEXT);
CREATE TABLE IF NOT EXISTS snap(date TEXT, source TEXT, key TEXT, value REAL, PRIMARY KEY(date, source, key));
CREATE TABLE IF NOT EXISTS trends(date TEXT, brand TEXT, value REAL, PRIMARY KEY(date, brand));
""")
for col in ('scope TEXT', 'thash TEXT'):
    try: db.execute('ALTER TABLE items ADD COLUMN ' + col)
    except sqlite3.OperationalError: pass
# миграция старых строк (до введения scope)
db.execute("UPDATE items SET scope='owned' WHERE scope IS NULL AND source IN ('ig','ads','play','appstore')")
db.execute("DELETE FROM items WHERE scope IS NULL AND source IN ('yt','tg')")
db.commit()

def day(ts): return dt.datetime.fromtimestamp(ts, TZ).strftime('%Y-%m-%d')
def parse_iso(s):
    s = re.sub(r'([+-]\d\d)(\d\d)$', r'\1:\2', s.replace('Z', '+00:00'))
    return int(dt.datetime.fromisoformat(s).timestamp())

PHONE = re.compile(r'\+?\d[\d\s\-()]{7,}\d')
def thash(text): return hashlib.md5(re.sub(r'[\W_]+', '', norm(text))[:300].encode()).hexdigest()

def save(source, kind, id_, ts, text, rating=None, url=None, parent=None, brand='bellissimo', scope='owned'):
    text = PHONE.sub('[тел]', (text or '').strip())
    if not text and not rating: return 0
    s, th = analyze(text, rating)
    s, th = about_other(text, brand, scope, s, th)
    cur = db.execute('INSERT OR IGNORE INTO items(id,source,kind,brand,date,ts,text,rating,sentiment,themes,url,parent,seen,scope,thash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        (id_, source, kind, brand, day(ts), ts, text[:2000], rating, s, '|'.join(th), url, parent,
         dt.datetime.now(TZ).strftime('%Y-%m-%d %H:%M'), scope, thash(text)))
    return cur.rowcount

def about_other(text, brand, scope, s, th):
    """A comment under our post that praises another brand («Энг зор пицца … ДОДА ПИЦЦА ЭКАН 👍») is not praise for us."""
    if brand != 'bellissimo' or scope != 'owned': return s, th
    t = norm(text or '')   # names only: under our post the context words of another brand's rule are not needed
    other = [b for b, p in globals().get('_bp', {}).items() if b != 'bellissimo' and any(r.search(t) for k in ('names', 'typos') for r in p[k])
             and not any(r.search(t) for r in p['minus'])]
    if not other: return s, th
    return ('neg' if s == 'pos' else 'neu' if s == 'neg' else s), ['Хвалят конкурента' if s == 'pos' else 'Про конкурента']

def save_multi(brands, source, kind, id_, ts, text, scope, **kw):
    """Одно сообщение — по строке на каждый названный бренд."""
    return sum(save(source, kind, id_ if i == 0 else f'{id_}#{b}', ts, text, brand=b, scope=scope, **kw) for i, b in enumerate(brands))

def http(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', 'replace')[:300]
            if e.code in (400, 401, 403, 404) and 'limit' not in body.lower(): raise RuntimeError(f'HTTP {e.code}: {mask(body)}')
            time.sleep(8 * (i + 1))
        except Exception: time.sleep(4 * (i + 1))
    raise RuntimeError('нет ответа после повторов')

# ---------- словарь брендов ----------
_bp = {}
def _pat(w): return re.compile(r"(?<![a-z0-9'])" + re.escape(norm(w).strip()))
for _b, _d in (CFG.get('brands') or {}).items():
    _bp[_b] = {k: [_pat(w) for w in _d.get(k, [])] for k in ('names', 'typos', 'slang', 'plus', 'minus', 'geo')}
    _bp[_b]['require'] = _d.get('require', '')

def match_brands(text):
    """Все бренды, названные в тексте (имя/опечатка/сленг), прошедшие минус-слова и обязательные плюс/гео."""
    t = norm(text or ''); out = []
    for b, p in _bp.items():
        if not any(r.search(t) for k in ('names', 'typos', 'slang') for r in p[k]): continue
        if any(r.search(t) for r in p['minus']): continue
        if p['require'] == 'plus' and not any(r.search(t) for r in p['plus']): continue
        if p['require'] == 'geo' and not any(r.search(t) for r in p['geo']): continue
        out.append(b)
    return out

def search_queries(n_names, n_typos):
    """Одинаковый бюджет запросов на каждый бренд (иначе у кого больше вариантов, тот «громче»)."""
    out = []; n_names = int(os.environ.get('QUICK_NAMES', n_names))
    for b, d in (CFG.get('brands') or {}).items():
        qs = [w for w in d['names'] if not w.startswith('#')][:n_names] + [w for w in d['typos'] if not w.startswith('#')][:n_typos]
        out += [(q, b) for q in qs]
    return out

class Skip(Exception): pass

# ---------- Meta ----------
TOKEN = secret('meta_token.txt')
def g(path, **p):
    p['access_token'] = TOKEN
    return http(f"https://graph.facebook.com/{CFG['api']}/{path}?" + urllib.parse.urlencode(p))
def gpaged(path, maxn=2000, **p):
    out = []; r = g(path, **p)
    while True:
        out += r.get('data', [])
        nxt = r.get('paging', {}).get('next')
        if not nxt or len(out) >= maxn: break
        r = http(nxt)
    return out

_own = None
def own_username():
    global _own
    if _own is None: _own = (g(CFG['ig_user'], fields='username').get('username') or '').lower()
    return _own

def ig_comments(media_id, source, kind, url=None):
    n = 0
    for c in gpaged(f'{media_id}/comments', fields='id,text,timestamp,username,replies{id,text,timestamp,username}', limit=100):
        for x in [c] + (c.get('replies', {}).get('data', [])):
            if (x.get('username') or '').lower() == own_username(): continue
            n += save(source, kind, 'ig:' + x['id'], parse_iso(x['timestamp']), x.get('text'), url=url, parent=media_id, scope='owned')
    return n

def stored(parent): return db.execute('SELECT COUNT(*) FROM items WHERE parent=?', (parent,)).fetchone()[0]

def run_ig():
    n = 0; err = 0; last = ''
    for m in g(f"{CFG['ig_user']}/media", fields='id,permalink,timestamp,comments_count', limit=CFG['ig_posts']).get('data', []):
        if not m.get('comments_count'): continue
        try: n += ig_comments(m['id'], 'ig', 'comment', m.get('permalink'))
        except RuntimeError as e: err += 1; last = str(e)
    return n, (f'ошибок постов: {err}, последняя: {last}' if err else '')

def counts(ids, field, token):
    """Счётчики комментариев через batch API (ids= в v26 отключён): до 50 запросов за раз."""
    out = {}; ids = list(ids)
    for i in range(0, len(ids), 50):
        part = ids[i:i + 50]
        body = urllib.parse.urlencode({'access_token': token, 'batch': json.dumps(
            [{'method': 'GET', 'relative_url': f'{k}?fields=' + urllib.parse.quote(field)} for k in part])}).encode()
        for t in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(f"https://graph.facebook.com/{CFG['api']}/", data=body), timeout=90) as r:
                    res = json.load(r); break
            except urllib.error.HTTPError as e: raise RuntimeError(mask(f'batch HTTP {e.code}: {e.read()[:200]}'))
            except Exception: time.sleep(5 * (t + 1))
        else: raise RuntimeError('batch: нет ответа')
        for k, x in zip(part, res):
            if x and x.get('code') == 200: out[k] = json.loads(x['body'])
    return out

def paged_page(st, tok):
    out = []; r = http(f"https://graph.facebook.com/{CFG['api']}/{st}/comments?" + urllib.parse.urlencode(
        {'fields': 'id,message,created_time,from', 'limit': 100, 'access_token': tok}))
    while True:
        out += r.get('data', [])
        nxt = r.get('paging', {}).get('next')
        if not nxt or len(out) >= 1000: break
        r = http(nxt)
    return out

def run_ads():
    cutoff = time.time() - CFG['ads_days'] * 86400
    ads = gpaged(f"{CFG['act']}/ads", maxn=600, fields='id,updated_time,creative{effective_object_story_id,effective_instagram_media_id}', limit=50,
                 effective_status='["ACTIVE","PAUSED","ARCHIVED"]',
                 filtering=json.dumps([{'field': 'updated_time', 'operator': 'GREATER_THAN', 'value': int(cutoff)}]))
    igs = {a['creative']['effective_instagram_media_id'] for a in ads if (a.get('creative') or {}).get('effective_instagram_media_id')}
    sts = {a['creative']['effective_object_story_id'] for a in ads if (a.get('creative') or {}).get('effective_object_story_id')}
    sts = {x for x in sts if x.split('_')[0] == CFG['page']}   # posts of other pages (not ours) cannot be read with our page token
    n = 0; err = 0; last = ''; fetched = 0
    try: igc = {k: v.get('comments_count', 0) for k, v in counts(igs, 'comments_count', TOKEN).items()}
    except RuntimeError as e: igc = {}; err += 1; last = str(e)
    for m in igs:
        if igc.get(m, 1) > stored(m):
            try: n += ig_comments(m, 'ads', 'comment'); fetched += 1
            except RuntimeError as e: err += 1; last = str(e)
    page_tok = g(CFG['page'], fields='access_token')['access_token'] if sts else None
    try:
        fbc = {k: (v.get('comments') or {}).get('summary', {}).get('total_count', 0)
               for k, v in counts(sts, 'comments.limit(0).summary(true)', page_tok).items()}
    except RuntimeError as e: fbc = {}; err += 1; last = str(e)
    for st in sts:
        if fbc.get(st, 1) > stored(st):
            try:
                for c in paged_page(st, page_tok):
                    if str((c.get('from') or {}).get('id')) == CFG['page']: continue
                    n += save('ads', 'comment', 'fb:' + c['id'], parse_iso(c['created_time']), c.get('message'), parent=st, scope='owned')
                fetched += 1
            except RuntimeError as e: err += 1; last = str(e)
    db.execute('INSERT OR REPLACE INTO snap VALUES (?,?,?,?)', (dt.datetime.now(TZ).strftime('%Y-%m-%d'), 'ads', 'ads_60d', len(ads)))
    return n, f'объявлений: {len(ads)}, постов: {len(igs)} IG + {len(sts)} FB, обновлено: {fetched}' + (f', ошибок: {err} ({last})' if err else '')

# ---------- Instagram конкурентов: только публичные цифры (business_discovery) ----------
def run_igc():
    today = dt.datetime.now(TZ).strftime('%Y-%m-%d'); cut = time.time() - 30 * 86400; n = 0; bad = []
    handles = dict(CFG.get('instagram_competitors') or {}); handles['bellissimo'] = own_username()
    for brand, u in handles.items():
        try:
            r = g(CFG['ig_user'], fields='business_discovery.username(%s){followers_count,media_count,media.limit(40){timestamp,like_count,comments_count}}' % u)['business_discovery']
            posts = [m for m in (r.get('media') or {}).get('data', []) if parse_iso(m['timestamp']) >= cut]
            vals = {'followers': r.get('followers_count') or 0, 'posts30': len(posts),
                    'likes30': sum(m.get('like_count') or 0 for m in posts), 'comments30': sum(m.get('comments_count') or 0 for m in posts)}
            for k, v in vals.items(): db.execute('INSERT OR REPLACE INTO snap VALUES (?,?,?,?)', (today, 'igc', f'{brand}:{k}', v))
            n += 1
        except RuntimeError as e: bad.append(f'{brand}: {str(e)[:40]}')
        time.sleep(1)
    return n, ('не взято: ' + '; '.join(bad)) if bad else ''

# ---------- Google Play: одинаково для всех брендов ----------
def run_play():
    gps = need('google_play_scraper', 'google-play-scraper'); n = 0; notes = []
    cutoff = time.time() - CFG.get('play_days', 28) * 86400; today = dt.datetime.now(TZ).strftime('%Y-%m-%d')
    for brand, pkg in CFG['play_apps'].items():
        try:
            info = gps.app(pkg, lang='ru', country='uz')
            for k, v in (('score', info.get('score')), ('ratings', info.get('ratings'))):
                if v is not None: db.execute('INSERT OR REPLACE INTO snap VALUES (?,?,?,?)', (today, 'play_' + brand, k, v))
            for lang in ('ru', 'uz'):
                tok = None; got = 0
                while got < 4000:
                    rows, tok = gps.reviews(pkg, lang=lang, country='uz', sort=gps.Sort.NEWEST, count=200, continuation_token=tok)
                    if not rows: break
                    new = 0; old = 0
                    for r in rows:
                        ts = int(r['at'].replace(tzinfo=dt.timezone.utc).timestamp())
                        if ts < cutoff: old += 1; continue
                        k = save('play', 'review', 'gp:' + r['reviewId'], ts, r.get('content'), rating=r.get('score'), brand=brand,
                                 scope='owned' if brand == 'bellissimo' else 'app_review')
                        new += k; n += k
                    got += len(rows)
                    if old or (new == 0 and got > 200) or not tok: break
                    time.sleep(0.5)
                if got >= 4000: notes.append(f'{brand}/{lang}: упёрлись в 4000')
        except Exception as e: notes.append(f'{brand}: {type(e).__name__}')
        db.commit()
    return n, '; '.join(notes)

# ---------- App Store (наше приложение) ----------
def run_appstore():
    n = 0; today = dt.datetime.now(TZ).strftime('%Y-%m-%d')
    apps = [('bellissimo', CFG['appstore_id'], cc, 'owned') for cc in CFG['appstore_countries']]
    apps += [(b, i, 'uz', 'app_review') for b, i in (CFG.get('appstore_apps') or {}).items()]
    for brand, aid, cc, scope in apps:
        for p in range(1, 11):
            try: d = http(f"https://itunes.apple.com/{cc}/rss/customerreviews/page={p}/id={aid}/sortby=mostrecent/json")
            except RuntimeError: break
            ents = d.get('feed', {}).get('entry') or []
            if isinstance(ents, dict): ents = [ents]
            got = 0
            for e in ents:
                if 'im:rating' not in e: continue
                got += 1
                text = (e['title']['label'] + '. ' + e['content']['label']).strip()
                n += save('appstore', 'review', 'as:' + e['id']['label'], parse_iso(e['updated']['label']), text, rating=int(e['im:rating']['label']), brand=brand, scope=scope)
            if not got: break
            time.sleep(1)
    try:
        allapps = [('bellissimo', CFG['appstore_id'])] + list((CFG.get('appstore_apps') or {}).items()) + list((CFG.get('appstore_global_excluded') or {}).items())
        for brand, aid in allapps:
            r = http(f"https://itunes.apple.com/lookup?id={aid}&country=uz")['results']
            if r and r[0].get('averageUserRating'):
                db.execute('INSERT OR REPLACE INTO snap VALUES (?,?,?,?)', (today, 'appstore_' + brand, 'score', r[0]['averageUserRating']))
                db.execute('INSERT OR REPLACE INTO snap VALUES (?,?,?,?)', (today, 'appstore_' + brand, 'ratings', r[0].get('userRatingCount') or 0))
    except RuntimeError: pass
    total = db.execute("SELECT COUNT(*) FROM items WHERE source='appstore'").fetchone()[0]
    return n, ('RSS Apple отдал 0 отзывов (в базе всего %d)' % total if total == 0 else '')

# ---------- Telegram (только на Маке, нужен tg.session) ----------
def run_tg():
    if not (os.path.exists(os.path.join(HERE, 'tg_api.txt')) and os.path.exists(os.path.join(HERE, 'tg.session'))):
        raise Skip('нет tg_api.txt / tg.session (запусти tg_login.py)')
    chans = CFG.get('telegram_channels') or {}
    need('telethon')
    from telethon.sync import TelegramClient
    from telethon.tl.functions.messages import SearchGlobalRequest
    from telethon.tl.types import InputPeerEmpty, InputMessagesFilterEmpty
    api_id, api_hash = [l.strip() for l in open(os.path.join(HERE, 'tg_api.txt')) if l.strip()][:2]
    own_ch = {k.lstrip('@').lower(): v for k, v in chans.items()}
    n = 0; note = []; since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=CFG.get('telegram_days', 14)); MAXP = CFG.get('tg_pages', 5)
    print('  tg: подключаюсь...', flush=True)
    with TelegramClient(os.path.join(HERE, 'tg'), int(api_id), api_hash) as c:
        print('  tg: подключено, ищу', flush=True)
        # 1) глобальный поиск: одинаковые запросы по всем брендам, постранично до конца окна
        for q, brand0 in search_queries(3, 2):
            try:
                off_rate, off_peer, off_id, pages = 0, InputPeerEmpty(), 0, 0
                while pages < MAXP:
                    res = c(SearchGlobalRequest(q=q, filter=InputMessagesFilterEmpty(), min_date=since, max_date=None,
                                                offset_rate=off_rate, offset_peer=off_peer, offset_id=off_id, limit=100))
                    msgs = res.messages; print(f'    «{q}» стр{pages+1}: найдено сообщений {len(msgs)}', flush=True)
                    if not msgs: break
                    names = {x.id: getattr(x, 'username', None) or str(x.id) for x in res.chats}
                    for m in msgs:
                        bl = match_brands(m.message)
                        if not bl: continue
                        cid = getattr(m.peer_id, 'channel_id', None) or getattr(m.peer_id, 'chat_id', None) or 0
                        uname = (names.get(cid) or '').lower()
                        # ТОЛЬКО публичные каналы и группы (есть @username). Личные переписки, закрытые группы и чаты аккаунта пропускаем — это не упоминания
                        if not cid or cid not in names or names[cid].isdigit(): continue
                        u = f"https://t.me/{names[cid]}/{m.id}"
                        # пост из собственного канала бренда — это не упоминание со стороны
                        scope = 'owned' if own_ch.get(uname) in bl else 'earned'
                        n += save_multi(bl, 'tg', 'mention', f'tgs:{cid}:{m.id}', int(m.date.timestamp()), m.message, scope, url=u)
                    pages += 1
                    if len(msgs) < 100: break
                    last = msgs[-1]; off_rate = int(last.date.timestamp()); off_id = last.id; off_peer = c.get_input_entity(last.peer_id)
                    time.sleep(4)
                if pages >= MAXP: note.append(f'«{q}»: упёрлись в {MAXP} страниц')
            except Exception as e: note.append(f'поиск «{q}»: {type(e).__name__}'); print(f'    ОШИБКА «{q}»: {type(e).__name__}: {str(e)[:150]}', flush=True)
            db.commit(); print(f'  tg поиск «{q}»: всего новых {n}', flush=True); time.sleep(6)
        # 2) комментарии в каналах брендов (владелец: для тональности, не для доли)
        for ch, brand in chans.items():
            try:
                for post in c.iter_messages(ch, limit=30):
                    if post.text: n += save('tg', 'post', f'tgp:{ch}:{post.id}', int(post.date.timestamp()), post.text, brand=brand, scope='owned')
                    if getattr(post, 'replies', None) and post.replies.replies:
                        for m in c.iter_messages(ch, reply_to=post.id, limit=300):
                            n += save('tg', 'comment', f'tg:{ch}:{m.id}', int(m.date.timestamp()), m.text, brand=brand, parent=str(post.id), scope='owned')
            except Exception as e: note.append(f'{ch}: {type(e).__name__}')
    return n, '; '.join(note)

# ---------- Telegram: наш список публичных каналов (сессия tg2, отдельный аккаунт) ----------
# Почему так: поиск канала по @имени (ResolveUsername) у Telegram сильно ограничен по частоте.
# Раньше каждый запуск (раз в 2 часа) заново искал все 88 каналов -> после ~80 Telegram давал паузу.
# Теперь id каналов хранятся в tgw_entities.json и ищутся по имени только один раз.
# Если Telegram всё-таки просит подождать, сбор не спит часами (и не держит блокировку), а останавливается
# и продолжает с того же места в следующий запуск, когда пауза закончится.
TGW_CACHE = os.path.join(HERE, 'tgw_entities.json')

def run_tgw():
    wf = os.path.join(HERE, 'telegram_watch.json')
    if not (os.path.exists(wf) and os.path.exists(os.path.join(HERE, 'tg2.session')) and os.path.exists(os.path.join(HERE, 'tg_api.txt'))):
        raise Skip('нет telegram_watch.json / tg2.session (запусти login_tg2.command)')
    row = db.execute("SELECT value FROM snap WHERE date='wait' AND source='tgw' AND key='until'").fetchone()
    if row and time.time() < row[0]:
        raise Skip('Telegram просил паузу, продолжу после ' + dt.datetime.fromtimestamp(row[0], TZ).strftime('%H:%M'))
    watch = json.load(open(wf)); need('telethon')
    from telethon.sync import TelegramClient
    from telethon.errors import FloodWaitError
    from telethon.tl.functions.channels import GetFullChannelRequest
    from telethon.tl.types import InputPeerChannel, InputChannel
    api_id, api_hash = [l.strip() for l in open(os.path.join(HERE, 'tg_api.txt')) if l.strip()][:2]
    first = db.execute("SELECT 1 FROM snap WHERE date='full' AND source='tgw' AND key='all'").fetchone() is None
    pdays, cdays = (CFG.get('tgw_post_days', 90), CFG.get('tgw_comment_days', 14)) if first else (3, 3)
    now = dt.datetime.now(dt.timezone.utc); cap = CFG.get('tgw_cap', 30000)
    cache = json.load(open(TGW_CACHE)) if os.path.exists(TGW_CACHE) else {}
    def save_cache(): json.dump(cache, open(TGW_CACHE, 'w'), ensure_ascii=False, indent=0)
    n = 0; note = []; done = 0; stopped = None
    def scan(c, ent, since, kind, idp, h, typ, comments):
        got = tot = 0
        for m in c.iter_messages(ent, limit=cap):
            if m.date < since: break
            tot += 1
            if not m.message: continue   # пересылки считаем (это охват в этом канале), но помечаем
            if getattr(m, 'via_bot_id', None): continue
            bl = match_brands(m.message)
            if not bl: continue
            got += save_multi(bl, 'tg', 'forward' if (m.fwd_from and kind == 'post') else kind, f'tgw:{idp}:{m.id}', int(m.date.timestamp()), m.message, 'earned',
                              url=f'https://t.me/{h}/{m.id}' if not comments else f'https://t.me/{h}/{m.reply_to.reply_to_top_id or m.reply_to.reply_to_msg_id}?comment={m.id}' if m.reply_to else f'https://t.me/{h}',
                              parent='w:' + typ)
        return got, tot
    def peer(h, c):
        """Канал и его чат комментариев из кэша; по @имени ищем только если канала ещё нет в кэше. Раз в 7 дней обновляем чат комментариев."""
        e = cache.get(h)
        if not e:
            ent = c.get_entity(h)                              # единственный «дорогой» запрос, один раз на канал
            e = cache[h] = {'id': ent.id, 'hash': ent.access_hash, 'lid': None, 'lhash': None, 'checked': 0}; save_cache()
        if time.time() - e.get('checked', 0) > 7 * 86400:
            try:
                full = c(GetFullChannelRequest(InputChannel(e['id'], e['hash'])))
                lid = full.full_chat.linked_chat_id; e['lid'] = lid; e['lhash'] = None
                for ch in full.chats:
                    if lid and ch.id == lid: e['lhash'] = ch.access_hash
                e['checked'] = time.time(); save_cache()
            except FloodWaitError: raise
            except Exception as ex: note.append(f'{h} комментарии: {type(ex).__name__}')
        main = InputPeerChannel(e['id'], e['hash'])
        linked = InputPeerChannel(e['lid'], e['lhash']) if e.get('lid') and e.get('lhash') else None
        return main, linked, e['id'], e.get('lid')
    print('  tgw: подключаюсь (%s), каналов в кэше %d из %d' % ('первый проход: посты %d дн, комментарии %d дн' % (pdays, cdays) if first else 'обновление', sum(1 for h in watch if h in cache), len(watch)), flush=True)
    with TelegramClient(os.path.join(HERE, 'tg2'), int(api_id), api_hash) as c:
        for i, (h, typ) in enumerate(watch.items(), 1):
            done_h = db.execute("SELECT 1 FROM snap WHERE date='full' AND source='tgw' AND key=? AND value>=2", (h,)).fetchone()   # 2 = read 30 days back with forwards
            if first and db.execute("SELECT 1 FROM snap WHERE date='full' AND source='tgw' AND key=?", (h,)).fetchone(): continue   # уже прочитан в первом проходе
            # канал, добавленный в список позже, один раз читается на 30 дней назад (группы и чаты веб-лента не показывает, их видит только Mac)
            pd_h, cd_h = (pdays, cdays) if (first or done_h) else (30, 7)
            try:
                main, linked, mid, lid = peer(h, c)
                g1, t1 = scan(c, main, now - dt.timedelta(days=pd_h), 'post', mid, h, typ, False)
                g2 = t2 = 0
                if linked:
                    try: g2, t2 = scan(c, linked, now - dt.timedelta(days=cd_h), 'mention', lid, h, typ, True)
                    except FloodWaitError: raise
                    except Exception as ex: note.append(f'{h} комментарии: {type(ex).__name__}')
                n += g1 + g2; done += 1
                if first or not done_h: db.execute("INSERT OR REPLACE INTO snap VALUES ('full','tgw',?,2)", (h,))
                db.commit()
                print(f'  [{i}/{len(watch)}] @{h}: постов просмотрено {t1}, комментариев {t2}, упоминаний новых {g1 + g2}', flush=True)
            except FloodWaitError as ex:
                if ex.seconds <= 60:                           # короткая пауза: подождать и идти дальше
                    print(f'    Telegram просит подождать {ex.seconds} с', flush=True); time.sleep(ex.seconds + 2); continue
                until = time.time() + ex.seconds + 60
                db.execute("INSERT OR REPLACE INTO snap VALUES ('wait','tgw','until',?)", (until,)); db.commit()
                stopped = f'Telegram попросил паузу {ex.seconds // 60} мин на @{h} ({i}/{len(watch)}); продолжу после ' + dt.datetime.fromtimestamp(until, TZ).strftime('%H:%M')
                print('    ' + stopped, flush=True); break
            except Exception as ex:
                note.append(f'@{h}: {type(ex).__name__}'); print(f'  [{i}/{len(watch)}] @{h}: ОШИБКА {type(ex).__name__}', flush=True)
            time.sleep(1.5)
    if first and db.execute("SELECT COUNT(*) FROM snap WHERE date='full' AND source='tgw' AND key!='all'").fetchone()[0] >= len(watch) - 3:
        db.execute("INSERT OR REPLACE INTO snap VALUES ('full','tgw','all',1)"); db.commit()
    if stopped: note.insert(0, stopped)
    return n, '; '.join(note[:12])

def run_tgweb():
    """Public Telegram channels through the web preview (t.me/s/...): posts only, no login, runs on GitHub. Comments need the Mac (run_tgw)."""
    import html as _h
    watch = json.load(open(os.path.join(HERE, 'telegram_watch.json')))
    have = {r[0] for r in db.execute("SELECT url FROM items WHERE source='tg' AND url IS NOT NULL")}
    # channels the Mac already read 90 days back (first Telethon pass) need no web backfill
    full = {k for (k,) in db.execute("SELECT key FROM snap WHERE date='full' AND source='tgweb' AND value>=2")}   # 2 = read 30 days back with forwards
    nopv = {k for (k,) in db.execute("SELECT key FROM snap WHERE date='nopreview' AND source='tgweb'")}   # groups: no web page, the Mac reads them
    today = dt.datetime.now(TZ).strftime('%Y-%m-%d')
    def cnt(x):   # "92.8K" -> 92800
        x = (x or '').strip().replace(' ', '').replace(',', '.'); m = {'K': 1e3, 'M': 1e6}.get(x[-1:].upper(), 1)
        try: return int(float(x[:-1] if m > 1 else x) * m)
        except Exception: return None
    n = 0; bad = []; ok = 0; backfill = 0
    for h, typ in watch.items():
        if h in nopv: continue
        # a channel added to the list is read 30 days back once (in portions: at most 30 such channels per run), then 3 days
        first = h not in full and backfill < 30
        if first: backfill += 1
        since = time.time() - (30 if first else 3) * 86400
        try:
            before = ''; got_ch = 0; seen_any = False
            for page in range(15 if first else 6):
                req = urllib.request.Request(f'https://t.me/s/{h}' + (f'?before={before}' if before else ''), headers={'User-Agent': 'Mozilla/5.0 (compatible; MentionsBot)'})
                doc = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
                parts = doc.split('data-post="')[1:]
                if page == 0:   # channel size: the reach of a publication in it
                    m = re.search(r'counter_value">([^<]+)</span>\s*<span class="counter_type">(subscribers|подписчик|members)', doc)
                    if m and cnt(m.group(1)): db.execute("INSERT OR REPLACE INTO snap VALUES (?,?,?,?)", (today, 'tgch', h, cnt(m.group(1))))
                if not parts: break
                seen_any = True; oldest = None; first_id = None
                for blk in parts:
                    ref = blk.split('"', 1)[0]
                    try: pid = int(ref.rsplit('/', 1)[1])
                    except Exception: continue
                    first_id = pid if first_id is None else min(first_id, pid)
                    m = re.search(r'<time[^>]*datetime="([^"]+)"', blk)
                    if not m: continue
                    try: ts = parse_iso(m.group(1))
                    except Exception: continue
                    oldest = ts if oldest is None else min(oldest, ts)
                    fwd = 'tgme_widget_message_forwarded_from' in blk   # a forward is real reach in this channel (iMAS counts it); marked as such
                    t = re.search(r'tgme_widget_message_text[^>]*>(.*?)</div>', blk, re.S)
                    if not t: continue
                    text = re.sub(r'\s+', ' ', _h.unescape(re.sub(r'<[^>]+>', '', re.sub(r'<br\s*/?>', ' ', t.group(1))))).strip()
                    url = f'https://t.me/{ref}'
                    if ts < since or not text: continue
                    if url in have:   # already saved: only refresh its views
                        v = re.search(r'tgme_widget_message_views">([^<]+)<', blk)
                        if v and cnt(v.group(1)): db.execute("INSERT OR REPLACE INTO snap VALUES ('v','tgviews',?,?)", (url, cnt(v.group(1))))
                        continue
                    bl = match_brands(text)
                    if bl:
                        got_ch += save_multi(bl, 'tg', 'forward' if fwd else 'post', f'tgweb:{ref}', ts, text, 'earned', url=url, parent='w:' + typ)
                        v = re.search(r'tgme_widget_message_views">([^<]+)<', blk)
                        if v and cnt(v.group(1)): db.execute("INSERT OR REPLACE INTO snap VALUES ('v','tgviews',?,?)", (url, cnt(v.group(1))))
                if oldest is None or oldest < since or first_id is None: break
                before = first_id
                time.sleep(1)
            if not seen_any: raise RuntimeError('нет публичной ленты')
            n += got_ch; ok += 1
            if first: db.execute("INSERT OR REPLACE INTO snap VALUES ('full','tgweb',?,2)", (h,))
            db.commit()
        except Exception as ex:
            if 'нет публичной ленты' in str(ex): db.execute("INSERT OR REPLACE INTO snap VALUES ('nopreview','tgweb',?,1)", (h,)); db.commit()
            else: bad.append(f'@{h}: {type(ex).__name__}')
        time.sleep(0.7)
    wait = sum(1 for h in watch if h not in full and h not in nopv) - backfill
    return n, f'каналов прочитано {ok} из {len(watch)} (посты, без комментариев)' + (f'; новых каналов дочитано за 30 дней: {backfill}, ждут очереди: {wait}' if backfill or wait > 0 else '') + (f'; групп без веб-ленты (читает Mac): {len(nopv)}' if nopv else '') + ('; не открылись: ' + ', '.join(bad[:12]) if bad else '')

# ---------- СМИ и газеты: ленты RSS/Atom (заголовок и анонс; полный текст не читаем) ----------
def run_media():
    import xml.etree.ElementTree as ET, html as _h, email.utils
    feeds = CFG.get('media_feeds') or {}
    if not feeds: raise Skip('нет media_feeds в config.json')
    n = 0; bad = []; ok_feeds = 0
    def tx(e, *names):
        for nm in names:
            for x in e.iter():
                if x.tag.split('}')[-1] == nm and (x.text or '').strip(): return x.text.strip()
        return ''
    for url, name in feeds.items():
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; MentionsBot)'})
            raw = urllib.request.urlopen(req, timeout=40).read()
            raw = re.sub(rb'<(/?)[A-Za-z0-9_]+:', rb'<\1', raw); raw = re.sub(rb' [A-Za-z0-9_]+:([A-Za-z0-9_]+=)', rb' \1', raw); raw = re.sub(rb' xmlns:[A-Za-z0-9_]+="[^"]*"', b'', raw)
            root = ET.fromstring(raw)
            items = [e for e in root.iter() if e.tag.split('}')[-1] in ('item', 'entry')]
            got = 0
            for it in items:
                title = _h.unescape(tx(it, 'title')); desc = re.sub(r'<[^>]+>', ' ', _h.unescape(tx(it, 'description', 'summary', 'encoded', 'content')))
                text = (title + '. ' + re.sub(r'\s+', ' ', desc)).strip()
                link = tx(it, 'link')
                if not link:
                    for x in it.iter():
                        if x.tag.split('}')[-1] == 'link' and x.get('href'): link = x.get('href'); break
                d = tx(it, 'pubDate', 'published', 'updated', 'date')
                try: ts = int(email.utils.parsedate_to_datetime(d).timestamp())
                except Exception:
                    try: ts = parse_iso(d)
                    except Exception: ts = int(time.time())
                bl = match_brands(text)
                if bl: got += save_multi(bl, 'media', 'post', 'media:' + hashlib.md5((link or title).encode()).hexdigest()[:16], ts, text, 'earned', url=link, parent='w:media:' + name)
            n += got; ok_feeds += 1; db.commit()
            print(f'  {name}: в ленте {len(items)}, новых упоминаний {got}', flush=True)
        except Exception as e:
            bad.append(f'{name}: {type(e).__name__}'); print(f'  {name}: ОШИБКА {type(e).__name__} ({url})', flush=True)
        time.sleep(1)
    return n, f'лент работает {ok_feeds} из {len(feeds)}' + ('; не открылись: ' + ', '.join(bad[:10]) if bad else '')

# ---------- YouTube ----------
def run_yt():
    key = secret('youtube_key.txt')
    if not key: raise Skip('нет youtube_key.txt')
    def y(ep, **p):
        p['key'] = key; return http('https://www.googleapis.com/youtube/v3/' + ep + '?' + urllib.parse.urlencode(p))
    after = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=14)).strftime('%Y-%m-%dT%H:%M:%SZ')
    own_ids = set((CFG.get('youtube_channels') or {}).keys()); vids = {}; capped = []; n = 0; cap = CFG.get('yt_cap', 50)
    # YouTube search costs 100 of the 10 000 daily units: 14 brands x 2 names x up to 2 pages stays within the limit (3 x 3 did not)
    for q, brand0 in search_queries(2, 0):
        tok = None
        for page in range(2):   # листаем дальше, пока в выдаче много подходящих (иначе у крупных брендов часть пропадёт)
            r = y('search', part='snippet', q=q, type='video', order='date', maxResults=cap, publishedAfter=after, regionCode='UZ', **({'pageToken': tok} if tok else {}))
            hit = 0
            for v in r.get('items', []):
                sn = v['snippet']; bl = match_brands(sn['title'] + ' ' + sn['description'])
                if bl: vids[v['id']['videoId']] = (sn, bl, sn.get('channelId') in own_ids); hit += 1
            tok = r.get('nextPageToken')
            if not tok or hit < cap // 5: break
            if page == 1: capped.append(q)
    for vid, (sn, bl, owned) in vids.items():
        n += save_multi(bl, 'yt', 'video', 'ytv:' + vid, parse_iso(sn['publishedAt']), sn['title'], 'owned' if owned else 'earned', url='https://youtu.be/' + vid)
        try:
            for t in y('commentThreads', part='snippet', videoId=vid, maxResults=100, order='time', textFormat='plainText').get('items', []):
                c = t['snippet']['topLevelComment']; cb = match_brands(c['snippet']['textDisplay']); ts = parse_iso(c['snippet']['publishedAt'])
                if cb: n += save_multi(cb, 'yt', 'comment', 'yt:' + c['id'], ts, c['snippet']['textDisplay'], 'earned', url='https://youtu.be/' + vid, parent=vid)
                else: n += save('yt', 'comment', 'yt:' + c['id'], ts, c['snippet']['textDisplay'], url='https://youtu.be/' + vid, parent=vid, brand=bl[0], scope='context')
        except RuntimeError: pass
    nch = 0
    for ch, brand in (CFG.get('youtube_channels') or {}).items():
        try:
            for it in y('playlistItems', part='contentDetails,snippet', playlistId='UU' + ch[2:], maxResults=10).get('items', []):
                vid = it['contentDetails']['videoId']; sn = it['snippet']
                n += save('yt', 'video', 'ytv:' + vid, parse_iso(sn['publishedAt']), sn['title'], url='https://youtu.be/' + vid, brand=brand, scope='owned')
                try:
                    for t in y('commentThreads', part='snippet', videoId=vid, maxResults=100, order='time', textFormat='plainText').get('items', []):
                        c = t['snippet']['topLevelComment']
                        if c['snippet'].get('authorChannelId', {}).get('value') == ch: continue
                        n += save('yt', 'comment', 'yt:' + c['id'], parse_iso(c['snippet']['publishedAt']), c['snippet']['textDisplay'], url='https://youtu.be/' + vid, parent=vid, brand=brand, scope='owned')
                except RuntimeError: pass
            nch += 1
        except RuntimeError: pass
    return n, f'видео по словам: {len(vids)}, каналов: {nch}' + (f'; не дочитали до конца окна: {len(capped)} запросов' if capped else '')

# ---------- Google Trends: доля поиска ----------
def run_trends():
    need('pytrends'); from pytrends.request import TrendReq
    terms = CFG['trends_terms']; anchor = CFG.get('trends_anchor', 'bellissimo')
    others = [b for b in terms if b != anchor]; batches = [others[i:i + 4] for i in range(0, len(others), 4)]
    py = TrendReq(hl='ru-RU', tz=-300, timeout=(10, 30)); ref = None; rows = {}; notes = []
    for bi, batch in enumerate(batches):
        kws = [terms[anchor]] + [terms[b] for b in batch]; names = [anchor] + batch; df = None
        for attempt in range(4):
            try:
                py.build_payload(kws, timeframe='today 12-m', geo='UZ'); df = py.interest_over_time(); break
            except Exception: time.sleep(30 * (attempt + 1)); df = None
        if df is None or df.empty: notes.append(f'пакет {bi+1}: нет ответа'); continue
        sums = {names[i]: float(df[kws[i]].sum()) for i in range(len(kws))}
        if ref is None: ref = sums[anchor]
        k = (ref / sums[anchor]) if sums[anchor] else 0   # приводим пакеты к одной шкале через общий бренд-якорь
        for i, b in enumerate(names):
            if b == anchor and bi > 0: continue
            for d, v in df[kws[i]].items(): rows[(d.strftime('%Y-%m-%d'), b)] = float(v) * k
        time.sleep(10)
    if rows: db.execute('DELETE FROM trends')   # недельные точки (12 мес.) заменяют старые дневные: смешивать шкалы нельзя
    for (d, b), v in rows.items(): db.execute('INSERT OR REPLACE INTO trends VALUES (?,?,?)', (d, b, v))
    return len(rows), '; '.join(notes)

def reanalyze():
    """Пересчёт тональности по всей истории (после правок словаря) и маскировка телефонов."""
    ch = 0
    for id_, text, rating, sent, th, brand, scope in db.execute('SELECT id, text, rating, sentiment, themes, brand, scope FROM items').fetchall():
        t2 = PHONE.sub('[тел]', text or ''); s2, th2 = analyze(t2, rating); s2, th2 = about_other(t2, brand, scope, s2, th2); th2 = '|'.join(th2)
        if (t2, s2, th2) != (text, sent, th):
            db.execute('UPDATE items SET text=?, sentiment=?, themes=? WHERE id=?', (t2, s2, th2, id_)); ch += 1
    db.commit(); return ch

def rematch():
    """Re-checks stored mentions from YouTube, Telegram and media against the current brand dictionary and removes what no longer matches.
    Needed after the dictionary is tightened (e.g. Italian "bellissimo" = "beautiful"). Runs every time after the Mac import: Mac rows come
    back from the export, so they are checked again. YouTube videos are checked by title + description, fetched once per video."""
    key = secret('youtube_key.txt'); base = lambda i: i.split('#')[0]
    rows = db.execute("SELECT id,source,kind,brand,text,scope,parent FROM items WHERE source IN ('yt','tg','media') AND scope IN ('earned','context')").fetchall()
    ver = int(hashlib.md5(json.dumps(CFG.get('brands'), sort_keys=True).encode()).hexdigest()[:7], 16)   # recheck everything when the dictionary changes
    done = {k for (k,) in db.execute("SELECT key FROM snap WHERE date='rematch' AND source='yt' AND value=?", (ver,))}
    vids = sorted({base(r[0])[4:] for r in rows if r[1] == 'yt' and r[2] == 'video'} - done)
    meta = {}; asked = set()
    if key:
        for i in range(0, len(vids), 50):
            try:
                for v in http('https://www.googleapis.com/youtube/v3/videos?' + urllib.parse.urlencode({'part': 'snippet', 'id': ','.join(vids[i:i + 50]), 'key': key})).get('items', []):
                    meta[v['id']] = v['snippet']['title'] + ' ' + v['snippet']['description']
                asked |= set(vids[i:i + 50])
            except RuntimeError: break
    groups = {}
    for r in rows: groups.setdefault(base(r[0]), []).append(r)
    video_brands = {}; dropped = 0
    for b_id, rs in groups.items():
        src, kind, scope = rs[0][1], rs[0][2], rs[0][5]
        if scope == 'context': continue
        if src == 'yt' and kind == 'video':
            vid = b_id[4:]
            if vid in done: video_brands[vid] = {r[3] for r in rs}; continue
            if vid not in meta and vid not in asked: video_brands[vid] = {r[3] for r in rs}; continue   # not checked yet (no key or quota): leave as is
            text = meta.get(vid) or rs[0][4] or ''   # deleted or private video: judge by the stored title
        else: text = rs[0][4] or ''
        ok = set(match_brands(text))
        for r in rs:
            if r[3] not in ok: db.execute('DELETE FROM items WHERE id=?', (r[0],)); dropped += 1
        if src == 'yt' and kind == 'video':
            video_brands[b_id[4:]] = ok & {r[3] for r in rs}
            db.execute("INSERT OR REPLACE INTO snap VALUES ('rematch','yt',?,?)", (b_id[4:], ver))
    for b_id, rs in groups.items():   # comments under a video that is no longer ours go with it
        r = rs[0]
        if r[5] == 'context' and r[1] == 'yt' and r[6] in video_brands and not video_brands[r[6]]:
            db.execute('DELETE FROM items WHERE id=?', (r[0],)); dropped += 1
    db.commit()
    return dropped, f'проверено видео: {len(meta)}, удалено строк: {dropped}'

SOURCES = {'rematch': rematch, 'tgweb': run_tgweb, 'ig': run_ig, 'ads': run_ads, 'play': run_play, 'appstore': run_appstore, 'igc': run_igc, 'tgw': run_tgw, 'media': run_media, 'yt': run_yt, 'trends': run_trends}
# старый сборщик 'tg' (личный аккаунт, глобальный поиск) отключён: читает только чужие каналы из telegram_watch.json через отдельный аккаунт
GROUPS = {'fast': ['ig', 'ads', 'play', 'appstore', 'igc', 'yt', 'trends'], 'slow': ['media', 'tgw']}

if __name__ == '__main__':
    if sys.argv[1:] == ['reanalyze']: print('изменено строк:', reanalyze()); sys.exit()
    want = [x for a in (sys.argv[1:] or ['fast']) for x in GROUPS.get(a, [a])]
    for s in want:
        now = dt.datetime.now(TZ).strftime('%Y-%m-%d %H:%M')
        try:
            if s in ('ig', 'ads', 'igc') and not TOKEN: raise Skip('нет meta_token.txt')
            n, note = SOURCES[s](); ok = 1
        except Skip as e: n, note, ok = 0, str(e), -1
        except Exception as e: n, note, ok = 0, mask(f'{type(e).__name__}: {e}')[:300], 0
        db.execute('INSERT OR REPLACE INTO status VALUES (?,?,?,?,?)', (s, now, ok, n, note)); db.commit()
        print(f"{s:9} {'ok' if ok == 1 else 'пропуск' if ok == -1 else 'ОШИБКА':8} новых: {n:5}  {note}", flush=True)
    print('пересчёт тональности, изменено строк:', reanalyze())
