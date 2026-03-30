import React, { useState } from 'react'
import styled from 'styled-components'
import { theme } from '../styles/theme'
import { useNavigate } from 'react-router-dom'

const SidebarContainer = styled.aside`
  width: ${props => props.$expanded ? '240px' : '64px'};
  height: 100vh;
  background-color: ${theme.colors.bg.secondary};
  border-right: 1px solid ${theme.colors.bg.border};
  display: flex;
  flex-direction: column;
  padding: ${theme.spacing.md} 0;
  position: fixed;
  left: 0;
  top: 0;
  overflow-y: auto;
  overflow-x: hidden;
  transition: width ${theme.transitions.base};

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: ${theme.colors.bg.secondary};
  }

  &::-webkit-scrollbar-thumb {
    background: ${theme.colors.bg.border};
    border-radius: ${theme.radius.full};
  }
`

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 0 ${theme.spacing.md};
  margin-bottom: ${theme.spacing.lg};
  gap: ${theme.spacing.md};
  cursor: pointer;
`

const LogoArea = styled.div`
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all ${theme.transitions.base};

  &:hover {
    transform: scale(1.05);
  }

  & img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`

const LogoText = styled.span`
  font-size: ${theme.fonts.sizes.lg};
  font-weight: ${theme.fonts.weights.bold};
  color: ${theme.colors.text.primary};
  white-space: nowrap;
  opacity: ${props => props.$visible ? 1 : 0};
  transition: opacity ${theme.transitions.base};
`

const MenuList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
  padding: 0 ${theme.spacing.sm};
`

const MenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${theme.radius.md};
  border: none;
  background-color: transparent;
  color: ${props => props.active ? theme.colors.accent.primary : theme.colors.text.secondary};
  cursor: pointer;
  transition: all ${theme.transitions.base};
  text-align: left;
  width: 100%;

  &:hover {
    background-color: ${theme.colors.bg.hover};
    color: ${theme.colors.accent.primary};
  }

  &:active {
    transform: scale(0.98);
  }
`

const MenuIcon = styled.span`
  font-family: 'Material Symbols Outlined';
  font-size: 24px;
  font-variation-settings: 'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
`

const MenuLabel = styled.span`
  font-size: ${theme.fonts.sizes.sm};
  font-weight: ${theme.fonts.weights.regular};
  white-space: nowrap;
  opacity: ${props => props.$visible ? 1 : 0};
  transition: opacity ${theme.transitions.base};
`

const sidebarMenuItems = [
  { icon: 'dashboard', label: 'Dashboard', active: false },
  { icon: 'menu', label: 'Menu', active: false },
  { icon: 'forum', label: 'Messages', active: false },
  { icon: 'mail', label: 'Mentions', active: false },
  { icon: 'task_alt', label: 'Tasks', active: false },
  { icon: 'group', label: 'Users', active: false },
  { icon: 'settings', label: 'Settings', active: false },
]

const Footer = styled.div`
  margin-top: auto;
  padding: ${theme.spacing.md};
  color: ${theme.colors.text.tertiary};
  font-size: ${theme.fonts.sizes.xs};
  text-align: ${props => (props.$expanded ? 'left' : 'center')};
  white-space: nowrap;
