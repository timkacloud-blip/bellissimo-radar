#!/usr/bin/env python3
"""Mentions feed: every publication about the brands (Telegram channels and chats, media sites, YouTube) with what it is
(hiring, the brand's promo, press, partners, promo code, opinion), region, language and reach. Rules only, no LLM.
Written as a separate file for the Mentions tab: site/mentions_feed.json."""
import json, os, re, datetime as dt

H = os.path.dirname(os.path.abspath(__file__))
try: REGION_OF = json.load(open(os.path.join(H, 'channels_meta.json'), encoding='utf-8')).get('region', {})
except Exception: REGION_OF = {}
REGION_OF = {k.lower(): v for k, v in REGION_OF.items()}
try: WATCH = {k.lower(): v for k, v in json.load(open(os.path.join(H, 'telegram_watch.json'), encoding='utf-8')).items()}
except Exception: WATCH = {}

NAMES = {'bellissimo': r"bell?i?ss?imo|бел+и+с+имо", 'kfc': r"\bkfc\b|кфс", 'evos': r"\bevos\b|эвос|евос", 'oqtepa': r"oq ?tepa|ok ?tepa|окт[еэ]па|оқтепа",
         'dodo': r"dodo|додо", 'maxway': r"max ?way|макс ?в[еэ]й", 'sariqbola': r"sariq ?bola|сари[кқ] бола", 'hardees': r"hardee|хардис",
         'safia': r"safi[ay]|сафи[яа]", 'uzum': r"uzum ?tezkor|узум ?тезкор", 'yandex': r"yandex ?(eats|eda|go)|яндекс ?еда", 'papajohns': r"papa ?john|папа ?джон",
         'apex': r"apex ?pi|апекс", 'dominos': r"domino|доминос"}
NAMES = {b: re.compile(p, re.I) for b, p in NAMES.items()}

HIRE = re.compile(r"ishga taklif|kuryer bo.?ling|kuryerlik|набира\w* курьер|курьером|kuryerlar? (oyiga|qancha)|ish(chi|chilar)? kerak|ish bor\b|kuryer(lar)? kerak|kerak:? *(kuryer|kassir|pizzerist|povar|oshpaz|ofitsiant)|pizzerist|kassir|vakans|ваканс|требу[юе]тся|ищем (курьер|сотрудник|повар)|"
                  r"приглашаем на работу|oylik maosh|maosh:|зарплат|курьер(ы|ов)? (нужн|требу)", re.I)
PROMO_CODE = re.compile(r"(?i:promo-?[kc]od|prom[ao]kod|промо-?код|промокод)|(?<![A-Za-z])[A-Z]{3,}\d{2,}(?![A-Za-z0-9])")
LANDMARK = re.compile(r"mo.ljal|ориентир|yonida|qarshisida|ro.parasida|o.ng tomon|chap tomon|рядом с|напротив|возле|за углом", re.I)
CASHBACK = re.compile(r"keshbek|кешб[еэ]к|cashback|karta bilan|по карте|картой", re.I)
PRESS = re.compile(r"интервью|intervyu|премия|премии|mukofot|award|festival|фестивал|лауреат|номинац|nominats|директор|direktor|\bCEO\b|основател|asoschi|рейтинг|reyting|исследован|"
                   r"tadqiqot|итоги|рынок|франшиз|franshiza|инвест|invest|выручк|daromad|филиалов|filiallar soni|топ-\d|top-\d", re.I)
OFFER = re.compile(r"(?<!\d)[1-3] ?\+ ?1(?!\d)|chegirma|скидк|aksiya|акци|bepul|бесплатн|so.m(ga|dan)?\b|сум\b|kombo|комбо|\bset\b|\bсет\b|sovg.a|подарок|pitsa bayram|yangi ta.m|новинк|tatib ko.ring", re.I)
OPINION = re.compile(r"(?<![a-zа-я])(men|meni|menga|я|мне|по-моему|имхо|menimcha)(?![a-zа-я])", re.I)

CITY = [('Ташкент', r"toshkent|tashkent|ташкент|тошкент|chilonzor|yunusobod|sergeli|чиланзар|юнусабад|сергел"), ('Самарканд', r"samarqand|samarkand|самарканд|самарқанд"),
        ('Бухара', r"buxoro|bukhara|бухар|бухоро|g.ijduvon"), ('Наманган', r"namangan|наманган"), ('Андижан', r"andijon|andijan|андижан|андижон"),
        ('Фергана', r"farg.ona|fergana|фергана|фарғона|qo.qon|kokand|коканд|marg.ilon"), ('Каракалпакстан', r"nukus|нукус|qoraqalpog|каракалпак"),
        ('Хорезм', r"xorazm|urganch|хорезм|ургенч|xiva|хива"), ('Кашкадарья', r"qarshi|qashqadaryo|карши|кашкадар|shahrisabz"), ('Сурхандарья', r"termiz|termez|термез|термиз|surxon"),
        ('Джизак', r"jizzax|jizzakh|джизак|жиззах"), ('Навои', r"navoiy|navoi|навои|навоий"), ('Сырдарья', r"guliston|gulistan|гулистан|sirdaryo|сырдар"),
        ('Ташкентская обл.', r"yangiyo.l|chirchiq|чирчик|olmaliq|алмалык|angren|ангрен")]
