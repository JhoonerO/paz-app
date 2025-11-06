// app/(tabs)/create.tsx
import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, Alert, KeyboardAvoidingView, Platform, Modal,
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



  const [author, setAuthor] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [category, setCategory] = useState('Urbana');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);



  const categories = [
    {
      value: 'Urbana',
      label: 'Urbana',
      description: 'Sucesos paranormales del barrio, historias que pasan en tu ciudad'
    },
    {
      value: 'Leyenda',
      label: 'Leyenda',
      description: 'Relatos tradicionales que nuestros abuelos cuentan de generación en generación'
    },
    {
      value: 'Mitos',
      label: 'Mitos',
      description: 'Creencias populares colombianas y seres sobrenaturales de nuestra cultura'
    }
  ];



  async function pickImage() {
    if (pickingImage) return;
    setPickingImage(true);



    try {
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        Alert.alert('Permiso requerido', 'Habilita el acceso a tu galería.');
        setPickingImage(false);
        return;
      }



      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });



      if (!res.canceled) {
        setCoverUri(res.assets[0].uri);
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
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
        const { error: upErr } = await supabase
          .storage.from('covers')
          .upload(filePath, ab, { contentType: type, upsert: true });
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
      <KeyboardAvoidingView style={{ flex: 10 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.container}>
          {/* PORTADA */}
          <TouchableOpacity 
            style={[s.imagePicker, pickingImage && { opacity: 0.6 }]} 
            onPress={pickImage} 
            activeOpacity={0.8}
            disabled={pickingImage}
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



          {/* AUTOR */}
          <TextInput
            placeholder="Autor (opcional)"
            placeholderTextColor="#8A8A93"
            style={s.input}
            value={author}
            onChangeText={setAuthor}
          />



          {/* TÍTULO */}
          <TextInput
            placeholder="Título"
            placeholderTextColor="#8A8A93"
            style={s.input}
            value={title}
            onChangeText={setTitle}
          />



          {/* 👇 SELECTOR DESPLEGABLE DE CATEGORÍA */}
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



          {/* HISTORIA */}
          <TextInput
            placeholder="Cuenta tu historia…"
            placeholderTextColor="#8A8A93"
            style={[s.input, s.textarea]}
            value={body}
            onChangeText={setBody}
            multiline
          />



          {/* BOTÓN PUBLICAR */}
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



        {/* 👇 MODAL DE CATEGORÍAS CON DESCRIPCIONES */}
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
                    categories[categories.length - 1].value === cat.value && { borderBottomWidth: 0 }
                  ]}
                  onPress={() => {
                    setCategory(cat.value);
                    setShowCategoryPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.modalOptionContent}>
                    <Text style={[
                      s.modalOptionText,
                      category === cat.value && s.modalOptionTextActive
                    ]}>
                      {cat.label}
                    </Text>
                    <Text style={s.modalOptionDescription}>
                      {cat.description}
                    </Text>
                  </View>
                  {category === cat.value && (
                    <Ionicons name="checkmark" size={20} color="#ffffffff" style={s.checkmark} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}



const s = StyleSheet.create({
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



  // 👇 ESTILOS DEL SELECTOR
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    color: '#8A8A93',
    fontSize: 16,
  },



  // 👇 ESTILOS DEL MODAL CON DESCRIPCIONES
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
  checkmark: {
    marginLeft: 8,
  },



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
