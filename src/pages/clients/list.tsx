import { useTable, EditButton, CreateButton, DeleteButton } from "@refinedev/antd";
import { Table, Space, Tag } from "antd";
import { ShopOutlined } from "@ant-design/icons";

export const ClientList = () => {
  const { tableProps } = useTable({ syncWithLocation: true });

  return (
    <div>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "flex-end" }}>
        <CreateButton />
      </Space>

      <Table {...tableProps} rowKey="id" pagination={{ pageSize: 15 }}>
        <Table.Column
          title="Cliente"
          dataIndex="name"
          render={(name) => (
            <Space>
              <ShopOutlined style={{ color: "#1B3A6B" }} />
              <strong>{name}</strong>
            </Space>
          )}
        />
        <Table.Column title="Industria" dataIndex="industry" render={(v) => v ?? "—"} />
        <Table.Column
          title="Estado"
          dataIndex="is_active"
          render={(v) => <Tag color={v ? "green" : "red"}>{v ? "Activo" : "Inactivo"}</Tag>}
        />
        <Table.Column
          title="Acciones"
          render={(_, record: any) => (
            <Space>
              <EditButton   hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id}
                confirmTitle="¿Desactivar este cliente?"
                confirmOkText="Desactivar" confirmCancelText="Cancelar"
              />
            </Space>
          )}
        />
      </Table>
    </div>
  );
};
