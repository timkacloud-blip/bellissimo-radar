#!/usr/bin/env python3
"""Takes the rows the Mac collected (Instagram, ad comments, Telegram, YouTube) from data/mentions_mac.json and puts them into the shared DB."""
import json, os, sqlite3, sys
DB, F = sys.argv[1], sys.argv[2]
if not os.path.exists(F): print('no mac file'); sys.exit(0)
x = json.load(open(F, encoding='utf-8')); db = sqlite3.connect(DB, timeout=60)
cols = x['cols']; ph = ','.join('?' * len(cols))
n = 0
for r in x['items']:
    db.execute(f'INSERT OR REPLACE INTO items({",".join(cols)}) VALUES({ph})', r); n += 1
for r in x.get('status', []): db.execute('INSERT OR REPLACE INTO status VALUES (?,?,?,?,?)', r)
for r in x.get('snap', []): db.execute('INSERT OR REPLACE INTO snap VALUES (?,?,?,?)', r)
db.commit(); print('imported from Mac:', n, 'items, exported', x.get('at'))
