"""Gera public/lib/seed.json (histórico das etapas) a partir da planilha LIGA PRECONBH 2026.

Uso:  python3 tools/build_seed.py [arquivo.xlsx]
Sem argumento, baixa a planilha (precisa estar compartilhada por link).
"""
import sys, json, datetime, urllib.request, os
sys.path.insert(0, os.path.dirname(__file__))
from xlsx import load

SHEET_ID = '1axSzXATvK5_jzlN36Al_H6WfUDp21LWa255BDn5lUBM'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'lib', 'seed.json')

def num(x):
    if x in (None, ''): return None
    return float(str(x).replace(',', '.'))

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else None
    if not path:
        path = os.path.join(ROOT, 'tools', 'liga.xlsx')
        urllib.request.urlretrieve(f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx', path)
    rows = load(path)['tab_registrojogos']
    head, data = rows[0], [r for r in rows[1:] if r and len(r) > 13 and r[4]]
    # Etapa = ordem das datas distintas (a coluna "Etapa Liga" guarda a data da etapa)
    dates = sorted({int(float(r[2])) for r in data})
    etapa = {d: i + 1 for i, d in enumerate(dates)}
    out = []
    for r in data:
        serial = int(float(r[2]))
        date = (datetime.date(1899, 12, 30) + datetime.timedelta(days=serial)).isoformat()
        ap = num(r[14]) if len(r) > 14 else None
        out.append({'season': int(float(r[1])), 'etapa': etapa[serial], 'date': date, 'pos': int(float(r[3])),
                    'player': r[4].strip(), 'deck': (r[5] or '').strip(), 'pts': num(r[6]) or 0,
                    'tb1': num(r[7]) or 0, 'tb2': num(r[8]) or 0, 'tb3': num(r[9]) or 0,
                    'v': int(num(r[11]) or 0), 'e': int(num(r[12]) or 0), 'd': int(num(r[13]) or 0),
                    'ap': int(ap) if ap is not None else None})
    json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=0)
    build_games(out)
    by = {}
    for o in out: by.setdefault(o['etapa'], []).append(o)
    for e in sorted(by):
        print(f"Etapa {e:02d} ({by[e][0]['date']}): {len(by[e])} jogadores, pontos de liga {'ok' if all(o['ap'] is not None for o in by[e]) else 'PENDENTES'}")
    print('->', OUT)

# Mesas de cada rodada (planilha "resultados liga precon 2026", uma linha por jogador em cada mesa).
GAMES_XLSX = os.path.join(ROOT, 'tools', 'mesas-2026.xlsx')
GAMES_OUT = os.path.join(ROOT, 'public', 'lib', 'seed_games.json')

def build_games(hist):
    if not os.path.exists(GAMES_XLSX):
        print('(sem tools/mesas-2026.xlsx: histórico de mesas não gerado)'); return
    canon = {o['player'].lower(): o['player'] for o in hist}   # nome como está no ranking
    rows = [r for r in load(GAMES_XLSX)['Planilha1'][1:] if r and len(r) > 7 and r[4]]
    games = []
    for r in rows:
        rn = int(float(r[2])); pod = str(r[3]).strip()
        name = r[4].strip()
        games.append({'season': int(float(r[0])), 'etapa': int(float(r[1])), 'round': rn,
                      'kind': 'final' if rn == 4 else 'suico', 'pod': 'bye' if pod.lower() == 'bye' else pod,
                      'player': canon.get(name.lower(), name), 'deck': (r[5] or '').strip(), 'result': r[6].strip()})
    json.dump(games, open(GAMES_OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'-> {GAMES_OUT}: {len(games)} participações em mesas')

if __name__ == '__main__':
    main()
