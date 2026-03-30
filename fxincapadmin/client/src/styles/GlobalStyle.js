import { createGlobalStyle } from 'styled-components'
import { theme } from './theme'

export const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    scroll-behavior: smooth;
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

    &:hover {
      color: ${theme.colors.accent.light};
    }
  }

  button {
    font-family: ${theme.fonts.family};
    cursor: pointer;
  }

  input, textarea, select {
    font-family: ${theme.fonts.family};
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${theme.colors.bg.primary};
  }

  ::-webkit-scrollbar-thumb {
    background: ${theme.colors.bg.border};
    border-radius: ${theme.radius.full};

    &:hover {
      background: ${theme.colors.accent.primary};
    }
  }
`
