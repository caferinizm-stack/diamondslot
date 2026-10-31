// Sunucu SQL'ini oyun ayarlarından üretir:
//   node tools/gen-sql.mjs > ../supabase_faz88_diamond_slot.sql
// Sembol ödemeleri, makara şeritleri, ödeme çizgileri, bonus ödülleri ve
// bahis seviyeleri gameConfig.js + slotEngine.js ile BİREBİR aynı olur.

import CONFIG from '../js/config/gameConfig.js';
import { STRIPS } from '../js/engine/slotEngine.js';

const q = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
const pays = Object.fromEntries(CONFIG.SYMBOLS.filter((s) => Object.keys(s.pays).length).map((s) => [s.id, s.pays]));
const lines = `array[${CONFIG.PAYLINES.map((l) => `array[${l.join(',')}]`).join(',')}]::int[]`;
const rewards = CONFIG.BONUS_REWARDS.map((r) => ({ id: r.id, mult: r.mult, weight: r.weight }));

const sql = `-- =====================================================================
-- FAZ 88: DIAMOND SLOT (5×3, 20 çizgi) · GERÇEK KRİSTAL · SUNUCU TARAFI
-- ---------------------------------------------------------------------
-- BU DOSYA ÜRETİLMİŞTİR: diamond_slot_web/tools/gen-sql.mjs
-- (ödemeler, şeritler, çizgiler, bonus ve bahisler gameConfig.js ile aynı).
--
-- * Sonuç SUNUCUDA belirlenir: makara durma noktaları, çizgi kazançları,
--   bonus sandığı ödülü ve bakiye. İstemci yalnız bu sonucu canlandırır.
-- * Bakiye: public.profiles.crystals (uygulamadaki cüzdanla aynı).
-- * Aynı istek (p_client) iki kez işlenmez; çok hızlı çevirme reddedilir.
-- * Her tur oyun defterine yazılır (record_game_result, 'diamond').
-- * RTP ≈ %95 (1 milyon tur simülasyonu · tools/simulate.mjs).
-- Tekrar çalıştırmak güvenlidir.
-- =====================================================================

create table if not exists public.diamond_players (
  id            uuid primary key references public.profiles (id) on delete cascade,
  rounds        bigint      not null default 0,
  total_bet     bigint      not null default 0,
  total_won     bigint      not null default 0,
  max_win       bigint      not null default 0,
  symbol_counts jsonb       not null default '{}'::jsonb,
  last_at       timestamptz
);
alter table public.diamond_players enable row level security;
revoke all on public.diamond_players from anon, authenticated;

create table if not exists public.diamond_spins (
  id         bigserial primary key,
  client_id  uuid        not null,
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  bet        bigint      not null,
  payout     bigint      not null,
  result     jsonb       not null,
  created_at timestamptz not null default now()
);
create unique index if not exists diamond_spins_client_idx on public.diamond_spins (user_id, client_id);
create index if not exists diamond_spins_user_idx on public.diamond_spins (user_id, created_at desc);
alter table public.diamond_spins enable row level security;
revoke all on public.diamond_spins from anon, authenticated;

-- ─── Tek çizgi değerlendirmesi (istemcideki evaluateLine ile aynı) ─────
create or replace function public.diamond_eval_line(p_syms text[], p_pays jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $fn$
declare
  v_base text := null;
  v_s text;
  v_n int := 0;
  v_w int := 0;
  v_pay_b int := 0;
  v_pay_w int := 0;
begin
  if p_syms[1] = '${CONFIG.BONUS_ID}' then return null; end if;
  foreach v_s in array p_syms loop
    exit when v_s = '${CONFIG.BONUS_ID}';
    if v_s <> '${CONFIG.WILD_ID}' then v_base := v_s; exit; end if;
  end loop;
  foreach v_s in array p_syms loop
    exit when v_s <> '${CONFIG.WILD_ID}';
    v_w := v_w + 1;
  end loop;
  if v_base is not null then
    foreach v_s in array p_syms loop
      exit when not (v_s = v_base or v_s = '${CONFIG.WILD_ID}');
      v_n := v_n + 1;
    end loop;
    if v_n >= 3 then v_pay_b := coalesce((p_pays -> v_base ->> v_n::text)::int, 0); end if;
  end if;
  if v_w >= 3 then v_pay_w := coalesce((p_pays -> '${CONFIG.WILD_ID}' ->> v_w::text)::int, 0); end if;
  if v_pay_b <= 0 and v_pay_w <= 0 then return null; end if;
  if v_pay_b >= v_pay_w then
    return jsonb_build_object('symbol', v_base, 'count', v_n, 'multiplier', v_pay_b);
  end if;
  return jsonb_build_object('symbol', '${CONFIG.WILD_ID}', 'count', v_w, 'multiplier', v_pay_w);
end $fn$;

-- ─── Oyun açık mı? (Admin ▸ Şans Oyunları Gizleme) ────────────────────
do $$ begin
  if to_regclass('public.luck_game_visibility') is not null then
    insert into public.luck_game_visibility (game) values ('diamond') on conflict (game) do nothing;
  end if;
end $$;

create or replace function public.diamond_is_open()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare v boolean;
begin
  if to_regclass('public.luck_game_visibility') is null then return true; end if;
  execute 'select visible from public.luck_game_visibility where game = $1' into v using 'diamond';
  return coalesce(v, true);
end $fn$;

-- ─── Durum: bakiye + son ${CONFIG.STORAGE.historySize} tur + istatistik ───────────────────────────
create or replace function public.diamond_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_bal bigint;
  v_name text;
  v_avatar text;
  p public.diamond_players%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select crystals, username, avatar_url into v_bal, v_name, v_avatar from public.profiles where id = v_uid;
  if v_bal is null then raise exception 'PROFILE_MISSING'; end if;
  select * into p from public.diamond_players where id = v_uid;
  return jsonb_build_object(
    'balance', v_bal,
    'user', jsonb_build_object('name', coalesce(v_name, ''), 'avatar', coalesce(v_avatar, '')),
    'open', public.diamond_is_open(),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
               'at', s.created_at, 'bet', s.bet, 'payout', s.payout,
               'symbol', s.result ->> 'top_symbol', 'count', (s.result ->> 'top_count')::int,
               'lines', jsonb_array_length(s.result -> 'wins')) order by s.created_at desc)
        from (select * from public.diamond_spins where user_id = v_uid
               order by created_at desc limit ${CONFIG.STORAGE.historySize}) s), '[]'::jsonb),
    'stats', jsonb_build_object(
      'rounds', coalesce(p.rounds, 0), 'total_won', coalesce(p.total_won, 0),
      'max_win', coalesce(p.max_win, 0), 'last_at', p.last_at,
      'symbol_counts', coalesce(p.symbol_counts, '{}'::jsonb)));
end $fn$;

-- ─── Tek çevirme ──────────────────────────────────────────────────────
create or replace function public.diamond_spin(p_bet bigint, p_client uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid     uuid := auth.uid();
  c_strips  constant jsonb := ${q(STRIPS)};
  c_pays    constant jsonb := ${q(pays)};
  c_lines   constant int[] := ${lines};
  c_rewards constant jsonb := ${q(rewards)};
  c_boost   constant jsonb := ${q(CONFIG.BONUS_COUNT_BOOST)};
  v_prev    jsonb;
  v_bal     bigint;
  v_last    timestamptz;
  v_stops   int[] := array[]::int[];
  v_grid    text[] := array[]::text[];   -- reel*${CONFIG.ROWS} + row + 1
  v_len     int;
  v_stop    int;
  r int; k int; i int;
  v_syms    text[];
  v_res     jsonb;
  v_wins    jsonb := '[]'::jsonb;
  v_line_total bigint := 0;
  v_amount  bigint;
  v_bonus_n int := 0;
  v_bonus   jsonb := null;
  v_pick    jsonb;
  v_tw      numeric;
  v_rnd     numeric;
  v_mult    int;
  v_total   bigint;
  v_counts  jsonb := '{}'::jsonb;
  v_top     text := null;
  v_top_n   int := 0;
  v_spin_id bigint;
  v_spin    jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_bet is null or p_bet not in (${CONFIG.CREDITS.betLevels.join(', ')}) then raise exception 'BAD_BET'; end if;
  if p_client is null then raise exception 'BAD_BET'; end if;
  if not public.diamond_is_open() then raise exception 'GAME_CLOSED'; end if;

  -- Aynı istek ikinci kez gelirse (ağ tekrarı) aynı sonuç döner, bakiye değişmez.
  select result into v_prev from public.diamond_spins where user_id = v_uid and client_id = p_client;
  if v_prev is not null then
    return jsonb_build_object('balance', (select crystals from public.profiles where id = v_uid),
                              'spin', v_prev, 'repeat', true);
  end if;

  insert into public.diamond_players (id) values (v_uid) on conflict (id) do nothing;
  select last_at into v_last from public.diamond_players where id = v_uid for update;
  if v_last is not null and v_last > clock_timestamp() - interval '350 milliseconds' then
    raise exception 'TOO_FAST';
  end if;

  select crystals into v_bal from public.profiles where id = v_uid for update;
  if v_bal is null then raise exception 'PROFILE_MISSING'; end if;
  if v_bal < p_bet then raise exception 'BALANCE'; end if;
  update public.profiles set crystals = crystals - p_bet where id = v_uid;

  -- 1) Makara durma noktaları ve tahta
  for r in 0..${CONFIG.REELS - 1} loop
    v_len := jsonb_array_length(c_strips -> r);
    v_stop := least(v_len - 1, floor(random() * v_len)::int);
    v_stops := v_stops || v_stop;
    for k in 0..${CONFIG.ROWS - 1} loop
      v_grid := v_grid || (c_strips -> r ->> ((v_stop + k) % v_len));
      v_counts := jsonb_set(v_counts, array[c_strips -> r ->> ((v_stop + k) % v_len)],
                  to_jsonb(coalesce((v_counts ->> (c_strips -> r ->> ((v_stop + k) % v_len)))::int, 0) + 1));
    end loop;
  end loop;

  -- 2) Çizgiler
  for i in 1..${CONFIG.PAYLINES.length} loop
    v_syms := array[]::text[];
    for r in 1..${CONFIG.REELS} loop
      v_syms := v_syms || v_grid[(r - 1) * ${CONFIG.ROWS} + c_lines[i][r] + 1];
    end loop;
    v_res := public.diamond_eval_line(v_syms, c_pays);
    if v_res is not null then
      v_amount := round(p_bet * (v_res ->> 'multiplier')::numeric / ${CONFIG.PAYLINES.length})::bigint;
      v_line_total := v_line_total + v_amount;
      v_wins := v_wins || jsonb_build_object('line', i - 1, 'symbol', v_res ->> 'symbol',
                  'count', (v_res ->> 'count')::int, 'multiplier', (v_res ->> 'multiplier')::int, 'amount', v_amount);
      if (v_res ->> 'count')::int > v_top_n or v_top is null then
        v_top := v_res ->> 'symbol'; v_top_n := (v_res ->> 'count')::int;
      end if;
    end if;
  end loop;

  -- 3) Bonus (kristal sandık): ${CONFIG.BONUS_TRIGGER}+ BONUS sembolü
  select count(*) into v_bonus_n from unnest(v_grid) g where g = '${CONFIG.BONUS_ID}';
  if v_bonus_n >= ${CONFIG.BONUS_TRIGGER} then
    select sum((x ->> 'weight')::numeric) into v_tw from jsonb_array_elements(c_rewards) x;
    v_rnd := random()::numeric * v_tw;
    for v_pick in select x from jsonb_array_elements(c_rewards) x loop
      v_rnd := v_rnd - (v_pick ->> 'weight')::numeric;
      exit when v_rnd < 0;
    end loop;
    v_mult := (v_pick ->> 'mult')::int * coalesce((c_boost ->> least(5, v_bonus_n)::text)::int, 1);
    v_bonus := jsonb_build_object('count', v_bonus_n, 'id', v_pick ->> 'id', 'mult', v_mult,
                                  'amount', p_bet * v_mult);
    v_top := '${CONFIG.BONUS_ID}'; v_top_n := v_bonus_n;
  end if;

  v_total := least(v_line_total + coalesce((v_bonus ->> 'amount')::bigint, 0), p_bet * ${CONFIG.MAX_WIN_X});
  if v_total > 0 then
    update public.profiles set crystals = crystals + v_total where id = v_uid;
  end if;
  select crystals into v_bal from public.profiles where id = v_uid;

  insert into public.diamond_spins (client_id, user_id, bet, payout, result)
  values (p_client, v_uid, p_bet, v_total, '{}'::jsonb)
  returning id into v_spin_id;
  v_spin := jsonb_build_object('id', v_spin_id, 'bet', p_bet, 'stops', to_jsonb(v_stops), 'wins', v_wins,
                               'line_total', v_line_total, 'bonus', v_bonus, 'total_win', v_total,
                               'top_symbol', v_top, 'top_count', v_top_n);
  update public.diamond_spins set result = v_spin where id = v_spin_id;

  update public.diamond_players p
     set rounds = p.rounds + 1, total_bet = p.total_bet + p_bet, total_won = p.total_won + v_total,
         max_win = greatest(p.max_win, v_total), last_at = clock_timestamp(),
         symbol_counts = (select coalesce(jsonb_object_agg(k2, coalesce((p.symbol_counts ->> k2)::bigint, 0)
                                + coalesce((v_counts ->> k2)::bigint, 0)), '{}'::jsonb)
                            from (select jsonb_object_keys(p.symbol_counts || v_counts) k2) kk)
   where p.id = v_uid;

  begin
    perform public.record_game_result(v_uid, 'diamond', p_bet::bigint, v_total::bigint);
  exception when undefined_function or undefined_table then null;
  end;

  return jsonb_build_object('balance', v_bal, 'spin', v_spin);
end $fn$;

revoke all on function public.diamond_eval_line(text[], jsonb) from public, anon, authenticated;
revoke all on function public.diamond_is_open() from public, anon, authenticated;
revoke all on function public.diamond_state() from public, anon;
revoke all on function public.diamond_spin(bigint, uuid) from public, anon;
grant execute on function public.diamond_state() to authenticated;
grant execute on function public.diamond_spin(bigint, uuid) to authenticated;

-- KONTROL
select to_regprocedure('public.diamond_spin(bigint,uuid)') is not null as diamond_spin,
       to_regclass('public.diamond_spins') is not null as diamond_kayit;
`;
process.stdout.write(sql);
