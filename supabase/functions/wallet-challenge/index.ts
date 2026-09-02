import { Account, Keypair, MuxedAccount } from "npm:@stellar/stellar-sdk@14.1.1";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "content-type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !user) return json({ error: "authentication required" }, 401);
    const { walletAddress } = await request.json();
    const normalized = String(walletAddress ?? "").trim().toUpperCase();
    try { Keypair.fromPublicKey(normalized); } catch { return json({ error: "올바른 G로 시작하는 Pi 지갑 주소를 입력해 주세요." }, 400); }

    const { data: owned } = await admin.from("pi_wallet_identities").select("user_id").eq("wallet_address", normalized).maybeSingle();
    if (owned && owned.user_id !== user.id) return json({ error: "이미 다른 계정에 인증된 지갑입니다." }, 409);
    if (owned?.user_id === user.id) return json({ alreadyVerified: true, walletAddress: normalized });

    await admin.from("wallet_verification_challenges").update({ status: "expired" }).eq("user_id", user.id).eq("status", "pending");
    const random = crypto.getRandomValues(new Uint32Array(2));
    const muxedId = ((BigInt(random[0]) << 32n) | BigInt(random[1])).toString();
    const muxedAddress = new MuxedAccount(new Account(normalized, "0"), muxedId).accountId();
    const network = (Deno.env.get("PI_NETWORK") ?? "testnet").toLowerCase() === "mainnet" ? "mainnet" : "testnet";
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data, error } = await admin.from("wallet_verification_challenges").insert({ user_id: user.id, wallet_address: normalized, muxed_id: muxedId, muxed_address: muxedAddress, amount: "0.1000000", network, expires_at: expiresAt }).select().single();
    if (error) throw error;
    return json({ id: data.id, walletAddress: normalized, muxedAddress, amount: data.amount, network, expiresAt });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "인증 요청을 만들지 못했습니다." }, 500);
  }
});
