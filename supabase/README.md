# Supabase setup

1. Create a Supabase project.
2. Run `migrations/202609020001_psl_mining.sql` in the SQL editor (or apply it with the Supabase CLI).
3. Enable Google and Apple providers in Supabase Authentication.
4. Copy `.env.example` to `.env.local` and fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Restart Expo so the public environment variables are embedded in the app.

Add `pslmining://auth/callback` to the Supabase Authentication redirect allow list. Google and Apple use PKCE OAuth and the resulting Supabase session is persisted on the device.

## Pi wallet ownership verification

Pi is not an app login provider. A signed-in user enters a Pi `G...` address in MY. `wallet-challenge` creates a one-time Muxed `M...` address derived from that same G address. The user sends exactly `0.0100000 Pi` from G to M, so the principal returns to the same underlying account and only the network fee is spent.

`wallet-verify` accepts the transaction only when the source G address, underlying destination G address, Muxed ID, native asset, amount, time window, transaction success, and unused transaction hash all match. A verified G address can belong to only one app account.

Use `npx supabase secrets set PI_NETWORK=testnet` during testing. Change it to `mainnet` only after confirming that the current Pi Wallet accepts an `M...` destination and the Horizon response preserves `to_muxed_id`.
