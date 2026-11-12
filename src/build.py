# Arma el juego en un solo HTML a partir de src/ y lo deja en:
#   index.html               (Netlify / GitHub Pages)
#   Potrero Raqueta.html     (para abrir directo)
#   public/index.html        (lo que publica el Worker de Cloudflare)
# Si existe online_url.txt con la dirección del Worker (https://...workers.dev),
# la página la usa para el modo online cuando se abre desde otro lado (por ejemplo Netlify).
import os
S=os.path.dirname(os.path.abspath(__file__))+'/'
R=os.path.join(S,'..')
order=['01_core.js','02_court.js','03_ball.js','04_players.js','05_game.js','06_main.js','07_fx.js','08_online.js']
js=''.join(open(S+f,encoding='utf-8').read()+'\n' for f in order)
cfg=''
u=os.path.join(R,'online_url.txt')
if os.path.exists(u):
    url=open(u,encoding='utf-8').read().strip()
    if url: cfg='<script>window.POTRERO_ONLINE_URL='+repr(url).replace("'",'"')+';</script>'
head=open(S+'head.html',encoding='utf-8').read().replace('<!--ASSETS-->',cfg)
out=head+js+'\n</script>\n'
os.makedirs(os.path.join(R,'public'),exist_ok=True)
for name in ['index.html','Potrero Raqueta.html',os.path.join('public','index.html')]:
    open(os.path.join(R,name),'w',encoding='utf-8').write(out)
print('listo',len(out),'bytes')
