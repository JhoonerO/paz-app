// lib/legal.ts

export type LegalSection = {
  title: string;
  subtitle?: string;
  isHeader?: boolean;
  body?: string;
  bullets?: string[];
  note?: string;
};


export const TERMS: LegalSection[] = [
  {
    title: 'Términos y Condiciones',
    subtitle: 'Última actualización: 5 de febrero de 2026',
    isHeader: true,
  },
  {
    title: '1. Aceptación de los Términos',
    body: 'Al acceder y utilizar U-Paz (en adelante, "la Plataforma"), aceptas estar sujeto a estos Términos y Condiciones, todas las leyes y regulaciones aplicables, y aceptas que eres responsable del cumplimiento de las leyes locales aplicables. Si no estás de acuerdo con alguno de estos términos, tienes prohibido usar o acceder a esta Plataforma.',
  },
  {
    title: '2. Descripción del Servicio',
    body: 'U-Paz es una plataforma social exclusiva para la comunidad del Instituto Universitario de la Paz que permite:',
    bullets: [
      'Publicar y visualizar historias y contenido multimedia',
      'Interactuar con publicaciones mediante comentarios y reacciones',
      'Participar en dinámicas y desafíos para obtener insignias y reconocimientos',
      'Personalizar la privacidad de tu perfil y actividad (likes, comentarios, etc.)',
      'Conectar con otros miembros de la comunidad universitaria',
    ],
  },
  {
    title: '3. Requisitos de Elegibilidad',
    body: 'Para crear una cuenta en U-Paz, debes ser estudiante, docente, administrativo o personal autorizado del Instituto Universitario de la Paz, y contar con un correo electrónico institucional válido (@unipaz.edu.co). Al registrarte, garantizas que la información proporcionada es veraz, precisa y actualizada.',
  },
  {
    title: '4. Normas de Contenido y Conducta',
    body: 'Al utilizar U-Paz, te comprometes a NO publicar, compartir o distribuir contenido que:',
    bullets: [
      'Sea de naturaleza sexual, pornográfico, explícito o para adultos (+18)',
      'Incluya violencia gráfica, contenido gore o que incite al daño físico',
      'Promueva el odio, discriminación, acoso o bullying hacia personas o grupos',
      'Viole derechos de autor, marcas registradas o propiedad intelectual de terceros',
      'Contenga información falsa, engañosa o fraudulenta',
      'Viole la privacidad de otras personas (doxxing, datos personales sin consentimiento)',
      'Promueva actividades ilegales o peligrosas',
      'Contenga spam, publicidad no autorizada o esquemas piramidales',
    ],
    note: 'Sistema de moderación con IA: Todas las imágenes de portada de historias y publicaciones pasan por un sistema de detección automática basado en inteligencia artificial para identificar contenido inadecuado.',
  },
  {
    title: '5. Moderación y Sanciones',
    body: 'El equipo de administración de U-Paz se reserva el derecho de revisar, editar, eliminar o rechazar cualquier contenido que considere inapropiado sin previo aviso. Las sanciones pueden incluir:',
    bullets: [
      'Eliminación del contenido infractor',
      'Advertencia formal al usuario',
      'Suspensión temporal de la cuenta (de 7 a 30 días)',
      'Suspensión permanente y eliminación de la cuenta',
      'Reporte a las autoridades competentes en casos de contenido ilegal',
    ],
  },
  {
    title: '6. Propiedad Intelectual',
    body: 'Conservas todos los derechos sobre el contenido que publicas en U-Paz. Sin embargo, al subir contenido, otorgas a U-Paz una licencia mundial, no exclusiva, libre de regalías y transferible para usar, reproducir, distribuir, preparar trabajos derivados, mostrar y ejecutar dicho contenido en relación con los servicios de la Plataforma.\n\nTodos los elementos de diseño, código, logotipos, textos y gráficos de U-Paz son propiedad exclusiva del Instituto Universitario de la Paz y están protegidos por las leyes de propiedad intelectual de Colombia.',
  },
  {
    title: '7. Privacidad y Protección de Datos',
    body: 'U-Paz cumple con la Ley 1581 de 2012 de Protección de Datos Personales de Colombia. Tu información personal será tratada conforme a nuestra Política de Privacidad. Puedes:',
    bullets: [
      'Configurar la visibilidad de tus likes (público/privado)',
      'Controlar quién puede comentar tus publicaciones',
      'Solicitar la descarga de tus datos personales',
      'Solicitar la eliminación permanente de tu cuenta y datos',
    ],
  },
  {
    title: '8. Sistema de Insignias y Gamificación',
    body: 'U-Paz implementa un sistema de reconocimientos y dinámicas donde puedes obtener insignias por participación activa, logros académicos o contribuciones a la comunidad. Estas insignias son puramente simbólicas, no tienen valor monetario y pueden ser revocadas si se detecta comportamiento fraudulento.',
  },
  {
    title: '9. Limitación de Responsabilidad',
    body: 'U-Paz se proporciona "tal cual" sin garantías de ningún tipo. El Instituto Universitario de la Paz no se hace responsable por:',
    bullets: [
      'Pérdida de datos o contenido debido a fallas técnicas',
      'Daños derivados del uso o imposibilidad de uso de la Plataforma',
      'Contenido publicado por otros usuarios',
      'Interacciones entre usuarios fuera de la Plataforma',
    ],
  },
  {
    title: '10. Modificaciones a los Términos',
    body: 'Nos reservamos el derecho de modificar estos Términos y Condiciones en cualquier momento. Las modificaciones entrarán en vigor inmediatamente después de su publicación. Tu uso continuado de U-Paz después de dichos cambios constituye tu aceptación de los nuevos términos.',
  },
  {
    title: '11. Terminación de Cuenta',
    body: 'Puedes eliminar tu cuenta en cualquier momento desde la configuración de tu perfil. Nos reservamos el derecho de suspender o terminar tu cuenta si violas estos términos o si tu afiliación con el Instituto Universitario de la Paz termina.',
  },
  {
    title: '12. Ley Aplicable y Jurisdicción',
    body: 'Estos Términos se rigen por las leyes de la República de Colombia. Cualquier disputa relacionada con estos términos será resuelta en los tribunales competentes de Santander, Colombia.',
  },
  {
    title: '13. Contacto',
    body: 'Para preguntas sobre estos Términos y Condiciones:\n\nEmail: soporte@unipaz.edu.co\nPlataforma: U-Paz (Instituto Universitario de la Paz)',
  },
];

