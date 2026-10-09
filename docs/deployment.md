# Backend Deploy

## Railway

Railway is the recommended backend host for this project. Keep Vercel for the frontend, and deploy `backend-node/` as a separate Railway service.

1. Push this repository to GitHub.
2. In Railway, create a new project from the GitHub repo.
3. Set the service root directory to `backend-node`.
4. Railway will use `backend-node/railway.toml` and start the API with `npm start`.
5. Add environment variables in Railway:
   - `NODE_ENV=production`
   - `ANTHROPIC_API_KEY=...` if the chat AI should call Claude
6. After deploy, copy the Railway backend URL.
7. In Vercel, add this frontend environment variable:
   - `VITE_API_URL=https://your-backend.up.railway.app`
8. Redeploy the Vercel frontend.

Health check:

```text
GET https://your-backend.up.railway.app/health
```

Expected response:

```json
{ "status": "ok" }
```

Local backend:

```bash
cd backend-node
npm install
npm start
```
