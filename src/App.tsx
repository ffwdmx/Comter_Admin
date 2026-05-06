import { Refine, Authenticated, useGetIdentity, useLogout } from "@refinedev/core";
import { RefineThemes, ThemedLayout, ThemedSider, useNotificationProvider } from "@refinedev/antd";
import routerProvider from "@refinedev/react-router";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { ConfigProvider, App as AntApp, Typography, Avatar, Dropdown } from "antd";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import {
  TeamOutlined,
  EnvironmentOutlined,
  ShopOutlined,
  DashboardOutlined,
  ClockCircleOutlined,
  AlertOutlined,
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

const CustomHeader = () => {
  const { data: identity } = useGetIdentity<{ name: string; role: string }>();
  const { mutate: logout } = useLogout();

  const menuItems = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Cerrar sesión",
      danger: true,
      onClick: () => logout(),
    },
  ];

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      padding: "0 24px",
      height: "100%",
    }}>
      <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <Avatar size={32} icon={<UserOutlined />} style={{ backgroundColor: "#1B3A6B" }} />
          <Typography.Text strong style={{ fontSize: 14 }}>
            {identity?.name ?? "Administrador"}
          </Typography.Text>
        </div>
      </Dropdown>
    </div>
  );
};

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
            ]}
            options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                element={
                  <Authenticated key="auth" fallback={<Navigate to="/login" />}>
                    <ThemedLayout
                      Header={CustomHeader}
                      Sider={() => (
                        <ThemedSider
                          Title={({ collapsed }) => (
                            <div style={{ padding: "12px 8px", textAlign: "center" }}>
                              {collapsed
                                ? <img src="/comter_logo_short.png" alt="Comter" style={{ height: 52, objectFit: "contain" }} />
                                : <img src="/comter_logo_short.png" alt="Comter" style={{ height: 64, objectFit: "contain" }} />
                              }
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

                <Route path="/supervisor" element={<SupervisorDashboard />} />
              </Route>

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Refine>
        </AntApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}
