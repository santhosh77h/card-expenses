import { Feather } from '@expo/vector-icons';

export const LABEL_COLORS = [
  '#FF6B6B', '#F472B6', '#A78BFA', '#818CF8',
  '#22D3EE', '#34D399', '#4ADE80', '#FBBF24',
  '#FFB547', '#60A5FA', '#94A3B8', '#E879F9',
];

export const LABEL_ICON_SECTIONS: { title: string; icons: (keyof typeof Feather.glyphMap)[] }[] = [
  { title: 'Finance', icons: ['dollar-sign', 'credit-card', 'percent', 'trending-up', 'trending-down', 'pie-chart'] },
  { title: 'Shopping', icons: ['shopping-cart', 'shopping-bag', 'tag', 'gift'] },
  { title: 'Home', icons: ['home', 'tool', 'key'] },
  { title: 'Transport', icons: ['truck', 'navigation', 'map-pin', 'globe', 'compass'] },
  { title: 'Tech', icons: ['phone', 'smartphone', 'wifi', 'monitor', 'tv'] },
  { title: 'Entertainment', icons: ['film', 'music', 'headphones', 'camera'] },
  { title: 'Health', icons: ['heart', 'activity', 'thermometer'] },
  { title: 'Education', icons: ['book', 'book-open', 'briefcase', 'award'] },
  { title: 'Recurring', icons: ['repeat', 'calendar', 'clock'] },
  { title: 'People', icons: ['users', 'user'] },
  { title: 'Protection', icons: ['shield', 'umbrella'] },
  { title: 'General', icons: ['star', 'flag', 'folder', 'bookmark', 'sun', 'zap', 'layers', 'package'] },
  { title: 'Other', icons: ['send', 'archive', 'scissors', 'droplet', 'coffee'] },
];

// Flat list for default selection and backward compat
export const LABEL_ICONS: (keyof typeof Feather.glyphMap)[] =
  LABEL_ICON_SECTIONS.flatMap((s) => s.icons);
