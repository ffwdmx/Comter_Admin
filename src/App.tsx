import { Refine, Authenticated } from "@refinedev/core";
import { RefineThemes, ThemedLayout, ThemedSider, useNotificationProvider } from "@refinedev/antd";
import routerProvider from "@refinedev/react-router";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { ConfigProvider, App as AntApp, Typography } from "antd";
import {
  TeamOutlined,
  EnvironmentOutlined,
  ShopOutlined,
  DashboardOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  CalendarOutlined,
  SwapOutlined,
  ExperimentOutlined,
  AuditOutlined,
  BugOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import "@refinedev/antd/dist/reset.css";

import { authProvider }  from "./providers/authProvider";
import { dataProvider }  from "./providers/dataProvider";
import { LoginPage }     from "./pages/login";
import { EmployeeList }  from "./pages/employees/list";
import { EmployeeCreate, EmployeeEdit } from "./pages/employees/form";
import { PlantList }     from "./pages/plants/list";
import { PlantCreate, PlantEdit } from "./pages/plants/form";
import { ClientList }    from "./pages/clients/list";
import { ClientCreate, ClientEdit } from "./pages/clients/form";
import { ShiftTypeList }             from "./pages/shifts/list";
import { ShiftTypeCreate, ShiftTypeEdit } from "./pages/shifts/form";
import { SupervisorDashboard }       from "./pages/supervisor/dashboard";
import { WeeklyReview }             from "./pages/attendance/WeeklyReview";
import { QCProjectList }            from "./pages/quality-control/projects/list";
import { QCProjectCreate, QCProjectEdit } from "./pages/quality-control/projects/form";
import { QCProjectDetail }          from "./pages/quality-control/projects/detail";
import { InspectionReview }         from "./pages/quality-control/inspections/review";
import { DefectTypeList }           from "./pages/quality-control/defect-types/list";
import { ReportGenerator }          from "./pages/quality-control/reports/generator";
import { ExtraShiftRequests }       from "./pages/attendance/ExtraShiftRequests";

const Dashboard = () => (
  <div style={{ padding: 24 }}>
    <Typography.Title level={3}>Panel de Administración</Typography.Title>
    <Typography.Text type="secondary">
      Selecciona un módulo en el menú lateral para comenzar.
    </Typography.Text>
  </div>
);

export default function App() {
  const notificationProvider = useNotificationProvider();

  return (
    <BrowserRouter>
      <ConfigProvider theme={RefineThemes.Blue}>
        <AntApp>
          <Refine
            routerProvider={routerProvider}
            authProvider={authProvider}
            dataProvider={dataProvider}
            notificationProvider={notificationProvider}
            resources={[
              {
                name: "dashboard",
                list: "/",
                meta: { label: "Dashboard", icon: <DashboardOutlined /> },
              },
              {
                name:   "employees",
                list:   "/employees",
                create: "/employees/create",
                edit:   "/employees/edit/:id",
                meta:   { label: "Empleados", icon: <TeamOutlined /> },
              },
              {
                name:   "plants",
                list:   "/plants",
                create: "/plants/create",
                edit:   "/plants/edit/:id",
                meta:   { label: "Plantas", icon: <EnvironmentOutlined /> },
              },
              {
                name:   "clients",
                list:   "/clients",
                create: "/clients/create",
                edit:   "/clients/edit/:id",
                meta:   { label: "Clientes", icon: <ShopOutlined /> },
              },
              {
                name:   "shifts",
                list:   "/shifts",
                create: "/shifts/create",
                edit:   "/shifts/edit/:id",
                meta:   { label: "Turnos", icon: <ClockCircleOutlined /> },
              },
              {
                name: "supervisor",
                list: "/supervisor",
                meta: { label: "Supervisor", icon: <AlertOutlined /> },
              },
              {
                name: "attendance",
                list: "/attendance",
                meta: { label: "Asistencia Semanal", icon: <CalendarOutlined /> },
              },
              {
                name: "extra-shifts",
                list: "/extra-shifts",
                meta: { label: "Segundos Turnos", icon: <SwapOutlined /> },
              },
              {
                name: "qc-projects",
                list:   "/quality-control/projects",
                create: "/quality-control/projects/create",
                edit:   "/quality-control/projects/edit/:id",
                show:   "/quality-control/projects/:id",
                meta:   { label: "QC — Proyectos", icon: <ExperimentOutlined /> },
              },
              {
                name: "qc-inspections",
                list: "/quality-control/inspections/review",
                meta: { label: "QC — Revisión", icon: <AuditOutlined /> },
              },
              {
                name: "qc-defect-types",
                list: "/quality-control/defect-types",
                meta: { label: "QC — Defectos", icon: <BugOutlined /> },
              },
              {
                name: "qc-reports",
                list: "/quality-control/reports",
                meta: { label: "QC — Reportes", icon: <BarChartOutlined /> },
              },
            ]}
            options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                element={
                  <Authenticated key="auth" fallback={<Navigate to="/login" />}>
                    <ThemedLayout
                      Sider={() => (
                        <ThemedSider
                          Title={({ collapsed }) => (
                            <div style={{ padding: "12px 8px", textAlign: "center" }}>
                              <img
                                src="/comter_logo_short.png"
                                alt="Comter"
                                style={{
                                  height: collapsed ? 40 : 56,
                                  objectFit: "contain",
                                  transition: "height 0.2s",
                                }}
                              />
                            </div>
                          )}
                        />
                      )}
                    >
                      <Outlet />
                    </ThemedLayout>
                  </Authenticated>
                }
              >
                <Route index element={<Dashboard />} />

                <Route path="/employees">
                  <Route index          element={<EmployeeList />} />
                  <Route path="create"  element={<EmployeeCreate />} />
                  <Route path="edit/:id" element={<EmployeeEdit />} />
                </Route>

                <Route path="/plants">
                  <Route index          element={<PlantList />} />
                  <Route path="create"  element={<PlantCreate />} />
                  <Route path="edit/:id" element={<PlantEdit />} />
                </Route>

                <Route path="/clients">
                  <Route index          element={<ClientList />} />
                  <Route path="create"  element={<ClientCreate />} />
                  <Route path="edit/:id" element={<ClientEdit />} />
                </Route>

                <Route path="/shifts">
                  <Route index          element={<ShiftTypeList />} />
                  <Route path="create"  element={<ShiftTypeCreate />} />
                  <Route path="edit/:id" element={<ShiftTypeEdit />} />
                </Route>

                <Route path="/supervisor"   element={<SupervisorDashboard />} />
                <Route path="/attendance"   element={<WeeklyReview />} />
                <Route path="/extra-shifts" element={<ExtraShiftRequests />} />

                <Route path="/quality-control/projects">
                  <Route index              element={<QCProjectList />}   />
                  <Route path="create"      element={<QCProjectCreate />} />
                  <Route path="edit/:id"    element={<QCProjectEdit />}   />
                  <Route path=":id"         element={<QCProjectDetail />} />
                </Route>

                <Route path="/quality-control/inspections/review" element={<InspectionReview />} />
                <Route path="/quality-control/defect-types"       element={<DefectTypeList />}   />
                <Route path="/quality-control/reports"            element={<ReportGenerator />}  />
              </Route>

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Refine>
        </AntApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}
