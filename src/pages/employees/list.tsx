import { EditButton, CreateButton } from "@refinedev/antd";
import { Table, Space, Tag, Input, Select, Switch, Tooltip, Popconfirm, App, Button } from "antd";
import { UserOutlined, SearchOutlined, StopOutlined, MobileOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { axiosInstance } from "../../providers/dataProvider";

const roleColor: Record<string, string> = {
  admin:      "purple",
  supervisor: "blue",
  employee:   "green",
};

const roleLabel: Record<string, string> = {
  admin:      "Administrador",
  supervisor: "Supervisor",
  employee:   "Empleado",
};

const reasonLabel: Record<string, string> = {
  resigned: "Renuncia",
  fired:    "Despido",
};

export const EmployeeList = () => {
  const { message } = App.useApp();
  const [search, setSearch]         = useState("");
  const [roleFilter, setRole]       = useState<string | undefined>();
  const [showInactive, setInactive] = useState(false);
  const [data, setData]             = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);

  const resetDevice = async (id: number, name: string) => {
    try {
      await axiosInstance.patch(`/employees/${id}/reset-device`);
      message.success(`Dispositivo liberado para ${name}. El empleado podrá iniciar sesión desde un nuevo celular.`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      message.error(detail ?? "Error al liberar el dispositivo");
    }
  };

  const fetchEmployees = async (includeInactive: boolean) => {
    setLoading(true);
    try {
      const active   = await axiosInstance.get("/employees", { params: { is_active: true } });
      const activeList: any[] = Array.isArray(active.data) ? active.data : [];

      if (includeInactive) {
        const inactive = await axiosInstance.get("/employees", { params: { is_active: false } });
        const inactiveList: any[] = Array.isArray(inactive.data) ? inactive.data : [];
        setData([...activeList, ...inactiveList]);
      } else {
        setData(activeList);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(showInactive); }, [showInactive]);

  const filtered = data.filter((emp) => {
    const matchSearch =
      !search ||
      emp.name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_no?.toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || emp.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div>
      {/* Toolbar */}
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Space wrap>
          <Input
            placeholder="Buscar nombre, número o email…"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Filtrar por rol"
            allowClear
            style={{ width: 160 }}
            onChange={setRole}
            options={[
              { label: "Administrador", value: "admin" },
              { label: "Supervisor",    value: "supervisor" },
              { label: "Empleado",      value: "employee" },
            ]}
          />
          <Tooltip title="Mostrar empleados dados de baja">
            <Space>
              <Switch
                checked={showInactive}
                onChange={setInactive}
                checkedChildren={<StopOutlined />}
                size="small"
              />
              <span style={{ fontSize: 13, color: "#666" }}>Mostrar bajas</span>
            </Space>
          </Tooltip>
        </Space>
        <CreateButton />
      </Space>

      <Table
        dataSource={filtered}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15 }}
        rowClassName={(r) => r.is_active ? "" : "row-inactive"}
      >
        <Table.Column
          title="Empleado"
          dataIndex="name"
          render={(name, record: any) => (
            <Space>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: record.is_active ? "#1B3A6B22" : "#88888822",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, color: record.is_active ? "#1B3A6B" : "#888", fontSize: 14,
              }}>
                {name?.[0]?.toUpperCase() ?? <UserOutlined />}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: record.is_active ? undefined : "#aaa" }}>
                  {name}
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>{record.employee_no}</div>
              </div>
            </Space>
          )}
        />
        <Table.Column title="Email"    dataIndex="email" render={(v) => v ?? "—"} />
        <Table.Column title="Teléfono" dataIndex="phone" render={(v) => v ?? "—"} />
        <Table.Column
          title="Rol"
          dataIndex="role"
          render={(role) => (
            <Tag color={roleColor[role] ?? "default"}>{roleLabel[role] ?? role}</Tag>
          )}
        />
        <Table.Column title="Planta" dataIndex="plant_name" render={(v) => v ?? "Sin asignar"} />
        <Table.Column
          title="Estado"
          dataIndex="is_active"
          render={(v, record: any) => v
            ? <Tag color="green">Activo</Tag>
            : (
              <Space direction="vertical" size={2}>
                <Tag color="red">Baja</Tag>
                {record.termination_reason && (
                  <span style={{ fontSize: 11, color: "#c62828" }}>
                    {reasonLabel[record.termination_reason] ?? record.termination_reason}
                    {record.termination_date ? ` · ${record.termination_date}` : ""}
                  </span>
                )}
              </Space>
            )
          }
        />
        <Table.Column
          title="Acciones"
          render={(_, record: any) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              {record.is_active && (
                <Popconfirm
                  title="¿Liberar dispositivo?"
                  description={`${record.name} podrá iniciar sesión desde un celular nuevo.`}
                  onConfirm={() => resetDevice(record.id, record.name)}
                  okText="Liberar"
                  cancelText="Cancelar"
                  okButtonProps={{ danger: true }}
                >
                  <Tooltip title="Liberar dispositivo">
                    <Button size="small" icon={<MobileOutlined />} />
                  </Tooltip>
                </Popconfirm>
              )}
            </Space>
          )}
        />
      </Table>
    </div>
  );
};
