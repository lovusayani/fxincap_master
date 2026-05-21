import React, { useEffect, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import styled from 'styled-components'
import { theme } from '../styles/theme'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg};
`

const PageHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`

const PageTitle = styled.h1`
  font-size: 1.875rem;
  font-weight: 700;
  color: ${theme.colors.text};
  margin: 0;
`

const PageSubtitle = styled.p`
  font-size: 0.875rem;
  color: ${theme.colors.textSecondary};
  margin: 0;
`

const Section = styled.div`
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  overflow: hidden;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.lg};
  background: ${theme.colors.card};
  border-bottom: 1px solid ${theme.colors.border};
`

const SectionTitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
`

const SectionIcon = styled.span`
  font-family: 'Material Symbols Outlined';
  font-size: 24px;
  color: ${theme.colors.text};
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: ${theme.colors.background};
  border-radius: ${theme.radius.sm};
`

const SectionTitleText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
`

const SectionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 700;
  color: ${theme.colors.text};
  margin: 0;
`

const SectionSubtitle = styled.p`
  font-size: 0.75rem;
  color: ${theme.colors.textSecondary};
  margin: 0;
`

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  background: ${theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${theme.radius.sm};
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }
`

const SectionContent = styled.div`
  padding: ${theme.spacing.lg};
  background: ${theme.colors.background};
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const EmptyState = styled.p`
  color: ${theme.colors.textSecondary};
  font-size: 0.875rem;
  margin: 0;
  text-align: center;
`

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`

const Item = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.lg};
  border-bottom: 1px solid ${theme.colors.border};
  background: ${theme.colors.background};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${theme.colors.cardHover};
  }
`

const ItemLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  flex: 1;
`

const ItemBadge = styled.span`
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  background: ${theme.colors.primary}20;
  color: ${theme.colors.primary};
  border-radius: ${theme.radius.sm};
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
`

const ItemName = styled.span`
  font-weight: 600;
  color: ${theme.colors.text};
`

const ItemValue = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.lg};
`

const Value = styled.span`
  font-size: 1.125rem;
  font-weight: 700;
  color: ${theme.colors.text};
  min-width: 120px;
  text-align: right;
`

const Unit = styled.span`
  font-size: 0.75rem;
  color: ${theme.colors.textSecondary};
  text-transform: uppercase;
  font-weight: 600;
`

const ActionButtons = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  align-items: center;
`

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid ${theme.colors.border};
  background: transparent;
  border-radius: ${theme.radius.sm};
  cursor: pointer;
  color: ${theme.colors.text};
  transition: all 0.2s ease;
  font-family: 'Material Symbols Outlined';
  font-size: 20px;

  &:hover {
    background: ${theme.colors.cardHover};
  }

  &.delete:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border-color: #ef4444;
  }
`

const Modal = styled.div`
  display: ${props => (props.$visible ? 'flex' : 'none')};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;

  @keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
`

const ModalContent = styled.div`
  background: ${theme.colors.bg.secondary};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  padding: ${theme.spacing.xl};
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);

  @keyframes slideUp {
    0% { transform: translateY(30px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
`

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${theme.spacing.lg};
  padding-bottom: ${theme.spacing.lg};
  border-bottom: 1px solid ${theme.colors.border};
`

const ModalTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 700;
  color: ${theme.colors.text};
  margin: 0;
`

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: ${theme.colors.textSecondary};
  font-size: 1.5rem;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${theme.radius.sm};
  transition: all 0.2s ease;

  &:hover {
    background: ${theme.colors.background};
    color: ${theme.colors.text};
  }
`

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  margin-bottom: ${theme.spacing.lg};

  &:last-child {
    margin-bottom: 0;
  }
`

const FormLabel = styled.label`
  font-weight: 600;
  color: ${theme.colors.text};
  font-size: 0.875rem;
`

const FormInput = styled.input`
  padding: ${theme.spacing.md};
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  color: ${theme.colors.text};
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
    box-shadow: 0 0 0 3px ${theme.colors.primary}20;
  }

  &::placeholder {
    color: ${theme.colors.textTertiary};
  }
`

const FormSelect = styled.select`
  padding: ${theme.spacing.md};
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  color: ${theme.colors.text};
  font-size: 0.875rem;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
    box-shadow: 0 0 0 3px ${theme.colors.primary}20;
  }
`

const ButtonGroup = styled.div`
  display: flex;
  gap: ${theme.spacing.md};
  margin-top: ${theme.spacing.xl};
  padding-top: ${theme.spacing.lg};
  border-top: 1px solid ${theme.colors.border};
`

const Button = styled.button`
  flex: 1;
  padding: ${theme.spacing.md};
  border: none;
  border-radius: ${theme.radius.sm};
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
  }
