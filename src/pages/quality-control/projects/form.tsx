// src/pages/quality-control/projects/form.tsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Form, Input, Select, InputNumber, Button, Card, Row, Col,
  Typography, Divider, message, Spin,
} from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../../providers/dataProvider";

interface Client { id: number; name: string; }

export const QCProjectCreate = () => <QCProjectForm mode="create" />;
export const QCProjectEdit   = () => <QCProjectForm mode="edit"   />;

const QCProjectForm = ({ mode }: { mode: "create" | "edit" }) => {
  const [form]    = Form.useForm();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const navigate  = useNavigate();
  const { id }    = useParams<{ id: string }>();
  const isEdit    = mode === "edit";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: clientsData } = await axiosInstance.get("/clients");
        setClients(Array.isArray(clientsData) ? clientsData : clientsData?.items ?? []);

        if (isEdit && id) {
          const { data } = await axiosInstance.get(`/qc/projects/${id}`);
          form.setFieldsValue({
            ...data,
            target_yield:         parseFloat(data.target_yield),
            min_acceptable_yield: parseFloat(data.min_acceptable_yield),
          });
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit, form]);

  const onFinish = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (isEdit) {
        await axiosInstance.patch(`/qc/projects/${id}`, values);
        message.success("Proyecto actualizado correctamente");
      } else {
        await axiosInstance.post("/qc/projects/", values);
        message.success("Proyecto creado correctamente");
      }
      navigate("/quality-control/projects");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      message.error(detail ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin style={{ display: "block", margin: "80px auto" }} />;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/quality-control/projects")} />
        <Typography.Title level={4} style={{ margin: 0 }}>
          {isEdit ? "Editar Proyecto QC" : "Nuevo Proyecto QC"}
        </Typography.Title>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            status:                 "active",
            component_type:         "electronic",
            inspection_type:        "sampling",
            opportunities_per_unit: 1,
            target_yield:           98,
            min_acceptable_yield:   95,
          }}
        >
          <Divider orientation="left">Información General</Divider>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item label="Nombre del proyecto" name="name" rules={[{ required: true, message: "Campo requerido" }]}>
                <Input placeholder="Ej: Ensamble PCB Modelo X" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Número de parte" name="part_number" rules={[{ required: true, message: "Campo requerido" }]}>
                <Input placeholder="Ej: PCB-001-A" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Cliente" name="client_id" rules={[{ required: true, message: "Selecciona un cliente" }]}>
                <Select
                  placeholder="Seleccionar cliente"
                  showSearch
                  filterOption={(input, option) =>
                    (String(option?.label ?? "")).toLowerCase().includes(input.toLowerCase())
                  }
                  options={clients.map((c) => ({ label: c.name, value: c.id }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Estado" name="status" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: "Activo",    value: "active"    },
                    { label: "En pausa",  value: "paused"    },
                    { label: "Terminado", value: "completed" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Tipo de componente" name="component_type" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: "Electrónico", value: "electronic"  },
                    { label: "Mecánico",    value: "mechanical"  },
                    { label: "Ensamble",    value: "assembly"    },
                    { label: "Plástico",    value: "plastic"     },
                    { label: "Otro",        value: "other"       },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Tipo de inspección" name="inspection_type" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: "Muestreo",  value: "sampling" },
                    { label: "100%",      value: "full"     },
                    { label: "Por lote",  value: "batch"    },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Parámetros de Calidad</Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Objetivo FPY (%)"
                name="target_yield"
                rules={[{ required: true, message: "Campo requerido" }]}
                extra="First Pass Yield objetivo"
              >
                <InputNumber
                  min={0} max={100} precision={2} step={0.5}
                  style={{ width: "100%" }}
                  addonAfter="%"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Mínimo aceptable (%)"
                name="min_acceptable_yield"
                rules={[{ required: true, message: "Campo requerido" }]}
                extra="Umbral para alerta roja"
              >
                <InputNumber
                  min={0} max={100} precision={2} step={0.5}
                  style={{ width: "100%" }}
                  addonAfter="%"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Oportunidades / unidad"
                name="opportunities_per_unit"
                extra="Para cálculo de DPMO"
              >
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Descripción / notas" name="description">
            <Input.TextArea rows={3} placeholder="Descripción del proyecto, instrucciones especiales..." />
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
            <Button onClick={() => navigate("/quality-control/projects")}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
              {isEdit ? "Guardar cambios" : "Crear proyecto"}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};
