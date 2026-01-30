// app/(tabs)/create.tsx
import { useCallback, useState } from 'react';
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
  Pressable, // 👈 AGREGAR
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { moderateImage } from '../../lib/moderation';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type InsertStory = {
  title: string;
  body: string;
  cover_url?: string | null;
  author_id: string;
  author_name?: string | null;
  category: string;
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

  const enter = useSharedValue(1);
  const enterStyle = useAnimatedStyle(() => {
    return {
      opacity: enter.value,
      transform: [{ translateX: (1 - enter.value) * 14 }],
    };
  });

  useFocusEffect(
    useCallback(() => {
      enter.value = 0;
      enter.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
    }, [])
  );

  const [author, setAuthor] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [category, setCategory] = useState('Urbana');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [moderating, setModerating] = useState(false);
  
  // 👇 NUEVO: Estado para modal de rechazo
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const categories = [
    {
      value: 'Urbana',
      label: 'Urbana',
      description: 'Sucesos paranormales del barrio, historias que pasan en tu ciudad',
    },
    {
      value: 'Leyenda',
      label: 'Leyenda',
      description: 'Relatos tradicionales que nuestros abuelos cuentan de generación en generación',
    },
    {
      value: 'Mitos',
      label: 'Mitos',
      description: 'Creencias populares colombianas y seres sobrenaturales de nuestra cultura',
    },
  ];

  async function pickImage() {
    if (pickingImage) return;
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
        const moderation = await moderateImage(uri);
        setModerating(false);

        if (!moderation.isApproved) {
          // 👇 CAMBIO: Usar modal personalizado en vez de Alert
          setRejectionReason(moderation.reason || 'La imagen contiene contenido inapropiado');
          setShowRejectionModal(true);
          return;
        }

        setCoverUri(uri);
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      setModerating(false);
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

      const payload: InsertStory = {
        title: title.trim(),
        body: body.trim(),
        cover_url,
        author_id: userId,
        author_name: author.trim() || null,
        category,
      };

      const { error: insErr } = await supabase.from('stories').insert(payload);
      if (insErr) throw insErr;

      setAuthor('');
      setTitle('');
      setBody('');
      setCoverUri(null);
      setCategory('Urbana');

      router.replace('/(tabs)');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message ?? 'No se pudo publicar la historia.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000ff' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled
          nestedScrollEnabled
        >
          <Animated.View style={[s.container, { paddingBottom: insets.bottom + 40 }, enterStyle]}>
            <TouchableOpacity
              style={[s.imagePicker, (pickingImage || moderating) && { opacity: 0.6 }]}
              onPress={pickImage}
              activeOpacity={0.8}
              disabled={pickingImage || moderating}
            >
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={s.cover} />
              ) : (
                <View style={s.coverPlaceholder}>
                  <Ionicons name="image-outline" size={22} color="#9CA3AF" />
                  <Text style={{ color: '#9CA3AF', marginTop: 6 }}>
                    {pickingImage 
                      ? 'Abriendo galería...' 
                      : moderating 
                      ? 'Verificando imagen...' 
                      : 'Añadir portada (opcional)'}
                  </Text>
                </View>
              )}
              
              {moderating && (
                <View style={s.moderatingOverlay}>
                  <ActivityIndicator size="large" color="#F3F4F6" />
                  <Text style={s.moderatingText}>Analizando imagen...</Text>
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              placeholder="Autor (opcional)"
              placeholderTextColor="#8A8A93"
              style={s.input}
              value={author}
              onChangeText={setAuthor}
            />

            <TextInput
              placeholder="Título"
              placeholderTextColor="#8A8A93"
              style={s.input}
              value={title}
              onChangeText={setTitle}
            />

            <TouchableOpacity
              style={s.input}
              onPress={() => setShowCategoryPicker(true)}
              activeOpacity={0.7}
            >
              <View style={s.pickerContent}>
                <Text style={s.pickerText}>{category}</Text>
                <Ionicons name="chevron-down" size={20} color="#f7f7f7ff" />
              </View>
            </TouchableOpacity>

            <TextInput
              placeholder="Cuenta tu historia…"
              placeholderTextColor="#8A8A93"
              style={[s.input, s.textarea]}
              value={body}
              onChangeText={setBody}
              multiline
              scrollEnabled
            />

            <TouchableOpacity
              style={[s.btn, submitting && { opacity: 0.6 }]}
              activeOpacity={0.85}
              onPress={submit}
              disabled={submitting}
            >
              <Ionicons name="send-outline" size={18} color="#F3F4F6" />
              <Text style={s.btnText}>{submitting ? 'Publicando…' : 'Publicar'}</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        {/* Modal de categorías */}
        <Modal
          visible={showCategoryPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCategoryPicker(false)}
        >
          <TouchableOpacity
            style={s.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowCategoryPicker(false)}
          >
            <View style={s.modalContent}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    s.modalOption,
                    category === cat.value && s.modalOptionActive,
                    categories[categories.length - 1].value === cat.value && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => {
                    setCategory(cat.value);
                    setShowCategoryPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.modalOptionContent}>
                    <Text
                      style={[
                        s.modalOptionText,
                        category === cat.value && s.modalOptionTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                    <Text style={s.modalOptionDescription}>{cat.description}</Text>
                  </View>
                  {category === cat.value && (
                    <Ionicons name="checkmark" size={20} color="#ffffffff" style={s.checkmark} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 👇 NUEVO: Modal personalizado de rechazo */}
        <Modal
          visible={showRejectionModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRejectionModal(false)}
        >
          <View style={s.rejectionOverlay}>
            <Pressable style={s.rejectionBackdrop} onPress={() => setShowRejectionModal(false)} />
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
    position: 'relative',
  },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  coverPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#010102ff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  moderatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  moderatingText: {
    color: '#F3F4F6',
    fontSize: 16,
    fontWeight: '600',
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

  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    color: '#8A8A93',
    fontSize: 16,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalContent: {
    backgroundColor: '#121219',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#181818ff',
    width: '100%',
    overflow: 'hidden',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#181818ff',
  },
  modalOptionActive: {
    backgroundColor: '#1a1a1aff',
  },
  modalOptionContent: {
    flex: 1,
    marginRight: 12,
  },
  modalOptionText: {
    color: '#F3F4F6',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalOptionTextActive: {
    color: '#F3F4F6',
    fontWeight: '700',
  },
  modalOptionDescription: {
    color: '#8A8A93',
    fontSize: 13,
    lineHeight: 18,
  },
  checkmark: { marginLeft: 8 },

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

  // 👇 NUEVOS ESTILOS: Modal de rechazo personalizado
  rejectionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  rejectionBackdrop: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
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
  rejectionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
