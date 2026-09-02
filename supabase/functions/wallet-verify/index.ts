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
    const { challengeId } = await request.json();
    const { data: challenge, error: challengeError } = await admin.from("wallet_verification_challenges").select("*").eq("id", challengeId).eq("user_id", user.id).single();
    if (challengeError || !challenge) return json({ error: "인증 요청을 찾을 수 없습니다." }, 404);
    if (challenge.status === "verified") return json({ verified: true, walletAddress: challenge.wallet_address });
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      await admin.from("wallet_verification_challenges").update({ status: "expired" }).eq("id", challenge.id);
      return json({ error: "인증 요청 시간이 만료되었습니다. 새로 요청해 주세요." }, 410);
    }

    const horizon = challenge.network === "mainnet" ? "https://api.mainnet.minepi.com" : "https://api.testnet.minepi.com";
    const response = await fetch(`${horizon}/accounts/${challenge.wallet_address}/payments?order=desc&limit=200`);
    if (!response.ok) return json({ error: "Pi 네트워크에서 지갑 거래를 조회하지 못했습니다." }, 502);
    const body = await response.json();
    const records = body?._embedded?.records ?? [];
    const candidatePayments = records.filter((record: Record<string, unknown>) =>
      record.type === "payment" &&
      record.transaction_successful !== false &&
      record.asset_type === "native" &&
      (record.from === challenge.wallet_address || record.from_muxed === challenge.wallet_address)
    );
    const payment = candidatePayments.find((record: Record<string, unknown>) => {
      const muxedDestinationMatches =
        record.to === challenge.muxed_address ||
        record.to_muxed === challenge.muxed_address ||
        (record.to === challenge.wallet_address && String(record.to_muxed_id ?? "") === String(challenge.muxed_id));
      const amountMatches = Math.abs(Number(record.amount) - Number(challenge.amount)) < 0.0000001;
      const occurredAfterChallenge = new Date(String(record.created_at)).getTime() >=
        new Date(challenge.created_at).getTime() - 120_000;
      return muxedDestinationMatches && amountMatches && occurredAfterChallenge;
    });
    if (!payment) return json({ verified: false, pending: true, checkedPaymentCount: candidatePayments.length });

    let txHash = String(payment.transaction_hash ?? "");
    if (!txHash) {
      const txUrl = (payment._links as { transaction?: { href?: string } } | undefined)?.transaction?.href;
      const txResponse = txUrl ? await fetch(txUrl) : null;
      const transaction = txResponse?.ok ? await txResponse.json() : null;
      if (transaction?.successful !== false) txHash = String(transaction?.hash ?? "");
    }
    if (!txHash) return json({ verified: false, pending: true });

    const { error: identityError } = await admin.from("pi_wallet_identities").insert({ user_id: user.id, wallet_address: challenge.wallet_address, verification_tx_hash: txHash });
    if (identityError) {
      if (identityError.code === "23505") return json({ error: "이미 인증에 사용된 지갑 또는 거래입니다." }, 409);
      throw identityError;
    }
    await admin.from("wallet_verification_challenges").update({ status: "verified", transaction_hash: txHash, verified_at: new Date().toISOString() }).eq("id", challenge.id);
    await admin.from("profiles").update({ pi_verified: true, wallet_address: challenge.wallet_address, updated_at: new Date().toISOString() }).eq("id", user.id);
    return json({ verified: true, walletAddress: challenge.wallet_address, transactionHash: txHash });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "지갑 소유권을 확인하지 못했습니다." }, 500);
  }
});
