import { GlobalStyle } from './styles/GlobalStyle'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { BlankPage } from './pages/BlankPage'
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
import { MiscellaneousSettings } from './pages/MiscellaneousSettings'
import { Offers } from './pages/Offers'
import { Wallet } from './pages/Wallet'
import { ServerSettings } from './pages/ServerSettings'
import { UserSettings } from './pages/UserSettings'

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
            <Route index element={<BlankPage />} />
            <Route path="dashboard" element={<BlankPage />} />
            <Route path="members/list" element={<MemberList />} />
            <Route path="members/profile" element={<MemberProfile />} />
            <Route path="members/profile/:id" element={<MemberProfile />} />
            <Route path="all-pendings" element={<AllPendings />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="pending-deposit/:id" element={<PendingDepositDetail />} />
            <Route path="pending-withdrawal/:id" element={<PendingWithdrawalDetail />} />
            <Route path="user-kyc" element={<UserKycStatus />} />
            <Route path="trade-setting" element={<TradeSetting />} />
            <Route path="market/offers" element={<Offers />} />
            <Route path="user-settings" element={<UserSettings />} />
            <Route path="server-settings" element={<ServerSettings />} />
            <Route path="miscellaneous-settings" element={<MiscellaneousSettings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
