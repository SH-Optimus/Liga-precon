import zipfile,re,xml.etree.ElementTree as ET
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def load(path):
    z=zipfile.ZipFile(path)
    ss=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t'%NS['m'])))
    wb=ET.fromstring(z.read('xl/workbook.xml'))
    rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rmap={r.get('Id'):r.get('Target') for r in rels}
    sheets={}
    for s in wb.find('m:sheets',NS):
        tgt=rmap[s.get('{%s}id'%NS['r'])]
        tgt=tgt.lstrip('/'); tgt=tgt if tgt.startswith('xl/') else 'xl/'+tgt
        rows=[]
        for row in ET.fromstring(z.read(tgt)).iter('{%s}row'%NS['m']):
            cells={}
            for c in row.findall('m:c',NS):
                ref=c.get('r');col=re.match(r'[A-Z]+',ref).group(0)
                ci=0
                for ch in col: ci=ci*26+ord(ch)-64
                v=c.find('m:v',NS);t=c.get('t')
                if t=='s' and v is not None: val=ss[int(v.text)]
                elif t=='inlineStr': val=''.join(x.text or '' for x in c.iter('{%s}t'%NS['m']))
                else: val=v.text if v is not None else None
                cells[ci-1]=val
            if cells:
                rows.append([cells.get(i) for i in range(max(cells)+1)])
        sheets[s.get('name')]=rows
    return sheets
