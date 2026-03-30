import React from 'react'
import styled from 'styled-components'
import { theme } from '../styles/theme'

const SettingsSidebarContainer = styled.div`
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 350px;
  background-color: ${theme.colors.bg.secondary};
  border-left: 1px solid ${theme.colors.bg.border};
  z-index: 100;
  transform: translateX(${props => props.$open ? '0' : '100%'});
  transition: transform ${theme.transitions.base};
  overflow-y: auto;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.3);

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: ${theme.colors.bg.primary};
  }

  &::-webkit-scrollbar-thumb {
    background: ${theme.colors.bg.border};
    border-radius: ${theme.radius.full};

    &:hover {
      background: ${theme.colors.accent.primary};
    }
  }
`

const SettingsHeader = styled.div`
  padding: ${theme.spacing.lg};
  border-bottom: 1px solid ${theme.colors.bg.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  background-color: ${theme.colors.bg.secondary};
`

const SettingsTitle = styled.h2`
  margin: 0;
  font-size: ${theme.fonts.sizes.lg};
  font-weight: ${theme.fonts.weights.bold};
  color: ${theme.colors.text.primary};
`

const CloseButton = styled.button`
  width: 36px;
  height: 36px;
  border: none;
  border-radius: ${theme.radius.md};
  background-color: transparent;
  color: ${theme.colors.text.secondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Material Symbols Outlined';
  font-size: 24px;
  transition: all ${theme.transitions.base};

  &:hover {
    background-color: ${theme.colors.bg.hover};
    color: ${theme.colors.accent.primary};
  }
`

const SettingsContent = styled.div`
  padding: ${theme.spacing.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.text.tertiary};
  text-align: center;
  min-height: 200px;
`

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, ${props => props.$open ? '0.3' : '0'});
  pointer-events: ${props => props.$open ? 'auto' : 'none'};
  z-index: 99;
  transition: background-color ${theme.transitions.base};
`

export const SettingsSidebar = ({ open, onClose }) => {
  return (
    <>
      <Overlay $open={open} onClick={onClose} />
      <SettingsSidebarContainer $open={open}>
        <SettingsHeader>
          <SettingsTitle>Settings</SettingsTitle>
          <CloseButton onClick={onClose}>close</CloseButton>
        </SettingsHeader>
        <SettingsContent>
          <p>Settings panel coming soon...</p>
        </SettingsContent>
      </SettingsSidebarContainer>
    </>
  )
}
