# Gera public/index.html a partir de src/ (rode: python3 build.py)
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
S = 'src/'
base = open(S + 'base.css').read().replace('</style>', open(S + 'extra.css').read() + '</style>')
logo = 'const LOGO = {claro:"/logo-claro.png", escuro:"/logo-escuro.png"};'
js = (open(S + 'part-core.js').read().replace('/*LOGO*/', logo)
      + open(S + 'parsers.js').read().split('if(typeof module')[0]
      + ''.join(open(S + f).read() for f in ['part-map.js', 'part-label.js', 'part-som.js', 'part-gestor.js', 'part-estoque.js', 'part-exp.js', 'part-main.js']))
html = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>/* celular da separação: sem zoom automático ao focar/desfocar o campo de bipe */ if(/^#s-/.test(location.hash)) document.querySelector('meta[name=viewport]').setAttribute("content","width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no");</script>
<title>Envio Full · Serena</title>
<meta name="theme-color" content="#0F3A4E">
<link rel="icon" type="image/png" href="/icon.png">
<link rel="apple-touch-icon" href="/icon.png">
<meta name="apple-mobile-web-app-title" content="Envio Full">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
{base}
</head>
<body>
<div id="app"></div>
<div id="scanbar" hidden><form id="scanf" autocomplete="off"><input id="scanIn" inputmode="none" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Código da peça" placeholder="Leitor pronto: bipe a peça"><button class="btn" type="submit">OK</button></form></div>
<div id="toast" hidden></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script>
{js}
</script>
</body>
</html>
'''
open('public/index.html', 'w').write(html)
print('public/index.html', len(html), 'bytes')
