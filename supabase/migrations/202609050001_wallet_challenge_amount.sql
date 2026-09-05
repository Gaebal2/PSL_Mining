-- Apply to existing databases as well as fresh installs. Existing challenges
-- retain their amount so a transfer already sent can still be verified.
alter table public.wallet_verification_challenges alter column amount set default 3.1400000;
