// app/(auth)/forgot-password.tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  Pressable,
  Alert,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { sendCodeToAdmin } from '../../lib/email';

const C = {
  bg: '#000000ff',
  card: '#010102ff',
  cardBorder: '#181818ff',
  textPrimary: '#F3F4F6',
  textSecondary: '#A1A1AA',
  avatarBg: '#0F1016',
  avatarBorder: '#2C2C33',
};

export default function ForgotPassword() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const [showSheet, setShowSheet] = useState(false);
  const [sheet, setSheet] = useState<{
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
    variant: 'info' | 'error';
  }>({
    title: '',
    message: '',
    confirmText: 'OK',
    onConfirm: () => setShowSheet(false),
    variant: 'info',
  });

  function generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async function sendResetCode() {
  const mail = email.trim().toLowerCase();

  if (!mail) {
    setSheet({
      title: 'Campo vacío',
      message: 'Ingresa tu correo electrónico.',
      confirmText: 'Cerrar',
      onConfirm: () => setShowSheet(false),
      variant: 'error',
    });
    setShowSheet(true);
    return;
  }

  setLoading(true);
  try {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Guardar en base de datos
    const { error: insertErr } = await supabase
      .from('password_reset_codes')
      .insert({
        user_email: mail,
        code: code,
        expires_at: expiresAt,
        used: false,
      });

    if (insertErr) throw insertErr;

    // 👇 ENVIAR EMAIL A TI (admin)
    await sendCodeToAdmin(mail, code);

    setSheet({
      title: 'Código generado',
      message: 'Se ha enviado un código al administrador. Pronto recibirás tu código de recuperación.',
      confirmText: 'Continuar',
      onConfirm: () => {
        setShowSheet(false);
        router.push({
          pathname: '/(auth)/verify-code',
          params: { email: mail },
        });
      },
      variant: 'info',
    });
    setShowSheet(true);
  } catch (e: any) {
    setSheet({
      title: 'Error',
      message: e?.message ?? 'No se pudo generar el código.',
      confirmText: 'Cerrar',
      onConfirm: () => setShowSheet(false),
      variant: 'error',
    });
    setShowSheet(true);
  } finally {
    setLoading(false);
  }
}


  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Image source={require('../../assets/LoginSc.png')} style={s.bgImg} />
      <View style={s.wrap}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color={C.textPrimary} />
        </TouchableOpacity>

        <View style={s.content}>
          <View style={s.iconCircle}>
            <Ionicons name="lock-closed-outline" size={32} color={C.textPrimary} />
          </View>

          <Text style={s.title}>¿Olvidaste tu contraseña?</Text>
          <Text style={s.subtitle}>
            Ingresa tu correo para generar un código de recuperación.
          </Text>

          <TextInput
            placeholder="Correo electrónico"
            placeholderTextColor={C.textSecondary}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            returnKeyType="send"
            onSubmitEditing={sendResetCode}
          />

          <TouchableOpacity
            activeOpacity={0.8}
            style={[s.btn, loading && { opacity: 0.7 }]}
            onPress={sendResetCode}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.textPrimary} />
            ) : (
              <Text style={s.btnText}>Generar código</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showSheet} transparent animationType="fade" onRequestClose={() => setShowSheet(false)}>
        <View style={s.overlay}>
          <Pressable style={s.backdrop} onPress={() => setShowSheet(false)} />
          <View style={s.sheet}>
            <View
              style={[
                s.iconWrap,
                sheet.variant === 'error'
                  ? { backgroundColor: '#3F1D1D', borderColor: '#7F1D1D' }
                  : { backgroundColor: C.avatarBg, borderColor: C.avatarBorder },
              ]}
            >
              <Ionicons
                name={sheet.variant === 'error' ? 'alert-circle' : 'information-circle'}
                size={24}
                color={sheet.variant === 'error' ? '#F87171' : '#93C5FD'}
              />
            </View>

            <Text style={s.sheetTitle}>{sheet.title}</Text>
            <Text style={s.sheetMsg}>{sheet.message}</Text>

            <View style={s.sheetActions}>
              <TouchableOpacity style={[s.sheetBtn, s.sheetBtnPrimary]} onPress={sheet.onConfirm}>
                <Text style={s.sheetBtnText}>{sheet.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', padding: 20 },
  bgImg: { ...StyleSheet.absoluteFillObject, opacity: 1 },
  backBtn: { marginTop: 50, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(15, 15, 15, 0.8)', alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.avatarBg, borderWidth: 1, borderColor: C.avatarBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { color: C.textPrimary, fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  subtitle: { color: C.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 32, paddingHorizontal: 20 },
  input: { backgroundColor: '#0f0f0fff', borderWidth: 0, borderRadius: 10, paddingHorizontal: 16, height: 48, color: C.textPrimary, textAlign: 'center', width: '100%', marginBottom: 16 },
  btn: { marginTop: 8, height: 48, width: '50%', borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1b1b1bff', backgroundColor: 'transparent' },
  btnText: { color: C.textPrimary, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  backdrop: { flex: 1 },
  sheet: { width: '100%', backgroundColor: C.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, borderTopWidth: 1, borderColor: C.cardBorder },
  iconWrap: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { color: C.textPrimary, fontWeight: '700', fontSize: 18, textAlign: 'center' },
  sheetMsg: { color: C.textSecondary, textAlign: 'center', marginTop: 6 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16, justifyContent: 'center' },
  sheetBtn: { height: 44, paddingHorizontal: 24, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  sheetBtnPrimary: { backgroundColor: C.avatarBg, borderColor: C.avatarBorder },
  sheetBtnText: { fontWeight: '600', color: '#fff' },
});
