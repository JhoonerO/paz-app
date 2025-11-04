// app/(auth)/verify-code.tsx
import { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

const C = {
  bg: '#000000ff',
  card: '#010102ff',
  cardBorder: '#181818ff',
  textPrimary: '#F3F4F6',
  textSecondary: '#A1A1AA',
  avatarBg: '#0F1016',
  avatarBorder: '#2C2C33',
};

export default function VerifyCode() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

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

  function handleCodeChange(value: string, index: number) {
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (index === 5 && value) {
      verifyCode(newCode.join(''));
    }
  }

  function handleKeyPress(e: any, index: number) {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function verifyCode(fullCode?: string) {
    const codeToVerify = fullCode || code.join('');

    if (codeToVerify.length !== 6) {
      setSheet({
        title: 'Código incompleto',
        message: 'Ingresa los 6 dígitos del código.',
        confirmText: 'Cerrar',
        onConfirm: () => setShowSheet(false),
        variant: 'error',
      });
      setShowSheet(true);
      return;
    }

    setLoading(true);
    try {
      const { data: codeData, error: codeErr } = await supabase
        .from('password_reset_codes')
        .select('*')
        .eq('user_email', email)
        .eq('code', codeToVerify)
        .eq('used', false)
        .single();

      if (codeErr || !codeData) {
        throw new Error('Código incorrecto o ya usado.');
      }

      const now = new Date();
      const expiresAt = new Date(codeData.expires_at);

      if (now > expiresAt) {
        throw new Error('El código ha expirado. Solicita uno nuevo.');
      }

      await supabase
        .from('password_reset_codes')
        .update({ used: true })
        .eq('id', codeData.id);

      router.push({
        pathname: '/(auth)/reset-password',
        params: { email, code: codeToVerify },
      });
    } catch (e: any) {
      setSheet({
        title: 'Error',
        message: e?.message ?? 'Código incorrecto. Verifica e intenta de nuevo.',
        confirmText: 'Cerrar',
        onConfirm: () => setShowSheet(false),
        variant: 'error',
      });
      setShowSheet(true);

      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
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
            <Ionicons name="mail-outline" size={32} color={C.textPrimary} />
          </View>

          <Text style={s.title}>Verifica tu código</Text>
          <Text style={s.subtitle}>
            Ingresa el código de 6 dígitos que te proporcionaron
          </Text>

          <View style={s.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={ref => { inputRefs.current[index] = ref; }}
                style={[s.codeInput, digit && s.codeInputFilled]}
                value={digit}
                onChangeText={value => handleCodeChange(value, index)}
                onKeyPress={e => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={index === 0}
              />
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[s.btn, loading && { opacity: 0.7 }]}
            onPress={() => verifyCode()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.textPrimary} />
            ) : (
              <Text style={s.btnText}>Verificar</Text>
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
  codeContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  codeInput: { width: 48, height: 56, backgroundColor: '#0f0f0fff', borderRadius: 10, borderWidth: 2, borderColor: 'transparent', color: C.textPrimary, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  codeInputFilled: { borderColor: C.textPrimary },
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
