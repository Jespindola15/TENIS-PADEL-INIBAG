# Online con Cloudflare

El modo online usa un Worker de Cloudflare como sala: cada partida es una sala con un código de 4 letras.
El mismo Worker también publica el juego, así que con un solo link se juega y se juega online.

## Publicarlo (una sola vez)

Necesitás Node.js instalado (https://nodejs.org, versión LTS) y Python.

En una terminal, dentro de esta carpeta:

```
npm install
npx wrangler login
npm run deploy
```

`wrangler login` abre el navegador para que autorices tu cuenta de Cloudflare.
Al terminar, `deploy` muestra la dirección del juego, algo como:

    https://potrero-raqueta.TU-USUARIO.workers.dev

Abrí esa dirección, tocá **Crear partida** y pasale el código a tu amigo, que lo escribe y toca **Unirse**.

## Actualizar

Cada vez que cambies algo: `npm run deploy`.

## Usarlo también desde Netlify

1. Creá un archivo `online_url.txt` con la dirección del Worker (por ejemplo `https://potrero-raqueta.TU-USUARIO.workers.dev`).
2. Corré `python src/build.py`, hacé commit y push.

Así la página de Netlify también se conecta al servidor de Cloudflare.

## Costo

El plan gratis de Cloudflare alcanza para jugar varias horas por día.
Cada partida usa una sala que se cierra sola cuando los dos jugadores se van.
