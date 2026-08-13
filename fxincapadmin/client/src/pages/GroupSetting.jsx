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

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid ${theme.colors.border};
  gap: ${theme.spacing.md};
  margin-bottom: ${theme.spacing.lg};
`

const Tab = styled.button`
  padding: ${theme.spacing.md} 0;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: ${props => props.active ? theme.colors.primary : theme.colors.textSecondary};
  border-bottom-color: ${props => props.active ? theme.colors.primary : 'transparent'};
  cursor: pointer;
  font-weight: ${props => props.active ? '600' : '500'};
  font-size: 0.875rem;
  transition: all 0.2s ease;

  &:hover {
    color: ${theme.colors.text};
  }
`

const StatusBanner = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: ${theme.radius.md};
  margin-bottom: ${theme.spacing.lg};
`

const StatusIcon = styled.span`
  color: #10b981;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
`

const StatusContent = styled.div`
  flex: 1;
`

const StatusLabel = styled.p`
  font-weight: 600;
  color: #10b981;
  margin: 0;
`

const StatusText = styled.p`
  font-size: 0.875rem;
  color: ${theme.colors.textSecondary};
  margin: ${theme.spacing.xs} 0 0 0;
`

const CheckStatusButton = styled.button`
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  background: transparent;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  color: ${theme.colors.accent};
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;

  &:hover {
    background: ${theme.colors.cardHover};
  }
`

const SettingsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.lg};
  background: ${theme.colors.card};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  margin-bottom: ${theme.spacing.lg};
  cursor: pointer;
  user-select: none;

  &:hover {
    background: ${theme.colors.cardHover};
  }
`

const SettingsHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  font-weight: 600;
  color: ${theme.colors.text};
`

const SettingsChevron = styled.span`
  margin-left: auto;
  font-family: 'Material Symbols Outlined';
  font-size: 24px;
  transition: transform 0.2s ease;
  transform: ${props => (props.$open ? 'rotate(180deg)' : 'rotate(0deg)')};
`

const SettingsIcon = styled.span`
  font-family: 'Material Symbols Outlined';
  font-size: 24px;
  color: ${theme.colors.text};
  display: flex;
  align-items: center;
`

const SettingsContent = styled.div`
  display: ${props => (props.$visible ? 'block' : 'none')};
  animation: ${props => (props.$visible ? 'slideDown 220ms ease-out' : 'none')};

  @keyframes slideDown {
    0% { opacity: 0; transform: translateY(-10px); }
    100% { opacity: 1; transform: translateY(0); }
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
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`

const FormIcon = styled.span`
  font-family: 'Material Symbols Outlined';
  font-size: 18px;
  display: flex;
  align-items: center;
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

const PasswordInput = styled(FormInput)`
  font-family: 'Courier New', monospace;
  letter-spacing: 0.2em;
`

const ButtonGroup = styled.div`
  display: flex;
  gap: ${theme.spacing.md};
  margin-top: ${theme.spacing.lg};
  padding-top: ${theme.spacing.lg};
  border-top: 1px solid ${theme.colors.border};
`

const Button = styled.button`
  padding: ${theme.spacing.md} ${theme.spacing.xl};
  border: none;
  border-radius: ${theme.radius.sm};
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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

const SuccessMessage = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: ${theme.radius.sm};
  color: #10b981;
  font-size: 0.875rem;
  margin-bottom: ${theme.spacing.md};
`

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: ${theme.radius.sm};
  color: #ef4444;
  font-size: 0.875rem;
  margin-bottom: ${theme.spacing.md};
`

const NoteSection = styled.div`
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  background: ${theme.colors.cardHover};
  border-radius: ${theme.radius.sm};
  font-size: 0.8125rem;
  color: ${theme.colors.textSecondary};
  line-height: 1.5;
  margin-top: ${theme.spacing.lg};

  strong {
    color: ${theme.colors.text};
  }
`

