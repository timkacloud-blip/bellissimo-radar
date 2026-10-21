"""Shared text rules for ads and Telegram posts: mechanics (tags), main offer, prices with context, promo codes, language.
Used by comp_build.py and journal.py so both describe an offer the same way."""
import re

TAGS = [
    ('1+1 / второй в подарок', r"1\s*\+\s*1|второй в подарок|ikkinchisi\s*(sovg|bepul)|ikkinchisini bepul|bittasi sizga|по цене одного|bir set narxiga|2 ta katta|два больших"),
    ('Скидка %', r"\d{1,2}\s*%(?!\s*(gacha\s*)?(keshbek|кешб|cashback))|chegirma|скидк"),
    ('Бесплатная доставка', r"бесплатн\w* доставк|доставляем .{0,40}бесплатно|yetkazib berish bepul|bepul yetkaz|БЕСПЛАТНО"),
    ('Промокод', r"промо-?код|promo-?kod|promokod|\b[A-Z]{3,}\d{2,}\b"),
    ('Новинка', r"новинк|yangi format|новом формате|endilikda|новый вкус|yangi ta.m|endi .{0,20}da|теперь в|встречайте|tez kunda|yangilik|уже здесь"),
    ('Открытие филиала', r"yangi .{0,25}filial|filial\w* ochil|ochilishi|ochildi|открыл\w*|новый филиал|нового филиала|kutib oling"),
    ('Комбо / сет', r"комбо|kombo|combo|сет\b|set\b|набор"),
    ('Дешевле в приложении', r"дешевле|arzonroq|в приложении .{0,30}сум|ilovada \d"),
    ('Цена', r"\d[\d\s]{2,}\s*(so.?m|сум|sum)"),
    ('Дети / праздник', r"tug.ilgan kun|день рожден|farzand|детск|animator|аниматор|shou\b|шоу"),
    ('Гарантия времени', r"\d{2}\s*(daqiqa|минут)|kechiksa|опоздает|опоздани"),
    ('Кешбэк / клуб', r"keshbek|кешб[еэ]к|cashback|\bclub\b|(?<![а-яё])клуб(?![а-яё])|bonus|бонус"),
]
TAGS = [(n, re.compile(p, re.I)) for n, p in TAGS]

SPLIT = re.compile(r"-{3,}|—{3,}|_{3,}|={3,}")
BOILER = [  # standard lines that are not the offer itself
    re.compile(r"\d{2}\s*(daqiqa\w*|минут\w*)[^.!?\n]{0,40}?(bepul|бесплатн\w*)", re.I),   # "35 daqiqada bepul yetkazib" = delivery promise
    re.compile(r"(bepul|бесплатн\w*)\s+(yetkaz\w*|доставк\w*)[^.!?\n]{0,25}?\d{2}\s*(daqiqa\w*|минут\w*)", re.I),  # "с бесплатной доставкой за 35 минут"
    re.compile(r"[^.!?\n]{0,60}(kechiks\w*|опозда\w*)[^.!?\n]{0,80}", re.I),              # late -> promo-code guarantee
]
COMBO_EXTRA = re.compile(r"ichimlik|напит\w*|\bkola\b|колой|\bfri\b|\bфри\b|uchta|3 ta |три пицц|ikki kishilik|на двоих|2 ta |два больш|комбо|kombo|combo|сет\b|set\b|набор", re.I)
PRIMARY = ['1+1 / второй в подарок', 'Кешбэк / клуб', 'Скидка %', 'Промокод', 'Бесплатная доставка', 'Комбо / сет', 'Дешевле в приложении',
           'Новинка', 'Открытие филиала', 'Дети / праздник', 'Цена']

CODE = re.compile(r"\b[A-Z]{3,}\d{2,}\b")
CODE_AFTER_WORD = re.compile(r"(?:промо-?код\w*|promo-?kod\w*|promokod\w*)\W{1,4}[«\"“]?([A-Za-z][A-Za-z0-9]{3,14})\b", re.I)
NOT_CODE = {'bilan', 'orqali', 'kiriting', 'введите', 'ishlating', 'используйте', 'kodini', 'kod', 'code', 'beradi', 'qoshing', 'yordamida', 'para', 'dlya', 'bepul', 'free', 'besplatno', 'бесплатно', 'sovga', 'chegirma', 'skidka'}


def headline(text):
    """The offer lives in the opening lines; bilingual ads repeat it after ---, so take the first part only."""
    return SPLIT.split(text or '')[0][:220]


def codes(text):
    out = set(CODE.findall(text or ''))
    for m in CODE_AFTER_WORD.finditer(text or ''):
        c = m.group(1)
        if c.lower() not in NOT_CODE and (any(ch.isdigit() for ch in c) or c.isupper()):
            out.add(c.upper())
    return sorted(out)


def tags(text):
    head = headline(text)
    clean = head
    for p in BOILER: clean = p.sub(' ', clean)
    out = [n for n, p in TAGS if p.search(clean)]
    if any(p.search(head) for p in BOILER[:2]) and 'Гарантия времени' not in out: out.append('Гарантия времени')
    if COMBO_EXTRA.search(clean) and 'Комбо / сет' not in out: out.append('Комбо / сет')
    # explicit promo code (DODO30, SALOM30) counts anywhere in the text unless it is the lateness guarantee
    full = text or ''
    for p in BOILER[2:]: full = p.sub(' ', full)
    if codes(full) and 'Промокод' not in out: out.append('Промокод')
    if 'Промокод' in out and not re.search(r"промо|promo|\b[A-Z]{3,}\d{2,}\b", full, re.I): out.remove('Промокод')
    return out


