"""Gera dist/liga.zip para extrair em public_html/mtg/: página do ranking (index.html + ranking/) e o sistema (liga/)."""
import os, shutil, secrets, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dist = os.path.join(ROOT, 'dist', 'liga')
shutil.rmtree(os.path.join(ROOT, 'dist'), ignore_errors=True)
shutil.copytree(os.path.join(ROOT, 'public'), dist)
cfg = os.path.join(dist, 'lib', 'config.php')
s = open(cfg).read()
token = secrets.token_urlsafe(18)
open(cfg, 'w').write(s.replace('__SETUP_TOKEN__', token))
# Versão nos arquivos (?v=...) para o navegador baixar de novo quando mudarem
import hashlib, re
for page in ('index.html', 'admin.html', 'tv.html'):
    hp = os.path.join(dist, page)
    html = open(hp).read()
    def ver(m):
        f = os.path.join(dist, m.group(1))
        return m.group(1) + '?v=' + hashlib.md5(open(f, 'rb').read()).hexdigest()[:8]
    html = re.sub(r'(assets/[\w.-]+\.(?:css|js))', ver, html)
    open(hp, 'w').write(html)
# Página do ranking (raiz da pasta mtg): index.html + ranking/ (css, js, dados 2025, artes)
rk_src = os.path.join(ROOT, 'ranking')
rk_dst = os.path.join(ROOT, 'dist', 'mtg')
shutil.copytree(rk_src, rk_dst, dirs_exist_ok=True)
shutil.move(dist, os.path.join(rk_dst, 'liga'))
dist = os.path.join(rk_dst, 'liga')
hp = os.path.join(rk_dst, 'index.html')
html = open(hp).read()
html = re.sub(r'(ranking/[\w.-]+\.(?:css|js))', lambda m: m.group(1) + '?v=' + hashlib.md5(open(os.path.join(rk_dst, m.group(1)), 'rb').read()).hexdigest()[:8], html)
open(hp, 'w').write(html)
z = os.path.join(ROOT, 'dist', 'liga.zip')
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
    for base, _, files in os.walk(rk_dst):
        for f in files:
            p = os.path.join(base, f)
            zf.write(p, os.path.relpath(p, rk_dst))
print('->', z, '(página do ranking + sistema; token de configuração em liga/lib/config.php)')
