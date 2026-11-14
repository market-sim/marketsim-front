import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { ThemeProvider } from "../theme/ThemeContext";
import { I18nProvider } from "../i18n/I18nContext";
import PublicTraderPage from "../modules/auth/PublicTraderPage";
import ProtectedRoute from "../auth/ProtectedRoute";
import AppLayout from "../layout/AppLayout";
import LoginPage from "../modules/auth/LoginPage";
import RegisterPage from "../modules/auth/RegisterPage";
import ProfilePage from "../modules/auth/ProfilePage";
import SecurityPage from "../modules/auth/SecurityPage";
import NotificationsPage from "../modules/auth/NotificationsPage";
import MessagesPage from "../modules/support/MessagesPage";
import AdminMessagesPage from "../modules/support/AdminMessagesPage";
import ForgotPasswordPage from "../modules/auth/ForgotPasswordPage";
import ResetPasswordPage from "../modules/auth/ResetPasswordPage";
import VerifyEmailPage from "../modules/auth/VerifyEmailPage";
import AdminOutboxPage from "../modules/admin/AdminOutboxPage";
import ProgressionPage from "../progression/ProgressionPage";
import LeaderboardPage from "../progression/LeaderboardPage";
import AdminUsersPage from "../modules/admin/AdminUsersPage";
import AdminSettingsPage from "../modules/admin/AdminSettingsPage";
import AdminStatsPage from "../modules/admin/AdminStatsPage";
import AdminActivityLogsPage from "../modules/admin/AdminActivityLogsPage";
import AdminLoginAnomaliesPage from "../modules/admin/AdminLoginAnomaliesPage";
import DashboardPage from "../modules/dashboard/DashboardPage";
import TradingPage from "../modules/trading/TradingPage";
import AnalysisPage from "../modules/analysis/AnalysisPage";
import EducationPage from "../modules/education/EducationPage";
import MarketPage from "../modules/market/MarketPage";
import AgentPage from "../modules/agent/AgentPage";
import StressPage from "../modules/stress/StressPage";
import BlockchainPage from "../modules/blockchain/BlockchainPage";

/** Page reservee aux traders : l'administrateur est renvoye vers son panneau (page confidentielle). */
function NotForAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user?.role === "ADMIN" ? <Navigate to="/admin" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          {/* carte de trader partagee : visible sans compte */}
          <Route path="/t/:publicId" element={<PublicTraderPage />} />

          {/* Pages accessibles une fois connecte */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="security" element={<NotForAdmin><SecurityPage /></NotForAdmin>} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="messages" element={<NotForAdmin><MessagesPage /></NotForAdmin>} />
              <Route path="progression" element={<ProgressionPage />} />
              <Route path="leaderboard" element={<LeaderboardPage />} />
              <Route path="trading" element={<TradingPage />} />
              <Route path="analysis" element={<AnalysisPage />} />
              <Route path="education" element={<EducationPage />} />
              <Route path="market" element={<MarketPage />} />
              <Route path="agent" element={<AgentPage />} />
              <Route path="stress" element={<StressPage />} />
              <Route path="blockchain" element={<BlockchainPage />} />

              {/* Reserve aux admins */}
              <Route element={<ProtectedRoute adminOnly />}>
                <Route path="admin" element={<AdminUsersPage />} />
                <Route path="admin/stats" element={<AdminStatsPage />} />
                <Route path="admin/settings" element={<AdminSettingsPage />} />
                <Route path="admin/activity" element={<AdminActivityLogsPage />} />
                <Route path="admin/login-anomalies" element={<AdminLoginAnomaliesPage />} />
                <Route path="admin/outbox" element={<AdminOutboxPage />} />
                <Route path="admin/messages" element={<AdminMessagesPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}
