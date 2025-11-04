// lib/email.ts

const RESEND_API_KEY = 're_ZhmBUV1w_ETv8UrakiHopSxcCxbG7YuYN';
const ADMIN_EMAIL = 'soporte.upaz@gmail.com'; // 👈 TU CORREO

export async function sendCodeToAdmin(userEmail: string, code: string) {
  try {
    console.log('📧 Enviando código al admin:', ADMIN_EMAIL);
    console.log('👤 Usuario:', userEmail);
    console.log('🔐 Código:', code);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: [ADMIN_EMAIL], // 👈 SOLO A TI
        subject: '🔐 Código de recuperación solicitado - U-PAZ',
        html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000000;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #000000; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #010102; border: 1px solid #181818; border-radius: 16px; max-width: 600px;">
          
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="width: 80px; height: 80px; background-color: #0F1016; border: 1px solid #2C2C33; border-radius: 40px; margin: 0 auto 24px; display: inline-flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px;">👤</span>
              </div>
              <h1 style="margin: 0 0 12px; font-size: 28px; font-weight: 700; color: #F3F4F6; letter-spacing: -0.5px;">
                Solicitud de recuperación
              </h1>
              <p style="margin: 0; font-size: 16px; color: #A1A1AA; line-height: 1.5;">
                Un usuario solicitó recuperar su contraseña
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 20px;">
              <div style="background-color: #0f0f0f; border: 1px solid #181818; border-radius: 10px; padding: 20px;">
                <p style="margin: 0 0 12px; font-size: 14px; color: #F3F4F6; line-height: 1.6;">
                  📧 <strong>Email del usuario:</strong>
                </p>
                <p style="margin: 0 0 20px; font-size: 16px; color: #32808D; font-weight: 600;">
                  ${userEmail}
                </p>
                
                <p style="margin: 0 0 12px; font-size: 14px; color: #F3F4F6; line-height: 1.6;">
                  🔐 <strong>Código de recuperación:</strong>
                </p>
                <div style="background-color: #000; border: 2px solid #F3F4F6; border-radius: 10px; padding: 16px; text-align: center;">
                  <div style="font-size: 32px; font-weight: 700; color: #F3F4F6; letter-spacing: 6px; font-family: 'Courier New', monospace;">
                    ${code}
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="background-color: #0f0f0f; border: 1px solid #181818; border-radius: 10px; padding: 20px;">
                <p style="margin: 0 0 12px; font-size: 14px; color: #F3F4F6; line-height: 1.6;">
                  ⏱️ <strong>Este código expira en 10 minutos</strong>
                </p>
                <p style="margin: 0; font-size: 14px; color: #A1A1AA; line-height: 1.6;">
                  Pásale este código al usuario <strong>${userEmail}</strong> para que pueda restablecer su contraseña.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 20px 40px 40px; text-align: center; border-top: 1px solid #181818;">
              <p style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #F3F4F6; letter-spacing: 2px;">
                U-PAZ
              </p>
              <p style="margin: 0; font-size: 12px; color: #A1A1AA;">
                Historias paranormales de la UNIP
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error de Resend:', data);
      throw new Error(data.message || 'Error al enviar email');
    }

    console.log('✅ Email enviado correctamente al admin');
    return data;
  } catch (error: any) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
}
