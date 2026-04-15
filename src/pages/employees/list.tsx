import { useTable, EditButton, DeleteButton, CreateButton } from "@refinedev/antd";
import { Table, Space, Tag, Input, Select } from "antd";
import { UserOutlined, SearchOutlined } from "@ant-design/icons";
import { useState } from "react";

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

export const EmployeeList = () => {
  const [search, setSearch]     = useState("");
  const [roleFilter, setRole]   = useState<string | undefined>();

  const { tableProps } = useTable({
    syncWithLocation: true,
  });

  const data = (tableProps.dataSource as any[]) ?? [];
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
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Space>
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
        </Space>
        <CreateButton />
      </Space>

      <Table
        {...tableProps}
        dataSource={filtered}
        rowKey="id"
        pagination={{ pageSize: 15 }}
      >
        <Table.Column
          title="Empleado"
          dataIndex="name"
          render={(name, record: any) => (
            <Space>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "#1B3A6B22", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontWeight: 700, color: "#1B3A6B", fontSize: 14,
              }}>
                {name?.[0]?.toUpperCase() ?? <UserOutlined />}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{name}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{record.employee_no}</div>
              </div>
            </Space>
          )}
        />
        <Table.Column title="Email"        dataIndex="email" />
        <Table.Column title="Teléfono"     dataIndex="phone" render={(v) => v ?? "—"} />
        <Table.Column
          title="Rol"
          dataIndex="role"
          render={(role) => (
            <Tag color={roleColor[role] ?? "default"}>
              {roleLabel[role] ?? role}
            </Tag>
          )}
        />
        <Table.Column title="Planta"       dataIndex="plant_name" render={(v) => v ?? "Sin asignar"} />
        <Table.Column
          title="Estado"
          dataIndex="is_active"
          render={(v) => (
            <Tag color={v ? "green" : "red"}>{v ? "Activo" : "Inactivo"}</Tag>
          )}
        />
        <Table.Column
          title="Acciones"
          render={(_, record: any) => (
            <Space>
              <EditButton   hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id}
                confirmTitle="¿Desactivar este empleado?"
                confirmOkText="Desactivar" confirmCancelText="Cancelar"
              />
            </Space>
          )}
        />
      </Table>
    </div>
  );
};