export const GroupSetting = () => {
  const [openSection, setOpenSection] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [formData, setFormData] = useState({
    lpApiUrl: 'https://api.corececn.com',
    websocketUrl: 'https://api.corececn.com',
    lpApiKey: '',
    lpApiSecret: '',
  })
  const [testLoading, setTestLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connected')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/lp-settings', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setFormData(prevState => ({
          ...prevState,
          ...data.data,
        }))
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleTestConnection = async () => {
    setTestLoading(true)
    setMessage(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/lp-test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lpApiUrl: formData.lpApiUrl,
          lpApiKey: formData.lpApiKey,
          lpApiSecret: formData.lpApiSecret,
        }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Connection successful! LP is reachable and credentials are valid.' })
        setConnectionStatus('connected')
      } else {
        setMessage({ type: 'error', text: 'Connection failed. Please check your credentials and URL.' })
        setConnectionStatus('failed')
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error testing connection: ' + error.message })
      setConnectionStatus('failed')
    } finally {
      setTestLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/lp-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' })
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving settings: ' + error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container>
      <Breadcrumb items={['Groups', 'Group Setting']} />

      <PageHeader>
        <PageTitle>📚 Book Management</PageTitle>
        <PageSubtitle>Manage A-Book and B-Book user assignments and view trades</PageSubtitle>
      </PageHeader>

      <TabsContainer>
        <Tab active={true}>Book Management</Tab>
      </TabsContainer>

      <StatusBanner>
        <StatusIcon>✓</StatusIcon>
        <StatusContent>
          <StatusLabel>LP Connected</StatusLabel>
          <StatusText>A-Book trades will be routed to LP automatically</StatusText>
        </StatusContent>
        <CheckStatusButton>Check Status</CheckStatusButton>
      </StatusBanner>

      {message && (
        message.type === 'success' ? (
          <SuccessMessage>
            <span>✓</span>
            {message.text}
          </SuccessMessage>
        ) : (
          <ErrorMessage>
            <span>✕</span>
            {message.text}
          </ErrorMessage>
        )
      )}

      <SettingsSection onClick={() => setOpenSection(openSection === 0 ? null : 0)}>
        <SettingsHeader>
          <SettingsIcon>settings</SettingsIcon>
          LP Connection Settings
          <SettingsChevron $open={openSection === 0}>expand_more</SettingsChevron>
        </SettingsHeader>

        <SettingsContent $visible={openSection === 0}>
          <div>
            <FormGroup>
              <FormLabel>
                <FormIcon>link</FormIcon>
                Liquidity Provider Connection
              </FormLabel>
              <div style={{ fontSize: '0.75rem', color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>
                Configure connection to Corececn LP for A-Book trade routing
              </div>
            </FormGroup>

            {connectionStatus === 'connected' && (
              <SuccessMessage style={{ marginBottom: theme.spacing.lg }}>
                <span>✓</span>
                Connection successful! LP is reachable and credentials are valid.
              </SuccessMessage>
            )}

            <FormGroup>
              <FormLabel>
                <FormIcon>api</FormIcon>
                LP API URL
              </FormLabel>
              <FormInput
                type="text"
                value={formData.lpApiUrl}
                onChange={(e) => handleInputChange('lpApiUrl', e.target.value)}
                placeholder="https://api.corececn.com"
              />
            </FormGroup>

            <FormGroup>
              <FormLabel>
                <FormIcon>cloud</FormIcon>
                WebSocket URL
              </FormLabel>
              <FormInput
                type="text"
                value={formData.websocketUrl}
                onChange={(e) => handleInputChange('websocketUrl', e.target.value)}
                placeholder="https://api.corececn.com"
              />
            </FormGroup>

            <FormGroup>
              <FormLabel>
                <FormIcon>vpn_key</FormIcon>
                LP API Key
              </FormLabel>
              <PasswordInput
                type="password"
                value={formData.lpApiKey}
                onChange={(e) => handleInputChange('lpApiKey', e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••••••••••••"
              />
            </FormGroup>

            <FormGroup>
              <FormLabel>
                <FormIcon>security</FormIcon>
                LP API Secret
              </FormLabel>
              <PasswordInput
                type="password"
                value={formData.lpApiSecret}
                onChange={(e) => handleInputChange('lpApiSecret', e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••••••••••••••••••••••••••"
              />
            </FormGroup>

            <ButtonGroup>
              <SecondaryButton onClick={handleTestConnection} disabled={testLoading}>
                {testLoading ? 'Testing...' : ''}
                <span style={{ fontFamily: 'Material Symbols Outlined' }}>cloud_sync</span>
                {!testLoading && 'Test Connection'}
              </SecondaryButton>
              <PrimaryButton onClick={handleSaveSettings} disabled={loading}>
                {loading ? 'Saving...' : ''}
                <span style={{ fontFamily: 'Material Symbols Outlined' }}>save</span>
                {!loading && 'Save Settings'}
              </PrimaryButton>
            </ButtonGroup>

            <NoteSection>
              <strong>Note:</strong> These settings configure the connection to your Corececn Liquidity Provider. A-Book trades will be automatically routed to the LP using these credentials. Make sure to test the connection before saving.
            </NoteSection>
          </div>
        </SettingsContent>
      </SettingsSection>
    </Container>
  )
}
