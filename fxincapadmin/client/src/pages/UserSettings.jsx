import React from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import styled from 'styled-components'
import { theme } from '../styles/theme'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg};
`

const ContentArea = styled.div`
  display: grid;
  gap: ${theme.spacing.md};
`

export const UserSettings = () => {
  return (
    <Container>
      <Breadcrumb items={['Settings', 'User Settings']} />

      <Card
        title="User Settings"
        subtitle="Manage user account settings and preferences"
      >
        <ContentArea>
          <p>User Settings page - Ready to be configured</p>
        </ContentArea>
      </Card>
    </Container>
  )
}
