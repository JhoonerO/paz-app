// app/(auth)/register.tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
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

  function redirectUrl() {
    // Si configuraste un scheme (app.json -> expo.scheme), define aquí tu callback.
    // Asegúrate de registrarlo en Supabase > Authentication > URL Configuration > Redirect URLs.
    return Linking.createURL('/auth/callback');
  }

  // Crea/actualiza el perfil en tu tabla "profiles"
  async function ensureProfile(userId: string, displayName: string) {
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,                 // PK = auth.uid()
          display_name: displayName,  // ✅ el nombre escrito en el input
          avatar_url: null,
          likes_public: true,
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.error('upsert profiles error:', error);
      throw error;
    }
  }

  async function onRegister() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !pass.trim()) {
      Alert.alert('Campos faltantes', 'Nombre, correo y contraseña son obligatorios.');
      return;
    }

    setLoading(true);
    try {
      // 1) Crear cuenta
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: pass,
        options: {
          // Esto va a user_metadata, NO a tu tabla profiles (por eso hacemos upsert abajo)
          data: { display_name: trimmedName },
          emailRedirectTo: redirectUrl(),
        },
      });
      if (error) throw error;

      // 2) Si el usuario ya existe (según configuración de confirmación),
      //    guardamos inmediatamente su perfil con el nombre del input:
      const userId = data.user?.id;
      if (userId) {
        await ensureProfile(userId, trimmedName);
        // Puedes llevarlo directo a la app si no exiges confirmación por email:
        // router.replace('/(tabs)');
      }

      // 3) Mensaje estándar de confirmación de correo
      Alert.alert(
        'Confirma tu correo',
        'Te enviamos un correo de verificación. Abre tu Gmail, confirma tu cuenta y luego inicia sesión.',
        [{ text: 'Ir al inicio de sesión', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo registrar.');
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
});
