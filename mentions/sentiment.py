# -*- coding: utf-8 -*-
"""Тональность и темы по словарю (ru + uz латиница + uz кириллица). Без LLM.
Словарь правим здесь. Слова пишем через запятую (запятая — разделитель, пробел внутри — часть фразы).
Слово ищется как начало слова; знак $ в конце — только целое слово. Кириллица автоматически приводится к латинице.
Точность проверяется по ручной разметке в labels/ (python3 eval_sentiment.py)."""
import re

_CYR = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'j','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m',
        'н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'x','ц':'ts','ч':'ch','ш':'sh','щ':'sh',
        'ъ':"'",'ы':'i','ь':'','э':'e','ю':'yu','я':'ya','ў':"o'",'ғ':"g'",'қ':'q','ҳ':'h'}

def norm(s):
    s = (s or '').lower().replace('ʻ', "'").replace('’', "'").replace('‘', "'").replace('`', "'").replace('ʼ', "'")
    return ''.join(_CYR.get(c, c) for c in s)

def _L(text): return [norm(w.strip()) if not w.strip().endswith('$') else norm(w.strip()[:-1]) + '$' for w in text.replace('\n', ' ').split(',') if w.strip()]

POS = _L("""спасибо, благодар, вкусн, отличн, супер, класс, лучш, нравит, понравил, быстр, горяч, свеж, рекоменд, молодц, обожаю, любим,
шикарн, идеальн, замечательн, круто, огонь, хорош, красив, rahmat, mazali, mazza, zo'r, ajoyib, yaxshi, yahshi, a'lo, tez, issiq, yoqdi, yoqadi,
yoqtir, tavsiya, sevaman, bomba, chiroyli, barakalla, ishonchli, zor$, zori$, zo'ri$, norm$""")

NEG = _L("""ужас, отврат, плох, кошмар, долго, опозд, холодн, невкусн, хамств, груб, обман, разочаров, глючит, вылетает, ошибк, не работает,
не приехал, не привез, списали, возврат, верните, мошенник, тухл, сырой, испорчен, дорого, завышен, баг, отмен, не отвечает, жалоб, позор,
маленьк, не наедае, не хватает, недовар, сыро, пережар, подгор, майонез, снизил, хуже, холодильник, расво, мусор, трэш, trash,
yomon, dahshat, sovuq, kechik, uzoq kut, mazasiz, ishlamayd, xato, aldadi, aldov, qaytar, pulimni, javob bermayd, javob yo'q, hafa, norozi,
jirkanch, bezor, qimmat, qimat, xafa, rezil, sharmanda, buzilgan, bekor, yetkazmad, olib kelmad, kutdim, qotgan, qotib, qattiq, kattik, rasvo,
musor, dabdala, aynig, aynib, yoqmad, yoqmay, yoqmag, yoqmed, yoqtirm, bemaza, pishmagan, hayf, xayf, aldam, sifatsiz, yaramay, iflos,
to'ydirm, toydirm, tuydirm, to'ymas, toymas, to'ymay, toymay, tuymay, tuymim, toymim, to'ymim, tuymid, toymid, to'ymid, tuymad, toymad, to'ymad,
kichkin, yeb qo'yaman, yeb beraman, o'zim yeb, ozim yeb, uzim yeb, bitta o'zim, bir o'zim, bir uzim, bittada, o'zim yiy, ozim yiy, uzim yiy,
bir ozim, bitta ozim, bitta uzim, ozim yiv, o'zim yiv, uzim yiv, ozim yev, o'zim yev, toyamanmi, toyamanov, to'yamanmi, toyamizmi, to'yamizmi, не наемся,
zorga yet, zo'rga yet, yetmay, yetmag, kalla bilan, rostini ayt, chiqmayap, ochilmay, kirmay, yuklanmay, siri yo, sir yo, siri yu, past sort,
mazasi yu, mazasi yo, maza-matras, mazamatras, ta'mi yu, ta'mi yo, tami yu, tami yo, tushirvord, tuwirvord, bulmay, bo'lmay, bulmagur, bo'lmagur""")

NEGATORS = {'ne', 'ni', 'nikogda', 'emas', "yo'q", 'yoq', 'net'}
POS_EMOJI = '👍❤️🔥😍🥰😋👏💯🤩😊'
NEG_EMOJI = '👎😡🤮😤🤬😠💩😒'

