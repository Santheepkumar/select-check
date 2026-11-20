# How to Redeploy the API with Changes

This guide gives you the exact, step-by-step workflow for modifying, testing, deploying, and monitoring changes to your **SelectCheck Cloudflare Worker API** (`apps/api`).

---

## ⚡ The Quick 30-Second Summary

If you just made code changes and want to deploy immediately:

```bash
# 1. Run tests to make sure your changes pass
pnpm --filter @select-check/api test

# 2. Deploy to Cloudflare Workers
pnpm --filter @select-check/api deploy

# 3. Verify the live health check
curl https://select-check-api.santheepkumar.workers.dev/health
```

---

## 📋 Complete Step-by-Step Workflow

### Step 1: Make Your Code Changes
All API source code lives in `apps/api/src/`:
- **Routes**:
  - `apps/api/src/routes/check.ts`: AI grammar check & quota logic
  - `apps/api/src/routes/auth.ts`: Email OTP & JWT token issuance
- **Services**:
  - `apps/api/src/services/openai.ts`: Prompts, OpenAI model calls, and local heuristic suggestions
  - `apps/api/src/services/quota.ts`: KV rate limiting & daily reset logic
- **Types & App Routing**:
  - `apps/api/src/types.ts`: Environment bindings
  - `apps/api/src/index.ts`: CORS headers & main Hono router

---

### Step 2: Test Locally Before Deploying

#### Option A: Quick Dev Server (Fastest)
From the project root:
```bash
pnpm dev:api
```
This runs the lightweight TypeScript dev server on `http://localhost:8787`.

#### Option B: Cloudflare Edge Simulator (`wrangler dev`)
To test with simulated Cloudflare Worker bindings (like KV and request isolates):
```bash
cd apps/api
npx wrangler dev
```

#### Test your local changes with `curl`:
```bash
curl http://localhost:8787/health
```

---

### Step 3: Run the Automated Test Suite
Before deploying to production, ensure you haven't broken any route contracts or quota rules:

```bash
# Test only the API:
pnpm --filter @select-check/api test

# Or run tests across the whole monorepo:
pnpm test
```

---

### Step 4 (Optional): Handle Special Changes

#### A. If you added a new npm package:
```bash
pnpm --filter @select-check/api add <package-name>
```

#### B. If you changed an environment variable or model name:
Edit `apps/api/wrangler.toml`:
```toml
[vars]
OPENAI_MODEL = "gpt-4o-mini"
FREE_DAILY_LIMIT = "10"
AUTH_DAILY_LIMIT = "100"
```
*(Variables under `[vars]` take effect automatically on your next deploy).*

#### C. If you need to update a secret (API Key or JWT Secret):
Secrets are not stored in `wrangler.toml`. Update them directly with:
```bash
cd apps/api
npx wrangler secret put OPENAI_API_KEY
# or pipe from .env:
echo "$NEW_API_KEY" | npx wrangler secret put OPENAI_API_KEY
```

---

### Step 5: Deploy to Cloudflare Workers

Run the deploy command from either the project root or the `apps/api` folder:

#### From Workspace Root:
```bash
pnpm --filter @select-check/api deploy
```

#### Or from `apps/api`:
```bash
cd apps/api
npx wrangler deploy
```

#### What happens during deployment:
1. **Bundling**: Wrangler runs `esbuild` to compile your TypeScript and minify dependencies into a single ultra-compact file (`~120 KB`).
2. **Upload**: The bundle is uploaded to Cloudflare's global network.
3. **Distribution**: Cloudflare distributes the new version to **330+ edge locations** in under 5 seconds.
4. **Zero Downtime**: The transition is instantaneous. In-flight requests finish on the previous version, and new incoming requests hit the updated code immediately.

Example terminal output:
```text
Total Upload: 119.79 KiB / gzip: 29.34 KiB
Worker Startup Time: 9 ms
Uploaded select-check-api (5.27 sec)
Deployed select-check-api triggers (0.97 sec)
  https://select-check-api.santheepkumar.workers.dev
Current Version ID: 89346ad6-0300-4522-9675-c5021e70145d
```

---

### Step 6: Verify the Live API

Verify your changes against the live edge URL:

#### 1. Check Health:
```bash
curl https://select-check-api.santheepkumar.workers.dev/health
```

#### 2. Test Grammar Check:
```bash
curl -X POST https://select-check-api.santheepkumar.workers.dev/v1/check \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: test_cli" \
  -d '{"text": "me and him goes to store", "deviceId": "test_cli"}'
```

---

### Step 7: Live Real-Time Logs (`wrangler tail`)

If something doesn't work as expected in production or you want to see incoming requests live:

```bash
cd apps/api
npx wrangler tail
```

This streams real-time logs from every edge data center in the world directly to your terminal. Whenever an app makes a request, you will see:
- Request method, URL, and status code (e.g. `POST /v1/check 200 OK`).
- Execution duration in milliseconds.
- Any `console.log()` statements you put in your code.
- Uncaught error stack traces.

Press `Ctrl + C` to stop watching.

---

### Step 8: Emergency Rollback (If something goes wrong)

Cloudflare automatically retains previous deployment versions. If a bad update was deployed, you can roll back instantly:

#### Option 1: Rollback via CLI
```bash
cd apps/api
npx wrangler rollback
```
Wrangler will list recent versions and ask which one you want to restore. Select the previous version, and it will be live globally within 1 second.

#### Option 2: Rollback via Cloudflare Dashboard
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com).
2. Click **Compute (Workers) → select-check-api → Deployments**.
3. Find the previous working deployment and click **Rollback to this version**.

---

## 📌 Summary Checklist

- [ ] Changed code in `apps/api/src/`
- [ ] Tested locally (`pnpm dev:api` or `npx wrangler dev`)
- [ ] Ran automated tests (`pnpm --filter @select-check/api test`)
- [ ] Deployed with `pnpm --filter @select-check/api deploy`
- [ ] Verified live URL (`curl https://select-check-api.santheepkumar.workers.dev/health`)
