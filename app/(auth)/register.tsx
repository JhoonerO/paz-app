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
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';

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
    // Debe coincidir con lo configurado en Supabase → Auth → Redirect URLs
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

      // No hacemos upsert al perfil: el trigger lo crea cuando el user es confirmado.
      // Mostramos el aviso bonito:
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

  // Estado/props para el sheet
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
      style={{ flex: 1, backgroundColor: '#0B0B0F' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.wrap}>
        {/* Logo/placeholder */}
        <View style={s.logo} />

        {/* Inputs */}
        <View style={s.card}>
          <TextInput
            placeholder="Nombre de usuario"
            placeholderTextColor="#6B7280"
            style={s.input}
            value={name}
            onChangeText={setName}
          />

          <TextInput
            placeholder="Correo"
            placeholderTextColor="#6B7280"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[s.input, { marginTop: 12 }]}
            value={email}
            onChangeText={setEmail}
          />

          <View style={{ position: 'relative', marginTop: 12 }}>
            <TextInput
              placeholder="Contraseña"
              placeholderTextColor="#6B7280"
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
              style={[s.input, { paddingRight: 44 }]}
              value={pass}
              onChangeText={setPass}
              returnKeyType="go"
              onSubmitEditing={onRegister}
            />
            <TouchableOpacity
              onPress={() => setShowPass((v) => !v)}
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

      {/* Mini notificación (sheet) igual estilo al de “Cerrar sesión” */}
      <Modal visible={showConfirmSheet} transparent animationType="fade" onRequestClose={() => setShowConfirmSheet(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={[s.iconWrap, sheet.variant === 'error' ? { backgroundColor: '#3F1D1D', borderColor: '#7F1D1D' } : { backgroundColor: '#1F2937', borderColor: '#374151' }]}>
              <Ionicons
                name={sheet.variant === 'error' ? 'alert-circle' : 'information-circle'}
                size={24}
                color={sheet.variant === 'error' ? '#F87171' : '#93C5FD'}
              />
            </View>

            <Text style={s.sheetTitle}>{sheet.title}</Text>
            <Text style={s.sheetMsg}>{sheet.message}</Text>

            <View style={s.sheetActions}>
              {sheet.variant === 'error' ? (
                <TouchableOpacity style={[s.sheetBtn, s.sheetBtnGhost]} onPress={() => setShowConfirmSheet(false)}>
                  <Text style={[s.sheetBtnText, { color: '#E5E7EB' }]}>Cerrar</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[s.sheetBtn, s.sheetBtnGhost]} onPress={() => setShowConfirmSheet(false)}>
                  <Text style={[s.sheetBtnText, { color: '#E5E7EB' }]}>Cerrar</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[s.sheetBtn, s.sheetBtnPrimary]} onPress={sheet.onConfirm}>
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
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16, justifyContent: 'flex-end' },
  sheetBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sheetBtnGhost: { backgroundColor: 'transparent', borderColor: '#374151' },
  sheetBtnPrimary: { backgroundColor: '#1F2937', borderColor: '#27272A' },
  sheetBtnText: { fontWeight: '600' },
});