CITY = [(n, re.compile(p, re.I)) for n, p in CITY]


def lang(t):
    cyr = len(re.findall(r"[а-яёўқғҳ]", t, re.I)); lat = len(re.findall(r"[a-z]", t, re.I))
    if cyr > lat:
        return 'ўзб' if re.search(r"[ўқғҳ]|(?<![а-я])(ва|учун|билан|ҳам|эмас|кўп|бугун|янги|бўлди)(?![а-я])", t, re.I) else 'рус'
    if lat: return 'uzb' if re.search(r"[‘’'`ʻ]|(?<![a-z])(va|uchun|bilan|ham|emas|bugun|yangi|bo.ldi|kerak|faqat)(?![a-z])", t, re.I) else 'eng'
    return '—'


def region(handle, text):
    r = REGION_OF.get((handle or '').lower())
    if r: return r
    for n, p in CITY:
        if p.search(text): return n
    return ''


def near_brand(text, rx, width=45):
    """Is a landmark / cashback word next to the brand name? («магазин рядом с Bellissimo» is not about Bellissimo itself)"""
    for b, p in NAMES.items():
        for m in p.finditer(text):
            if rx.search(text[max(0, m.start() - width):m.end() + width]): return True
    return False


def category(text, src, ctype, sent):
    if HIRE.search(text): return 'Найм'
    if PROMO_CODE.search(text): return 'Промокод'
    # YouTube shorts that repeat a delivery deal with a price («3 ta pitsa atigi 73 000 so'm #shorts»): promo-code / referral accounts
    if src == 'yt' and re.search(r"#shorts|#promo|#\w*promo", text, re.I) and OFFER.search(text): return 'Промокод'
    if near_brand(text, LANDMARK) or near_brand(text, CASHBACK, 150): return 'Партнёры и ориентиры'
    if src == 'media' or ctype == 'business' or PRESS.search(text): return 'Пресса и PR'
    if OFFER.search(text): return 'Акция бренда'
    if sent in ('pos', 'neg') or (src == 'tg' and ctype != 'news' and OPINION.search(text)): return 'Мнение'
    return 'Упоминание'


def build(db, today, names, days=120):
    since = str(today - dt.timedelta(days=days))
    subs = {}
    for d, k, v in db.execute("SELECT date,key,value FROM snap WHERE source='tgch' ORDER BY date"): subs[k.lower()] = int(v)
    views = {k: int(v) for k, v in db.execute("SELECT key,value FROM snap WHERE source='tgviews'")}
    rows = db.execute("""SELECT id,source,kind,brand,date,ts,text,sentiment,url,parent FROM items
                         WHERE scope='earned' AND source IN ('tg','media','yt') AND kind IN ('post','mention','video') AND date>=? ORDER BY ts DESC""", [since]).fetchall()
    by = {}
    for id_, src, kind, brand, d, ts, text, sent, url, parent in rows:
        if brand not in names: continue
        base = url or id_.split('#')[0]   # the same Telegram post read from the web page and by the Mac is one publication
        x = by.get(base)
        if x:
            if brand not in x['b']: x['b'].append(brand)
            continue
        handle = ''; ctype = ''
        if src == 'tg' and url and 't.me/' in url:
            handle = url.split('t.me/', 1)[1].split('/')[0].split('?')[0]
            if handle == 'c': handle = ''
            ctype = WATCH.get(handle.lower(), (parent or '').replace('w:', '') if (parent or '').startswith('w:') else '')
        elif src == 'media': handle = (parent or '').replace('w:media:', '')
        t = __import__('html').unescape(text or '')
        by[base] = {'id': id_.split('#')[0], 'd': d, 'ts': ts, 'b': [brand], 'src': src, 'k': 'Комментарий в чате' if kind == 'mention' else '', 'ch': handle, 'ct': ctype,
                    'r': subs.get(handle.lower()) if src == 'tg' else None, 'v': views.get(url), 's': sent or 'neu',
                    'cat': category(t, src, ctype, sent), 'reg': region(handle if src == 'tg' else '', t), 'lg': lang(t), 'u': url or '', 't': t[:600]}
    feed = list(by.values())
    # the same text in several channels (a seeded post) is one message: count where else it went
    key = lambda x: re.sub(r'\W+', ' ', x['t'].lower())[:120]
    grp = {}
    for x in feed: grp.setdefault(key(x), []).append(x)
    for g in grp.values():
        for x in g: x['dup'] = len(g)
    return feed


def write(db, today, path, names):
    feed = build(db, today, names)
    json.dump({'built': dt.datetime.now(dt.timezone(dt.timedelta(hours=5))).strftime('%Y-%m-%d %H:%M'), 'feed': feed}, open(path, 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))
    return len(feed)
