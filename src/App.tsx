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
                          Title={() => (
                            <div style={{ padding: "16px 8px", textAlign: "center" }}>
                              <Typography.Text strong style={{ fontSize: 16, color: "#1B3A6B" }}>
                                COMTER
                              </Typography.Text>
                              <br />
                              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                Admin Panel
                              </Typography.Text>
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
                  <Route index       element={<EmployeeList />} />
                  <Route path="create"    element={<EmployeeCreate />} />
                  <Route path="edit/:id"  element={<EmployeeEdit />} />
                </Route>

                <Route path="/plants">
                  <Route index       element={<PlantList />} />
                  <Route path="create"    element={<PlantCreate />} />
                  <Route path="edit/:id"  element={<PlantEdit />} />
                </Route>

                <Route path="/clients">
                  <Route index       element={<ClientList />} />
                  <Route path="create"    element={<ClientCreate />} />
                  <Route path="edit/:id"  element={<ClientEdit />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Refine>
        </AntApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}
