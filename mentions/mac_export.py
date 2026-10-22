#!/usr/bin/env python3
"""Runs on the Mac. Writes the rows of the Mac-only sources (last 21 days) to mac_export.json; publish_gh.py uploads it to the repo."""
import json, os, sqlite3, datetime as dt
H = os.path.dirname(os.path.abspath(__file__)); db = sqlite3.connect(os.path.join(H, 'mentions_data.db'))
TZ = dt.timezone(dt.timedelta(hours=5)); since = str(dt.datetime.now(TZ).date() - dt.timedelta(days=21))
cols = [r[1] for r in db.execute('PRAGMA table_info(items)')]
items = [list(r) for r in db.execute(f"SELECT {','.join(cols)} FROM items WHERE source IN ('ig','ads','tg','yt') AND date>=?", [since])]
MAC = ('ig', 'ads', 'igc', 'tg', 'tgw', 'yt')
status = [list(r) for r in db.execute('SELECT * FROM status') if r[0] in MAC]
snap = [list(r) for r in db.execute('SELECT * FROM snap WHERE source NOT LIKE "play%" AND source NOT LIKE "appstore%" AND date>=?', [since])]
json.dump({'at': dt.datetime.now(TZ).strftime('%Y-%m-%d %H:%M'), 'cols': cols, 'items': items, 'status': status, 'snap': snap}, open(os.path.join(H, 'mac_export.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('export', len(items), 'items')
