import React from 'react'
import styled from 'styled-components'
import { theme } from '../styles/theme'

const BreadcrumbNav = styled.nav`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  margin-bottom: ${theme.spacing.lg};
  font-size: ${theme.fonts.sizes.sm};
`

const BreadcrumbItem = styled.span`
  color: ${props => props.active ? theme.colors.accent.primary : theme.colors.text.secondary};
  cursor: pointer;
  transition: color ${theme.transitions.base};

  &:hover {
    color: ${theme.colors.accent.primary};
  }

  &:not(:last-child)::after {
    content: '›';
    margin-left: ${theme.spacing.sm};
    color: ${theme.colors.text.tertiary};
  }
`

export const Breadcrumb = ({ items = [] }) => {
  return (
    <BreadcrumbNav>
      {items.map((item, idx) => (
        <BreadcrumbItem key={idx} active={idx === items.length - 1}>
          {item}
        </BreadcrumbItem>
      ))}
    </BreadcrumbNav>
  )
}
