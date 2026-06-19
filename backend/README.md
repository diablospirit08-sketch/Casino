# Volt Casino — Backend

Node.js + Fastify + PostgreSQL API server for wallet, ledger, and game resolution.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Fastify 4 |
| Database | PostgreSQL 15 |
| Auth | JWT (access 15 min) + refresh token rotation (30 days) |
| Password hashing | scrypt (Node built-in, no external dep) |
| RNG | Provably fair HMAC-SHA256 |

## Quick start

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit DATABASE_URL and JWT_SECRET at minimum

# 3. Create the database
createdb volt_casino

# 4. Run migrations
npm run migrate

# 5. Start the dev server (restarts on file change)
npm run dev
```

## API reference

### Auth
| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, username, password}` | Create account |
| POST | `/api/auth/login` | `{email, password}` | Get tokens |
| POST | `/api/auth/refresh` | `{refreshToken}` | Rotate refresh → new access |
| POST | `/api/auth/logout` | `{refreshToken}` | Revoke refresh token |
| GET  | `/api/auth/me` | — | Current user (requires Bearer token) |

### Wallet
All wallet routes require `Authorization: Bearer <accessToken>`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/wallet/balances` | All currency balances |
| GET | `/api/wallet/balance/:currency` | Single balance |
| GET | `/api/wallet/deposit-address/:currency/:network` | Get/create deposit address |
| GET | `/api/wallet/history` | Ledger history `?currency=&limit=&offset=` |
| POST | `/api/wallet/withdraw` | `{currency, network, amount, address}` |
| GET | `/api/wallet/withdrawals` | Withdrawal history |

### Bets
All bet routes require `Authorization: Bearer <accessToken>`.

| Method | Path | Description |
|---|---|---|
| POST | `/api/bets/prepare` | Get `serverSeedHash` + `clientSeed` before placing a bet |
| POST | `/api/bets/place` | Place a bet (see below) |
| GET  | `/api/bets/history` | Bet history `?game=&limit=&offset=` |
| GET  | `/api/bets/:id` | Single bet (reveals `serverSeed` after settlement) |
| POST | `/api/verify` | Verify any bet's provably fair result (public) |

#### Place bet body
```json
{
  "game": "originals-dice",
  "currency": "USDC",
  "wager": 10,
  "serverSeedHash": "...",
  "clientSeed": "...",
  "nonce": 0,
  "params": { "target": 50, "direction": "over" }
}
```

## Ledger design

- **Immutable** — rows are never updated or deleted, only inserted.
- **Derived balances** — `SUM(amount)` per `(user_id, currency)`. No balance column.
- **Atomic debits** — every debit acquires a `FOR UPDATE` row-level lock to prevent double-spend.
- **Types**: `deposit`, `withdrawal`, `withdrawal_fee`, `bet_debit`, `bet_credit`, `bonus`, `rakeback`, `adjustment`

## Provably fair

1. Call `POST /api/bets/prepare` → get `serverSeedHash` and a suggested `clientSeed`.
2. Optionally replace `clientSeed` with your own string.
3. Call `POST /api/bets/place` with your chosen seeds and a `nonce`.
4. The response includes the revealed `serverSeed`.
5. Verify: `SHA256(serverSeed) === serverSeedHash` and re-derive the result via `POST /api/verify`.

## Production checklist

- [ ] Set strong `JWT_SECRET` (64 random bytes)
- [ ] Set `NODE_ENV=production`
- [ ] Set `CORS_ORIGIN` to your actual frontend domain
- [ ] Use TLS in front of the API (nginx / Cloudflare)
- [ ] Replace placeholder deposit address generation with real custody provider
- [ ] Add withdrawal processing queue (Redis + worker)
- [ ] Add deposit webhook handler from custody provider
- [ ] Set up database backups
- [ ] Add monitoring (Sentry, Datadog, etc.)
- [ ] Obtain gambling license before accepting real money
- [ ] Integrate KYC provider (Sumsub, Jumio) before allowing withdrawals
