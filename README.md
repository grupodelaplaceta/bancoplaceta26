# Banco de La Placeta — Web

Banca en línea ciudadana, **igualito a la app** (banco-app Android). Solo consume la API real `api.banco.laplaceta.org` (backend-banco, fuente de verdad en MongoDB).

## Seguridad
- Login con **PlacetaID** (redirect + callback con token JWT) y 2FA gestionado por PlacetaID.
- El token **nunca llega al navegador**: viaja en cookie `HttpOnly` corta (1h) y todas las llamadas al banco se hacen **server-side**.
- **Scoping por propietario**: la API `/api/web/*` solo devuelve datos del titular autenticado; IBAN y tarjetas enmascarados; `no-store` en todas las respuestas.
- Sin bulk data en el DOM: cada página pinta solo lo del usuario.

## Funcionalidades (FASE 2)
- Inicio: cuentas y saldo.
- Movimientos (últimos, entrada/salida).
- Tarjetas digitales (número enmascarado, sin PIN).
- Gestores y cotitulares.
- Cumplimiento (censo, flags, estado IRM).
- Normativa: valores oficiales del CNI-BANCO en vivo desde el BOLP (`/normativa`, server-side).
- Transferencia: solicitud **pendiente** (requiere confirmación en PlacetaID Móvil; no mueve saldos hasta confirmarse).

## Puesta en marcha local
```bash
npm install
cp .env.example .env   # ajusta APP_URL si cambia el puerto
npm start              # http://localhost:3003
```

## Despliegue (Vercel)
- Repo propio con `vercel.json` (rewrite a `api/index.js`).
- Variables: `APP_URL`, `PLACETA_ID_BASE_URL`, `BANCO_API_URL`.

## API consumida
- `GET /api/web/cuenta` · `GET /api/web/movimientos` · `GET /api/web/tarjetas`
- `GET /api/web/gestores` · `GET /api/web/cumplimiento` · `GET /api/web/contactos`
- `POST /api/web/transferencia` (crea operación pendiente)
