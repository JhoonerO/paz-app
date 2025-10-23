// app/(auth)/register.tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  Pressable,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';

const C = {
  bg: '#000000ff',
  card: '#010102ff',
  cardBorder: '#181818ff',
  textPrimary: '#F3F4F6',
  textSecondary: '#A1A1AA',
  line: '#000000ff',
  avatarBg: '#0F1016',
  avatarBorder: '#2C2C33',
  like: '#ef4444',
};

export default function Register() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sheet de confirmación
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);

  function redirectUrl() {
    return Linking.createURL('/auth/callback');
  }

  async function onRegister() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !pass.trim()) {
      setSheet({
        title: 'Campos faltantes',
        message: 'Nombre, correo y contraseña son obligatorios.',
        confirmText: 'Cerrar',
        onConfirm: () => setShowConfirmSheet(false),
        variant: 'error',
      });
      setShowConfirmSheet(true);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: pass,
        options: {
          data: { display_name: trimmedName },
          emailRedirectTo: redirectUrl(),
        },
      });
      if (error) throw error;

      setSheet({
        title: 'Confirma tu correo',
        message:
          'Te enviamos un correo de verificación. Abre el email, confirma tu cuenta y luego inicia sesión.',
        confirmText: 'Ir a iniciar sesión',
        onConfirm: () => {
          setShowConfirmSheet(false);
          router.replace('/(auth)/login');
        },
        variant: 'info',
      });
      setShowConfirmSheet(true);
    } catch (e: any) {
      setSheet({
        title: 'Error',
        message: e?.message ?? 'No se pudo registrar.',
        confirmText: 'Cerrar',
        onConfirm: () => setShowConfirmSheet(false),
        variant: 'error',
      });
      setShowConfirmSheet(true);
    } finally {
      setLoading(false);
    }
  }

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
    onConfirm: () => setShowConfirmSheet(false),
    variant: 'info',
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Image source={require('../../assets/LoginSc.png')} style={s.bgImg} />

      <View style={s.wrap}>
        {/* Logo */}
        <View style={s.logoFrame}>
          <Image
            source={require('../../assets/icon.png')}
            style={s.logoImg}
            resizeMode="contain"
          />
        </View>

        {/* Inputs */}
        <View style={s.card}>
          <TextInput
            placeholder="Nombre de usuario"
            placeholderTextColor={C.textSecondary}
            style={s.input}
            value={name}
            onChangeText={setName}
          />

          <TextInput
            placeholder="Correo"
            placeholderTextColor={C.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[s.input, { marginTop: 12 }]}
            value={email}
            onChangeText={setEmail}
          />

          <View style={s.pwdWrap}>
            <TextInput
              placeholder="Contraseña"
              placeholderTextColor={C.textSecondary}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
              style={[s.input, s.inputPwd]}
              value={pass}
              onChangeText={setPass}
              returnKeyType="go"
              onSubmitEditing={onRegister}
            />
            <TouchableOpacity
              onPress={() => setShowPass(v => !v)}
              style={s.eyeBtn}
              hitSlop={10}
            >
              <Ionicons
                name={showPass ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={C.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[s.btn, loading && { opacity: 0.6 }]}
            onPress={onRegister}
            disabled={loading}
          >
            <Text style={s.btnText}>{loading ? 'Creando…' : 'Crear cuenta'}</Text>
          </TouchableOpacity>

          <Text style={s.footerText}>
            ¿Ya tienes cuenta?{' '}
            <Link href="/(auth)/login" style={s.link}>
              Inicia sesión
            </Link>
          </Text>
        </View>
      </View>

      {/* Mini notificación */}
      <Modal
        visible={showConfirmSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmSheet(false)}
      >
        <View style={s.overlay}>
          <Pressable style={s.backdrop} onPress={() => setShowConfirmSheet(false)} />
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
              <TouchableOpacity
                style={[s.sheetBtn, s.sheetBtnPrimary]}
                onPress={sheet.onConfirm}
              >
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
  wrap: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    padding: 20,
    justifyContent: 'center',
  },
  bgImg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },
  logoFrame: {
    alignSelf: 'center',
    marginBottom: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: { width: 250, height: 250 },
  card: { gap: 0 },

  input: {
    backgroundColor: '#0f0f0fff',
    borderWidth: 0,
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
    color: '#F3F4F6',
    textAlign: 'center',
    width: '100%',
    alignSelf: 'center',
  },
  inputPwd: {
    width: '125%',
    alignSelf: 'center',
    backgroundColor: '#0f0f0fff',
    borderRadius: 10,
    height: 48,
    color: '#F3F4F6',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  pwdWrap: {
    position: 'relative',
    marginTop: 12,
    width: '80%',
    alignSelf: 'center',
  },
  eyeBtn: {
    position: 'absolute',
    right: -20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  btn: {
    marginTop: 50,
    height: 48,
    width: '50%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1b1b1bff',
    backgroundColor: 'transparent',
  },
  btnText: { color: C.textPrimary, fontWeight: '600' },
  footerText: { color: C.textSecondary, marginTop: 16, textAlign: 'center' },
  link: { color: C.textPrimary, textDecorationLine: 'underline' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  backdrop: { flex: 1 },
  sheet: {
    width: '100%',
    backgroundColor: C.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderTopWidth: 1,
    borderColor: C.cardBorder,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    color: C.textPrimary,
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
  },
  sheetMsg: { color: C.textSecondary, textAlign: 'center', marginTop: 6 },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    justifyContent: 'center',
  },
  sheetBtn: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sheetBtnPrimary: { backgroundColor: C.avatarBg, borderColor: C.avatarBorder },
  sheetBtnText: { fontWeight: '600', color: '#fff' },
});
