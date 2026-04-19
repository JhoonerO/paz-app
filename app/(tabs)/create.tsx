// app/(tabs)/create.tsx
import { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  ActivityIndicator,
  Pressable,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { awardStoryXP } from '../../lib/gamification';
import { moderateImage } from '../../lib/moderation';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type StoryCategory = 'mito' | 'leyenda' | 'urbana' | 'otra';

type InsertStory = {
  title: string;
  body: string;
  cover_url?: string | null;
  author_id: string;
  category: StoryCategory;
};

// ── Categorías ────────────────────────────────────────────────────────────────

const CATEGORIES: {
  key: StoryCategory;
  label: string;
  desc: string;
  icon: string;
  iconSet: 'Ionicons' | 'MaterialCommunityIcons';
}[] = [
  {
    key: 'mito',
    label: 'Mito',
    desc: 'Relatos sagrados sobre el origen del universo, dioses o la humanidad. De carácter simbólico y religioso.',
    icon: 'lightning-bolt',
    iconSet: 'MaterialCommunityIcons',
  },
  {
    key: 'leyenda',
    label: 'Leyenda',
    desc: 'Mezcla de hechos reales con lo fantástico. Ligadas a un lugar o época, transmitidas de generación en generación.',
    icon: 'map-legend',
    iconSet: 'MaterialCommunityIcons',
  },
  {
    key: 'urbana',
    label: 'Urbana',
    desc: 'Historias de misterio que circulan en la vida moderna. El clásico "le pasó a un amigo de un amigo".',
    icon: 'city-variant-outline',
    iconSet: 'MaterialCommunityIcons',
  },
  {
    key: 'otra',
    label: 'Otra',
    desc: 'Creepypasta, cuento popular, terror original u otro género que no encaja en las categorías anteriores.',
    icon: 'help-rhombus-outline',
    iconSet: 'MaterialCommunityIcons',
  },
];

function CatIcon({ iconSet, icon, color, size }: { iconSet: string; icon: string; color: string; size: number }) {
  if (iconSet === 'MaterialCommunityIcons') {
    return <MaterialCommunityIcons name={icon as any} size={size} color={color} />;
  }
  return <Ionicons name={icon as any} size={size} color={color} />;
}

// ── Helpers (sin cambios) ─────────────────────────────────────────────────────

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

// ── Componente principal ──────────────────────────────────────────────────────

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

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<StoryCategory | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
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

  function handleCategorySelect(key: StoryCategory) {
    setCategory(key);
    setShowCategoryModal(false);
  }

  async function pickImage() {
    if (pickingImage || isBlocked) return;
    setPickingImage(true);
    try {
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        Alert.alert('Permiso requerido', 'Habilita el acceso a tu galería.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
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
    if (!category) {
      Alert.alert('Falta la categoría', 'Por favor selecciona una categoría.');
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

      const payload: InsertStory = {
        title: title.trim(),
        body: body.trim(),
        cover_url,
        author_id: userId,
        category: category!,
      };

      const { error: insErr } = await supabase.from('stories').insert(payload);
      if (insErr) throw insErr;
      awardStoryXP(userId).catch(() => {});

      setTitle('');
      setBody('');
      setCoverUri(null);
      setCategory(null);

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

  // ── Render ────────────────────────────────────────────────────────────────

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
          <Animated.View style={[s.container, { paddingBottom: insets.bottom + 40 }, enterStyle]}>

            {/* Portada */}
            <TouchableOpacity
              style={[s.imagePicker, isBlocked && { opacity: 0.5 }]}
              onPress={pickImage}
              activeOpacity={0.8}
              disabled={isBlocked}
            >
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={s.cover} contentFit="cover" />
              ) : (
                <View style={s.coverPlaceholder}>
                  <Ionicons name="image-outline" size={22} color="#9CA3AF" />
                  <Text style={{ color: '#9CA3AF', marginTop: 6 }}>
                    {pickingImage ? 'Abriendo galería...' : 'Añadir portada (opcional)'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Título */}
            <TextInput
              placeholder="Título"
              placeholderTextColor="#8A8A93"
              style={[s.input, isBlocked && { opacity: 0.5 }]}
              value={title}
              onChangeText={setTitle}
              editable={!isBlocked}
            />

            {/* ── CATEGORÍA (desplegable) ─────────────────────────────── */}
            <TouchableOpacity
              style={[s.catSelector, isBlocked && { opacity: 0.5 }]}
              activeOpacity={0.7}
              disabled={isBlocked}
              onPress={() => !isBlocked && setShowCategoryModal(true)}
            >
              <Ionicons name="pricetag-outline" size={18} color={category ? '#F3F4F6' : '#6B7280'} />
              <Text style={[s.catSelectorText, category && s.catSelectorTextActive]}>
                {category ? CATEGORIES.find(c => c.key === category)?.label : 'Seleccionar categoría *'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#6B7280" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            {/* ── FIN CATEGORÍA ───────────────────────────────────────── */}

            {/* Historia */}
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

            {/* Publicar */}
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

        {/* Modal rechazo imagen */}
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

        {/* Modal estado publicación */}
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

        {/* Modal de categorías */}
        <Modal visible={showCategoryModal} transparent animationType="fade" onRequestClose={() => setShowCategoryModal(false)}>
          <Pressable style={s.catOverlay} onPress={() => setShowCategoryModal(false)}>
            <Pressable style={s.catSheet} onPress={() => {}}>
              <View style={s.catSheetHeader}>
                <Text style={s.catSheetTitle}>Categoría</Text>
                <TouchableOpacity onPress={() => setShowCategoryModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={24} color="#F3F4F6" />
                </TouchableOpacity>
              </View>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[s.catOption, isSelected && s.catOptionSelected]}
                    onPress={() => handleCategorySelect(cat.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.catOptionIcon, isSelected && s.catOptionIconSelected]}>
                      <CatIcon iconSet={cat.iconSet} icon={cat.icon} size={20} color={isSelected ? '#F3F4F6' : '#6B7280'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.catOptionName, isSelected && s.catOptionNameSelected]}>{cat.label}</Text>
                      <Text style={s.catOptionDesc}>{cat.desc}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color="#4ADE80" />}
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // — originales sin cambios —
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
  rejectionTitle: { color: '#F3F4F6', fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  rejectionMessage: { color: '#D1D5DB', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
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

  // — categoría —
  catSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#181818',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  catSelectorText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  catSelectorTextActive: {
    color: '#F3F4F6',
    fontWeight: '600',
  },

  // Modal de categorías
  catOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  catSheet: {
    backgroundColor: '#121219',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#1F1F27',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    maxHeight: '75%',
  },
  catSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F27',
  },
  catSheetTitle: {
    color: '#F3F4F6',
    fontSize: 20,
    fontWeight: '700',
  },
  catOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1F1F27',
    borderRadius: 12,
    marginBottom: 8,
  },
  catOptionSelected: {
    borderColor: '#2C2C33',
    backgroundColor: '#151520',
  },
  catOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1A1A22',
    borderWidth: 1,
    borderColor: '#2A2A35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catOptionIconSelected: {
    backgroundColor: '#252535',
    borderColor: '#3A3A50',
  },
  catOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 2,
  },
  catOptionNameSelected: {
    color: '#F3F4F6',
  },
  catOptionDesc: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
  },
});