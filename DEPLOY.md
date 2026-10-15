# Mickey Studio deployment

The frontend is published as a static Vercel site. The API is a Cloudflare Worker. The browser build copies only `index.html`, `admin.html`, `app.js`, and `style.css` into `dist`, so the PHP source and deployment files are not served as website files.

## Cloudflare Worker

1. Create a KV namespace named `MICKEY_STATE`.
2. Replace the placeholder namespace ID in `wrangler.toml` with its ID.
3. Deploy `worker/index.js` as `mickey-studio-api` with Wrangler or Cloudflare's Git integration.
4. Add `GEMINI_API_KEY` as a Worker secret, or sign in to the site's admin page and add keys there. Do not put provider keys in GitHub or in `wrangler.toml`.
5. Set `ALLOWED_ORIGINS` to the published Vercel origin and any custom site domain.

The Worker URL should end in `/api.php`, for example `https://mickey-studio-api.<account-subdomain>.workers.dev/api.php`.

## Vercel frontend

1. Import the private GitHub repository and set the framework preset to **Other**.
2. Set `MICKEY_API_BASE_URL` as a build environment variable to the Worker URL above.
3. Vercel runs `npm run build:vercel` and publishes `dist`.
4. Add the final Vercel domain to Firebase Authentication's authorized domains.

Firebase config values in the frontend are public web-app identifiers. Provider keys must stay in Worker secrets or its admin-managed KV pool.
