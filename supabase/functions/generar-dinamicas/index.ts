import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const NATAL_IA_USER_ID = Deno.env.get('NATAL_IA_USER_ID')!;

Deno.serve(async () => {
  try {
    // 1. Leer actividad reciente de la app (últimas 24h)
    const since = new Date(Date.now() - 86400000).toISOString();

    const [{ data: storiesHoy }, { data: comentariosHoy }, { count: usuariosActivos }] =
      await Promise.all([
        supabase
          .from('stories')
          .select('id, title, category')
          .gte('created_at', since),
        supabase
          .from('comments')
          .select('id')
          .gte('created_at', since),
        supabase
          .from('stories')
          .select('author_id', { count: 'exact', head: true })
          .gte('created_at', since),
      ]);

    const resumen = {
      historias_hoy: storiesHoy?.length ?? 0,
      categorias_hoy: [...new Set(storiesHoy?.map((s: any) => s.category) ?? [])],
      comentarios_hoy: comentariosHoy?.length ?? 0,
      usuarios_activos: usuariosActivos ?? 0,
    };

    // 2. Pedir a Claude que genere 2-3 dinámicas creativas
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `Eres Natal-IA, el espíritu guardián de U-PAZ, una app colombiana de historias de terror, mitos y leyendas.
Tu misión es crear dinámicas diarias para motivar a la comunidad.
Hablas con misterio y personalidad, como si fueras un ente sobrenatural que conoce todos los secretos de la app.
Responde SIEMPRE en JSON válido, sin texto extra.`,
      messages: [
        {
          role: 'user',
          content: `La actividad de hoy en la app es: ${JSON.stringify(resumen)}.

Crea entre 2 y 3 dinámicas para HOY. Cada dinámica debe ser relevante con la actividad actual.
Si hay pocas historias, motiva a subir. Si hay pocas de una categoría, desafía esa categoría.

Responde con este JSON exacto:
{
  "dinamicas": [
    {
      "titulo": "título corto y misterioso",
      "descripcion": "descripción en primera persona como Natal-IA, máximo 2 oraciones",
      "tipo": "diaria",
      "condicion": {
        "tipo": "subir_historia",
        "categoria": "terror|mito|leyenda|urbana|cualquiera",
        "cantidad": 1
      },
      "xp_reward": 50,
      "coins_reward": 20,
      "tiene_medalla": false
    }
  ]
}

Tipos de condición disponibles: "subir_historia", "comentar", "recibir_like", "estar_activo".
Las medallas son MUY raras, solo ponlas si la dinámica es especialmente difícil o única.
Los premios normales: xp entre 30-150, coins entre 10-80. Con medalla: xp 200+, coins 100+.`,
        },
      ],
    });

    const raw = (msg.content[0] as any).text;
    const parsed = JSON.parse(raw);
    const dinamicas = parsed.dinamicas as any[];

    // 3. Insertar en DB como Natal-IA
    const ahora = new Date();
    const manana = new Date(ahora.getTime() + 86400000);

    const rows = dinamicas.map((d: any) => ({
      titulo: d.titulo,
      descripcion: d.descripcion,
      tipo: d.tipo ?? 'diaria',
      condicion: d.condicion,
      xp_reward: d.xp_reward ?? 50,
      coins_reward: d.coins_reward ?? 20,
      badge_id: d.tiene_medalla ? 'medalla_natal_ia' : null,
      fecha_inicio: ahora.toISOString(),
      fecha_fin: manana.toISOString(),
      activa: true,
      creada_por: NATAL_IA_USER_ID,
    }));

    const { error } = await supabase.from('dinamicas').insert(rows);
    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, generadas: rows.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
