// src/pages/quality-control/component-types/index.tsx
import { useState, useEffect } from "react";
import {
  Table, Button, Tag, Typography, Space, Modal, Form,
  Input, App, Tooltip, Switch, Badge,
} from "antd";
import {
  PlusOutlined, EditOutlined, LockOutlined,
} from "@ant-design/icons";
import { axiosInstance } from "../../../providers/dataProvider";

interface ComponentType {
  id:         number;
  code:       string;
  label:      string;
  is_active:  boolean;
  is_builtin: boolean;
}

export const ComponentTypeList = () => {
  const { message } = App.useApp();
  const [types, setTypes]           = useState<ComponentType[]>([]);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen]     = useState(false);
  const [selected, setSelected]     = useState<ComponentType | null>(null);
  const [createForm] = Form.useForm();
  const [editForm]   = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get("/qc/component-types?include_inactive=true");
      setTypes(Array.isArray(data) ? data : []);
    } catch {
      message.error("Error al cargar tipos de componente");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (values: { code: string; label: string }) => {
    setSaving(true);
    try {
      await axiosInstance.post("/qc/component-types/", values);
      message.success("Tipo creado correctamente");
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      message.error(detail ?? "Error al crear tipo");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (values: { label: string }) => {
    if (!selected) return;
    setSaving(true);
    try {
      await axiosInstance.patch(`/qc/component-types/${selected.id}`, values);
      message.success("Nombre actualizado");
      setEditOpen(false);
      load();
    } catch {
      message.error("Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (ct: ComponentType) => {
    try {
      await axiosInstance.patch(`/qc/component-types/${ct.id}`, { is_active: !ct.is_active });
      message.success(ct.is_active ? "Tipo desactivado" : "Tipo activado");
      load();
    } catch {
      message.error("Error al cambiar estado");
    }
  };

  const openEdit = (ct: ComponentType) => {
    setSelected(ct);
    editForm.setFieldsValue({ label: ct.label });
    setEditOpen(true);
  };

  const columns = [
    {
      title: "Nombre (español)",
      dataIndex: "label",
      key: "label",
      render: (v: string, row: ComponentType) => (
        <Space>
          <Typography.Text strong>{v}</Typography.Text>
          {row.is_builtin && (
            <Tag color="default" style={{ fontSize: 11 }}>
              <LockOutlined style={{ marginRight: 3 }} />Predefinido
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Código interno",
      dataIndex: "code",
      key: "code",
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    {
      title: "Estado",
      dataIndex: "is_active",
      key: "is_active",
      align: "center" as const,
      render: (v: boolean) =>
        v
          ? <Badge status="success" text="Activo" />
          : <Badge status="default" text="Inactivo" />,
    },
    {
      title: "Acciones",
      key: "actions",
      align: "center" as const,
      render: (_: unknown, row: ComponentType) => (
        <Space>
          <Tooltip title="Editar nombre">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(row)}
            />
          </Tooltip>
          <Tooltip title={row.is_active ? "Desactivar" : "Activar"}>
            <Switch
              size="small"
              checked={row.is_active}
              onChange={() => handleToggle(row)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Tipos de Componente
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Define los tipos disponibles al crear un proyecto QC
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { createForm.resetFields(); setCreateOpen(true); }}
        >
          Nuevo tipo
        </Button>
      </div>

      <Table
        dataSource={types}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="middle"
        rowClassName={(row) => (!row.is_active ? "ant-table-row-disabled" : "")}
      />

      {/* Modal crear */}
      <Modal
        title="Nuevo tipo de componente"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="Crear"
        cancelText="Cancelar"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} style={{ marginTop: 8 }}>
          <Form.Item
            label="Nombre en español"
            name="label"
            rules={[{ required: true, message: "Campo requerido" }]}
          >
            <Input placeholder="Ej: Módulo de control" />
          </Form.Item>
          <Form.Item
            label="Código interno"
            name="code"
            rules={[
              { required: true, message: "Campo requerido" },
              { pattern: /^[a-z0-9_]{1,60}$/, message: "Solo minúsculas, números y guiones bajos" },
            ]}
            extra="Identificador único. Solo letras minúsculas, números y _ (sin espacios)"
          >
            <Input placeholder="Ej: control_module" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal editar label */}
      <Modal
        title="Editar nombre"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit} style={{ marginTop: 8 }}>
          <Form.Item
            label="Nombre en español"
            name="label"
            rules={[{ required: true, message: "Campo requerido" }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
