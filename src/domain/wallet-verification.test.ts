import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesPayment } from '../../supabase/functions/wallet-verify/payment.ts';
import { withRequestDeadline } from '../lib/request-deadline.ts';

const challenge = { wallet_address: 'G-wallet', muxed_address: 'M-current', amount: '3.1400000',
  created_at: '2026-09-05T01:00:00Z', expires_at: '2026-09-05T01:10:00Z' };
const muxedId = '18446744073709551615';
const payment = { type: 'payment', transaction_successful: true, asset_type: 'native',
  from: 'G-wallet', to: 'G-wallet', to_muxed_id: muxedId, amount: '3.1400000', created_at: '2026-09-05T01:05:00Z' };

test('matches exact 3.14 Pi and full uint64 muxed ID', () => {
  assert.equal(matchesPayment(payment, challenge, muxedId), true);
  assert.equal(matchesPayment({ ...payment, to_muxed_id: undefined, to_muxed: 'M-current' }, challenge, muxedId), true);
});

test('rejects incorrect amount, wallet, previous address, failed transaction and out-of-window payments', () => {
  for (const change of [
    { amount: '0.0100000' }, { amount: '3.1400001' }, { amount: '3.1399999' },
    { from: 'G-other' }, { to_muxed_id: '1' }, { to_muxed_id: Number(muxedId) },
    { transaction_successful: false }, { transaction_successful: undefined },
    { asset_type: 'credit_alphanum4' }, { created_at: '2026-09-05T00:59:59Z' },
    { created_at: '2026-09-05T01:10:01Z' },
  ]) assert.equal(matchesPayment({ ...payment, ...change }, challenge, muxedId), false, JSON.stringify(change));
});

test('legacy challenge keeps its original amount for an already sent payment', () => {
  assert.equal(matchesPayment({ ...payment, amount: '0.0100000' }, { ...challenge, amount: '0.01' }, muxedId), true);
});

test('a hung request times out, aborts, and allows a successful retry', async () => {
  let signal: AbortSignal | undefined;
  await assert.rejects(withRequestDeadline((requestSignal) => {
    signal = requestSignal;
    return new Promise(() => {});
  }, 10), /Request timed out/);
  assert.equal(signal?.aborted, true);
  assert.equal(await withRequestDeadline(async () => 'verified', 100), 'verified');
});

test('request failures propagate immediately', async () => {
  await assert.rejects(withRequestDeadline(async () => { throw new Error('network failed'); }), /network failed/);
});
