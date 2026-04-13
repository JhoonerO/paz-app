// components/CategoryBadge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type StoryCategory = 'mito' | 'leyenda' | 'urbana' | 'otra';

interface CategoryBadgeProps {
  category: StoryCategory;
  size?: 'sm' | 'md';
}

const CATEGORY_CONFIG: Record<
  StoryCategory,
  { label: string; emoji: string; bg: string; text: string; border: string }
> = {
  mito: {
    label: 'Mito',
    emoji: '⚡',
    bg: '#2D1B69',
    text: '#C4B5FD',
    border: '#7C3AED',
  },
  leyenda: {
    label: 'Leyenda',
    emoji: '🌿',
    bg: '#14342B',
    text: '#6EE7B7',
    border: '#059669',
  },
  urbana: {
    label: 'Urbana',
    emoji: '🏙️',
    bg: '#1E293B',
    text: '#94A3B8',
    border: '#475569',
  },
  otra: {
    label: 'Otra',
    emoji: '✨',
    bg: '#3D1A00',
    text: '#FCD34D',
    border: '#D97706',
  },
};

export default function CategoryBadge({ category, size = 'sm' }: CategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.otra;
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingHorizontal: isSmall ? 8 : 12,
          paddingVertical: isSmall ? 3 : 6,
          borderRadius: isSmall ? 6 : 8,
        },
      ]}
    >
      <Text style={{ fontSize: isSmall ? 11 : 14 }}>{config.emoji}</Text>
      <Text
        style={[
          styles.label,
          {
            color: config.text,
            fontSize: isSmall ? 11 : 13,
            marginLeft: 4,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});