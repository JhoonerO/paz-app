// app/(auth)/register.tsx
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
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { TERMS, PRIVACY, LegalSection } from '../../lib/legal';

const C = {
  bg: '#000000ff',
  card: '#010102ff',
  cardBorder: '#181818ff',
  textPrimary: '#F3F4F6',
  textSecondary: '#A1A1AA',
  avatarBg: '#0F1016',
  avatarBorder: '#2C2C33',
  accent: '#93C5FD',
};

// ─── Modal reutilizable para mostrar Terms o Privacy ─────────────────────────
function LegalModal({
  visible,
  sections,
  onClose,
  insetBottom,
}: {
  visible: boolean;
  sections: LegalSection[];
  onClose: () => void;
  insetBottom: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[sl.overlay, { paddingBottom: insetBottom }]}>
        <Pressable style={sl.backdrop} onPress={onClose} />
        <View style={sl.sheet}>
          {/* Header */}
          <View style={sl.sheetHeader}>
            <Text style={sl.sheetHeaderTitle}>
              {sections[0]?.title ?? ''}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={C.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Contenido */}
          <ScrollView
            style={sl.scrollArea}
            contentContainerStyle={sl.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((section, i) => (
              <View key={i} style={sl.section}>
                {section.isHeader ? (
                  <Text style={sl.subtitle}>{section.subtitle}</Text>
                ) : (
                  <>
                    <Text style={sl.sectionTitle}>{section.title}</Text>
                    {section.body && (
                      <Text style={sl.sectionBody}>{section.body}</Text>
                    )}
                    {section.bullets?.map((b, j) => (
                      <View key={j} style={sl.bulletRow}>
                        <Text style={sl.bullet}>•</Text>
                        <Text style={sl.bulletText}>{b}</Text>
                      </View>
                    ))}
                    {section.note && (
                      <View style={sl.noteBox}>
                        <Text style={sl.noteText}>{section.note}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Botón cerrar */}
          <View style={sl.closeFooter}>
            <TouchableOpacity style={sl.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={sl.closeBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [restrictUnipaz, setRestrictUnipaz] = useState(true);

  // Modales legales
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Modal de notificación
  const [showNotifSheet, setShowNotifSheet] = useState(false);
  const [notif, setNotif] = useState<{
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
    variant: 'info' | 'error';
  }>({
    title: '',
    message: '',
    confirmText: 'OK',
    onConfirm: () => setShowNotifSheet(false),
    variant: 'info',
  });

  function showNotification(
    title: string,
    message: string,
    variant: 'info' | 'error' = 'info',
    confirmText = 'Cerrar',
    onConfirm?: () => void
  ) {
    setNotif({
      title,
      message,
      confirmText,
      variant,
      onConfirm: onConfirm ?? (() => setShowNotifSheet(false)),
    });
    setShowNotifSheet(true);
  }

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'restrict_unipaz_email')
      .single()
      .then(({ data }) => {
        if (data !== null) setRestrictUnipaz(Boolean(data.value));
      });
  }, []);

  function redirectUrl() {
    return Linking.createURL('/auth/callback');
  }

  async function onRegister() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail || !pass.trim() || !confirmPass.trim()) {
      showNotification(
        'Campos faltantes',
        'Nombre, correo, contraseña y confirmación son obligatorios.',
        'error'
      );
      return;
    }

    if (pass !== confirmPass) {
      showNotification(
        'Contraseñas no coinciden',
        'Las contraseñas no son iguales. Intenta de nuevo.',
        'error'
      );
      return;
    }

    if (!acceptedTerms) {
      showNotification(
        'Términos requeridos',
        'Debes aceptar los Términos y la Política de Privacidad para continuar.',
        'error'
      );
      return;
    }

    if (restrictUnipaz && !trimmedEmail.endsWith('@unipaz.edu.co')) {
      showNotification(
        'Correo no permitido',
        'El registro está disponible solo para correos institucionales @unipaz.edu.co.',
        'error'
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: pass,
        options: {
          data: { 
            display_name: trimmedName,
            username: trimmedName  // misma variable, mismo campo
          },
          emailRedirectTo: redirectUrl(),
        },
      });
      if (error) throw error;

      showNotification(
        'Confirma tu correo',
        'Te enviamos un correo de verificación. Ábrelo, confirma tu cuenta y luego inicia sesión.',
        'info',
        'Ir a iniciar sesión',
        () => {
          setShowNotifSheet(false);
          router.push('/(auth)/login');
        }
      );
    } catch (e: any) {
      showNotification('Error', e?.message ?? 'No se pudo registrar.', 'error');
    } finally {
      setLoading(false);
    }
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
                {/* Nombre */}
                <TextInput
                  placeholder="Nombre de usuario"
                  placeholderTextColor={C.textSecondary}
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                />

                {/* Correo */}
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

                {restrictUnipaz && (
                  <Text style={s.domainHint}>Solo correos @unipaz.edu.co</Text>
                )}

                {/* Contraseña */}
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
                  />
                  <TouchableOpacity
                    onPress={() => setShowPass((v) => !v)}
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

                {/* Confirmar contraseña */}
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
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPass((v) => !v)}
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

                {/* ✅ Checkbox siempre visible con links clickeables */}
                <View style={s.checkRow}>
                  <TouchableOpacity
                    style={[s.checkBox, acceptedTerms && s.checkBoxChecked]}
                    onPress={() => setAcceptedTerms((v) => !v)}
                    hitSlop={8}
                  >
                    {acceptedTerms && (
                      <Ionicons name="checkmark" size={14} color={C.textPrimary} />
                    )}
                  </TouchableOpacity>

                  <Text style={s.checkLabel}>
                    <Text style={s.checkLabelPlain}>Acepto los </Text>
                    <Text
                      style={s.checkLabelLink}
                      onPress={() => setShowTermsModal(true)}
                    >
                      Términos y Condiciones
                    </Text>
                    <Text style={s.checkLabelPlain}> y la </Text>
                    <Text
                      style={s.checkLabelLink}
                      onPress={() => setShowPrivacyModal(true)}
                    >
                      Política de Privacidad
                    </Text>
                    <Text style={s.checkLabelPlain}>.</Text>
                  </Text>
                </View>

                {/* Botón crear */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[s.btn, (!acceptedTerms || loading) && { opacity: 0.45 }]}
                  onPress={onRegister}
                  disabled={!acceptedTerms || loading}
                >
                  {loading ? (
                    <ActivityIndicator color={C.textPrimary} />
                  ) : (
                    <Text style={s.btnText}>Crear cuenta</Text>
                  )}
                </TouchableOpacity>

                <View style={s.footer}>
                  <Text style={s.footerText}>¿Ya tienes cuenta? </Text>
                  <TouchableOpacity onPress={() => router.back()}>
                    <Text style={s.link}>Inicia sesión</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* ── Modal Términos ───────────────────────────────────────────────── */}
      <LegalModal
        visible={showTermsModal}
        sections={TERMS}
        onClose={() => setShowTermsModal(false)}
        insetBottom={insets.bottom}
      />

      {/* ── Modal Privacidad ─────────────────────────────────────────────── */}
      <LegalModal
        visible={showPrivacyModal}
        sections={PRIVACY}
        onClose={() => setShowPrivacyModal(false)}
        insetBottom={insets.bottom}
      />

      {/* ── Modal notificación ───────────────────────────────────────────── */}
      <Modal
        visible={showNotifSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifSheet(false)}
      >
        <View style={[s.overlay, { paddingBottom: insets.bottom }]}>
          <Pressable style={s.backdrop} onPress={() => setShowNotifSheet(false)} />
          <View style={s.sheet}>
            <View
              style={[
                s.iconWrap,
                notif.variant === 'error'
                  ? { backgroundColor: '#3F1D1D', borderColor: '#7F1D1D' }
                  : { backgroundColor: C.avatarBg, borderColor: C.avatarBorder },
              ]}
            >
              <Ionicons
                name={notif.variant === 'error' ? 'alert-circle' : 'information-circle'}
                size={24}
                color={notif.variant === 'error' ? '#F87171' : C.accent}
              />
            </View>
            <Text style={s.sheetTitle}>{notif.title}</Text>
            <Text style={s.sheetMsg}>{notif.message}</Text>
            <View style={s.sheetActions}>
              <TouchableOpacity
                style={[s.sheetBtn, s.sheetBtnPrimary]}
                onPress={notif.onConfirm}
              >
                <Text style={s.sheetBtnText}>{notif.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Estilos base ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  wrap: { flex: 1, padding: 20, justifyContent: 'center' },
  overlayFixed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bgImg: { ...StyleSheet.absoluteFillObject, opacity: 1 },
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
  // ✅ Checkbox row
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    paddingHorizontal: 4,
    gap: 10,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.avatarBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkBoxChecked: { backgroundColor: C.avatarBg, borderColor: C.accent },
  checkLabel: { flex: 1, lineHeight: 20 },
  checkLabelPlain: { color: C.textSecondary, fontSize: 13 },
  checkLabelLink: {
    color: C.accent,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  btn: {
    marginTop: 18,
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
  footer: { marginTop: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: C.textSecondary, fontSize: 14 },
  link: { color: C.textPrimary, textDecorationLine: 'underline', fontSize: 14 },
  domainHint: { color: '#6B7280', fontSize: 11, textAlign: 'center', marginTop: 4 },
  // Notificación
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
  sheetTitle: { color: C.textPrimary, fontWeight: '700', fontSize: 18, textAlign: 'center' },
  sheetMsg: { color: C.textSecondary, textAlign: 'center', marginTop: 6 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16, justifyContent: 'center' },
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

// ─── Estilos del modal legal ──────────────────────────────────────────────────
const sl = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: '#010102ff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#181818ff',
    height: '88%',      // ← altura fija para que flex funcione
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#181818ff',
  },
  sheetHeaderTitle: {
    color: '#F3F4F6',
    fontWeight: '700',
    fontSize: 16,
  },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 8 },
  section: { marginBottom: 18 },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#F3F4F6',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 6,
  },
  sectionBody: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    paddingLeft: 4,
  },
  bullet: { color: '#93C5FD', fontSize: 13, lineHeight: 20 },
  bulletText: { color: '#D1D5DB', fontSize: 13, lineHeight: 20, flex: 1 },
  noteBox: {
    backgroundColor: '#0F1016',
    borderLeftWidth: 3,
    borderLeftColor: '#93C5FD',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  noteText: { color: '#A1A1AA', fontSize: 12, lineHeight: 18 },
  closeFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#181818ff',
  },
  closeBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1016',
    borderWidth: 1,
    borderColor: '#2C2C33',
  },
  closeBtnText: { fontWeight: '600', color: '#F3F4F6', fontSize: 15 },
});