`

const menus = [
  { label: 'Dashboard', icon: 'dashboard' },
  {
    label: 'Reminders', icon: 'notifications', children: [
      { label: 'Quick Note' },
      { label: 'Alert Settings' },
    ]
  },
  {
    label: 'Reports', icon: 'analytics', children: [
      { label: 'Transactions' },
      { label: 'Balance Sheet' },
      { label: 'Report2' },
    ]
  },
  {
    label: 'Members', icon: 'group', children: [
      { label: 'Member List', path: '/members/list' },
      { label: 'Member Profile', path: '/members/profile' },
    ]
  },
  {
    label: 'Groups', icon: 'groups', children: [
      { label: 'All Groups' },
    ]
  },
  {
    label: 'Transactions', icon: 'account_balance_wallet', children: [
      { label: 'Wallet', path: '/wallet' },
      { label: 'All Pendings', path: '/all-pendings' },
      { label: 'Deposite' },
      { label: 'Withdraw' },
    ]
  },
  {
    label: 'Kyc Status', icon: 'verified_user', children: [
      { label: 'User Kyc', path: '/user-kyc' },
      { label: 'Others Kyc' },
    ]
  },
  {
    label: 'Market', icon: 'trending_up', children: [
      { label: 'Market1' },
      { label: 'Offers', path: '/market/offers' },
    ]
  },
  { label: 'IB Program', icon: 'workspace_premium' },
  {
    label: 'Trade Master', icon: 'monitoring', children: [
      { label: 'Trade Setting', path: '/trade-setting' },
    ]
  },
  { label: 'Mam&Pam', icon: 'insights' },
  {
    label: 'Support', icon: 'support_agent', children: [
      { label: 'Tickets' },
      { label: 'Requests' },
    ]
  },
  {
    label: 'Settings', icon: 'settings', children: [
      { label: 'User Settings', path: '/user-settings' },
      { label: 'Control Settings' },
      { label: 'Payment Settings' },
      { label: 'Terminal Settings' },
      { label: 'Server Settings', path: '/server-settings' },
      { label: 'Notif Settings' },
      { label: 'Miscellaneous', path: '/miscellaneous-settings' },
    ]
  },
]

const Submenu = styled.div`
  display: ${props => (props.$visible ? 'block' : 'none')};
  padding-left: ${theme.spacing.lg};
  margin-top: ${theme.spacing.xs};
  border-left: 2px solid ${theme.colors.bg.border};
  margin-left: ${theme.spacing.sm};
  animation: ${props => (props.$visible ? 'submenuEnter 220ms ease-out' : 'none')};

  @keyframes submenuEnter {
    0% { opacity: 0; transform: translateY(-6px); }
    100% { opacity: 1; transform: translateY(0); }
  }
`

const SubmenuBullet = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid ${theme.colors.bg.border};
  display: inline-block;
  margin-right: ${theme.spacing.sm};
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: ${theme.colors.bg.border};
  }
`

const SubmenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.xs} 0;
  border: none;
  background: transparent;
  color: ${theme.colors.text.secondary};
  font-size: ${theme.fonts.sizes.sm};
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: color ${theme.transitions.base};

  &:hover {
    color: ${theme.colors.accent.primary};
  }
`

const Chevron = styled.span`
  font-family: 'Material Symbols Outlined';
  font-size: 20px;
  font-variation-settings: 'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24;
  margin-left: auto;
  transition: transform ${theme.transitions.base};
  transform: ${props => (props.$open ? 'rotate(90deg)' : 'rotate(0deg)')};
`

export const Sidebar = ({ expanded, onToggle }) => {
  const [openIndex, setOpenIndex] = useState(null)
  const navigate = useNavigate()

  const handleToggleItem = (idx, hasChildren) => {
    if (!hasChildren) return
    setOpenIndex(openIndex === idx ? null : idx)
  }

  const handleMenuClick = (item, idx, hasChildren) => {
    if (hasChildren) {
      handleToggleItem(idx, hasChildren)
    } else {
      // Navigate for items without children
      if (item.label === 'Dashboard') {
        navigate('/dashboard')
      } else if (item.path) {
        navigate(item.path)
      }
    }
  }

  return (
    <SidebarContainer $expanded={expanded}>
      <LogoContainer onClick={onToggle}>
        <LogoArea>
          <img src="/logo_white.png" alt="SUIMFX Logo" />
        </LogoArea>
        <LogoText $visible={expanded}>SuimFx</LogoText>
      </LogoContainer>

      <MenuList>
        {menus.map((item, idx) => {
          const hasChildren = Array.isArray(item.children) && item.children.length > 0
          const isOpen = openIndex === idx
          return (
            <div key={idx}>
              <MenuItem
                active={false}
                title={item.label}
                onClick={() => handleMenuClick(item, idx, hasChildren)}
              >
                <MenuIcon>{item.icon}</MenuIcon>
                <MenuLabel $visible={expanded}>{item.label}</MenuLabel>
                {expanded && hasChildren && (
                  <Chevron $open={isOpen}>{'chevron_right'}</Chevron>
                )}
              </MenuItem>
              {hasChildren && (
                <Submenu $visible={expanded && isOpen}>
                  {item.children.map((sub, sIdx) => (
                    <SubmenuItem
                      key={sIdx}
                      title={sub.label}
                      onClick={() => sub.path && navigate(sub.path)}
                    >
                      <SubmenuBullet />
                      {sub.label}
                    </SubmenuItem>
                  ))}
                </Submenu>
              )}
            </div>
          )
        })}
      </MenuList>

      <Footer $expanded={expanded}>
        <div>Simfx Trading Admin</div>
        <div>@2025 All Right Reserved</div>
      </Footer>
    </SidebarContainer>
  )
}
