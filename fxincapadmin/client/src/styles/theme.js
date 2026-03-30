// Design tokens for SUIMFX Admin - Dark Mode
export const theme = {
  colors: {
    // Backgrounds
    bg: {
      primary: '#0f1419',      // Main background
      secondary: '#162238',    // Sidebar
      tertiary: '#1a2a3a',     // Cards
      hover: '#232f42',        // Hover state
      border: '#2a3a4a',       // Subtle borders
    },
    // Text
    text: {
      primary: '#ffffff',      // Main text
      secondary: '#8899aa',    // Secondary text
      tertiary: '#5a6a7a',     // Tertiary text
    },
    // Accents
    accent: {
      primary: '#d4a574',      // Gold/Orange
      light: '#e8b896',        // Light gold
      dark: '#b8905c',         // Dark gold
    },
    // Status colors
    status: {
      success: '#4caf50',
      warning: '#ff9800',
      error: '#f44336',
      info: '#2196f3',
    }
  },
  fonts: {
    family: "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
    sizes: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '24px',
      xxl: '32px',
    },
    weights: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    }
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.15)',
  },
  transitions: {
    fast: '150ms ease-in-out',
    base: '200ms ease-in-out',
    slow: '300ms ease-in-out',
  }
};

export const globalStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: ${theme.fonts.family};
    background-color: ${theme.colors.bg.primary};
    color: ${theme.colors.text.primary};
    font-size: ${theme.fonts.sizes.sm};
    font-weight: ${theme.fonts.weights.regular};
    line-height: 1.5;
  }

  a {
    color: ${theme.colors.accent.primary};
    text-decoration: none;
    transition: color ${theme.transitions.fast};
  }

  a:hover {
    color: ${theme.colors.accent.light};
  }

  button {
    font-family: ${theme.fonts.family};
  }
`;
