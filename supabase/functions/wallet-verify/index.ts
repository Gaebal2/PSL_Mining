import { createClient } from "npm:@supabase/supabase-js@2";
import { MuxedAccount } from "npm:@stellar/stellar-sdk@14.1.1";
import { matchesPayment } from "./payment.ts";

const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "content-type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const signal = AbortSignal.timeout(20_000);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      global: { fetch: (input, init) => fetch(input, { ...init, signal }) },
    });
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !user) return json({ error: "authentication required" }, 401);
    const { challengeId } = await request.json();
    const { data: challenge, error: challengeError } = await admin.from("wallet_verification_challenges").select("*").eq("id", challengeId).eq("user_id", user.id).single();
    if (challengeError || !challenge) return json({ error: "인증 요청을 찾을 수 없습니다." }, 404);
    if (challenge.status === "verified") return json({ verified: true, walletAddress: challenge.wallet_address });
    if (challenge.status !== "pending" || new Date(challenge.expires_at).getTime() <= Date.now()) {
      await admin.from("wallet_verification_challenges").update({ status: "expired" }).eq("id", challenge.id);
      return json({ error: "인증 요청 시간이 만료되었습니다. 새로 요청해 주세요." }, 410);
    }

    const horizon = challenge.network === "mainnet" ? "https://api.mainnet.minepi.com" : "https://api.testnet.minepi.com";
    const response = await fetch(`${horizon}/accounts/${challenge.wallet_address}/payments?order=desc&limit=200`, { signal });
    if (response.status === 404) return json({ verified: false, pending: true, checkedPaymentCount: 0 });
    if (!response.ok) return json({ error: "Pi 네트워크에서 지갑 거래를 조회하지 못했습니다." }, 502);
    const body = await response.json();
    const records = body?._embedded?.records ?? [];
    const candidatePayments = records.filter((record: Record<string, unknown>) =>
      record.type === "payment" &&
      record.transaction_successful === true &&
      record.asset_type === "native" &&
      (record.from === challenge.wallet_address || record.from_muxed === challenge.wallet_address)
    );
    // PostgreSQL numeric(20,0) is decoded as a JS number and can lose uint64 precision.
    const muxedId = MuxedAccount.fromAddress(challenge.muxed_address, "0").id();
    const payment = candidatePayments.find((record: Record<string, unknown>) => matchesPayment(record, challenge, muxedId));
    if (!payment) return json({ verified: false, pending: true, checkedPaymentCount: candidatePayments.length });

    let txHash = String(payment.transaction_hash ?? "");
    if (!txHash) {
      const txUrl = (payment._links as { transaction?: { href?: string } } | undefined)?.transaction?.href;
      const txResponse = txUrl && new URL(txUrl).origin === horizon ? await fetch(txUrl, { signal }) : null;
      const transaction = txResponse?.ok ? await txResponse.json() : null;
      if (transaction?.successful === true) txHash = String(transaction?.hash ?? "");
    }
    if (!txHash) return json({ verified: false, pending: true });

    const { data: completion, error: completionError } = await admin.rpc("complete_pi_wallet_verification", { p_challenge_id: challenge.id, p_transaction_hash: txHash });
    if (completionError) {
      // A retry can overlap a previous request whose client timed out.
      const { data: completed } = await admin.from("wallet_verification_challenges")
        .select("status,transaction_hash").eq("id", challenge.id).single();
      if (completed?.status === "verified") return json({ verified: true, walletAddress: challenge.wallet_address, transactionHash: completed.transaction_hash });
      throw completionError;
    }
    const result = Array.isArray(completion) ? completion[0] : completion;
    return json({ verified: true, walletAddress: challenge.wallet_address, transactionHash: txHash, previousAccountId: result?.previous_user_id ?? null, resetGridId: result?.reset_grid_id ?? null });
  } catch (error) {
    console.error(error);
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return json({ error: "Pi 거래 조회 시간이 초과되었습니다. 새 주소를 만들지 말고 같은 주소로 입금 확인을 다시 시도해 주세요. / Pi lookup timed out. Retry checking the same address." }, 504);
    }
    return json({ error: error instanceof Error ? error.message : "지갑 소유권을 확인하지 못했습니다." }, 500);
  }
});
