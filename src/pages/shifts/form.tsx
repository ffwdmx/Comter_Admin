import { useState, useEffect } from "react";
import {
  Form, Input, InputNumber, Select, Switch, Button,
  Card, Row, Col, Typography, Divider, Space, message,
} from "antd";
import { SaveOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "../../providers/dataProvider";

const { Title, Text } = Typography;

interface Plant { id: number; name: string }

const ThresholdField = ({
  name, label, help,
}: { name: string; label: string; help: string }) => (
  <Form.Item
    name={name}
    label={label}
    extra={<Text type="secondary" style={{ fontSize: 11 }}>{help}</Text>}
    rules={[{ required: true, message: "Requerido" }]}
  >
    <InputNumber min={1} max={480} addonAfter="min" style={{ width: "100%" }} />
  </Form.Item>
);

const ShiftTypeForm = ({ isEdit }: { isEdit: boolean }) => {
  const navigate = useNavigate();
  const { id }   = useParams<{ id: string }>();
  const [form]   = Form.useForm();
  const [plants, setPlants]   = useState<Plant[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar plantas y, si es edición, datos del turno
  useEffect(() => {
    axiosInstance.get("/plants").then(({ data }) => {
      setPlants(Array.isArray(data) ? data : data.items ?? []);
    });

    if (isEdit && id) {
      axiosInstance.get("/shifts/admin/shift-types").then(({ data }) => {
        const shift = data.find((s: any) => s.id === Number(id));
        if (shift) {
          form.setFieldsValue({
            ...shift,
            // Time viene como "HH:MM:SS" desde la API — quedarnos con HH:MM
            start_time: shift.start_time?.slice(0, 5),
            end_time:   shift.end_time?.slice(0, 5),
          });
        }
      });
    }
  }, [isEdit, id, form]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      if (isEdit && id) {
        await axiosInstance.patch(`/shifts/admin/shift-types/${id}`, values);
        message.success("Turno actualizado correctamente");
      } else {
        await axiosInstance.post("/shifts/admin/shift-types", values);
        message.success("Turno creado correctamente");
      }
      navigate("/shifts");
    } catch (err: any) {
      message.error(
        err?.response?.data?.detail ?? "Error al guardar el turno"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => navigate("/shifts")}
          />
          <Title level={4} style={{ margin: 0 }}>
            {isEdit ? "Editar Tipo de Turno" : "Nuevo Tipo de Turno"}
          </Title>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          is_overnight: false,
          is_active: true,
          late_tolerance_minutes: 15,
          early_exit_timeout_minutes: 15,
          overtime_timeout_minutes: 15,
          notify_before_end_minutes: 15,
          notify_after_end_minutes: 30,
        }}
      >
        {/* ── Datos generales ── */}
        <Divider orientation="left">Datos generales</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="plant_id"
              label="Planta"
              rules={[{ required: true, message: "Selecciona una planta" }]}
            >
              <Select
                placeholder="Seleccionar planta"
                options={plants.map((p) => ({ label: p.name, value: p.id }))}
                disabled={isEdit}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="name"
              label="Nombre del turno"
              rules={[{ required: true, message: "Requerido" }]}
            >
              <Input placeholder="Ej: T1 Matutino" />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Horario ── */}
        <Divider orientation="left">Horario</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="start_time"
              label="Hora de inicio"
              rules={[
                { required: true, message: "Requerido" },
                { pattern: /^\d{2}:\d{2}$/, message: "Formato HH:MM" },
              ]}
              extra={<Text type="secondary" style={{ fontSize: 11 }}>Formato 24h — Ej: 08:00</Text>}
            >
              <Input placeholder="08:00" maxLength={5} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="end_time"
              label="Hora de fin"
              rules={[
                { required: true, message: "Requerido" },
                { pattern: /^\d{2}:\d{2}$/, message: "Formato HH:MM" },
              ]}
              extra={<Text type="secondary" style={{ fontSize: 11 }}>Formato 24h — Ej: 16:00</Text>}
            >
              <Input placeholder="16:00" maxLength={5} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="duration_hours"
              label="Duración (horas)"
              rules={[{ required: true, message: "Requerido" }]}
            >
              <InputNumber min={0.5} max={24} step={0.5} addonAfter="h" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="is_overnight"
              label="Turno nocturno (cruza medianoche)"
              valuePropName="checked"
            >
              <Switch checkedChildren="Sí" unCheckedChildren="No" />
            </Form.Item>
          </Col>
          {isEdit && (
            <Col span={8}>
              <Form.Item name="is_active" label="Activo" valuePropName="checked">
                <Switch checkedChildren="Activo" unCheckedChildren="Inactivo" />
              </Form.Item>
            </Col>
          )}
        </Row>

        {/* ── Tolerancias ── */}
        <Divider orientation="left">Tolerancias de entrada / salida</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <ThresholdField
              name="late_tolerance_minutes"
              label="Tolerancia de llegada tardía"
              help="Ventana desde el inicio del turno para registrar entrada"
            />
          </Col>
          <Col span={8}>
            <ThresholdField
              name="early_exit_timeout_minutes"
              label="Tiempo para aprobar salida anticipada"
              help="Minutos que tiene el supervisor para responder antes de escalar"
            />
          </Col>
          <Col span={8}>
            <ThresholdField
              name="overtime_timeout_minutes"
              label="Tiempo para aprobar tiempo extra"
              help="Minutos que tiene el supervisor para responder la solicitud de overtime"
            />
          </Col>
        </Row>

        {/* ── Notificaciones ── */}
        <Divider orientation="left">Notificaciones automáticas</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <ThresholdField
              name="notify_before_end_minutes"
              label="Aviso antes del fin del turno"
              help="Minutos antes del fin para avisar al empleado que registre salida"
            />
          </Col>
          <Col span={8}>
            <ThresholdField
              name="notify_after_end_minutes"
              label="Alerta por turno sin cerrar"
              help="Minutos después del fin para alertar si el turno sigue abierto"
            />
          </Col>
        </Row>

        <Form.Item style={{ marginTop: 24 }}>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<SaveOutlined />}
            >
              {isEdit ? "Guardar cambios" : "Crear turno"}
            </Button>
            <Button onClick={() => navigate("/shifts")}>Cancelar</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export const ShiftTypeCreate = () => <ShiftTypeForm isEdit={false} />;
export const ShiftTypeEdit   = () => <ShiftTypeForm isEdit={true} />;
