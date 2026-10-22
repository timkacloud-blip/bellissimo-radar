#!/usr/bin/env python3
"""DB -> site/mentions_data.json (the Mentions tab reads it straight from the repo). Usage: build.py DB OUT"""
import sys, sqlite3, datetime as dt
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import facts
TZ = dt.timezone(dt.timedelta(hours=5))
db = sqlite3.connect(sys.argv[1]); facts.write(db, dt.datetime.now(TZ).date(), TZ, sys.argv[2]); print('built', sys.argv[2])
