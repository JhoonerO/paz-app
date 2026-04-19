// components/CategorySelector.tsx
// Úsalo dentro de create.tsx donde el usuario elige la categoría
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { StoryCategory } from './CategoryBadge';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface CategorySelectorProps {
  value: StoryCategory | null;
  onChange: (cat: StoryCategory) => void;
}

const CATEGORIES: {
  key: StoryCategory;
  label: string;
  emoji: string;
  shortDesc: string;
  longDesc: string;
  bg: string;
  activeBg: string;
  activeText: string;
  border: string;
}[] = [
  {
    key: 'mito',
    label: 'Mito',
    emoji: '⚡',
    shortDesc: 'Origen del mundo o dioses',
    longDesc:
      'Los mitos son relatos sagrados que explican el origen del universo, los dioses, la naturaleza o la humanidad. Suelen pertenecer a culturas antiguas y tienen un carácter simbólico o religioso. Ejemplo: el mito de la creación del mundo en culturas indígenas.',
    bg: '#1A0E3D',
    activeBg: '#2D1B69',
    activeText: '#C4B5FD',
    border: '#7C3AED',
  },
  {
    key: 'leyenda',
    label: 'Leyenda',
    emoji: '🌿',
    shortDesc: 'Historia local con raíz real',
    longDesc:
      'Las leyendas mezclan hechos históricos reales con elementos fantásticos. Están ligadas a un lugar, personaje o época específica y se transmiten de generación en generación. Ejemplo: La Llorona, el Mohán, la Madremonte.',
    bg: '#0C2318',
    activeBg: '#14342B',
    activeText: '#6EE7B7',
    border: '#059669',
  },
  {
    key: 'urbana',
    label: 'Urbana',
    emoji: '🏙️',
    shortDesc: 'Rumor moderno que "todos conocen"',
    longDesc:
      'Las leyendas urbanas son historias de terror o misterio que circulan en la vida moderna. Suelen presentarse como algo que "le pasó a un amigo de un amigo". Se adaptan a ciudades y tecnología contemporánea. Ejemplo: el hombre del gancho, Bloody Mary.',
    bg: '#111827',
    activeBg: '#1E293B',
    activeText: '#94A3B8',
    border: '#475569',
  },
  {
    key: 'otra',
    label: 'Otra',
    emoji: '✨',
    shortDesc: 'No encaja en las anteriores',
    longDesc:
      'Si tu historia tiene elementos fantásticos, de terror, ciencia ficción, creepypasta, cuento popular u otro género que no cabe exactamente en mito, leyenda o urbana, esta categoría es para ti.',
    bg: '#111827',
    activeBg: '#1E293B',
    activeText: '#94A3B8',
    border: '#475569',
  },
];

export default function CategorySelector({ value, onChange }: CategorySelectorProps) {
  const [expanded, setExpanded] = useState<StoryCategory | null>(null);

  const handlePress = (key: StoryCategory) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expanded === key) {
      setExpanded(null);
    } else {
      setExpanded(key);
    }
    onChange(key);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Categoría *</Text>
      <Text style={styles.sectionHint}>
        Toca una categoría para ver su descripción y seleccionarla
      </Text>

      {CATEGORIES.map((cat) => {
        const isSelected = value === cat.key;
        const isExpanded = expanded === cat.key;

        return (
          <TouchableOpacity
            key={cat.key}
            activeOpacity={0.8}
            onPress={() => handlePress(cat.key)}
            style={[
              styles.card,
              {
                backgroundColor: isSelected ? cat.activeBg : cat.bg,
                borderColor: isSelected ? cat.border : '#2A2A2A',
                borderWidth: isSelected ? 1.5 : 1,
              },
            ]}
          >
            {/* Header row */}
            <View style={styles.cardHeader}>
              <Text style={styles.emoji}>{cat.emoji}</Text>
              <View style={styles.cardTitles}>
                <Text
                  style={[
                    styles.catLabel,
                    { color: isSelected ? cat.activeText : '#E2E8F0' },
                  ]}
                >
                  {cat.label}
                </Text>
                <Text style={styles.catShort}>{cat.shortDesc}</Text>
              </View>
              <View style={styles.rightSide}>
                {isSelected && (
                  <View style={[styles.selectedDot, { backgroundColor: cat.border }]} />
                )}
                <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
              </View>
            </View>

            {/* Expanded description */}
            {isExpanded && (
              <View style={styles.descBox}>
                <Text style={[styles.descText, { color: isSelected ? cat.activeText : '#94A3B8' }]}>
                  {cat.longDesc}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 22,
    marginRight: 12,
  },
  cardTitles: {
    flex: 1,
  },
  catLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  catShort: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  rightSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chevron: {
    fontSize: 10,
    color: '#64748B',
  },
  descBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  descText: {
    fontSize: 13,
    lineHeight: 20,
  },
});