export const PRIVACY: LegalSection[] = [
  {
    title: 'Política de Privacidad',
    subtitle: 'Última actualización: 5 de febrero de 2026',
    isHeader: true,
  },
  {
    title: '1. Información que Recopilamos',
    body: 'Recopilamos la siguiente información cuando usas U-Paz:',
    bullets: [
      'Información de registro: nombre, correo institucional, contraseña encriptada',
      'Información de perfil: foto de perfil, biografía, programa académico',
      'Contenido generado: publicaciones, historias, comentarios, reacciones',
      'Datos de uso: interacciones, tiempo en la plataforma, preferencias',
      'Datos técnicos: dirección IP, tipo de dispositivo, navegador',
    ],
  },
  {
    title: '2. Cómo Usamos tu Información',
    body: 'Utilizamos tu información para:',
    bullets: [
      'Proporcionar y mejorar los servicios de U-Paz',
      'Personalizar tu experiencia y mostrarte contenido relevante',
      'Moderar contenido y detectar violaciones a nuestras normas',
      'Enviar notificaciones sobre actividad en tu cuenta',
      'Analizar patrones de uso y mejorar la plataforma',
      'Prevenir fraude, abuso y actividades maliciosas',
    ],
  },
  {
    title: '3. Detección Automática de Contenido',
    body: 'Utilizamos tecnología de inteligencia artificial para analizar imágenes subidas a la plataforma con el fin de detectar contenido inapropiado, violento o para adultos. Este análisis es automático y puede resultar en el rechazo de tu publicación si se detecta contenido que viole nuestras normas.',
  },
  {
    title: '4. Compartir Información',
    body: 'NO vendemos tu información personal a terceros. Podemos compartir información con:',
    bullets: [
      'Otros usuarios según tu configuración de privacidad',
      'Proveedores de servicios técnicos (alojamiento, almacenamiento en la nube)',
      'Autoridades legales cuando sea requerido por ley',
    ],
  },
  {
    title: '5. Tus Derechos',
    body: 'Según la Ley 1581 de 2012 de Colombia, tienes derecho a:',
    bullets: [
      'Acceder a tu información personal',
      'Actualizar o corregir tus datos',
      'Solicitar la eliminación de tu cuenta y datos',
      'Revocar autorizaciones otorgadas',
      'Descargar una copia de tus datos',
    ],
  },
  {
    title: '6. Seguridad de Datos',
    body: 'Implementamos medidas de seguridad técnicas y organizativas para proteger tu información, incluyendo encriptación de contraseñas, conexiones HTTPS y controles de acceso. Sin embargo, ningún sistema es 100% seguro y no podemos garantizar la seguridad absoluta.',
  },
  {
    title: '7. Retención de Datos',
    body: 'Conservamos tu información mientras tu cuenta esté activa o según sea necesario para cumplir con obligaciones legales. Cuando eliminas tu cuenta, tu información personal se elimina permanentemente en un plazo de 30 días, excepto datos que debamos conservar por requerimientos legales.',
  },
  {
    title: '8. Cookies y Tecnologías Similares',
    body: 'Utilizamos cookies y tecnologías similares para mantener tu sesión activa, recordar tus preferencias y analizar el uso de la plataforma. Puedes configurar tu navegador para rechazar cookies, pero esto puede afectar la funcionalidad.',
  },
  {
    title: '9. Cambios a esta Política',
    body: 'Podemos actualizar esta Política de Privacidad ocasionalmente. Te notificaremos sobre cambios significativos mediante un aviso en la plataforma o por correo electrónico.',
  },
  {
    title: '10. Contacto',
    body: 'Para ejercer tus derechos o hacer consultas sobre esta política:\n\nEmail: privacidad@unipaz.edu.co\nResponsable de Datos: Instituto Universitario de la Paz',
  },
];
