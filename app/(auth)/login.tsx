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
  Image,
  Pressable,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

const KEY_SESSION = 'session_active';

// 🎨 Paleta idéntica a la del feed
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
          'Te enviamos un nuevo correo de verificación. Revisa tu bandeja y confirma tu cuenta.',
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
              'Revisa tu correo para confirmar tu cuenta. Si no lo ves, toca “Reenviar correo”.',
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
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Image
  source={require('../../assets/LoginSc.png')}
  style={s.bgImg}
/>
      <View style={s.wrap}>
        {/* Logo */}
        <View style={s.logoFrame}>
          <Image
            source={require('../../assets/icon.png')}
            style={s.logoImg}
            resizeMode="contain"
          />
        </View>

        <View style={s.card}>
          <TextInput
            placeholder="Correo"
            placeholderTextColor={C.textSecondary}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
          />

          {/* Contraseña centrada */}
          <View style={s.pwdWrap}>
            <TextInput
              placeholder="Contraseña"
              placeholderTextColor={C.textSecondary}
              secureTextEntry={!showPass}
              style={[s.input, s.inputPwd]}
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
                color={C.textSecondary}
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
              <ActivityIndicator color={C.textPrimary} />
            ) : (
              <Text style={s.btnText}>Iniciar sesión</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer fijo */}
        <View style={s.footer}>
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
  backgroundColor: 'rgba(0, 0, 0, 0.45)', // fondo semitransparente sobre la imagen
  padding: 20,
  justifyContent: 'center',
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
    right: -20  ,
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

  // ✅ Footer fijo
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
  },
  footerText: { color: C.textSecondary, textAlign: 'center' },
  link: { color: C.textPrimary, textDecorationLine: 'underline' },

  // Sheet styles
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
  bgImg: {
  ...StyleSheet.absoluteFillObject,
  opacity: 1,        // ajusta visibilidad
},
  sheetBtnPrimary: { backgroundColor: C.avatarBg, borderColor: C.avatarBorder },
  sheetBtnText: { fontWeight: '600', color: '#fff' },
});
