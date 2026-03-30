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

export const TradeSetting = () => {
  return (
    <Container>
      <Breadcrumb items={['Trade Master', 'Trade Setting']} />
      
      <Card
        title="Trade Settings"
        subtitle="Configure trading parameters and preferences"
      >
        <ContentArea>
          <p>Trade Setting page - Ready to be configured</p>
        </ContentArea>
      </Card>
    </Container>
  )
}
