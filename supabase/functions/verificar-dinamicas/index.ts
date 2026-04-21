import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

Deno.serve(async () => {
  try {
    // 1. Traer todas las dinámicas activas no expiradas
    const { data: dinamicas } = await supabase
      .from('dinamicas')
      .select('*')
      .eq('activa', true)
      .gte('fecha_fin', new Date().toISOString());

    if (!dinamicas || dinamicas.length === 0) {
      return new Response(JSON.stringify({ ok: true, procesadas: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let entregadas = 0;

    for (const din of dinamicas) {
      const condicion = din.condicion as any;
      if (!condicion?.tipo) continue;

      // 2. Buscar usuarios que ya completaron esta dinámica
      const { data: yaCompletaron } = await supabase
        .from('user_dinamicas')
        .select('user_id')
        .eq('dinamica_id', din.id);

      const yaIds = new Set((yaCompletaron ?? []).map((r: any) => r.user_id));

      // 3. Según el tipo de condición, buscar candidatos
      let candidatos: { user_id: string; extra?: any }[] = [];

      if (condicion.tipo === 'subir_historia') {
        const query = supabase
          .from('stories')
          .select('id, author_id, title, body, category')
          .gte('created_at', din.fecha_inicio);

        if (condicion.categoria && condicion.categoria !== 'cualquiera') {
          query.eq('category', condicion.categoria);
        }

        const { data: historias } = await query;

        for (const h of historias ?? []) {
          if (yaIds.has(h.author_id)) continue;

          // 4. Claude verifica si la historia realmente cumple la categoría
          let aprobada = true;
          if (condicion.categoria && condicion.categoria !== 'cualquiera') {
            const check = await anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 50,
              system: 'Eres un verificador estricto de contenido. Responde solo "SI" o "NO".',
              messages: [
                {
                  role: 'user',
                  content: `¿Esta historia pertenece genuinamente a la categoría "${condicion.categoria}"?
Título: ${h.title}
Contenido (primeros 500 caracteres): ${h.body.slice(0, 500)}
Responde únicamente SI o NO.`,
                },
              ],
            });
            const resp = (check.content[0] as any).text.trim().toUpperCase();
            aprobada = resp.startsWith('SI');
          }

          if (aprobada) {
            candidatos.push({ user_id: h.author_id, extra: { story_id: h.id } });
          }
        }
      } else if (condicion.tipo === 'comentar') {
        const cantidad = condicion.cantidad ?? 1;
        const { data: comentarios } = await supabase
          .from('comments')
          .select('author_id')
          .gte('created_at', din.fecha_inicio);

        const conteo = new Map<string, number>();
        for (const c of comentarios ?? []) {
          conteo.set(c.author_id, (conteo.get(c.author_id) ?? 0) + 1);
        }
        for (const [uid, cant] of conteo.entries()) {
          if (cant >= cantidad && !yaIds.has(uid)) {
            candidatos.push({ user_id: uid });
          }
        }
      } else if (condicion.tipo === 'recibir_like') {
        const cantidad = condicion.cantidad ?? 1;
        const { data: likes } = await supabase
          .from('story_likes')
          .select('stories(author_id)')
          .gte('created_at', din.fecha_inicio);

        const conteo = new Map<string, number>();
        for (const l of likes ?? []) {
          const uid = (l.stories as any)?.author_id;
          if (uid) conteo.set(uid, (conteo.get(uid) ?? 0) + 1);
        }
        for (const [uid, cant] of conteo.entries()) {
          if (cant >= cantidad && !yaIds.has(uid)) {
            candidatos.push({ user_id: uid });
          }
        }
      }

      // 5. Entregar recompensas a cada candidato
      for (const c of candidatos) {
        const { error: insErr } = await supabase.from('user_dinamicas').insert({
          user_id: c.user_id,
          dinamica_id: din.id,
          recompensa_entregada: true,
        });

        if (insErr) continue;

        // XP
        if (din.xp_reward > 0) {
          await supabase.rpc('increment_xp', {
            p_user_id: c.user_id,
            p_amount: din.xp_reward,
          });
        }

        // Coins
        if (din.coins_reward > 0) {
          await supabase
            .from('user_gamification')
            .update({ coins: supabase.rpc('increment_coins', { p_user_id: c.user_id, p_amount: din.coins_reward }) })
            .eq('user_id', c.user_id);

          await supabase.rpc('increment_coins', {
            p_user_id: c.user_id,
            p_amount: din.coins_reward,
          });
        }

        entregadas++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, entregadas }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
