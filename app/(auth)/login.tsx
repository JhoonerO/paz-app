// app/(auth)/login.tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
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

  async function onLogin() {
    const mail = email.trim().toLowerCase();
    const pwd = pass.trim();

    if (!mail || !pwd) {
      Alert.alert('Campos faltantes', 'Ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      // 1) Iniciar sesión con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: mail,
        password: pwd,
      });

      if (error) {
        // Mensaje más amable
        const msg =
          error.message.includes('Invalid login credentials') ||
          error.message.includes('Invalid login')
            ? 'Correo o contraseña incorrectos.'
            : error.message;
        throw new Error(msg);
      }

      // 2) Tomar el usuario autenticado
      const user = data.user;
      if (!user) throw new Error('No se pudo obtener el usuario.');

      // 3) Leer su perfil para mostrar nombre en la app (tabla public.profiles)
      let displayName = user.email?.split('@')[0] ?? 'Usuario';
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      if (!profErr && prof?.display_name) displayName = prof.display_name;

      // 4) Guardar un pequeño snapshot para tu UI actual
      await AsyncStorage.setItem(
        KEY_SESSION,
        JSON.stringify({ email: user.email, name: displayName, uid: user.id })
      );

      // 5) Ir al root (tu _layout redirige a tabs)
      router.replace('/'); // o router.replace('/(tabs)') si prefieres
    } catch (e: any) {
      Alert.alert('Error al iniciar sesión', e?.message ?? 'Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
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

        <View style={s.passWrap}>
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
  passWrap: { position: 'relative', marginTop: 12 },
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
