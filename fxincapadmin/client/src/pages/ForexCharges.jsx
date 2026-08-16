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

/** The three charge types side by side, collapsing to one column when narrow. */
const ChargeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${theme.spacing.lg};
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`

const Section = styled.div`
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  overflow: hidden;
  display: flex;
  flex-direction: column;
`


/** Stacked rather than side-by-side: the three columns are too narrow to fit a
 *  title and an action button on one line. */
const SectionHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${theme.spacing.md};
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
  justify-content: center;
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

/** Symbols offered in the picker. 'ALL' is the fallback for anything else. */
const SPREAD_SYMBOLS = [
  'ALL',
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY',
  'XAUUSD', 'XAGUSD',
  'BTCUSDT', 'ETHUSDT',
]

export const ForexCharges = () => {
  const [commissions, setCommissions] = useState([])
  const [spreads, setSpreads] = useState([])
  const [swaps, setSwaps] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [openModal, setOpenModal] = useState(null)
  const [formData, setFormData] = useState({ symbol: 'ALL', spreadPips: '', enabled: true })

  useEffect(() => {
    fetchCharges()
  }, [])

  const fetchCharges = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch('/api/admin/forex-charges', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        // Surfaced rather than swallowed: this page previously hid a 404 behind
        // an `if (response.ok)` and looked like it was working.
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || `Failed to load charges (HTTP ${response.status})`)
      }
      const data = await response.json()
      setCommissions(data?.commissions || [])
      setSpreads(data?.spreads || [])
      setSwaps(data?.swaps || [])
    } catch (err) {
      console.error('Error fetching charges:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCharge = (type) => {
    setFormData({ symbol: 'ALL', spreadPips: '', enabled: true })
    setError(null)
    setOpenModal(type)
  }

  const handleSaveCharge = async () => {
    const pips = Number(formData.spreadPips)
    if (!formData.symbol) {
      setError('Choose a symbol')
      return
    }
    if (!Number.isFinite(pips) || pips < 0) {
      setError('Spread must be a number of pips, 0 or greater')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch('/api/admin/forex-charges/spread', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          symbol: formData.symbol,
          spreadPips: pips,
          enabled: formData.enabled,
        }),
      })

      const body = await response.json().catch(() => null)
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || `Save failed (HTTP ${response.status})`)
      }

      // Re-read from the server rather than trusting local state, so what is
      // displayed is what was actually persisted.
      await fetchCharges()
      setOpenModal(null)
      setFormData({ symbol: 'ALL', spreadPips: '', enabled: true })
    } catch (err) {
      console.error('Error saving charge:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSpread = async (symbol) => {
    if (!window.confirm(`Remove the spread configured for ${symbol}?`)) return
    setError(null)
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/forex-charges/spread/${encodeURIComponent(symbol)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || `Delete failed (HTTP ${response.status})`)
      }
      await fetchCharges()
    } catch (err) {
      console.error('Error deleting spread:', err)
      setError(err.message)
    }
  }

  const handleEditSpread = (item) => {
    setFormData({
      symbol: item.symbol,
      spreadPips: String(item.spreadPips),
      enabled: item.enabled,
    })
    setError(null)
    setOpenModal('spread')
  }

  const renderSpreadItem = (item) => (
    <Item key={item.symbol}>
      <ItemLabel>
        <ItemBadge>{item.symbol === 'ALL' ? 'Fallback' : 'Symbol'}</ItemBadge>
        <ItemName>{item.symbol}</ItemName>
        {!item.enabled && <Unit style={{ color: '#ef4444' }}>disabled</Unit>}
      </ItemLabel>
      <ItemValue>
        <Value>{item.spreadPips}</Value>
        <Unit>pips</Unit>
        <ActionButtons>
          <IconButton onClick={() => handleEditSpread(item)}>edit</IconButton>
          {item.symbol !== 'ALL' && (
            <IconButton className="delete" onClick={() => handleDeleteSpread(item.symbol)}>delete</IconButton>
          )}
        </ActionButtons>
      </ItemValue>
    </Item>
  )

  const renderChargeItem = (type, item) => (
    <Item key={item.id}>
      <ItemLabel>
        <ItemBadge>{type === 'commission' ? 'Commission' : 'Swap'}</ItemBadge>
        <ItemName>{item.name}</ItemName>
      </ItemLabel>
      <ItemValue>
        <Value>{item.value}</Value>
        <Unit>{item.unit}</Unit>
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

      {error && !openModal && (
        <Section style={{ borderColor: '#ef4444' }}>
          <SectionContent style={{ minHeight: 'auto', padding: '12px 16px' }}>
            <EmptyState style={{ color: '#ef4444' }}>{error}</EmptyState>
          </SectionContent>
        </Section>
      )}

      <ChargeGrid>
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
          {/* Commission has no backend yet; the button is disabled rather than
              opening a form that cannot save. */}
          <AddButton disabled title="Commission configuration is not implemented yet" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
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
              <SectionSubtitle>
                Extra pips added on top of the provider's raw Bid/Ask, split evenly so the mid price is unchanged
              </SectionSubtitle>
            </SectionTitleText>
          </SectionTitleGroup>
          <AddButton onClick={() => handleAddCharge('spread')}>
            <span style={{ fontFamily: 'Material Symbols Outlined' }}>add</span>
            Set Spread
          </AddButton>
        </SectionHeader>
        <SectionContent>
          {loading ? (
            <EmptyState>Loading…</EmptyState>
          ) : spreads.length > 0 ? (
            <ItemList>
              {spreads.map(renderSpreadItem)}
            </ItemList>
          ) : (
            <EmptyState>No spreads configured — traders see the raw provider price</EmptyState>
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
          {/* Swap has no backend yet — see the Commission note above. */}
          <AddButton disabled title="Swap configuration is not implemented yet" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
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
      </ChargeGrid>

      {/* Add/Edit Modal */}
      <Modal $visible={openModal}>
        <ModalContent onClick={e => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>Set Spread</ModalTitle>
            <CloseButton onClick={() => setOpenModal(null)}>✕</CloseButton>
          </ModalHeader>

          <FormGroup>
            <FormLabel>Symbol</FormLabel>
            <FormSelect
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
            >
              {SPREAD_SYMBOLS.map(s => (
                <option key={s} value={s}>{s === 'ALL' ? 'ALL — fallback for every symbol' : s}</option>
              ))}
            </FormSelect>
            <SectionSubtitle>
              A symbol's own setting wins; ALL applies to anything without one.
            </SectionSubtitle>
          </FormGroup>

          <FormGroup>
            <FormLabel>Spread (pips)</FormLabel>
            <FormInput
              type="number"
              placeholder="e.g. 1.5"
              value={formData.spreadPips}
              onChange={(e) => setFormData({ ...formData, spreadPips: e.target.value })}
              step="0.1"
              min="0"
            />
            <SectionSubtitle>
              Half is taken off the Bid and half added to the Ask, so the mid price does not move.
              On EUR/USD 1 pip = 0.0001. Enter 0 to quote the provider price unchanged.
            </SectionSubtitle>
          </FormGroup>

          <FormGroup>
            <FormLabel style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
              Enabled
            </FormLabel>
            <SectionSubtitle>
              When off, this row is ignored and the symbol falls through to ALL (or the raw price).
            </SectionSubtitle>
          </FormGroup>

          {error && (
            <SectionSubtitle style={{ color: '#ef4444' }}>{error}</SectionSubtitle>
          )}

          <ButtonGroup>
            <SecondaryButton onClick={() => setOpenModal(null)} disabled={saving}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleSaveCharge} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </PrimaryButton>
          </ButtonGroup>
        </ModalContent>
      </Modal>
    </Container>
  )
}
