# Universal Cloudflare Workers Deployment Playbook

A complete, beginner-friendly, step-by-step playbook for deploying modern serverless TypeScript/JavaScript APIs to **Cloudflare Workers** using **Hono** and the **Wrangler CLI**.

This guide is designed to be **reusable for any project** (monorepos, standalone APIs, microservices, or full-stack apps).

---

## Table of Contents
1. [Core Concepts & Mental Model](#1-core-concepts--mental-model)
2. [Project Setup & Dependencies](#2-project-setup--dependencies)
3. [The `wrangler.toml` Configuration File](#3-the-wranglertoml-configuration-file)
4. [Authentication: Wrangler CLI & API Tokens](#4-authentication-wrangler-cli--api-tokens)
5. [Storage Primitives: KV & D1 Database](#5-storage-primitives-kv--d1-database)
6. [Managing Secrets (`wrangler secret put`)](#6-managing-secrets-wrangler-secret-put)
7. [Deploying to Production](#7-deploying-to-production)
8. [Real-World Gotchas & Troubleshooting](#8-real-world-gotchas--troubleshooting)
9. [Automating with CI/CD (GitHub Actions)](#9-automating-with-cicd-github-actions)
10. [Wrangler Commands Cheatsheet](#10-wrangler-commands-cheatsheet)

---

## 1. Core Concepts & Mental Model

### Why Cloudflare Workers?
| Traditional Containers (AWS ECS / Heroku / Docker) | Cloudflare Workers (V8 Isolates) |
| :--- | :--- |
| Deployed in 1 specific data center (e.g. Virginia). | Distributed to **330+ cities worldwide** automatically. |
| Cold starts take 2 to 10 seconds. | Cold starts take **under 5 milliseconds** (effectively zero). |
| High baseline cost for idle servers. | **Free 100,000 requests/day**, pay only per execution millisecond. |
| Needs Dockerfiles, OS patches, port bindings. | Pure serverless JavaScript/TypeScript code. |

### How It Works Under the Hood
1. **V8 Isolates**: Workers runs lightweight sandboxed execution environments inside Google V8 (the same engine inside Chrome and Node.js). Thousands of isolates share one process securely, which eliminates container overhead.
2. **Anycast Routing**: All requests share one global IP network. When a user in London visits your API, their request is terminated at the London edge data center nearest to them.

---

## 2. Project Setup & Dependencies

For any project, your backend API directory should have the following minimum dependencies:

### 2.1 Install Dependencies
```bash
# Core framework
npm install hono

# Dev dependencies for TypeScript, bundling & Cloudflare types
npm install -D wrangler typescript @cloudflare/workers-types @types/node
```

### 2.2 Standard `package.json` Scripts
```json
{
  "name": "my-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "build": "tsc --noEmit",
    "tail": "wrangler tail"
  }
}
```

### 2.3 Minimal Hono API Entrypoint (`src/index.ts`)
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Bindings {
  MY_KV?: KVNamespace;
  DB?: D1Database;
  MY_SECRET_KEY?: string;
  APP_ENV?: string;
}

export const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS so your web/mobile/desktop clients can talk to this API
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Device-Id']
}));

// Health check endpoint
app.get('/health', (c) => c.json({
  status: 'ok',
  service: 'my-api',
  timestamp: new Date().toISOString()
}));

export default app;
```

---

## 3. The `wrangler.toml` Configuration File

Create `wrangler.toml` in your API root directory. This tells Cloudflare how to build, name, and bind resources to your Worker.

```toml
# Name of your worker on Cloudflare
name = "my-project-api"

# TypeScript entrypoint
main = "src/index.ts"

# Cloudflare runtime compatibility date (use current or recent date)
compatibility_date = "2025-03-01"

# Enable modern Node.js compatibility (Buffer, crypto, streams, etc.)
compatibility_flags = ["nodejs_compat"]

# Public environment variables (plain text, NOT secrets)
[vars]
APP_ENV = "production"
API_VERSION = "v1"

# (Optional) Workers KV Namespace Binding
# [[kv_namespaces]]
# binding = "MY_KV"
# id = "<kv_namespace_id>"

# (Optional) Cloudflare D1 Database Binding
# [[d1_databases]]
# binding = "DB"
# database_name = "my-project-db"
# database_id = "<d1_database_id>"
```

---

## 4. Authentication: Wrangler CLI & API Tokens

Before you can run Wrangler commands against your Cloudflare account, authenticate using one of the following methods:

### Method A: Interactive Browser Login (Best for Local Development)
Run:
```bash
npx wrangler login
```
This opens your browser to `dash.cloudflare.com`. Click **Allow**. Your credentials will be saved locally in `~/.config/.wrangler` or `~/Library/Preferences/.wrangler`.

---

### Method B: Cloudflare API Token (Best for CI/CD, Scripts & Headless Systems)
1. Go to **[Cloudflare Dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens)**.
2. Click **Create Token**.
3. You can start with the **"Edit Cloudflare Workers"** template, or click **Create Custom Token** with the following permissions:
   - `Account` → `Workers Scripts` → `Edit`
   - `Account` → `Workers KV Storage` → `Edit`
   - `Account` → `D1` → `Edit` *(if using D1 databases)*
   - `User` → `Memberships` → `Read`
4. Copy the generated token.
5. In your project `.env` file (or terminal export):
   ```bash
   export CLOUDFLARE_API_TOKEN="your_token_here"
   ```
6. Verify your connection anytime:
   ```bash
   npx wrangler whoami
   ```

---

## 5. Storage Primitives: KV & D1 Database

Cloudflare offers built-in serverless edge storage that binds directly to your Worker code without connection pools or TCP connection latency.

### 5.1 Workers KV (Key-Value Store)
- **Best for**: Daily quotas, user sessions, cache counters, configuration flags.
- **Latency**: Sub-10ms globally.

#### Step 1: Create the KV namespace
```bash
npx wrangler kv namespace create MY_KV
```
Wrangler will output:
```toml
[[kv_namespaces]]
binding = "MY_KV"
id = "b41b26b9843b4df99a798cb6f73805e8"
```

#### Step 2: Paste into `wrangler.toml`
Add the block directly into `wrangler.toml`.

#### Step 3: Use it in your Hono code
```typescript
app.get('/quota/:id', async (c) => {
  const id = c.req.param('id');
  // Read from KV
  const count = await c.env.MY_KV.get(`user:${id}`);
  
  // Write to KV (with optional expiration in seconds)
  await c.env.MY_KV.put(`user:${id}`, String(Number(count || 0) + 1), {
    expirationTtl: 86400 // 24 hours
  });
  
  return c.json({ count });
});
```

---

### 5.2 Cloudflare D1 (Serverless SQLite Database)
- **Best for**: Structured relational data, users, transaction history, audit logs.
- **SQL dialect**: SQLite with native TypeScript bindings.

#### Step 1: Create the D1 Database
```bash
npx wrangler d1 create my-project-db
```
Wrangler will output:
```toml
[[d1_databases]]
binding = "DB"
database_name = "my-project-db"
database_id = "xxxx-xxxx-xxxx"
```

#### Step 2: Paste into `wrangler.toml`
Add the block directly into `wrangler.toml`.

#### Step 3: Run Database Schema Migrations
Create `schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
Execute it against your live remote D1 database:
```bash
npx wrangler d1 execute my-project-db --remote --file=./schema.sql
```

#### Step 4: Use it in your Hono code
```typescript
app.get('/users', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  return c.json({ users: results });
});
```

---

## 6. Managing Secrets (`wrangler secret put`)

> [!WARNING]
> **NEVER put API keys or secrets in `wrangler.toml` or commit them to Git.**
> `[vars]` in `wrangler.toml` is visible to anyone with access to the repo.

### Interactive Secret Creation
```bash
npx wrangler secret put OPENAI_API_KEY
# Enter your secret when prompted
```

### Automated / Piped Secret Creation from `.env`
If you already have your secrets in a local `.env` file, pipe them safely:
```bash
echo "$OPENAI_API_KEY" | npx wrangler secret put OPENAI_API_KEY
echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET
```

### Accessing Secrets in Code
Secrets automatically appear inside your Hono context (`c.env.<SECRET_NAME>`):
```typescript
const apiKey = c.env.OPENAI_API_KEY;
```

---

## 7. Deploying to Production

### Step 1: Register your `workers.dev` Subdomain (First-Time Only)
The first time you deploy on a Cloudflare account, Cloudflare will ask you to choose a free global subdomain:
```
https://<worker-name>.<your-subdomain>.workers.dev
```
Choose a clean name (e.g., `yourname` or `yourcompany`).

### Step 2: Deploy
```bash
npx wrangler deploy
```
Wrangler will:
1. Bundle your TypeScript with `esbuild`.
2. Package all static assets and bindings.
3. Upload the bundle to Cloudflare's edge in 2–5 seconds.
4. Output your live production URL:
   ```
   https://my-project-api.your-subdomain.workers.dev
   ```

### Step 3: Verify the Live Deployment
```bash
curl https://my-project-api.your-subdomain.workers.dev/health
# Expected: {"status":"ok","service":"my-api","timestamp":"..."}
```

---

## 8. Real-World Gotchas & Troubleshooting

### Gotcha 1: SSL Handshake Error (Curl Code 35) Right After First Deploy
- **Symptom**: `curl: (35) LibreSSL: error:1404B410:SSL routines:ST_CONNECT:sslv3 alert handshake failure`.
- **Cause**: When a new `*.workers.dev` subdomain is created, Cloudflare's Universal SSL certificate is generated across 330+ edge data centers.
- **Solution**: HTTP (`http://...`) will work immediately. Universal SSL issuance takes **1 to 3 minutes**. Simply wait 2 minutes, and HTTPS will connect automatically.

### Gotcha 2: `Buffer is not defined` or `crypto is not defined`
- **Symptom**: `ReferenceError: Buffer is not defined` at runtime.
- **Cause**: Workers runs on V8, not standard Node.js.
- **Solution**: Add `compatibility_flags = ["nodejs_compat"]` to your `wrangler.toml`. This enables Node.js standard libraries (`Buffer`, `crypto`, `events`, `util`, `stream`) with zero extra bundle weight.

### Gotcha 3: D1 Database Creation `Authentication error [code: 10000]`
- **Symptom**: `wrangler d1 create` fails with error code 10000 when using an API Token.
- **Cause**: The default Cloudflare token template "Edit Cloudflare Workers" only includes KV and Scripts permissions; D1 is a separate permission scope.
- **Solution**: In Cloudflare Dashboard → API Tokens → edit your token and add `Account` → `D1` → `Edit`.

### Gotcha 4: Missing Request Body in CORS Preflight
- **Symptom**: Frontend calls receive CORS errors on `POST` requests.
- **Solution**: Always place Hono's `cors()` middleware before any route handlers in `src/index.ts`, and ensure `allowHeaders` includes custom headers like `X-Device-Id` or `Authorization`.

---

## 9. Automating with CI/CD (GitHub Actions)

To automatically deploy whenever you push code to `main`:

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy Cloudflare Worker

on:
  push:
    branches:
      - main
    paths:
      - 'apps/api/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: 'apps/api'
          command: deploy
```

Add your `CLOUDFLARE_API_TOKEN` to your **GitHub Repository Settings → Secrets and variables → Actions**.

---

## 10. Wrangler Commands Cheatsheet

| Command | What it does |
| :--- | :--- |
| `npx wrangler dev` | Starts local edge simulator on `https://select-check-api.santheepkumar.workers.dev` with live reload. |
| `npx wrangler dev --remote` | Runs local code connected to real remote Cloudflare KV / D1 resources. |
| `npx wrangler deploy` | Bundles and deploys worker to global production edge. |
| `npx wrangler tail` | Streams live production logs and console output directly in your terminal. |
| `npx wrangler secret put <KEY>` | Securely saves an encrypted secret to Cloudflare's vault. |
| `npx wrangler secret list` | Lists all encrypted secret variable names attached to the worker. |
| `npx wrangler kv namespace list` | Lists all Cloudflare KV namespaces in your account. |
| `npx wrangler kv key get --binding=<BINDING> <KEY>` | Inspects the value of a specific KV key. |
| `npx wrangler d1 list` | Lists all Cloudflare D1 databases in your account. |
| `npx wrangler d1 execute <DB> --remote --command="SELECT ..."` | Runs an arbitrary SQL query against production D1. |

---

*Authored for SelectCheck — Reusable across any modern Web, Mobile, or Desktop cloud backend project.*
