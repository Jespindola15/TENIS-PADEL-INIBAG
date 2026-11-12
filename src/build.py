import base64,json
import os
S=os.path.dirname(os.path.abspath(__file__))+'/'
order=['01_core.js','02_court.js','03_ball.js','04_players.js','05_game.js','06_main.js','07_fx.js','08_online.js']
js=''.join(open(S+f,encoding='utf-8').read()+'\n' for f in order)
head=open(S+'head.html',encoding='utf-8').read().replace('<!--ASSETS-->','')
out=head+js+'\n</script>\n'
open(os.path.join(S,'..','Potrero Raqueta.html'),'w',encoding='utf-8').write(out)
open(os.path.join(S,'..','index.html'),'w',encoding='utf-8').write(out)  # Netlify / GitHub Pages abren index.html
print('size',len(out))
