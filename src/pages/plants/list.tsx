import { useTable, EditButton, CreateButton } from "@refinedev/antd";
import { Table, Space, Tag, Typography } from "antd";
import { EnvironmentOutlined } from "@ant-design/icons";

export const PlantList = () => {
  const { tableProps } = useTable({ syncWithLocation: true });

  return (
    <div>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "flex-end" }}>
        <CreateButton />
      </Space>

      <Table {...tableProps} rowKey="id" pagination={{ pageSize: 15 }}>
        <Table.Column
          title="Planta"
          dataIndex="name"
          render={(name) => (
            <Space>
              <EnvironmentOutlined style={{ color: "#1B3A6B" }} />
              <Typography.Text strong>{name}</Typography.Text>
            </Space>
          )}
        />
        <Table.Column title="Cliente"   dataIndex="client_name" render={(v) => v ?? "—"} />
        <Table.Column title="Dirección" dataIndex="address" render={(v) => v ?? "—"} />
        <Table.Column
          title="Coordenadas GPS"
          render={(_, record: any) => (
            <Typography.Text code style={{ fontSize: 12 }}>
              {record.latitude?.toFixed(5)}, {record.longitude?.toFixed(5)}
            </Typography.Text>
          )}
        />
        <Table.Column
          title="Radio geofence"
          dataIndex="radius_m"
          render={(v) => `${v} m`}
        />
        <Table.Column
          title="Estado"
          dataIndex="is_active"
          render={(v) => <Tag color={v ? "green" : "red"}>{v ? "Activa" : "Inactiva"}</Tag>}
        />
        <Table.Column
          title="Acciones"
          render={(_, record: any) => (
            <EditButton hideText size="small" recordItemId={record.id} />
          )}
        />
      </Table>
    </div>
  );
};
