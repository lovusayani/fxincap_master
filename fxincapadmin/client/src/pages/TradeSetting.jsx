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

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${theme.spacing.md};
  margin-bottom: ${theme.spacing.lg};
`

const StatCard = styled.div`
  background: ${theme.colors.card};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  padding: ${theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`

const StatLabel = styled.p`
  font-size: 0.875rem;
  color: ${theme.colors.textSecondary};
  margin: 0;
`

const StatValue = styled.h3`
  font-size: 1.875rem;
  font-weight: 700;
  margin: 0;
  color: ${theme.colors.text};
`

const StatSubtext = styled.p`
  font-size: 0.75rem;
  color: ${theme.colors.textTertiary};
  margin: ${theme.spacing.xs} 0 0 0;
`

const TabsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`

const TabsList = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  border-bottom: 1px solid ${theme.colors.border};
`

const TabButton = styled.button`
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: ${props => props.active ? theme.colors.primary : theme.colors.textSecondary};
  border-bottom-color: ${props => props.active ? theme.colors.primary : 'transparent'};
  cursor: pointer;
  font-weight: ${props => props.active ? '600' : '500'};
  transition: all 0.2s ease;

  &:hover {
    color: ${theme.colors.text};
  }
`

const TableWrapper = styled.div`
  overflow-x: auto;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  thead {
    background: ${theme.colors.cardHover};
    border-bottom: 1px solid ${theme.colors.border};
  }

  th {
    padding: ${theme.spacing.md};
    text-align: left;
    font-weight: 600;
    color: ${theme.colors.textSecondary};
    font-size: 0.875rem;
  }

  td {
    padding: ${theme.spacing.md};
    border-bottom: 1px solid ${theme.colors.border};
    color: ${theme.colors.text};
    font-size: 0.875rem;
  }

  tr:hover {
    background: ${theme.colors.cardHover};
  }

  tr:last-child td {
    border-bottom: none;
  }
`

const StatusBadge = styled.span`
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border-radius: ${theme.radius.sm};
  font-size: 0.75rem;
  font-weight: 600;
  background: ${props => props.status === 'open' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(107, 114, 128, 0.1)'};
  color: ${props => props.status === 'open' ? '#3b82f6' : '#6b7280'};
`

const PnLText = styled.span`
  color: ${props => props.value >= 0 ? '#10b981' : '#ef4444'};
  font-weight: 600;
`

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.spacing.xl};
  color: ${theme.colors.textSecondary};
`

const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.lg};
  background: ${theme.colors.card};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  margin-bottom: ${theme.spacing.lg};
  flex-wrap: wrap;
`

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
`

const FilterLabel = styled.label`
  font-size: 0.875rem;
  color: ${theme.colors.textSecondary};
  font-weight: 500;
`

const FilterInput = styled.input`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  color: ${theme.colors.text};
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
  }
`

const FilterSelect = styled.select`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  color: ${theme.colors.text};
  font-size: 0.875rem;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
  }
`

const SearchInput = styled.input`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  color: ${theme.colors.text};
  font-size: 0.875rem;
  flex: 1;
  min-width: 200px;

  &::placeholder {
    color: ${theme.colors.textTertiary};
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
  }
`

const CreateButton = styled.button`
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  background: ${theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${theme.radius.sm};
  font-weight: 600;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.2s ease;

  &:hover {
    opacity: 0.9;
  }
`

const TradeTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
  white-space: nowrap;
`

const TradeLabel = styled.label`
  font-size: 0.75rem;
  color: ${theme.colors.textTertiary};
  text-transform: uppercase;
  font-weight: 600;
`

export const TradeSetting = () => {
  const [dashboardData, setDashboardData] = useState({
    totalTrades: 0,
    openPositions: 0,
    totalVolume: 0,
    platformPnl: 0,
  })
  const [demoTrades, setDemoTrades] = useState([])
  const [realTrades, setRealTrades] = useState([])
  const [activeTab, setActiveTab] = useState('demo')
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [dateBy, setDateBy] = useState('openDate')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const [statsRes, demoRes, realRes] = await Promise.all([
        fetch('/api/trades/stats', { headers }),
        fetch('/api/trades?mode=demo', { headers }),
        fetch('/api/trades?mode=real', { headers }),
      ])

      if (statsRes.ok) {
        const stats = await statsRes.json()
        setDashboardData({
          totalTrades: stats?.totalTrades || 0,
          openPositions: stats?.openPositions || 0,
          totalVolume: stats?.totalVolume || 0,
          platformPnl: stats?.platformPnl || 0,
        })
      }

      if (demoRes.ok) {
        const demo = await demoRes.json()
        setDemoTrades(demo?.trades || demo || [])
      }

      if (realRes.ok) {
        const real = await realRes.json()
        setRealTrades(real?.trades || real || [])
      }
    } catch (error) {
      console.error('Error fetching trade data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const getFilteredTrades = () => {
    const trades = activeTab === 'demo' ? demoTrades : realTrades

    return trades.filter((trade) => {
      // Search filter
      if (searchTerm && !trade.symbol.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }

      // Status filter
      if (statusFilter !== 'all' && trade.status !== statusFilter) {
        return false
      }

      // Date filter
      if (fromDate || toDate) {
        const dateToCheck = dateBy === 'closeDate' ? trade.closeTime : trade.openTime
        const tradeDate = new Date(dateToCheck)

        if (fromDate) {
          const from = new Date(fromDate)
          if (tradeDate < from) return false
        }

        if (toDate) {
          const to = new Date(toDate)
          to.setHours(23, 59, 59, 999)
          if (tradeDate > to) return false
        }
      }

      return true
    })
  }

  const filteredTrades = getFilteredTrades()

  const handleCreateTrade = () => {
    alert('Create Trade functionality - to be implemented')
  }

  return (
    <Container>
      <Breadcrumb items={['Trade Master', 'Trade Setting']} />

      <StatsGrid>
        <StatCard>
          <StatLabel>Total Trades</StatLabel>
          <StatValue>{dashboardData.totalTrades}</StatValue>
          <StatSubtext>Completed trades</StatSubtext>
        </StatCard>

        <StatCard>
          <StatLabel>Open Positions</StatLabel>
          <StatValue>{dashboardData.openPositions}</StatValue>
          <StatSubtext>Currently active</StatSubtext>
        </StatCard>

        <StatCard>
          <StatLabel>Total Volume</StatLabel>
          <StatValue>{formatCurrency(dashboardData.totalVolume)}</StatValue>
          <StatSubtext>Trading volume</StatSubtext>
        </StatCard>

        <StatCard>
          <StatLabel>Platform P&L</StatLabel>
          <StatValue style={{ color: dashboardData.platformPnl >= 0 ? '#10b981' : '#ef4444' }}>
            {formatCurrency(dashboardData.platformPnl)}
          </StatValue>
          <StatSubtext>Profit & Loss</StatSubtext>
        </StatCard>
      </StatsGrid>

      <Card title="Trading History">
        <TabsContainer>
          <TabsList>
            <TabButton
              active={activeTab === 'demo'}
              onClick={() => setActiveTab('demo')}
            >
              Demo Trades
            </TabButton>
            <TabButton
              active={activeTab === 'real'}
              onClick={() => setActiveTab('real')}
            >
              Real Trades
            </TabButton>
          </TabsList>

          <FilterBar>
            <TradeTitle>
              <span style={{ fontSize: '1rem', fontWeight: 600 }}>All Trades</span>
              <TradeLabel>{activeTab} accounts</TradeLabel>
            </TradeTitle>

            <FilterGroup>
              <FilterLabel>From:</FilterLabel>
              <FilterInput
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder="dd-mm-yyyy"
              />
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>To:</FilterLabel>
              <FilterInput
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder="dd-mm-yyyy"
              />
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>Date by:</FilterLabel>
              <FilterSelect value={dateBy} onChange={(e) => setDateBy(e.target.value)}>
                <option value="openDate">Open date</option>
                <option value="closeDate">Close date</option>
              </FilterSelect>
            </FilterGroup>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <CreateButton onClick={handleCreateTrade}>+ Create Trade</CreateButton>
              <SearchInput
                type="text"
                placeholder="Search trades..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <FilterSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </FilterSelect>
            </div>
          </FilterBar>

          <TableWrapper>
            {filteredTrades.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th style={{ textAlign: 'right' }}>Entry Price</th>
                    <th style={{ textAlign: 'right' }}>Exit Price</th>
                    <th style={{ textAlign: 'right' }}>Quantity</th>
                    <th style={{ textAlign: 'right' }}>P&L</th>
                    <th style={{ textAlign: 'right' }}>P&L %</th>
                    <th>Entry Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td style={{ fontWeight: 600 }}>{trade.symbol}</td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(trade.entryPrice)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {trade.exitPrice ? formatNumber(trade.exitPrice) : '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(trade.quantity)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <PnLText value={trade.pnl}>
                          {formatCurrency(trade.pnl)}
                        </PnLText>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <PnLText value={trade.pnlPercent}>
                          {trade.pnlPercent > 0 ? '+' : ''}{formatNumber(trade.pnlPercent)}%
                        </PnLText>
                      </td>
                      <td>{new Date(trade.openTime).toLocaleString()}</td>
                      <td>
                        <StatusBadge status={trade.status}>
                          {trade.status.toUpperCase()}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState>
                {loading ? 'Loading...' : searchTerm || statusFilter !== 'all' || fromDate || toDate ? 'No trades match your filters' : `No ${activeTab} trades found`}
              </EmptyState>
            )}
          </TableWrapper>
        </TabsContainer>
      </Card>
    </Container>
  )
}
