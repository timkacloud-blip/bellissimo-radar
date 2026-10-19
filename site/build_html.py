import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
css=open('base.css').read().replace('<style>','').replace('</style>','').replace('/* Layout: sticky glass header with lightning canvas → segmented tabs → one panel per tab, cards on a 12-col grid */','')
open('index.html','w').write('<meta charset="utf-8">\n<title>Competitor Radar</title>\n<meta name="description" content="Конкуренты Bellissimo: реклама Meta, офферы, приложения и Telegram — ежедневно">\n<style>'+css+open('extra.css').read()+'</style>\n'+open('body.html').read())
