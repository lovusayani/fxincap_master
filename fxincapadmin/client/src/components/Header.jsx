import React, { useState, useRef, useEffect } from 'react'
import styled from 'styled-components'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { theme } from '../styles/theme'

const HeaderContainer = styled.header`
  width: calc(100% - ${props => props.$sidebarExpanded ? '240px' : '64px'});
  height: 56px;
  background-color: ${theme.colors.bg.secondary};
  border-bottom: 1px solid ${theme.colors.bg.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${theme.spacing.lg};
  position: fixed;
  left: ${props => props.$sidebarExpanded ? '240px' : '64px'};
  top: 0;
  z-index: 10;
  transition: all ${theme.transitions.base};
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  flex: 1;
`

const MenuToggle = styled.button`
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.md};
  border: none;
  background-color: transparent;
  color: ${theme.colors.text.secondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Material Symbols Outlined';
  font-size: 24px;
  font-variation-settings: 'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24;
  transition: all ${theme.transitions.base};

  &:hover {
    background-color: ${theme.colors.bg.hover};
    color: ${theme.colors.accent.primary};
  }

  &:active {
    transform: scale(0.95);
  }
`

const SearchBar = styled.input`
  flex: 1;
  max-width: 400px;
  height: 36px;
  background-color: ${theme.colors.bg.tertiary};
  border: 1px solid ${theme.colors.bg.border};
  border-radius: ${theme.radius.md};
  padding: 0 ${theme.spacing.md};
  color: ${theme.colors.text.primary};
  font-size: ${theme.fonts.sizes.sm};
  transition: all ${theme.transitions.base};

  &::placeholder {
    color: ${theme.colors.text.tertiary};
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.accent.primary};
    background-color: ${theme.colors.bg.hover};
  }
`

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
`

const IconButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.md};
  border: none;
  background-color: transparent;
  color: ${theme.colors.text.secondary};
  cursor: pointer;
  transition: all ${theme.transitions.base};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  font-variation-settings: 'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24;
  letter-spacing: normal;
  text-transform: none;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;

  &:hover {
    background-color: ${theme.colors.bg.hover};
    color: ${theme.colors.accent.primary};
  }
`

const UserAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.md};
  background: linear-gradient(135deg, ${theme.colors.accent.primary}, ${theme.colors.accent.dark});
  display: flex;
  align-items: center;
  justify-content: center;
  color: #000;
  font-weight: ${theme.fonts.weights.bold};
  cursor: pointer;
  transition: all ${theme.transitions.base};
  font-size: ${theme.fonts.sizes.lg};
  position: relative;

  &:hover {
    transform: scale(1.05);
  }
`

const DropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  background-color: ${theme.colors.bg.secondary};
  border: 1px solid ${theme.colors.bg.border};
  border-radius: ${theme.radius.md};
  min-width: 180px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  margin-top: ${theme.spacing.sm};
  z-index: 1000;
  overflow: hidden;
`

const DropdownItem = styled.button`
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border: none;
  background-color: transparent;
  color: ${theme.colors.text.primary};
  cursor: pointer;
  text-align: left;
  font-size: ${theme.fonts.sizes.sm};
  transition: all ${theme.transitions.base};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  font-family: inherit;

  &:hover {
    background-color: ${theme.colors.bg.hover};
    color: ${theme.colors.accent.primary};
  }

  &:active {
    background-color: ${theme.colors.bg.tertiary};
  }
`

export const Header = ({ sidebarExpanded, onToggleSidebar, onOpenSettings }) => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  const userInitial = user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'A'

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const handleLogout = () => {
    setShowDropdown(false)
    logout()
  }

  const handleMyAccount = () => {
    setShowDropdown(false)
    // Navigate to account page (will create later)
    navigate('/account')
  }

  const handleChangePassword = () => {
    setShowDropdown(false)
    // Navigate to change password page (will create later)
    navigate('/change-password')
  }

  return (
    <HeaderContainer $sidebarExpanded={sidebarExpanded}>
      <HeaderLeft>
        <MenuToggle onClick={onToggleSidebar} title={sidebarExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}>
          {sidebarExpanded ? 'menu_open' : 'menu'}
        </MenuToggle>
        <SearchBar placeholder="Search" />
      </HeaderLeft>
      <HeaderRight>
        <IconButton onClick={handleFullscreen} title="Fullscreen">fullscreen</IconButton>
        <IconButton title="Notifications">notifications</IconButton>
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <UserAvatar onClick={() => setShowDropdown(!showDropdown)} title="User Profile">
            {userInitial}
          </UserAvatar>
          {showDropdown && (
            <DropdownMenu>
              <DropdownItem onClick={handleMyAccount}>
                <span style={{ fontFamily: 'Material Symbols Outlined' }}>person</span>
                My Account
              </DropdownItem>
              <DropdownItem onClick={handleChangePassword}>
                <span style={{ fontFamily: 'Material Symbols Outlined' }}>lock</span>
                Change Password
              </DropdownItem>
              <DropdownItem onClick={handleLogout}>
                <span style={{ fontFamily: 'Material Symbols Outlined' }}>logout</span>
                Logout
              </DropdownItem>
            </DropdownMenu>
          )}
        </div>
        <IconButton onClick={() => onOpenSettings?.(true)} title="Settings">settings</IconButton>
      </HeaderRight>
    </HeaderContainer>
  )
}
