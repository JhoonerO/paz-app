import { createClient } from 'npm:@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function esContenidoValido(titulo: string, cuerpo: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Eres un moderador de contenido de una app universitaria colombiana de historias de terror y leyendas. Responde solo SI o NO, sin explicación. Responde SI si el contenido es una historia real (aunque corta), NO si es spam, texto sin sentido, insultos, o claramente no es una historia.',
          },
          {
            role: 'user',
            content: `¿Esta publicación es una historia válida y no es spam o troll?\nTítulo: ${titulo}\nContenido: ${cuerpo.slice(0, 600)}\nResponde únicamente SI o NO.`,
          },
        ],
        max_tokens: 5,
        temperature: 0,
      }),
    });
    const data = await res.json();
    const respuesta = data.choices?.[0]?.message?.content?.trim().toUpperCase() ?? 'SI';
    return respuesta.startsWith('SI');
  } catch {
    // Si Groq falla, aprobamos por defecto para no bloquear al usuario
    return true;
  }
}

Deno.serve(async () => {
  try {
    // 1. Traer todas las dinámicas activas no expiradas
    const { data: dinamicas, error: dinError } = await supabase
      .from('dinamicas')
      .select('*')
      .eq('activa', true)
      .gte('fecha_fin', new Date().toISOString());

    if (dinError) throw dinError;

    if (!dinamicas || dinamicas.length === 0) {
      return new Response(JSON.stringify({ ok: true, procesadas: 0, entregadas: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let entregadas = 0;

    for (const din of dinamicas) {
      const condicion = din.condicion as any;
      if (!condicion?.tipo) continue;

      // 2. Buscar usuarios que tienen esta dinámica pendiente (aceptada, no completada)
      const { data: pendientes } = await supabase
        .from('user_dinamicas')
        .select('user_id')
        .eq('dinamica_id', din.id)
        .is('completada_at', null);

      if (!pendientes || pendientes.length === 0) continue;

      const userIds = pendientes.map((r: any) => r.user_id);
      const desde = din.fecha_inicio; // todo lo que ocurrió desde que inició el desafío cuenta

      for (const userId of userIds) {
        let cumplido = false;

        if (condicion.tipo === 'subir_historia') {
          // Buscar historias del usuario desde el inicio del desafío
          let query = supabase
            .from('stories')
            .select('id, title, body, category')
            .eq('author_id', userId)
            .gte('created_at', desde);

          // Filtrar por categoría si aplica (confiamos en la categoría que el usuario seleccionó)
          if (condicion.categoria && condicion.categoria !== 'cualquiera') {
            query = query.eq('category', condicion.categoria);
          }

          const { data: historias } = await query;

          for (const h of historias ?? []) {
            // Solo verificar si el contenido no es troll/spam, no la categoría
            const valida = await esContenidoValido(h.title, h.body);
            if (valida) {
              cumplido = true;
              break;
            }
          }
        } else if (condicion.tipo === 'comentar') {
          const cantidad = condicion.cantidad ?? 1;
          const { data: comentarios } = await supabase
            .from('story_comments')
            .select('id')
            .eq('user_id', userId)
            .gte('created_at', desde);

          cumplido = (comentarios?.length ?? 0) >= cantidad;
        } else if (condicion.tipo === 'recibir_like') {
          const cantidad = condicion.cantidad ?? 1;
          const { data: misHistorias } = await supabase
            .from('stories')
            .select('id')
            .eq('author_id', userId);

          const storyIds = (misHistorias ?? []).map((s: any) => s.id);
          if (storyIds.length > 0) {
            const { data: likes } = await supabase
              .from('story_likes')
              .select('story_id')
              .in('story_id', storyIds)
              .gte('created_at', desde);

            cumplido = (likes?.length ?? 0) >= cantidad;
          }
        } else if (condicion.tipo === 'estar_activo') {
          const cantidad = condicion.cantidad ?? 1;
          const { data: lecturas } = await supabase
            .from('story_reads')
            .select('story_id')
            .eq('user_id', userId)
            .gte('created_at', desde);

          // Fallback: si story_reads no tiene created_at, contar todas las lecturas del período
          const total = lecturas?.length ?? 0;
          cumplido = total >= cantidad;
        }

        if (!cumplido) continue;

        // 3. Marcar como completada
        const { error: updErr } = await supabase
          .from('user_dinamicas')
          .update({
            completada_at: new Date().toISOString(),
            recompensa_entregada: true,
          })
          .eq('user_id', userId)
          .eq('dinamica_id', din.id);

        if (updErr) continue;

        // 4. Entregar XP
        if (din.xp_reward > 0) {
          await supabase.rpc('increment_xp', {
            p_user_id: userId,
            p_amount: din.xp_reward,
          });
        }

        // 5. Entregar coins
        if (din.coins_reward > 0) {
          await supabase.rpc('increment_coins', {
            p_user_id: userId,
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
