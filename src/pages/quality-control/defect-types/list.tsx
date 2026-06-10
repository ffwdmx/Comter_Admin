// src/pages/quality-control/defect-types/list.tsx
import { useState, useEffect } from "react";
import {
  Table, Tag, Typography, Button, Space, Input, Select, Modal,
  Form, App, Tooltip, Switch, Divider,
} from "antd";
import {
  PlusOutlined, EditOutlined, SearchOutlined, ReloadOutlined,
} from "@ant-design/icons";
import { axiosInstance } from "../../../providers/dataProvider";

interface QCDefectType {
  id: number;
  code: string;
  name: string;
  description?: string;
  category: string;
  severity_default: string;
  project_id?: number;
  project_name?: string;
  is_global: boolean;
  is_active: boolean;
}

interface QCProject { id: number; name: string; }

const CATEGORY_LABELS: Record<string, string> = {
  visual:      "Visual",
  dimensional: "Dimensional",
  electrical:  "Eléctrico",
  functional:  "Funcional",
  packaging:   "Empaque",
  other:       "Otro",
};
const SEV_COLOR: Record<string, string> = {
  critical: "red", major: "orange", minor: "gold",
};
const SEV_LABEL: Record<string, string> = {
  critical: "Crítico", major: "Mayor", minor: "Menor",
};

export const DefectTypeList = () => {
  const { message } = App.useApp();
  const [defectTypes, setDefectTypes] = useState<QCDefectType[]>([]);
  const [projects,    setProjects]    = useState<QCProject[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [search,      setSearch]      = useState("");
  const [catFilter,   setCatFilter]   = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<QCDefectType | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [form]      = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data: dts } = await axiosInstance.get("/qc/defect-types/?all=true");
      setDefectTypes(Array.isArray(dts) ? dts : []);
    } catch {
      message.error("Error cargando tipos de defecto");
    } finally {
      setLoading(false);
    }
    try {
      const { data: projs } = await axiosInstance.get("/qc/projects/?all=true&limit=200");
      setProjects(Array.isArray(projs) ? projs : []);
    } catch {
      message.error("Error cargando lista de proyectos");
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ severity_default: "major", category: "visual", is_active: true });
    setModalOpen(true);
  };

  const openEdit = (dt: QCDefectType) => {
    setEditing(dt);
    form.setFieldsValue({
      code:             dt.code,
      name:             dt.name,
      description:      dt.description,
      category:         dt.category,
      severity_default: dt.severity_default,
      project_id:       dt.project_id,
      is_active:        dt.is_active,
    });
    setModalOpen(true);
  };

  const onSave = async (values: Record<string, unknown>) => {
    setSaving(true);
    // allowClear deja project_id como undefined; lo normalizamos a null para que el backend lo reciba y limpie la asignación
    const payload = { ...values, project_id: values.project_id ?? null };
    try {
      if (editing) {
        await axiosInstance.patch(`/qc/defect-types/${editing.id}`, payload);
        message.success("Tipo de defecto actualizado");
      } else {
        await axiosInstance.post("/qc/defect-types/", payload);
        message.success("Tipo de defecto creado");
      }
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      message.error(detail ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const filtered = defectTypes.filter((dt) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      dt.code.toLowerCase().includes(q) ||
      dt.name.toLowerCase().includes(q);
    const matchCat = !catFilter || dt.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          Catálogo de Tipos de Defecto
        </Typography.Title>
        <Space>
          <Tooltip title="Recargar">
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Nuevo Tipo
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Buscar código o nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280 }}
          allowClear
        />
        <Select
          placeholder="Categoría"
          allowClear
          style={{ width: 180 }}
          value={catFilter}
          onChange={setCatFilter}
          options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ label: v, value: k }))}
        />
      </Space>

      <Table
        dataSource={filtered}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        bordered
      >
        <Table.Column
          title="Código"
          dataIndex="code"
          render={(v) => (
            <Typography.Text code style={{ fontWeight: 700 }}>{v}</Typography.Text>
          )}
        />
        <Table.Column title="Nombre" dataIndex="name" />
        <Table.Column
          title="Categoría"
          dataIndex="category"
          render={(v) => <Tag>{CATEGORY_LABELS[v] ?? v}</Tag>}
        />
        <Table.Column
          title="Severidad default"
          dataIndex="severity_default"
          render={(v) => <Tag color={SEV_COLOR[v]}>{SEV_LABEL[v] ?? v}</Tag>}
        />
        <Table.Column
          title="Alcance"
          render={(_: unknown, record: QCDefectType) => {
            const proj = projects.find((p) => p.id === record.project_id);
            return record.project_id == null
              ? <Tag color="blue">Global</Tag>
              : <Tag>{proj?.name ?? `Proyecto ${record.project_id}`}</Tag>;
          }}
        />
        <Table.Column
          title="Activo"
          dataIndex="is_active"
          align="center"
          render={(v) => (
            <Tag color={v ? "green" : "default"}>{v ? "Sí" : "No"}</Tag>
          )}
        />
        <Table.Column
          title="Acciones"
          align="center"
          render={(_: unknown, record: QCDefectType) => (
            <Tooltip title="Editar">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            </Tooltip>
          )}
        />
      </Table>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? "Editar tipo de defecto" : "Nuevo tipo de defecto"}
        onOk={() => form.submit()}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        confirmLoading={saving}
        okText="Guardar"
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={onSave} style={{ marginTop: 16 }}>
          <Space.Compact style={{ width: "100%", marginBottom: 16 }}>
            <Form.Item
              label="Código"
              name="code"
              style={{ width: "30%", marginBottom: 0 }}
              rules={[{ required: true, message: "Requerido" }]}
            >
              <Input placeholder="Ej: DEF-001" style={{ textTransform: "uppercase" }} />
            </Form.Item>
            <Form.Item
              label="Nombre"
              name="name"
              style={{ width: "70%", marginBottom: 0 }}
              rules={[{ required: true, message: "Requerido" }]}
            >
              <Input placeholder="Ej: Soldadura fría" />
            </Form.Item>
          </Space.Compact>

          <Form.Item label="Descripción" name="description">
            <Input.TextArea rows={2} placeholder="Descripción del defecto..." />
          </Form.Item>

          <Space style={{ width: "100%" }} size={16}>
            <Form.Item label="Categoría" name="category" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
              <Select
                style={{ width: 200 }}
                options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ label: v, value: k }))}
              />
            </Form.Item>
            <Form.Item label="Severidad default" name="severity_default" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
              <Select
                style={{ width: 160 }}
                options={[
                  { label: "Crítico", value: "critical" },
                  { label: "Mayor",   value: "major"    },
                  { label: "Menor",   value: "minor"    },
                ]}
              />
            </Form.Item>
          </Space>

          <Divider style={{ margin: "16px 0" }} />

          <Form.Item label="Proyecto (dejar vacío para catálogo global)" name="project_id">
            <Select
              allowClear
              placeholder="Catálogo global"
              showSearch
              filterOption={(input, option) =>
                (String(option?.label ?? "")).toLowerCase().includes(input.toLowerCase())
              }
              options={projects.map((p) => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>

          {editing && (
            <Form.Item label="Activo" name="is_active" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};
