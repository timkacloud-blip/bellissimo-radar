#!/bin/bash
# Builds the static site into _site from data/raw. Used by the GitHub Action and for local tests.
set -e
cd "$(dirname "$0")"
rm -rf _site 2>/dev/null || true; mkdir -p _site/data && cp site/* _site/
python3 collector/comp_build.py data/raw _site
[ -f collector/journal.py ] && python3 collector/journal.py data _site || true
python3 _site/build_html.py
python3 - <<'PY'
import os
p='_site/index.html'; s=open(p,encoding='utf-8').read()
open(p,'w',encoding='utf-8').write('<!doctype html>\n<html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1">\n'+s+'\n</html>')
for f in ['body.html','base.css','extra.css','build_html.py']:
    try: os.remove('_site/'+f)
    except OSError: pass
open('_site/.nojekyll','w').close()
PY
ls -la _site _site/data
