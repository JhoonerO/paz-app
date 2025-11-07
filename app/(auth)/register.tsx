// app/(auth)/register.tsx
import { useState, useRef } from 'react';
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
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';

// 👇 DESCOMENTAR ESTO PARA PERMITIR CORREOS GMAIL NORMALES
//const ALLOW_ANY_EMAIL = true;
const ALLOW_ANY_EMAIL = false; // Solo UNIPAZ

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
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [showTermsSheet, setShowTermsSheet] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);

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

  function redirectUrl() {
    return Linking.createURL('/auth/callback');
  }

  const scrollToInput = (yOffset: number) => {
    scrollViewRef.current?.scrollTo({
      y: yOffset,
      animated: true,
    });
  };

  async function completeRegister() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

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

      setShowTermsSheet(false);
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

  async function onRegister() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail || !pass.trim() || !confirmPass.trim()) {
      setSheet({
        title: 'Campos faltantes',
        message: 'Nombre, correo, contraseña y confirmación son obligatorios.',
        confirmText: 'Cerrar',
        onConfirm: () => setShowConfirmSheet(false),
        variant: 'error',
      });
      setShowConfirmSheet(true);
      return;
    }

    if (pass !== confirmPass) {
      setSheet({
        title: 'Contraseñas no coinciden',
        message: 'Las contraseñas no son iguales. Intenta de nuevo.',
        confirmText: 'Cerrar',
        onConfirm: () => setShowConfirmSheet(false),
        variant: 'error',
      });
      setShowConfirmSheet(true);
      return;
    }

    // Validación de correo con variable
    const isValidEmail = ALLOW_ANY_EMAIL 
      ? trimmedEmail.endsWith('@gmail.com') || trimmedEmail.endsWith('@unipaz.edu.co')
      : trimmedEmail.endsWith('@unipaz.edu.co');

    if (!isValidEmail) {
      const message = ALLOW_ANY_EMAIL
        ? 'Solo se permiten correos de UNIPAZ (@unipaz.edu.co) o Gmail.'
        : 'Solo se permiten correos institucionales de la UNIPAZ (@unipaz.edu.co).';
      
      setSheet({
        title: 'Correo no permitido',
        message,
        confirmText: 'Cerrar',
        onConfirm: () => setShowConfirmSheet(false),
        variant: 'error',
      });
      setShowConfirmSheet(true);
      return;
    }

    // Mostrar modal de términos
    setAcceptedTerms(false);
    setShowTermsSheet(true);
  }

  return (
    <View style={{ flex: 1 }}>
      <Image source={require('../../assets/LoginSc.png')} style={s.bgImg} />
      
      <View style={s.overlayFixed} pointerEvents="none" />
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[s.wrap, { paddingBottom: insets.bottom + 24 }]}>
              <View style={s.logoFrame}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={s.logoImg}
                  resizeMode="contain"
                />
              </View>

              <View style={s.card}>
                <TextInput
                  placeholder="Nombre de usuario"
                  placeholderTextColor={C.textSecondary}
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => scrollToInput(0)}
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
                  onFocus={() => scrollToInput(80)}
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
                    onFocus={() => scrollToInput(160)}
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

                <View style={[s.pwdWrap, { marginTop: 12 }]}>
                  <TextInput
                    placeholder="Confirmar contraseña"
                    placeholderTextColor={C.textSecondary}
                    secureTextEntry={!showConfirmPass}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[s.input, s.inputPwd]}
                    value={confirmPass}
                    onChangeText={setConfirmPass}
                    returnKeyType="go"
                    onSubmitEditing={onRegister}
                    onFocus={() => scrollToInput(240)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPass(v => !v)}
                    style={s.eyeBtn}
                    hitSlop={10}
                  >
                    <Ionicons
                      name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'}
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
                  {loading ? (
                    <ActivityIndicator color={C.textPrimary} />
                  ) : (
                    <Text style={s.btnText}>Crear cuenta</Text>
                  )}
                </TouchableOpacity>

                <View style={s.footer}>
                  <Text style={s.footerText}>
                    ¿Ya tienes cuenta?{' '}
                    <Link href="/(auth)/login" asChild>
                      <TouchableOpacity>
                        <Text style={s.link}>Inicia sesión</Text>
                      </TouchableOpacity>
                    </Link>
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* MODAL TÉRMINOS Y CONDICIONES */}
      <Modal
        visible={showTermsSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTermsSheet(false)}
      >
        <View style={[s.termsOverlay, { paddingBottom: insets.bottom }]}>
          <Pressable style={s.termsBackdrop} onPress={() => setShowTermsSheet(false)} />
          <View style={s.termsSheet}>
            <Text style={s.termsTitle}>Términos y Condiciones</Text>
            <Text style={s.termsText}>
              Al crear una cuenta, aceptas nuestros términos y condiciones. Tu contenido debe ser respetable y acorde con los valores institucionales de la UNIPAZ.
            </Text>

            <View style={s.termsCheckbox}>
              <TouchableOpacity
                style={[s.checkBox, acceptedTerms && s.checkBoxChecked]}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
              >
                {acceptedTerms && (
                  <Ionicons name="checkmark" size={16} color={C.textPrimary} />
                )}
              </TouchableOpacity>
              <Text style={s.checkText}>Acepto los términos y condiciones</Text>
            </View>

            <TouchableOpacity
              style={[s.termsBtn, !acceptedTerms && { opacity: 0.5 }]}
              onPress={completeRegister}
              disabled={!acceptedTerms || loading}
            >
              {loading ? (
                <ActivityIndicator color={C.textPrimary} />
              ) : (
                <Text style={s.termsBtnText}>Crear cuenta</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL NOTIFICACIÓN */}
      <Modal
        visible={showConfirmSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmSheet(false)}
      >
        <View style={[s.overlay, { paddingBottom: insets.bottom }]}>
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
    </View>
  );
}

const s = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  wrap: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },

  overlayFixed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
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

  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
  footerText: { color: C.textSecondary, textAlign: 'center', fontSize: 14 },
  link: { color: C.textPrimary, textDecorationLine: 'underline', fontSize: 14 },

  // TÉRMINOS
  termsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  termsBackdrop: { flex: 1 },
  termsSheet: {
    width: '100%',
    backgroundColor: C.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderTopWidth: 1,
    borderColor: C.cardBorder,
  },
  termsTitle: {
    color: C.textPrimary,
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  termsText: {
    color: C.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  termsCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.avatarBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkBoxChecked: {
    backgroundColor: C.avatarBg,
    borderColor: '#93C5FD',
  },
  checkText: {
    color: C.textPrimary,
    fontSize: 14,
    flex: 1,
  },
  termsBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.avatarBg,
    borderWidth: 1,
    borderColor: C.avatarBorder,
  },
  termsBtnText: {
    fontWeight: '600',
    color: C.textPrimary,
    fontSize: 16,
  },

  // NOTIFICACIÓN
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
