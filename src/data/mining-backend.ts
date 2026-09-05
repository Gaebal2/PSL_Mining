import { GridMine } from '@/domain/mining';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withRequestDeadline } from '@/lib/request-deadline';

type Provider = 'google' | 'apple' | 'pi';
type MineRow = { grid_id:string; latitude:number; longitude:number; depth_meters:number|string; miner_id:string|null; miner_name:string|null; mining_speed:number|string|null; active_until:string|null; abandonment_at:string|null; last_calculated_at:string|null; completed_at:string|null; completed_by:string|null; reward_type:GridMine['reward'] };
export type RemoteProfile = { id:string; display_name:string; auth_provider:Provider; pi_verified:boolean; skill_level:number; completed_mines:number; wallet_address:string; psl_wallet_address:string };

export const backendEnabled = isSupabaseConfigured;
const mapMine = (row: MineRow): GridMine => ({ id:row.grid_id, latitude:row.latitude, longitude:row.longitude, depthMeters:Number(row.depth_meters), ownerId:row.miner_id, ownerName:row.miner_name, miningSpeed:row.mining_speed===null?null:Number(row.mining_speed), activeUntil:row.active_until, abandonmentAt:row.abandonment_at, lastCalculatedAt:row.last_calculated_at, completed:Boolean(row.completed_at), completedByUserId:row.completed_by, reward:row.reward_type });

export async function signInBackend(provider: Provider) {
  if (!supabase) return null;
  let { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    if (provider === 'pi') throw new Error('Pi는 로그인 공급자가 아니라 출금 지갑 인증에 사용됩니다.');
    const redirectTo = Linking.createURL('auth/callback');
    const oauth = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true, queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined } });
    if (oauth.error) throw oauth.error;
    const browser = await WebBrowser.openAuthSessionAsync(oauth.data.url, redirectTo);
    if (browser.type !== 'success') throw new Error('로그인이 취소되었습니다.');
    const code = Linking.parse(browser.url).queryParams?.code;
    if (typeof code !== 'string') throw new Error('로그인 인증 코드를 받지 못했습니다.');
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) throw exchanged.error;
    session = { session: exchanged.data.session };
  }
  const id = session.session!.user.id;
  const { data, error } = await supabase.from('profiles').select('*').eq('id',id).single();
  if (error) throw error;
  return data as RemoteProfile;
}

export async function loadBackendSnapshot() {
  if (!supabase) return null;
  const { data:{ user } } = await supabase.auth.getUser(); if (!user) return null;
  const [{ data:profile, error:profileError },{ data:mines,error:minesError },{ data:balance,error:balanceError }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id',user.id).single(),
    supabase.from('mines').select('*').or('miner_id.not.is.null,completed_at.not.is.null'),
    supabase.rpc('psl_balance',{ target:user.id }),
  ]);
  if (profileError) throw profileError; if (minesError) throw minesError; if (balanceError) throw balanceError;
  return { profile:profile as RemoteProfile, mines:Object.fromEntries((mines as MineRow[]).map(row=>{const mine=mapMine(row);return [mine.id,mine]})), balance:Number(balance??0) };
}

export async function startBackendMine(mine: GridMine, speed:number) {
  if (!supabase) return null;
  const { data,error }=await supabase.rpc('start_mining',{ p_grid_id:mine.id,p_latitude:mine.latitude,p_longitude:mine.longitude,p_speed:speed,p_ad_transaction_id:`${mine.id}:${Date.now()}` });
  if(error) throw error; return mapMine(data as MineRow);
}
export async function leaveBackendMine(gridId:string) { if(!supabase)return null; const {data,error}=await supabase.rpc('leave_mine',{p_grid_id:gridId});if(error)throw error;return mapMine(data as MineRow); }
export async function syncBackendMine() { if(!supabase)return null; const {error}=await supabase.rpc('sync_my_mine');if(error)throw error;return loadBackendSnapshot(); }
export async function signOutBackend(){ if(supabase) await supabase.auth.signOut(); }
const DEVICE_ID_KEY = 'psl-mining-device-id-v1';
async function getDeviceId() {
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const created = `device-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}
export async function registerLoginDevice() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('register_login_device', { p_device_id: await getDeviceId() });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row?.forced_exit_grid_id as string | null | undefined) ?? null;
}
export async function savePslWalletAddress(pslWalletAddress:string) {
  if(!supabase) return;
  const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error('로그인이 필요합니다.');
  const {error}=await supabase.from('profiles').update({psl_wallet_address:pslWalletAddress}).eq('id',user.id);
  if(error) throw error;
}

export type WalletChallenge = { id:string; walletAddress:string; muxedAddress:string; amount:number|string; network:'testnet'|'mainnet'; expiresAt:string; alreadyVerified?:boolean; ownershipConflict?:boolean; previousAccountName?:string };
async function throwFunctionError(error: {message:string; context?:unknown}) {
  let message=error.message;
  const response=error.context as { clone?: () => { json: () => Promise<{error?:string;message?:string}> } } | undefined;
  if(response?.clone) { try { const body=await response.clone().json(); message=body.error || body.message || message; } catch { /* keep the SDK message */ } }
  throw new Error(message);
}
export async function createWalletChallenge(walletAddress:string, allowTransfer=false) {
  return withRequestDeadline(async (signal) => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
  let {data:{session}}=await supabase.auth.getSession();
  if(!session) {
    const refreshed=await supabase.auth.refreshSession();
    session=refreshed.data.session;
  }
  if(!session) throw new Error('로그인이 만료되었습니다. 로그아웃 후 다시 로그인해 주세요.');
  const {data,error}=await supabase.functions.invoke('wallet-challenge',{body:{walletAddress,allowTransfer},headers:{Authorization:`Bearer ${session.access_token}`},signal});
  if(error) await throwFunctionError(error); if(data?.error) throw new Error(data.error); return data as WalletChallenge;
  });
}
export async function verifyWalletChallenge(challengeId:string) {
  return withRequestDeadline(async (signal) => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
  let {data:{session}}=await supabase.auth.getSession();
  if(!session) {
    const refreshed=await supabase.auth.refreshSession();
    session=refreshed.data.session;
  }
  if(!session) throw new Error('로그인이 만료되었습니다. 로그아웃 후 다시 로그인해 주세요.');
  const {data,error}=await supabase.functions.invoke('wallet-verify',{body:{challengeId},headers:{Authorization:`Bearer ${session.access_token}`},signal});
  if(error) await throwFunctionError(error); if(data?.error) throw new Error(data.error);
  return data as {verified:boolean;pending?:boolean;walletAddress?:string;transactionHash?:string;checkedPaymentCount?:number};
  });
}

export type MiningStatus = { totalMiners:number; activeMiners:number; completedMines:number };
export async function loadMiningStatus() {
  if(!supabase) return null;
  const {data,error}=await supabase.rpc('mining_status'); if(error) throw error;
  const row=(Array.isArray(data)?data[0]:data) as {total_miners:number|string;active_miners:number|string;completed_mines:number|string};
  return {totalMiners:Number(row.total_miners),activeMiners:Number(row.active_miners),completedMines:Number(row.completed_mines)} as MiningStatus;
}
