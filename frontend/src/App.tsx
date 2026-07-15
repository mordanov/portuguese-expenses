import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated, isAdmin } from './api/auth'
import { ProjectProvider } from './context/ProjectContext'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TicketsPage from './pages/TicketsPage'
import NewTicketPage from './pages/NewTicketPage'
import TicketDetailPage from './pages/TicketDetailPage'
import MembersPage from './pages/MembersPage'
import CategoriesPage from './pages/CategoriesPage'
import ReportsPage from './pages/ReportsPage'
import BalancesPage from './pages/BalancesPage'
import UsersPage from './pages/UsersPage'
import ProjectsPage from './pages/ProjectsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (!isAdmin()) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ProjectProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="tickets/new" element={<AdminRoute><NewTicketPage /></AdminRoute>} />
          <Route path="tickets/:id" element={<TicketDetailPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="balances" element={<BalancesPage />} />
          <Route
            path="users"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />
          <Route
            path="projects"
            element={
              <AdminRoute>
                <ProjectsPage />
              </AdminRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ProjectProvider>
  )
}
