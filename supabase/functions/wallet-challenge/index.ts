import { Account, Keypair, MuxedAccount } from "npm:@stellar/stellar-sdk@14.1.1";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "content-type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }) },
    });
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !user) return json({ error: "로그인이 필요합니다." }, 401);
    const { walletAddress, allowTransfer = false } = await request.json();
    const normalized = String(walletAddress ?? "").trim().toUpperCase();
    try { Keypair.fromPublicKey(normalized); } catch { return json({ error: "올바른 G로 시작하는 Pi 지갑 주소를 입력해 주세요." }, 400); }

    const { data: owned, error: ownedError } = await admin.from("pi_wallet_identities").select("user_id").eq("wallet_address", normalized).maybeSingle();
    if (ownedError) throw ownedError;
    if (owned && owned.user_id !== user.id && !allowTransfer) {
      const { data: previousProfile } = await admin.from("profiles").select("display_name").eq("id", owned.user_id).maybeSingle();
      return json({ ownershipConflict: true, walletAddress: normalized, previousAccountName: previousProfile?.display_name ?? "기존 계정" });
    }
    if (owned?.user_id === user.id) return json({ alreadyVerified: true, walletAddress: normalized });

    const network = (Deno.env.get("PI_NETWORK") ?? "testnet").toLowerCase() === "mainnet" ? "mainnet" : "testnet";
    const { data: pending, error: pendingError } = await admin.from("wallet_verification_challenges")
      .select("*").eq("user_id", user.id).eq("status", "pending").maybeSingle();
    if (pendingError) throw pendingError;
    if (pending && pending.wallet_address === normalized && pending.network === network &&
      Number(pending.amount) === 3.14 && new Date(pending.expires_at).getTime() > Date.now()) {
      return json({ id: pending.id, walletAddress: normalized, muxedAddress: pending.muxed_address,
        amount: pending.amount, network, expiresAt: pending.expires_at });
    }
    const { error: expireError } = await admin.from("wallet_verification_challenges").update({ status: "expired" }).eq("user_id", user.id).eq("status", "pending");
    if (expireError) throw expireError;
    const random = crypto.getRandomValues(new Uint32Array(2));
    const muxedId = ((BigInt(random[0]) << 32n) | BigInt(random[1])).toString();
    const muxedAccount = new MuxedAccount(new Account(normalized, "0"), "0");
    muxedAccount.setId(muxedId);
    const muxedAddress = muxedAccount.accountId();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data, error } = await admin.from("wallet_verification_challenges").insert({ user_id: user.id, wallet_address: normalized, muxed_id: muxedId, muxed_address: muxedAddress, amount: "3.1400000", network, expires_at: expiresAt }).select().single();
    if (error) throw error;
    return json({ id: data.id, walletAddress: normalized, muxedAddress, amount: data.amount, network, expiresAt });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "인증 요청을 만들지 못했습니다." }, 500);
  }
});
