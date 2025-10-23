// app/(tabs)/create.tsx
import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

type InsertStory = {
  title: string;
  body: string;
  cover_url?: string | null;
  author_id: string;
  author_name?: string | null;   // autor propio de la historia
};

function getExtAndType(uri: string) {
  const ext = (uri.split('.').pop() || '').toLowerCase();
  if (ext === 'png') return { ext: 'png', type: 'image/png' };
  if (ext === 'webp') return { ext: 'webp', type: 'image/webp' };
  if (ext === 'jpg' || ext === 'jpeg') return { ext: 'jpg', type: 'image/jpeg' };
  if (ext === 'heic') return { ext: 'heic', type: 'image/heic' };
  return { ext: 'jpg', type: 'image/jpeg' };
}

async function uriToArrayBuffer(uri: string) {
  const res: any = await fetch(uri);
  // @ts-ignore
  const ab = await res.arrayBuffer();
  return ab as ArrayBuffer;
}

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [author, setAuthor] = useState(''); // autor de la *historia*, no del perfil
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function pickImage() {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert('Permiso requerido', 'Habilita el acceso a tu galería.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!res.canceled) setCoverUri(res.assets[0].uri);
  }

  async function submit() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Faltan datos', 'Título e historia son obligatorios.');
      return;
    }

    setSubmitting(true);
    try {
      // Usuario
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr || !userData.user) throw new Error('Debes iniciar sesión para publicar.');
      const userId = userData.user.id;

      // (Opcional) subir portada
      let cover_url: string | null = null;
      if (coverUri) {
        const { ext, type } = getExtAndType(coverUri);
        const filePath = `${userId}/${Date.now()}.${ext}`;
        const ab = await uriToArrayBuffer(coverUri);
        const { error: upErr } = await supabase
          .storage.from('covers')
          .upload(filePath, ab, { contentType: type, upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('covers').getPublicUrl(filePath);
        cover_url = pub?.publicUrl ?? null;
      }

      // Insertar historia (SIN tocar el perfil del usuario)
      const payload: InsertStory = {
        title: title.trim(),
        body: body.trim(),
        cover_url,
        author_id: userId,
        author_name: author.trim() || null, // se guarda en la historia
      };

      const { error: insErr } = await supabase.from('stories').insert(payload);
      if (insErr) throw insErr;

      // limpiar y volver al feed
      setAuthor(''); setTitle(''); setBody(''); setCoverUri(null);
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message ?? 'No se pudo publicar la historia.');
    } finally {
      setSubmitting(false);
    }
  }

  const HEADER_H = 56;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000ff' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 10 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
       
        <View style={s.container}>
          {/* Portada (opcional) */}
          <TouchableOpacity style={s.imagePicker} onPress={pickImage} activeOpacity={0.8}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={s.cover} />
            ) : (
              <View style={s.coverPlaceholder}>
                <Ionicons name="image-outline" size={22} color="#9CA3AF" />
                <Text style={{ color: '#9CA3AF', marginTop: 6 }}>Añadir portada (opcional)</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Autor de la historia (no afecta tu perfil) */}
          <TextInput
            placeholder="Autor (opcional)"
            placeholderTextColor="#8A8A93"
            style={s.input}
            value={author}
            onChangeText={setAuthor}
          />

          {/* Título */}
          <TextInput
            placeholder="Título"
            placeholderTextColor="#8A8A93"
            style={s.input}
            value={title}
            onChangeText={setTitle}
          />

          {/* Historia */}
          <TextInput
            placeholder="Cuenta tu historia…"
            placeholderTextColor="#8A8A93"
            style={[s.input, s.textarea]}
            value={body}
            onChangeText={setBody}
            multiline
          />

          {/* Publicar */}
          <TouchableOpacity
            style={[s.btn, submitting && { opacity: 0.6 }]}
            activeOpacity={0.85}
            onPress={submit}
            disabled={submitting}
          >
            <Ionicons name="send-outline" size={18} color="#F3F4F6" />
            <Text style={s.btnText}>{submitting ? 'Publicando…' : 'Publicar'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: '#121219',
    borderBottomWidth: 1,
    borderBottomColor: '#010102ff',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#F3F4F6', fontSize: 18, fontWeight: '700' },

  container: { padding: 16, gap: 12 },

  imagePicker: { borderWidth: 1, borderColor: '#181818ff', borderRadius: 12, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  coverPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#010102ff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#181818ff',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#F3F4F6',
    height: 46,
  },
  textarea: { height: 140, paddingTop: 12, textAlignVertical: 'top' },

  btn: {
    marginTop: 6,
    backgroundColor: '#3b3b3bff',
    borderWidth: 1,
    borderColor: '#010102ff',
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnText: { color: '#F3F4F6', fontWeight: '600' },
});
