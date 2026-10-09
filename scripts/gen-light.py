# Gera src/theme-light.css: para cada regra de src/index.css com cor "de tema escuro" fixa no código,
# cria a mesma regra sob html[data-theme="light"] com a cor equivalente no tema claro.
import re
src = open('src/index.css').read()
src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
TEXT = '#3d2e1c'
MAP = [
  (r'#(ddd0bb|e9dfcd|e8dcc4|d9ccb6|d8cbb5|f5ede0|ffe7a8)\b', TEXT),
  (r'#(86efac|bbf7d0|dcfce7)\b', '#15803d'),
  (r'#(fcd34d|fbbf24)\b', '#a16207'),
  (r'#(fca5a5|fecaca|fde2e2)\b', '#b91c1c'),
  (r'#(15110c|120f0b|0f0b08|0e0b08|0d0b09)\b', '#fffaf2'),
  (r'#(1b140d|17110b)\b', '#fffdf8'),
  (r'rgba\((?:8,7,7|10,8,7|18,14,10),\s*(\.\d+)\)', lambda m: f'rgba(255,253,248,{min(0.95, float(m.group(1)) + 0.3):.2f})'),
  (r'rgba\(0,0,0,\s*\.(35|5|6)\)', 'rgba(110,70,20,.14)'),
  (r'rgba\(0,0,0,\s*\.55\)', 'rgba(60,40,15,.35)'),
  (r'rgba\(255,255,255,\s*\.(02|015|03)\)', 'rgba(161,84,8,.04)'),
  (r'rgba\(253,239,137,\s*\.(06|08|16)\)', 'rgba(255,255,255,.5)'),
  (r'rgba\(232,220,196,\s*\.35\)', 'rgba(61,46,28,.3)'),
]
out = []
def conv(decls):
  res = []
  for d in decls.split(';'):
    if ':' not in d: continue
    nd = d
    for pat, rep in MAP: nd = re.sub(pat, rep, nd)
    if nd != d: res.append(nd.strip())
  return res
def walk(css, wrap=None):
  i = 0
  while i < len(css):
    j = css.find('{', i)
    if j < 0: break
    sel = css[i:j].strip()
    if sel.startswith('@'):
      # bloco aninhado
      depth, k = 1, j + 1
      while depth and k < len(css):
        depth += {'{': 1, '}': -1}.get(css[k], 0); k += 1
      if sel.startswith(('@media', '@container', '@supports')): walk(css[j + 1:k - 1], sel)
      i = k; continue
    k = css.find('}', j)
    decls = conv(css[j + 1:k])
    if decls and not sel.startswith(('from', 'to', '0%', '100%')) and not re.match(r'^[\d.%, ]+$', sel):
      sels = ','.join(f'html[data-theme="light"] {s.strip()}' if not s.strip().startswith(('html', 'body', ':root')) else f'html[data-theme="light"] {s.strip()}'.replace(' html', '').replace(' body', ' body') for s in sel.split(','))
      rule = f'{sels}{{{";".join(decls)}}}'
      out.append(f'{wrap}{{{rule}}}' if wrap else rule)
    i = k + 1
walk(src)
open('src/theme-light.gen.css', 'w').write('/* GERADO por scripts/gen-light.py — não edite à mão */\n' + '\n'.join(out) + '\n')
print(len(out), 'regras')
