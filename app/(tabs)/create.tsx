// app/(tabs)/create.tsx
import { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { moderateImage } from '../../lib/moderation';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// ✅ author_name eliminado del tipo
type InsertStory = {
  title: string;
  body: string;
  cover_url?: string | null;
  author_id: string;
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
  const ab = await res.arrayBuffer();
  return ab as ArrayBuffer;
}

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();

  const enter = useSharedValue(1);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * 14 }],
  }));

  useFocusEffect(
    useCallback(() => {
      enter.value = 0;
      enter.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    }, [])
  );

  // ✅ useState('author') eliminado
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [publishState, setPublishState] = useState<'idle' | 'analyzing' | 'publishing' | 'done'>('idle');

  const isBlocked = moderating || submitting;

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: any) => {
      if (publishState === 'analyzing' || publishState === 'publishing') {
        e.preventDefault();
      }
    });
    return unsub;
  }, [navigation, publishState]);

  async function pickImage() {
    if (pickingImage || isBlocked) return;
    setPickingImage(true);
    try {
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        Alert.alert('Permiso requerido', 'Habilita el acceso a tu galería.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });

      if (!res.canceled) {
        const uri = res.assets[0].uri;
        setModerating(true);
        setPublishState('analyzing');
        const moderation = await moderateImage(uri);
        setModerating(false);
        setPublishState('idle');

        if (!moderation.isApproved) {
          setRejectionReason(moderation.reason || 'La imagen contiene contenido inapropiado');
          setShowRejectionModal(true);
          return;
        }

        setCoverUri(uri);
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      setModerating(false);
      setPublishState('idle');
    } finally {
      setPickingImage(false);
    }
  }

  async function submit() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Faltan datos', 'Título e historia son obligatorios.');
      return;
    }

    setSubmitting(true);
    setPublishState('publishing');

    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr || !userData.user) throw new Error('Debes iniciar sesión para publicar.');
      const userId = userData.user.id;

      let cover_url: string | null = null;
      if (coverUri) {
        const { ext, type } = getExtAndType(coverUri);
        const filePath = `${userId}/${Date.now()}.${ext}`;
        const ab = await uriToArrayBuffer(coverUri);

        const { error: upErr } = await supabase.storage.from('covers').upload(filePath, ab, {
          contentType: type,
          upsert: true,
        });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from('covers').getPublicUrl(filePath);
        cover_url = pub?.publicUrl ?? null;
      }

      // ✅ author_name eliminado del payload
      const payload: InsertStory = {
        title: title.trim(),
        body: body.trim(),
        cover_url,
        author_id: userId,
      };

      const { error: insErr } = await supabase.from('stories').insert(payload);
      if (insErr) throw insErr;

      setTitle('');
      setBody('');
      setCoverUri(null);

      setPublishState('done');
      setTimeout(() => {
        setPublishState('idle');
        setSubmitting(false);
        router.replace('/(tabs)');
      }, 1500);
    } catch (e: any) {
      console.error(e);
      setPublishState('idle');
      setSubmitting(false);
      Alert.alert('Error', e.message ?? 'No se pudo publicar la historia.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000ff' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled
          nestedScrollEnabled
          pointerEvents={isBlocked ? 'none' : 'auto'}
        >
          <Animated.View
            style={[s.container, { paddingBottom: insets.bottom + 40 }, enterStyle]}
          >
            {/* Portada */}
            <TouchableOpacity
              style={[s.imagePicker, isBlocked && { opacity: 0.5 }]}
              onPress={pickImage}
              activeOpacity={0.8}
              disabled={isBlocked}
            >
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={s.cover} />
              ) : (
                <View style={s.coverPlaceholder}>
                  <Ionicons name="image-outline" size={22} color="#9CA3AF" />
                  <Text style={{ color: '#9CA3AF', marginTop: 6 }}>
                    {pickingImage ? 'Abriendo galería...' : 'Añadir portada (opcional)'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ✅ TextInput de Autor eliminado */}

            <TextInput
              placeholder="Título"
              placeholderTextColor="#8A8A93"
              style={[s.input, isBlocked && { opacity: 0.5 }]}
              value={title}
              onChangeText={setTitle}
              editable={!isBlocked}
            />

            <TextInput
              placeholder="Cuenta tu historia…"
              placeholderTextColor="#8A8A93"
              style={[s.input, s.textarea, isBlocked && { opacity: 0.5 }]}
              value={body}
              onChangeText={setBody}
              multiline
              scrollEnabled
              editable={!isBlocked}
            />

            <TouchableOpacity
              style={[s.btn, isBlocked && { opacity: 0.5 }]}
              activeOpacity={0.85}
              onPress={submit}
              disabled={isBlocked}
            >
              <Ionicons name="send-outline" size={18} color="#F3F4F6" />
              <Text style={s.btnText}>Publicar</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        {/* Modal rechazo de imagen */}
        <Modal
          visible={showRejectionModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRejectionModal(false)}
        >
          <View style={s.rejectionOverlay}>
            <Pressable
              style={s.rejectionBackdrop}
              onPress={() => setShowRejectionModal(false)}
            />
            <View style={s.rejectionModal}>
              <View style={s.rejectionIconWrap}>
                <Ionicons name="alert-circle" size={56} color="#EF4444" />
              </View>
              <Text style={s.rejectionTitle}>Imagen rechazada</Text>
              <Text style={s.rejectionMessage}>{rejectionReason}</Text>
              <TouchableOpacity
                style={s.rejectionButton}
                onPress={() => setShowRejectionModal(false)}
                activeOpacity={0.8}
              >
                <Text style={s.rejectionButtonText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal de análisis / publicación / listo */}
        <Modal visible={publishState !== 'idle'} transparent animationType="fade">
          <View style={s.publishOverlay}>
            <View style={s.publishBox}>
              {publishState === 'analyzing' && (
                <>
                  <ActivityIndicator size="large" color="#F3F4F6" style={{ marginBottom: 16 }} />
                  <Text style={s.publishTitle}>Analizando imagen</Text>
                  <Text style={s.publishSub}>Por favor espera...</Text>
                </>
              )}
              {publishState === 'publishing' && (
                <>
                  <ActivityIndicator size="large" color="#F3F4F6" style={{ marginBottom: 16 }} />
                  <Text style={s.publishTitle}>Publicando historia</Text>
                  <Text style={s.publishSub}>Por favor espera...</Text>
                </>
              )}
              {publishState === 'done' && (
                <>
                  <View style={s.publishIconWrap}>
                    <Ionicons name="checkmark-circle" size={56} color="#4ADE80" />
                  </View>
                  <Text style={s.publishTitle}>¡Historia publicada!</Text>
                  <Text style={s.publishSub}>Redirigiendo al feed...</Text>
                </>
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  imagePicker: {
    borderWidth: 1,
    borderColor: '#181818ff',
    borderRadius: 12,
    overflow: 'hidden',
  },
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
    justifyContent: 'center',
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
  rejectionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  rejectionBackdrop: { position: 'absolute', width: '100%', height: '100%' },
  rejectionModal: {
    backgroundColor: '#010102ff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#181818ff',
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    zIndex: 10,
  },
  rejectionIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1F1416',
    borderWidth: 2,
    borderColor: '#3F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  rejectionTitle: {
    color: '#F3F4F6',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  rejectionMessage: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  rejectionButton: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  rejectionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  publishOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  publishBox: {
    backgroundColor: '#010102ff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#181818ff',
    padding: 32,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  publishIconWrap: { marginBottom: 16 },
  publishTitle: { color: '#F3F4F6', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  publishSub: { color: '#9CA3AF', fontSize: 14, marginTop: 8, textAlign: 'center' },
});
