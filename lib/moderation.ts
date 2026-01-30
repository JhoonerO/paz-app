// lib/moderation.ts

const API_USER = process.env.EXPO_PUBLIC_SIGHTENGINE_API_USER;
const API_SECRET = process.env.EXPO_PUBLIC_SIGHTENGINE_API_SECRET;

export async function moderateImage(imageUri: string): Promise<{
  isApproved: boolean;
  reason?: string;
}> {
  try {
    const formData = new FormData();
    
    // @ts-ignore
    formData.append('media', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'image.jpg',
    });
    
    formData.append('models', 'nudity-2.0,wad,offensive');
    formData.append('api_user', API_USER!);
    formData.append('api_secret', API_SECRET!);

    const apiResponse = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    const result = await apiResponse.json();
    console.log('Respuesta de Sightengine:', result);

    if (result.error) {
      console.error('Error de Sightengine:', result.error);
      return { isApproved: false, reason: 'Error al verificar la imagen. Intenta de nuevo.' };
    }

    // 👇 UMBRALES MÁS ESTRICTOS

    // 1. Rechazar si "none" (sin contenido inapropiado) es bajo
    // Si none < 0.4 = hay algo sospechoso
    if (result.nudity?.none < 0.4) {
      return { isApproved: false, reason: 'Contenido inapropiado detectado' };
    }

    // 2. Rechazar contenido erótico/artístico
    if (result.nudity?.erotica > 0.4) {
      return { isApproved: false, reason: 'Contenido erótico detectado' };
    }

    // 3. Rechazar actividad sexual (MUY ESTRICTO)
    if (result.nudity?.sexual_activity > 0.15) {
      return { isApproved: false, reason: 'Contenido sexual explícito detectado' };
    }

    // 4. Rechazar exposición sexual (genitales, senos explícitos)
    if (result.nudity?.sexual_display > 0.2) {
      return { isApproved: false, reason: 'Contenido sexual explícito detectado' };
    }

    // 5. Rechazar contenido sugestivo alto
    if (result.nudity?.suggestive > 0.5) {
      return { isApproved: false, reason: 'Contenido inapropiado detectado' };
    }

    // 6. Rechazar si tiene partes íntimas visibles (cleavage alto, etc)
    const suggestiveClasses = result.nudity?.suggestive_classes || {};
    if (suggestiveClasses.cleavage > 0.6 || suggestiveClasses.bikini > 0.7) {
      return { isApproved: false, reason: 'Contenido inapropiado detectado' };
    }

    // 7. Rechazar contenido ofensivo
    if (result.offensive?.prob > 0.6) {
      return { isApproved: false, reason: 'Contenido ofensivo detectado' };
    }

    // 8. Rechazar armas y drogas ilegales
    if (result.weapon > 0.7 || result.drugs > 0.7) {
      return { isApproved: false, reason: 'Contenido inapropiado detectado' };
    }

    // Imagen aprobada ✅
    return { isApproved: true };
  } catch (error: any) {
    console.error('Error en moderación:', error);
    return { isApproved: false, reason: 'No se pudo verificar la imagen. Intenta de nuevo.' };
  }
}
