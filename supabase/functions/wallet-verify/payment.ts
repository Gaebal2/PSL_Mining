export type PaymentChallenge = {
  wallet_address: string;
  muxed_address: string;
  created_at: string;
  expires_at: string;
  amount: string | number;
};

function stroops(value: unknown): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(String(value));
  return match ? BigInt(match[1]) * 10_000_000n + BigInt((match[2] ?? '').padEnd(7, '0')) : null;
}

export function matchesPayment(record: Record<string, unknown>, challenge: PaymentChallenge, muxedId: string): boolean {
  const destinationMatches = record.to === challenge.muxed_address ||
    record.to_muxed === challenge.muxed_address ||
    (record.to === challenge.wallet_address && typeof record.to_muxed_id === 'string' && record.to_muxed_id === muxedId);
  const amount = stroops(record.amount);
  const occurredAt = Date.parse(String(record.created_at));
  return record.type === 'payment' && record.transaction_successful === true &&
    record.asset_type === 'native' && record.from === challenge.wallet_address &&
    destinationMatches && amount !== null && amount === stroops(challenge.amount) &&
    occurredAt >= Date.parse(challenge.created_at) && occurredAt <= Date.parse(challenge.expires_at);
}