`

const PrimaryButton = styled(Button)`
  background: ${theme.colors.primary};
  color: white;

  &:hover {
    opacity: 0.9;
  }
`

const SecondaryButton = styled(Button)`
  background: transparent;
  border: 1px solid ${theme.colors.border};
  color: ${theme.colors.text};

  &:hover {
    background: ${theme.colors.cardHover};
  }
`

export const ForexCharges = () => {
  const [commissions, setCommissions] = useState([])
  const [spreads, setSpreads] = useState([
    { id: 1, name: 'Global', value: 20, unit: 'percentage' },
  ])
  const [swaps, setSwaps] = useState([])
  const [loading, setLoading] = useState(false)
  const [openModal, setOpenModal] = useState(null)
  const [formData, setFormData] = useState({ name: '', value: '', unit: 'percentage' })

  useEffect(() => {
    fetchCharges()
  }, [])

  const fetchCharges = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/forex-charges', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setCommissions(data?.commissions || [])
        setSpreads(data?.spreads || [])
        setSwaps(data?.swaps || [])
      }
    } catch (error) {
      console.error('Error fetching charges:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCharge = (type) => {
    setFormData({ name: '', value: '', unit: 'percentage' })
    setOpenModal(type)
  }

  const handleSaveCharge = async () => {
    if (!formData.name || !formData.value) {
      alert('Please fill in all fields')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/forex-charges/${openModal}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const newCharge = { id: Date.now(), ...formData }

        if (openModal === 'commission') {
          setCommissions([...commissions, newCharge])
        } else if (openModal === 'spread') {
          setSpreads([...spreads, newCharge])
        } else if (openModal === 'swap') {
          setSwaps([...swaps, newCharge])
        }

        setOpenModal(null)
        setFormData({ name: '', value: '', unit: 'percentage' })
      }
    } catch (error) {
      console.error('Error saving charge:', error)
      alert('Error saving charge')
    }
  }

  const handleDeleteCharge = (type, id) => {
    if (type === 'commission') {
      setCommissions(commissions.filter(c => c.id !== id))
    } else if (type === 'spread') {
      setSpreads(spreads.filter(s => s.id !== id))
    } else if (type === 'swap') {
      setSwaps(swaps.filter(s => s.id !== id))
    }
  }

  const handleEditCharge = (type, id) => {
    const charge = type === 'commission' ? commissions.find(c => c.id === id) :
                   type === 'spread' ? spreads.find(s => s.id === id) :
                   swaps.find(s => s.id === id)

    if (charge) {
      setFormData(charge)
      setOpenModal(type)
    }
  }

  const renderChargeItem = (type, item) => (
    <Item key={item.id}>
      <ItemLabel>
        <ItemBadge>{type === 'commission' ? 'Commission' : type === 'spread' ? 'Spread' : 'Swap'}</ItemBadge>
        <ItemName>{item.name}</ItemName>
      </ItemLabel>
      <ItemValue>
        <Value>{item.value}</Value>
        <Unit>{item.unit}</Unit>
        <ActionButtons>
          <IconButton onClick={() => handleEditCharge(type, item.id)}>edit</IconButton>
          <IconButton className="delete" onClick={() => handleDeleteCharge(type, item.id)}>delete</IconButton>
        </ActionButtons>
      </ItemValue>
    </Item>
  )

  return (
    <Container>
      <Breadcrumb items={['Trade Master', 'Forex Charges']} />

      <PageHeader>
        <PageTitle>Forex Charges</PageTitle>
        <PageSubtitle>Manage trading fees and spreads</PageSubtitle>
      </PageHeader>

      {/* Commission Section */}
      <Section>
        <SectionHeader>
          <SectionTitleGroup>
            <SectionIcon>💰</SectionIcon>
            <SectionTitleText>
              <SectionTitle>Commission</SectionTitle>
              <SectionSubtitle>Trading fees per lot/trade</SectionSubtitle>
            </SectionTitleText>
          </SectionTitleGroup>
          <AddButton onClick={() => handleAddCharge('commission')}>
            <span style={{ fontFamily: 'Material Symbols Outlined' }}>add</span>
            Add Commission
          </AddButton>
        </SectionHeader>
        <SectionContent>
          {commissions.length > 0 ? (
            <ItemList>
              {commissions.map(item => renderChargeItem('commission', item))}
            </ItemList>
          ) : (
            <EmptyState>No commission charges configured</EmptyState>
          )}
        </SectionContent>
      </Section>

      {/* Spread Section */}
      <Section>
        <SectionHeader>
          <SectionTitleGroup>
            <SectionIcon>📈</SectionIcon>
            <SectionTitleText>
              <SectionTitle>Spread</SectionTitle>
              <SectionSubtitle>Bid/Ask price difference</SectionSubtitle>
            </SectionTitleText>
          </SectionTitleGroup>
          <AddButton onClick={() => handleAddCharge('spread')}>
            <span style={{ fontFamily: 'Material Symbols Outlined' }}>add</span>
            Add Spread
          </AddButton>
        </SectionHeader>
        <SectionContent>
          {spreads.length > 0 ? (
            <ItemList>
              {spreads.map(item => renderChargeItem('spread', item))}
            </ItemList>
          ) : (
            <EmptyState>No spread charges configured</EmptyState>
          )}
        </SectionContent>
      </Section>

      {/* Swap Section */}
      <Section>
        <SectionHeader>
          <SectionTitleGroup>
            <SectionIcon>🌙</SectionIcon>
            <SectionTitleText>
              <SectionTitle>Swap</SectionTitle>
              <SectionSubtitle>Overnight holding fees</SectionSubtitle>
            </SectionTitleText>
          </SectionTitleGroup>
          <AddButton onClick={() => handleAddCharge('swap')}>
            <span style={{ fontFamily: 'Material Symbols Outlined' }}>add</span>
            Add Swap
          </AddButton>
        </SectionHeader>
        <SectionContent>
          {swaps.length > 0 ? (
            <ItemList>
              {swaps.map(item => renderChargeItem('swap', item))}
            </ItemList>
          ) : (
            <EmptyState>No swap charges configured</EmptyState>
          )}
        </SectionContent>
      </Section>

      {/* Add/Edit Modal */}
      <Modal $visible={openModal}>
        <ModalContent onClick={e => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>
              {openModal === 'commission' ? 'Add Commission' :
               openModal === 'spread' ? 'Add Spread' :
               'Add Swap'}
            </ModalTitle>
            <CloseButton onClick={() => setOpenModal(null)}>✕</CloseButton>
          </ModalHeader>

          <FormGroup>
            <FormLabel>Charge Name</FormLabel>
            <FormInput
              type="text"
              placeholder="e.g., Global, Premium, etc."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </FormGroup>

          <FormGroup>
            <FormLabel>Value</FormLabel>
            <FormInput
              type="number"
              placeholder="0.00"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              step="0.01"
            />
          </FormGroup>

          <FormGroup>
            <FormLabel>Unit</FormLabel>
            <FormSelect
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed (USD)</option>
              <option value="pips">Pips</option>
            </FormSelect>
          </FormGroup>

          <ButtonGroup>
            <SecondaryButton onClick={() => setOpenModal(null)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleSaveCharge}>Save</PrimaryButton>
          </ButtonGroup>
        </ModalContent>
      </Modal>
    </Container>
  )
}
