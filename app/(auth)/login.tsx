// app/(auth)/login.tsx
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
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

const KEY_SESSION = 'session_active';

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // ---- Sheet (mini notificación) ----
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

  // Reenviar correo de confirmación de signup
  async function resendConfirmEmail(to: string) {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: to,
      });
      if (error) throw error;

      setSheet({
        title: 'Correo reenviado',
        message:
          'Te enviamos un nuevo correo de verificación. Revisa tu bandeja de Gmail y confirma tu cuenta.',
        confirmText: 'Cerrar',
        onConfirm: () => setShowSheet(false),
        variant: 'info',
      });
      setShowSheet(true);
    } catch (e: any) {
      setSheet({
        title: 'No se pudo reenviar',
        message: e?.message ?? 'Intenta de nuevo en unos segundos.',
        confirmText: 'Cerrar',
        onConfirm: () => setShowSheet(false),
        variant: 'error',
      });
      setShowSheet(true);
    }
  }

  async function onLogin() {
    const mail = email.trim().toLowerCase();
    const pwd = pass.trim();

    if (!mail || !pwd) {
      setSheet({
        title: 'Campos faltantes',
        message: 'Ingresa tu correo y contraseña.',
        confirmText: 'Cerrar',
        onConfirm: () => setShowSheet(false),
        variant: 'error',
      });
      setShowSheet(true);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: mail,
        password: pwd,
      });

      if (error) {
        const raw = error.message || '';
        const isCreds =
          /invalid login/i.test(raw) ||
          /invalid login credentials/i.test(raw) ||
          /invalid email or password/i.test(raw);
        const isNotConfirmed = /confirm/i.test(raw) && /email/i.test(raw);

        if (isNotConfirmed) {
          setSheet({
            title: 'Correo no confirmado',
            message:
              'Revisa tu bandeja de Gmail para confirmar tu cuenta. Si no ves el correo, toca el botón de abajo para reenviarlo.',
            confirmText: 'Reenviar correo',
            onConfirm: () => {
              setShowSheet(false);
              resendConfirmEmail(mail);
            },
            variant: 'info',
          });
          setShowSheet(true);
          throw new Error('Correo no confirmado');
        }

        const msg = isCreds ? 'Correo o contraseña incorrectos.' : raw;
        throw new Error(msg || 'No se pudo iniciar sesión.');
      }

      const user = data.user;
      if (!user) throw new Error('No se pudo obtener el usuario.');

      // Carga display_name desde public.profiles
      let displayName = user.email?.split('@')[0] ?? 'Usuario';
      const { data: prof } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();

      if (prof?.display_name) displayName = prof.display_name;

      await AsyncStorage.setItem(
        KEY_SESSION,
        JSON.stringify({ email: user.email, name: displayName, uid: user.id })
      );

      router.replace('/');
    } catch (e: any) {
      const msg = e?.message ?? 'Intenta nuevamente.';
      if (!/no confirmado/i.test(msg)) {
        setSheet({
          title: 'Error al iniciar sesión',
          message: msg,
          confirmText: 'Cerrar',
          onConfirm: () => setShowSheet(false),
          variant: 'error',
        });
        setShowSheet(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0B0B0F' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.wrap}>
        <View style={s.logo} />

        <View style={s.card}>
          <TextInput
            placeholder="Correo"
            placeholderTextColor="#6B7280"
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
          />

          <View style={{ position: 'relative', marginTop: 12 }}>
            <TextInput
              placeholder="Contraseña"
              placeholderTextColor="#6B7280"
              secureTextEntry={!showPass}
              style={[s.input, { paddingRight: 44 }]}
              value={pass}
              onChangeText={setPass}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={onLogin}
            />
            <TouchableOpacity
              onPress={() => setShowPass(v => !v)}
              style={s.eyeBtn}
              hitSlop={10}
            >
              <Ionicons
                name={showPass ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#C1C1C7"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[s.btn, loading && { opacity: 0.7 }]}
            onPress={onLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#F3F4F6" />
            ) : (
              <Text style={s.btnText}>Iniciar sesión</Text>
            )}
          </TouchableOpacity>

          <Text style={s.footerText}>
            ¿No tienes una cuenta?{' '}
            <Link href="/(auth)/register" style={s.link}>
              Regístrate
            </Link>
          </Text>
        </View>
      </View>

      {/* Sheet / mini notificación */}
      <Modal
        visible={showSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSheet(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View
              style={[
                s.iconWrap,
                sheet.variant === 'error'
                  ? { backgroundColor: '#3F1D1D', borderColor: '#7F1D1D' }
                  : { backgroundColor: '#1F2937', borderColor: '#374151' },
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
                <Text style={[s.sheetBtnText, { color: '#fff' }]}>{sheet.confirmText}</Text>
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
    backgroundColor: '#0B0B0F',
    padding: 20,
    justifyContent: 'center',
  },
  logo: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#1F2937',
    marginBottom: 28,
  },
  card: { gap: 0 },
  input: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
    color: '#F3F4F6',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  btn: {
    marginTop: 16,
    backgroundColor: '#1F2937',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  btnText: { color: '#F3F4F6', fontWeight: '600' },
  footerText: { color: '#A1A1AA', marginTop: 16, textAlign: 'center' },
  link: { color: '#4F46E5' },

  // Sheet styles
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#121219',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#1F1F27',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: { color: '#F3F4F6', fontWeight: '700', fontSize: 18, textAlign: 'center' },
  sheetMsg: { color: '#D1D5DB', textAlign: 'center', marginTop: 6 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16, justifyContent: 'center' },
  sheetBtn: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sheetBtnPrimary: { backgroundColor: '#1F2937', borderColor: '#27272A' },
  sheetBtnText: { fontWeight: '600' },
});