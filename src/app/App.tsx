import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "../auth/AuthContext";
import ProtectedRoute from "../auth/ProtectedRoute";
import AppLayout from "../layout/AppLayout";
import LoginPage from "../modules/auth/LoginPage";
import RegisterPage from "../modules/auth/RegisterPage";
import AdminUsersPage from "../modules/admin/AdminUsersPage";
import DashboardPage from "../modules/dashboard/DashboardPage";
import TradingPage from "../modules/trading/TradingPage";
import AnalysisPage from "../modules/analysis/AnalysisPage";
import EducationPage from "../modules/education/EducationPage";
import MarketPage from "../modules/market/MarketPage";
import AgentPage from "../modules/agent/AgentPage";
import StressPage from "../modules/stress/StressPage";
import BlockchainPage from "../modules/blockchain/BlockchainPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Pages accessibles une fois connecte */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
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
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