def primary(tg):
    return next((t for t in PRIMARY if t in tg), 'Без оффера')


NOT_PRICE_BEFORE = re.compile(r"(скидк\w*|chegirma|вместо|минимал\w*|сумм\w* заказа|заказ\w* от|доход\w*|оплата\w*|экономи\w*|daromad\w*|bonus\w*|kassada|на кассе|(?<![а-яёa-z])до(?![а-яё])|gacha)[^\d]{0,12}$", re.I)
NOT_PRICE_AFTER = re.compile(r"^\W{0,3}(so.?m|сум\w*|sum)?\W{0,2}(o.rniga|chegirma|скидк|бонус|bonus|dan (yuqori|ortiq|boshlab berilgan)|gacha|daromad|в (день|месяц)|в час)", re.I)
NUM = re.compile(r"\d{1,3}(?:[\s  .]\d{3})+(?![\d.,]\d)|\d{4,6}")
CUR_AFTER = re.compile(r"^\s*(so.?m|сум|sum|dan\b|so.?mdan)", re.I)
PRICE_CUE_BEFORE = re.compile(r"(от|за|atigi|всего|narx\w*|цена|price|—|-|:)\s*[«\"“]?\s*$", re.I)

# what the price is for: the nearest product word around the number
CATS = [
    ('Пицца', r"pizza|pitsa|pitstsa|пицц"),
    ('Бургер', r"burger|бургер"),
    ('Лаваш / шаурма', r"lavash|лаваш|shaurma|шаурм|donar|донер|doner|hot.?dog|хот.?дог|tvister|твистер"),
    ('Курица', r"strips|стрипс|qanot|крыл|chicken|tovuq|курин|nagget|наггет|basket|баскет"),
    ('Комбо / сет', r"kombo|комбо|combo|\bset\b|\bсет\b|набор|to.plam"),
    ('Торт / выпечка', r"tort|торт|выпеч|somsa|самс|croissant|круассан|pishiriq|desert|десерт"),
    ('Напиток', r"kofe|coffee|кофе|ichimlik|напит|choy|чай|lipton|kola|кола|limonad|лимонад|mohito|мохито"),
]
CATS = [(n, re.compile(p, re.I)) for n, p in CATS]


def price_cat(text, start, end):
    """Category of the product nearest to the price (looks at the same sentence first)."""
    best = None
    for n, p in CATS:
        for m in p.finditer(text):
            d = start - m.end() if m.end() <= start else m.start() - end
            if d < 0: d = 0
            if n == 'Напиток': d += 40   # a drink next to food is usually part of the meal
            if d <= 80 and (best is None or d < best[0]): best = (d, n)
    return best[1] if best else 'Другое'


def price_items(text, hire=False):
    """Offer prices with what they are for: [{'p': 84000, 'c': 'Пицца', 't': '…snippet…'}].
    Drops discounts, old prices ("вместо", "o'rniga", "kassada"), order minimums, savings and salaries."""
    if hire or not text: return []
    out, seen = [], set()
    for m in NUM.finditer(text):
        raw = m.group(0); v = int(re.sub(r"\D", "", raw))
        if not 3000 <= v <= 1_000_000: continue
        before, after = text[max(0, m.start() - 30):m.start()], text[m.end():m.end() + 25]
        if not (CUR_AFTER.search(after) or (re.search(r"[\s.]", raw) and PRICE_CUE_BEFORE.search(before[-12:])) or re.search(r"pizza|pitsa|пицц", before[-15:], re.I)): continue
        if NOT_PRICE_BEFORE.search(before): continue
        if NOT_PRICE_AFTER.search(after): continue
        if re.search(r"(−|(?<!\s)-|\s-(?=$))\s?$", before): continue   # "−30 000 сум" / "-20 000" is a discount, not a price
        if v in seen: continue
        seen.add(v)
        a, b = max(0, m.start() - 60), min(len(text), m.end() + 40)
        snip = re.sub(r"\s+", " ", text[a:b]).strip()
        out.append({'p': v, 'c': price_cat(text, m.start(), m.end()), 't': ('…' if a else '') + snip + ('…' if b < len(text) else '')})
    return sorted(out, key=lambda x: x['p'])


def prices(text, hire=False):
    return [x['p'] for x in price_items(text, hire)]


def lang(text):
    cyr = len(re.findall(r"[а-яё]", text, re.I)); lat = len(re.findall(r"[a-z]", text, re.I))
    if cyr == 0 and lat == 0: return '—'
    return 'RU' if cyr >= lat else 'UZ'


def plural(n, one, few, many):
    n = abs(int(n)); m10, m100 = n % 10, n % 100
    if m10 == 1 and m100 != 11: return one
    if 2 <= m10 <= 4 and not 12 <= m100 <= 14: return few
    return many


def gist(text, price=None):
    """Short Russian description of an offer: main mechanics + price, e.g. «1+1 / второй в подарок · 88 000 сум»."""
    tg = [t for t in tags(text) if t not in ('Цена', 'Гарантия времени')]
    parts = tg[:2]
    if price: parts.append(f"{price:,} сум".replace(',', ' '))
    return ' · '.join(parts) or 'Акция, механика не распознана — см. текст'
