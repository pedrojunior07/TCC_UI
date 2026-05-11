import { Navigate, Route, Routes } from 'react-router-dom'
import { AppDataProvider } from './context/AppDataContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { RequireAuth } from './components/auth/RequireAuth.jsx'
import { RequireRole } from './components/auth/RequireRole.jsx'
import { AppShell } from './components/shell/AppShell.jsx'
import { Dashboard } from './pages/Dashboard.jsx'
import { MembersList } from './pages/MembersList.jsx'
import { MemberDetail } from './pages/MemberDetail.jsx'
import { MemberNew } from './pages/MemberNew.jsx'
import { ImportCsv } from './pages/ImportCsv.jsx'
import { OcrSim } from './pages/OcrSim.jsx'
import { Families } from './pages/Families.jsx'
import { FamilyDetail } from './pages/FamilyDetail.jsx'
import { Certificates } from './pages/Certificates.jsx'
import { CertificateRequests } from './pages/CertificateRequests.jsx'
import { Login } from './pages/Login.jsx'
import { Profile } from './pages/Profile.jsx'
import { Security } from './pages/Security.jsx'
import { Users } from './pages/Users.jsx'
import { Nucleos } from './pages/Nucleos.jsx'
import { NucleoDetail } from './pages/NucleoDetail.jsx'
import { Actividades } from './pages/Actividades.jsx'
import { ActividadeNew } from './pages/ActividadeNew.jsx'
import { ActividadeDetail } from './pages/ActividadeDetail.jsx'
import { VisitasFamiliares } from './pages/VisitasFamiliares.jsx'
import { Contribuicoes } from './pages/Contribuicoes.jsx'
import { Cargos } from './pages/Cargos.jsx'
import { WhatsAppSettings } from './pages/WhatsAppSettings.jsx'
import { ParoquiaSettings } from './pages/ParoquiaSettings.jsx'
import { MembrosEliminados } from './pages/MembrosEliminados.jsx'
import { ServicosParoquiais } from './pages/ServicosParoquiais.jsx'

export default function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/membros" element={<MembersList />} />
            <Route path="/membros/novo" element={<MemberNew />} />
            <Route path="/membros/importar" element={<ImportCsv />} />
            <Route path="/membros/ocr" element={<OcrSim />} />
            <Route
              path="/nucleos"
              element={
                <RequireRole roles={['super_admin', 'chefe_nucleo']}>
                  <Nucleos />
                </RequireRole>
              }
            />
            <Route
              path="/nucleos/:id"
              element={
                <RequireRole roles={['super_admin', 'chefe_nucleo']}>
                  <NucleoDetail />
                </RequireRole>
              }
            />
            <Route
              path="/actividades"
              element={
                <RequireRole roles={['chefe_nucleo']}>
                  <Actividades />
                </RequireRole>
              }
            />
            <Route
              path="/actividades/nova"
              element={
                <RequireRole roles={['chefe_nucleo']}>
                  <ActividadeNew />
                </RequireRole>
              }
            />
            <Route
              path="/actividades/:id"
              element={
                <RequireRole roles={['chefe_nucleo']}>
                  <ActividadeDetail />
                </RequireRole>
              }
            />
            <Route
              path="/visitas-familiares"
              element={
                <RequireRole roles={['chefe_nucleo']}>
                  <VisitasFamiliares />
                </RequireRole>
              }
            />
            <Route
              path="/contribuicoes"
              element={
                <RequireRole roles={['chefe_nucleo']}>
                  <Contribuicoes />
                </RequireRole>
              }
            />
            <Route
              path="/cargos"
              element={
                <RequireRole roles={['chefe_nucleo']}>
                  <Cargos />
                </RequireRole>
              }
            />
            <Route
              path="/certificados"
              element={
                <RequireRole roles={['secretario', 'super_admin']}>
                  <Certificates />
                </RequireRole>
              }
            />
            <Route
              path="/solicitar-certificado"
              element={
                <RequireRole roles={['chefe_nucleo']}>
                  <CertificateRequests />
                </RequireRole>
              }
            />
            <Route
              path="/servicos-paroquiais"
              element={
                <RequireRole roles={['super_admin', 'secretario', 'chefe_nucleo']}>
                  <ServicosParoquiais />
                </RequireRole>
              }
            />
            <Route
              path="/integracoes/whatsapp"
              element={
                <RequireRole roles={['chefe_nucleo']}>
                  <WhatsAppSettings />
                </RequireRole>
              }
            />
            <Route path="/perfil" element={<Profile />} />
            <Route path="/seguranca" element={<Security />} />
            <Route
              path="/paroquia-settings"
              element={
                <RequireRole roles={['super_admin']}>
                  <ParoquiaSettings />
                </RequireRole>
              }
            />
            <Route
              path="/utilizadores"
              element={
                <RequireRole role="super_admin">
                  <Users />
                </RequireRole>
              }
            />
            <Route
              path="/auditoria/eliminados"
              element={
                <RequireRole role="super_admin">
                  <MembrosEliminados />
                </RequireRole>
              }
            />
            <Route path="/membros/:memberKey" element={<MemberDetail />} />
            <Route path="/familias" element={<Families />} />
            <Route path="/familias/:familyId" element={<FamilyDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppDataProvider>
    </AuthProvider>
  )
}
