import './default.css';
import './beige.css';

export type ThemeId = 'default' | 'beige';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  colors: {
    bg: string;
    surface: string;
    accent: string;
    text: string;
  };
}

export const THEMES: ThemeOption[] = [
  {
    id: 'default',
    name: 'Sombre Émeraude (Défaut)',
    description: 'Thème sombre moderne avec des accents émeraude',
    colors: {
      bg: '#0b0f17',
      surface: '#131926',
      accent: '#10b981',
      text: '#f8fafc',
    },
  },
  {
    id: 'beige',
    name: 'Papier Beige',
    description: 'Ambiance livre ancien et papier doux aux tons beiges et ambrés',
    colors: {
      bg: '#f6f1eb',
      surface: '#ebe3d5',
      accent: '#b45309',
      text: '#292524',
    },
  },
];

export const DEFAULT_THEME: ThemeId = 'default';
