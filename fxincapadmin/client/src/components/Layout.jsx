import React, { useState } from 'react'
import styled from 'styled-components'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { SettingsSidebar } from './SettingsSidebar'
import { Outlet } from 'react-router-dom'
import { theme } from '../styles/theme'

const LayoutContainer = styled.div`
  display: flex;
  height: 100vh;
  background-color: ${theme.colors.bg.primary};
`

const MainContent = styled.main`
  flex: 1;
  margin-left: ${props => props.$sidebarExpanded ? '240px' : '64px'};
  margin-top: 56px;
  overflow-y: auto;
  padding: ${theme.spacing.lg};
  transition: margin-left ${theme.transitions.base};

  &::-webkit-scrollbar {
    width: 8px;
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

export const Layout = () => {
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarExpanded')
    return saved ? JSON.parse(saved) : false
  })
  const [settingsOpen, setSettingsOpen] = useState(false)

  const toggleSidebar = () => {
    setSidebarExpanded(prev => {
      const newState = !prev
      localStorage.setItem('sidebarExpanded', JSON.stringify(newState))
      return newState
    })
  }

  return (
    <LayoutContainer>
      <Sidebar expanded={sidebarExpanded} onToggle={toggleSidebar} />
      <Header sidebarExpanded={sidebarExpanded} onToggleSidebar={toggleSidebar} onOpenSettings={setSettingsOpen} />
      <SettingsSidebar open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <MainContent $sidebarExpanded={sidebarExpanded}>
        <Outlet />
      </MainContent>
    </LayoutContainer>
  )
}
