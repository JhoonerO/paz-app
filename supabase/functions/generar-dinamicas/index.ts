import { createClient } from 'npm:@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function groqChat(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1024,
      temperature: 0.8,
    }),
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

const NATAL_IA_USER_ID = Deno.env.get('NATAL_IA_USER_ID')!;

Deno.serve(async () => {
  try {
    // 1. Desactivar dinámicas viejas del día anterior
    await supabase
      .from('dinamicas')
      .update({ activa: false })
      .lt('fecha_fin', new Date().toISOString());

    // 2. Leer actividad de la app (últimas 24h y general)
    const since24h = new Date(Date.now() - 86400000).toISOString();
    const since7d = new Date(Date.now() - 7 * 86400000).toISOString();

    const [
      { data: storiesHoy },
      { data: comentariosHoy },
      { data: storiesSemana },
      { data: topStories },
      { data: totalPorCategoria },
    ] = await Promise.all([
      supabase.from('stories').select('id, title, category').gte('created_at', since24h),
      supabase.from('story_comments').select('id').gte('created_at', since24h),
      supabase.from('stories').select('category').gte('created_at', since7d),
      supabase.from('stories').select('title, likes_count, category').order('likes_count', { ascending: false }).limit(3),
      supabase.from('stories').select('category'),
    ]);

    const conteoCategoriaSemana: Record<string, number> = {};
    for (const s of storiesSemana ?? []) {
      conteoCategoriaSemana[s.category] = (conteoCategoriaSemana[s.category] ?? 0) + 1;
    }
    const conteoCategoriaTotal: Record<string, number> = {};
    for (const s of totalPorCategoria ?? []) {
      conteoCategoriaTotal[s.category] = (conteoCategoriaTotal[s.category] ?? 0) + 1;
    }
    const categoriasMenosActivas = ['mito', 'leyenda', 'urbana', 'otra']
      .sort((a, b) => (conteoCategoriaSemana[a] ?? 0) - (conteoCategoriaSemana[b] ?? 0));

    const resumen = {
      historias_ultimas_24h: storiesHoy?.length ?? 0,
      comentarios_ultimas_24h: comentariosHoy?.length ?? 0,
      historias_esta_semana: storiesSemana?.length ?? 0,
      categorias_subidas_hoy: storiesHoy?.map((s: any) => s.category) ?? [],
      categorias_menos_activas_semana: categoriasMenosActivas,
      conteo_por_categoria_semana: conteoCategoriaSemana,
      conteo_total_por_categoria: conteoCategoriaTotal,
      historias_mas_populares: topStories?.map((s: any) => ({ titulo: s.title, likes: s.likes_count, categoria: s.category })) ?? [],
    };

    // 3. Pedir a Groq que genere 2-3 dinámicas creativas
    const raw = await groqChat(
      `Eres Natal-IA, una parcera virtual de U-PAZ, app colombiana universitaria donde estudiantes comparten historias de terror, mitos y leyendas.

PERSONALIDAD:
Bacana, relajada, colombiana al 100%. Hablas como compañera de universidad: casual, directa, con jerga colombiana (parcero/a, bacano, chévere, uy, dale, qué más, ojo, etc). Nunca dramática ni oscura. Nunca te presentas. Vas directo al punto.

CONTEXTO COMPLETO DE LA APP:
- App universitaria colombiana, principalmente Unipaz (Universidad de La Paz, Barrancabermeja)
- Los usuarios ganan XP haciendo: likes (+10 XP), comentarios (+15 XP cada 2), publicar historia (+20 XP), leer historia completa (+8 XP), racha diaria (+5 XP)
- Niveles: Bronce I (0 XP) → Bronce II (150) → Plata I (400) → Plata II (800) → Oro I (1400) → Oro II (2200) → Esmeralda I (3500) → Esmeralda II (5500) → Platino I (8000) → Platino II (12000) → Diamante (18000) → Cósmico (30000)
- Moneda: Pesos (0-999), Lukas (1000+), Palos (1.000.000+)
- Insignias: Admin (amarilla), Tester (azul, si se unió antes de 2026), y badges customizadas
- Hay mensajes directos entre usuarios, sistema de notificaciones y racha de días activos

CATEGORÍAS DE HISTORIAS (usa estos valores exactos en el JSON):
- "mito": mitos colombianos e indígenas (el mohán, la madremonte, la llorona, el dorado, el hombre caimán, duendes, etc)
- "leyenda": leyendas de colegios, universidades, barrios, pueblos, salones abandonados, baños escolares, etc
- "urbana": sucesos raros en lugares cotidianos de ciudad, historias que "le pasaron a un amigo de un amigo"
- "otra": creepypasta, terror original, cuentos populares, lo que no encaja en los anteriores

TIPOS DE DINÁMICAS (usa estos valores en condicion.tipo):
- "subir_historia": publicar una historia. Da idea concreta de qué contar y en qué categoría
- "comentar": comentar historias de otros (especifica cantidad en condicion.cantidad)
- "recibir_like": recibir likes en tus propias historias (especifica cantidad)
- "estar_activo": leer historias completas en la app (especifica cantidad)

REGLAS PARA DESCRIPCIONES:
- Directas, concretas, motivadoras. Máximo 2 oraciones
- Da ideas específicas: no "sube un mito", sino "¿conoces la historia del mohán del río Magdalena? cuéntala antes de que se pierda"
- Usa jerga colombiana natural, no forzada
- Nunca empieces con "Soy Natal-IA" ni te presentes
- Ejemplos buenos:
  * "¿Tu universidad tiene salones con historia? Sube esa leyenda que todos conocen y nadie ha escrito. Los pesos son tuyos."
  * "Dale, comenta en 2 historias hoy. Un comentario sincero vale más que diez emojis."
  * "Esa historia urbana que te contaron y nunca olvidaste... hoy es el día de escribirla."

REGLAS PARA INSTRUCCIONES (campo instrucciones):
- Son los pasos exactos para completar el reto, los lee el usuario DESPUÉS de aceptarlo
- Máximo 3 oraciones, lenguaje casual colombiano
- Debe mencionar exactamente QUÉ hacer y CUÁNTO (si aplica)
- Ejemplos por tipo:
  * subir_historia: "Toca el botón + en la app. Escribe tu historia de [categoría] con mínimo 2-3 párrafos. Publícala y espera — Natal-IA verifica que sea de esa categoría."
  * comentar: "Entra a cualquier historia de la app y deja [N] comentarios sinceros. No vale spam ni 'buena'. Algo que aporte de verdad."
  * recibir_like: "Sube o revisa tus historias publicadas. Consigue que [N] personas te den like. Comparte en el chat si quieres que te lean."
  * estar_activo: "Abre [N] historias y léelas hasta el final — el sistema detecta cuando terminas de leer. No vale solo abrir y cerrar."

SISTEMA DE RECOMPENSAS (coins_reward debe ser múltiplo de 100):
- Muy fácil (leer 1 historia, comentar 1 vez): 100-200 pesos, xp 20-40
- Fácil (comentar 2-3 veces, estar activo): 200-500 pesos, xp 40-80
- Normal (subir 1 historia, comentar 4 veces): 500-1000 pesos (hasta 1 luka), xp 80-150
- Difícil (recibir 5+ likes, comentar 5+ veces): 2000-5000 pesos (2-5 lukas), xp 150-300
- Muy difícil (recibir 10+ likes, publicar 3+ historias): 10000-50000 (10-50 lukas), xp 300-500
- Legendario con medalla: 100000+ pesos (100+ lukas), xp 500+. Rarísimo, solo para algo verdaderamente especial
- El PALO (1000000 pesos): prácticamente imposible, solo si toda la comunidad debe participar

Responde SIEMPRE en JSON válido, sin texto extra, sin markdown, sin bloques de código.`,

      `Datos reales de U-PAZ ahorita: ${JSON.stringify(resumen, null, 2)}

Analiza los datos y crea 3 dinámicas variadas para HOY:
- Mira qué categoría tiene menos historias esta semana y priorízala
- Si hay pocos comentarios hoy, pon una dinámica de comentar
- Varía los tipos (no todo "subir_historia")
- Las descripciones NO empiezan con "Soy Natal-IA", van directo al grano con jerga colombiana
- Los coins_reward deben ser múltiplos de 100 (100, 200, 500, 1000, 2000, 5000...)
- Lo normal del día son 100-500 pesos en coins

Responde ÚNICAMENTE con este JSON:
{
  "dinamicas": [
    {
      "titulo": "título concreto y llamativo, máximo 6 palabras",
      "descripcion": "descripción directa, colombiana y específica, máximo 2 oraciones, sin presentarte",
      "instrucciones": "pasos claros de cómo completar el reto, máximo 3 oraciones cortas. Ej: 'Ve a la app y toca el botón +. Escribe una historia de mitos colombianos con mínimo 3 párrafos. Publícala y ¡listo!'",
      "tipo": "diaria",
      "condicion": {
        "tipo": "subir_historia",
        "categoria": "mito",
        "cantidad": 1
      },
      "xp_reward": 80,
      "coins_reward": 200,
      "tiene_medalla": false
    }
  ]
}`
    );
    const parsed = JSON.parse(raw);
    const dinamicas = parsed.dinamicas as any[];

    // 3. Insertar en DB como Natal-IA
    const ahora = new Date();
    const manana = new Date(ahora.getTime() + 86400000);

    const rows = dinamicas.map((d: any) => ({
      titulo: d.titulo,
      descripcion: d.descripcion,
      instrucciones: d.instrucciones ?? null,
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
