"""Simula um evento completo pela API do servidor de teste (http://127.0.0.1:8770)."""
import json, random, sys, urllib.request, http.cookiejar
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8770'
cj = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def api(a, data=None, **params):
    qs = '&'.join(f'{k}={v}' for k, v in {'a': a, **params}.items())
    req = urllib.request.Request(f'{BASE}/api.php?{qs}', data=None if data is None else json.dumps(data).encode(),
                                 headers={'Content-Type': 'application/json', 'X-Liga': '1'})
    try: r = json.load(op.open(req))
    except urllib.error.HTTPError as e: r = json.load(e)
    return r
def ok(r):
    if 'error' in r: raise SystemExit('ERRO: ' + r['error'])
    return r
random.seed(7)
if api('me')['needs_setup']: ok(api('setup', {'token': 'token-local-de-teste', 'user': 'teste', 'pass': 'senha-teste-123'}))
else: ok(api('login', {'user': 'teste', 'pass': 'senha-teste-123'}))
ev = ok(api('event_save', {'title': 'Simulação Etapa 10', 'etapa': 10, 'date': '2026-10-31', 'start_time': '10:00', 'season': 2026}))['id']
decks = ['Quick Draw', 'Creative Energy', 'Blood Rites', 'Turtle Power!', 'Animated Army', 'Revival Trance', 'Jeskai Striker', 'Counter Blitz']
names = ['Morkan', 'Fabio C', 'Crothen', 'Yasmin', 'Erickpd', 'Campera', 'Lanna', 'TendiNietzsche', 'Bydo', 'ViniCVR',
         'Gabriel P.', 'AndreVL', 'Montezuma', 'caiobmbh', 'Skeeter', 'Karyum', 'Henrique', 'Novato Teste']
anon = urllib.request.build_opener()
for i, n in enumerate(names):
    r = api('register', {'event_id': ev, 'name': n, 'deck': decks[i % len(decks)], 'pin': '1234'})
    if 'error' in r: print('  inscrição', n, '->', r['error'])
print('banido recusado?', api('register', {'event_id': ev, 'name': 'Outro', 'deck': 'Lorehold Spirit', 'pin': '1234'}).get('error'))
ok(api('checkin_all', {'event_id': ev}))
pins_wrong = api('report', {'pod_id': 1, 'entry_id': 1, 'pin': '0000', 'outcome': 'E'})
for rnd in range(1, 4):
    ok(api('round_generate', {'event_id': ev}))
    d = ok(api('event', id=ev)); cur = d['rounds'][-1]
    sizes = [len(p['seats']) for p in cur['pods'] if not int(p['bye'])]; byes = [s['name'] for p in cur['pods'] if int(p['bye']) for s in p['seats']]
    print(f'Rodada {rnd}: mesas {sizes}, bye {byes}')
    for i, p in enumerate(p for p in cur['pods'] if not int(p['bye'])):
        out = 'E' if random.random() < .35 else 'V:' + str(random.choice(p['seats'])['entry_id'])
        if i == 0:   # dois jogadores reportam pelo site -> confirma sozinho
            for s in p['seats'][:2]: r = ok(api('report', {'pod_id': p['id'], 'entry_id': s['entry_id'], 'pin': '1234', 'outcome': out}))
            print('   reporte de jogadores:', r['status'])
        elif i == 1:  # relatos divergentes -> organização decide
            a, b = p['seats'][0], p['seats'][1]
            ok(api('report', {'pod_id': p['id'], 'entry_id': a['entry_id'], 'pin': '1234', 'outcome': 'V:' + str(a['entry_id'])}))
            print('   divergência:', ok(api('report', {'pod_id': p['id'], 'entry_id': b['entry_id'], 'pin': '1234', 'outcome': 'V:' + str(b['entry_id'])}))['status'])
            ok(api('pod_result', {'pod_id': p['id'], 'outcome': out}))
        else: ok(api('pod_result', {'pod_id': p['id'], 'outcome': out}))
    if rnd == 1:   # alguém dropa pelo celular
        me = next(e for e in d['entries'] if e['name'] == 'Novato Teste')
        print('   drop:', ok(api('drop', {'entry_id': me['id'], 'pin': '1234'}))['msg'])
    ok(api('round_close', {'round_id': cur['id']}))
d = ok(api('event', id=ev))
met = {}
for r in d['rounds']:
    for p in r['pods']:
        if int(p['bye']): continue
        ids = [s['entry_id'] for s in p['seats']]
        for a in ids:
            for b in ids:
                if a < b: met[(a, b)] = met.get((a, b), 0) + 1
print('pares que se reencontraram:', sum(1 for v in met.values() if v > 1), 'de', len(met))
print('PIN errado:', pins_wrong.get('error'))
if d['absolute_winner']: print('vitória absoluta:', d['absolute_winner'])
else:
    ok(api('final_generate', {'event_id': ev}))
    d = ok(api('event', id=ev)); fin = d['rounds'][-1]['pods'][0]
    print('mesa final:', [s['name'] for s in fin['seats']])
    ok(api('pod_result', {'pod_id': fin['id'], 'outcome': 'V:' + str(fin['seats'][-1]['entry_id'])}))
    ok(api('round_close', {'round_id': d['rounds'][-1]['id']}))
pv = ok(api('close_preview', event_id=ev))
print('colocação:', [(r['pos'], r['name'], r['pts'], r['ap']) for r in pv['rows'][:9]], pv['note'])
ok(api('event_close', {'event_id': ev}))
s = ok(api('season', season=2026))
print('ranking após etapa 10:', [(p['rk'], p['n'], p['tot']) for p in s['pl'][:5]])
print('etapas no histórico:', sorted({r['et'] for r in s['reg']}))
print('EVENT_ID', ev)
