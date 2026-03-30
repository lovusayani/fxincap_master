import React from 'react'
import styled from 'styled-components'
import { theme } from '../styles/theme'

const CardContainer = styled.div`
  background-color: ${theme.colors.bg.tertiary};
  border: 1px solid ${theme.colors.bg.border};
  border-radius: ${theme.radius.lg};
  padding: ${theme.spacing.lg};
  transition: all ${theme.transitions.base};

  &:hover {
    border-color: ${theme.colors.accent.primary};
    box-shadow: ${theme.shadows.md};
  }
`

const CardHeader = styled.div`
  margin-bottom: ${theme.spacing.md};
`

const CardTitle = styled.h2`
  font-size: ${theme.fonts.sizes.xl};
  font-weight: ${theme.fonts.weights.bold};
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.sm};
`

const CardBody = styled.div`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.fonts.sizes.sm};
  line-height: 1.6;
  margin-bottom: ${theme.spacing.md};
`

const CardFooter = styled.div`
  padding-top: ${theme.spacing.md};
  border-top: 1px solid ${theme.colors.bg.border};
  color: ${theme.colors.text.tertiary};
  font-size: ${theme.fonts.sizes.xs};
`

export const Card = ({ title, children, footer }) => {
  return (
    <CardContainer>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      {children && <CardBody>{children}</CardBody>}
      {footer && <CardFooter>{footer}</CardFooter>}
    </CardContainer>
  )
}