THEMES = {
    'Долго / опоздание': "долго, опозд, ждем, ждал, жду, kech, kutdim, kutib, uzoq, kechik, yetib kelmad, yetkazmad",
    'Качество еды': "холодн, остыл, сырой, тухл, невкусн, жирн, пересол, вкус, качеств, тесто, sovuq, qotgan, qotib, mazasiz, sifat, ta'm, xamir, xom, qattiq, siri yo",
    'Приложение / оплата': "приложен, оплат, карт, списал, списан, глюч, баг, вылет, обновлен, регистрац, ошибк, app, ilova, to'lov, karta, xato, ishlamayd, kirmayd, chiqmayap",
    'Промокод / акция': "промокод, промо, акци, скидк, бонус, кэшбек, купон, розыгрыш, aksiya, chegirma, promokod, bonus, sovg'a, yutuq",
    'Курьер / персонал': "курьер, оператор, хамств, груб, менеджер, персонал, kuryer, operator, qo'pol, xodim, haydovchi, momilasi, muomala",
    'Размер порции': "toymay, toymid, toymad, tuymay, tuymid, tuymim, tuymad, to'ymay, to'ymid, to'ymad, to'ydirm, toydirm, kichkin, порци, маленьк, porsiya, hajm, razmer, kishi",
    'Цена': "дорог, цен, завыш, narx, qimmat, qimat, arzon",
}
THEMES = {k: _L(v) for k, v in THEMES.items()}
THEMES_POS = {
    'Вкус / качество': "вкусн, mazali, mazza, shirin, sifatli, свеж, горяч, issiq, a'lo, ajoyib, zo'r, зор$, тесто, xamiri",
    'Быстрая доставка': "быстр, вовремя, tez, tezda, o'z vaqtida, joyida keldi, tez yetkaz, tez keldi, не ждал",
    'Сервис / персонал': "вежлив, курьер, оператор, менеджер, персонал, kuryer, operator, xodim, muloyim, xizmat, servis, обслуж, rahmat, barakalla, спасибо, благодар",
    'Акции / цена': "акци, скидк, бонус, кэшбек, купон, подар, aksiya, chegirma, promokod, bonus, sovg'a, arzon, дешев, выгодн",
    'Приложение': "приложен, удобн, ilova, qulay, app",
    'Порция / размер': "больш, наедае, сытн, katta, porsiya, to'yib, toyib, hajm",
}
THEMES_POS = {k: _L(v) for k, v in THEMES_POS.items()}

def _rx(stem):
    if stem.endswith('$'): return re.compile(r"(?<![a-z'])" + re.escape(stem[:-1]) + r"(?![a-z'])")
    return re.compile(r"(?<![a-z'])" + re.escape(stem))
_POS = [_rx(x) for x in POS]; _NEG = [_rx(x) for x in NEG]
_TH = {k: [_rx(w) for w in ws] for k, ws in THEMES.items()}
_THP = {k: [_rx(w) for w in ws] for k, ws in THEMES_POS.items()}
_SPAM = re.compile(r"promokod\s*:|promo\s*kod\s*:|\[tel\]|\[тел\]|https?://|t\.me/|kuryer\s+boling|haftali\s+tolov")
_PAST = re.compile(r"(?<![a-z'])(oldin|ilgari|ildin|ranshe|ranee)")

def analyze(text, rating=None):
    """-> (sentiment, [themes]); sentiment: pos | neu | neg. rating (1-5) для отзывов приоритетнее текста."""
    text = text or ''; t = norm(text)
    words = re.findall(r"[a-z']+", t)
    themes = [k for k, rs in _TH.items() if any(r.search(t) for r in rs)]
    if text and '@' in text and len(re.sub(r'@\w+|\s|[^\w]', '', text)) == 0: return 'neu', ['Теги / розыгрыш']
    if not rating and (_SPAM.search(t) or _SPAM.search(text)): return 'neu', ['Реклама / спам']
    pos = neg = 0
    for r in _POS:
        m = r.search(t)
        if not m: continue
        before = re.findall(r"[a-z']+", t[:m.start()])[-2:]; after = re.findall(r"[a-z']+", t[m.end():])[:2]; rest = t[m.end():m.end() + 8]
        if re.match(r"(mi|misiz|misan|mis)\b", rest): continue            # «yaxshimisiz» — приветствие, не оценка
        if set(before) & NEGATORS or 'emas' in after or re.match(r"(mas|emas|emes)\b", rest): neg += 1
        else: pos += 1
    for r in _NEG:
        m = r.search(t)
        if not m: continue
        if re.match(r"[a-z']*masa", t[m.start():m.start() + 25]): continue   # «agar zakaz kechikmasa» = «если не опоздаете»: условие, не жалоба
        neg += 1
    # laughing about the portion («4 5 kisimas bir ozim yivoraman 🤣»): sarcasm, the portion is small
    if not rating and any(e in text for e in '🤣😂😅') and re.search(r"(?<![a-z'])(kishi|kisi|ozim|o'zim|uzim|porsiya|kichkin|toy|to'y|tuy|ports|malenk|naed)", t):
        neg += 2
        if 'Размер порции' not in themes: themes.append('Размер порции')
    if pos and neg and _PAST.search(t): pos = 0                           # «раньше было хорошо, теперь плохо»
    if len(words) <= 2:                                                   # эмодзи считаем только у совсем коротких реплик
        pos += min(2, sum(text.count(e) for e in POS_EMOJI)); neg += min(2, sum(text.count(e) for e in NEG_EMOJI))
    if rating:
        label = 'neg' if rating <= 2 else 'neu' if rating == 3 else 'pos'
        if text.strip() and label == 'pos' and neg > pos + 1: label = 'neu'  # хвалят звёздами, но ругают текстом
    else: label = 'pos' if pos > neg else 'neg' if neg > pos else 'neu'
    if label == 'pos': themes = [k for k, rs in _THP.items() if any(r.search(t) for r in rs)]   # у позитива свои темы: за что хвалят
    return label, themes
