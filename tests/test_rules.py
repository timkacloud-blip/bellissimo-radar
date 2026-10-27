#!/usr/bin/env python3
"""Checks the text rules (offer type, prices, promo codes) on hand-checked examples in tests/rules_cases.json.
Add a line there every time a wrong offer or price is found on the site. Exit code 1 if anything is wrong."""
import json, os, sys
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(H, '..', 'collector'))
from rules import tags, primary, price_items, codes  # noqa: E402
C = json.load(open(os.path.join(H, 'rules_cases.json'), encoding='utf-8')); bad = []
for t, want in C['tags']:
    got = primary(tags(t))
    if got != want: bad.append(f'оффер: «{t}» → {got}, нужно {want}')
for t, want in C['prices']:
    got = [[x['p'], x['c']] for x in price_items(t)]
    if got != want: bad.append(f'цена: «{t}» → {got}, нужно {want}')
for t, want in C['codes']:
    got = codes(t)
    if got != want: bad.append(f'промокод: «{t}» → {got}, нужно {want}')
n = sum(len(v) for v in C.values())
print(f'правила: {n - len(bad)} из {n} примеров верно')
for b in bad: print('  ✗', b)
sys.exit(1 if bad else 0)
