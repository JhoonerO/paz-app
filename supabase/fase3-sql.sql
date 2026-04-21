-- ── RPC: incrementar XP ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_xp(p_user_id uuid, p_amount int)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_gamification (user_id, xp, coins)
  VALUES (p_user_id, p_amount, 0)
  ON CONFLICT (user_id)
  DO UPDATE SET xp = user_gamification.xp + p_amount;
END;
$$;

-- ── RPC: incrementar coins ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_coins(p_user_id uuid, p_amount int)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_gamification (user_id, xp, coins)
  VALUES (p_user_id, 0, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET coins = user_gamification.coins + p_amount;
END;
$$;

-- ── Política: Natal-IA puede insertar dinámicas ───────────────────────────────
CREATE POLICY "Natal-IA inserta dinamicas" ON dinamicas
  FOR INSERT WITH CHECK (true);

-- ── Política: sistema entrega recompensas ────────────────────────────────────
CREATE POLICY "Sistema inserta progreso" ON user_dinamicas
  FOR INSERT WITH CHECK (true);
