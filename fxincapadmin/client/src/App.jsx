import { GlobalStyle } from './styles/GlobalStyle'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { BlankPage } from './pages/BlankPage'
import { Dashboard } from './pages/Dashboard'
import { MemberList } from './pages/MemberList'
import { MemberProfile } from './pages/MemberProfile'
import { Register } from './pages/Register'
import { Login } from './pages/Login'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { VerifyEmail } from './pages/VerifyEmail'
import { LockScreen } from './pages/LockScreen'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AllPendings } from './pages/AllPendings'
import { PendingDepositDetail } from './pages/PendingDepositDetail'
import { PendingWithdrawalDetail } from './pages/PendingWithdrawalDetail'
import { UserKycStatus } from './pages/UserKycStatus'
import { TradeSetting } from './pages/TradeSetting'
import { GroupSetting } from './pages/GroupSetting'
import { ForexCharges } from './pages/ForexCharges'
import { HeroBanners } from './pages/HeroBanners'
import { MiscellaneousSettings } from './pages/MiscellaneousSettings'
import { Offers } from './pages/Offers'
import { Wallet } from './pages/Wallet'
import { ServerSettings } from './pages/ServerSettings'
import { UserSettings } from './pages/UserSettings'
import { TradersList } from './pages/TradersList'
import { SubAgentsList } from './pages/SubAgentsList'
import { AccountTypes } from './pages/AccountTypes'
import { IBProgram } from './pages/IBProgram'
import { WithdrawalCharges } from './pages/WithdrawalCharges'
import { WithdrawalsReport } from './pages/WithdrawalsReport'
import { DepositsReport } from './pages/DepositsReport'
import { MamPam } from './pages/MamPam'
import { PageSetting } from './pages/PageSetting'
import { SupportTickets } from './pages/SupportTickets'
import { SupportCategories } from './pages/SupportCategories'
import { EmailSettings } from './pages/EmailSettings'
import { TransactionsReport } from './pages/TransactionsReport'
import { BalanceSheetReport } from './pages/BalanceSheetReport'
import { TradingReport } from './pages/TradingReport'

function App() {
  return (
    <BrowserRouter>
      <GlobalStyle />
      <AuthProvider>
        <Routes>
          {/* Auth Routes - No Layout */}
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/lock-screen" element={<LockScreen />} />
          
          {/* Protected Routes - With Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          > 
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="members/list" element={<MemberList />} />
            <Route path="members/profile" element={<MemberProfile />} />
            <Route path="members/profile/:id" element={<MemberProfile />} />
            <Route path="members/traders" element={<TradersList />} />
            <Route path="members/sub-agents" element={<SubAgentsList />} />
            <Route path="all-pendings" element={<AllPendings />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="pending-deposit/:id" element={<PendingDepositDetail />} />
            <Route path="pending-withdrawal/:id" element={<PendingWithdrawalDetail />} />
            <Route path="user-kyc" element={<UserKycStatus />} />
            <Route path="trade-setting" element={<TradeSetting />} />
            <Route path="group-setting" element={<GroupSetting />} />
            <Route path="account-types" element={<AccountTypes />} />
            <Route path="forex-charges" element={<ForexCharges />} />
            <Route path="hero-banners" element={<HeroBanners />} />
            <Route path="market/offers" element={<Offers />} />
            <Route path="user-settings" element={<UserSettings />} />
            <Route path="server-settings" element={<ServerSettings />} />
            <Route path="miscellaneous-settings" element={<MiscellaneousSettings />} />
            <Route path="page-setting" element={<PageSetting />} />
            <Route path="support/tickets" element={<SupportTickets />} />
            <Route path="support/categories" element={<SupportCategories />} />
            <Route path="email-setting" element={<EmailSettings />} />
            <Route path="reports/transactions" element={<TransactionsReport />} />
            <Route path="reports/balance-sheet" element={<BalanceSheetReport />} />
            <Route path="reports/trading" element={<TradingReport />} />
            <Route path="ib-program" element={<IBProgram />} />
            <Route path="deposits" element={<DepositsReport />} />
            <Route path="withdrawals" element={<WithdrawalsReport />} />
            <Route path="withdrawal-charges" element={<WithdrawalCharges />} />
            <Route path="mam-pam" element={<MamPam />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
