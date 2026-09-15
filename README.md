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
- **Alta con PlacetaID** (`/registro`): cualquier DIP válido puede abrirse cuenta. Si el DIP
  ya tiene cuentas en el banco, solo se vincula la identidad (no se duplica nada);
  los menores de edad quedan registrados pero la cuenta la abre un tutor legal.

## Puesta en marcha local
```bash
npm install
cp .env.example .env   # ajusta APP_URL si cambia el puerto
npm start              # http://localhost:3003
```

## Despliegue (Vercel)
- Repo propio con `vercel.json` (rewrite a `api/index.js`).
- Variables obligatorias/recomendadas:
  - `APP_URL=https://bancoplaceta26.vercel.app` (o el dominio de producción configurado).
  - `PLACETA_ID_CLIENT_ID=79d7087aa027fac0250e832c4b5d39b2` (solicitante registrado en PlacetaID; si PlacetaID asigna otro ID al banco, sustituirlo).
  - `PLACETA_ID_BASE_URL=https://id.laplaceta.org`.
  - `BANCO_API_URL=https://api.banco.laplaceta.org`.
- El login envía a PlacetaID `client_id`, `redirect_uri`, `platform=web` y `from`.
- El callback se calcula con `APP_URL`; si falta, usa `VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL`. Solo en desarrollo local usa `http://localhost:3003`. Nunca se genera localhost en producción.

## API consumida
- `GET /api/web/cuenta` · `GET /api/web/movimientos` · `GET /api/web/tarjetas`
- `GET /api/web/gestores` · `GET /api/web/cumplimiento` · `GET /api/web/contactos`
- `POST /api/web/transferencia` (crea operación pendiente)
- `GET /api/web/registro` (consulta por DIP) · `POST /api/web/registro` (alta/vinculación)
