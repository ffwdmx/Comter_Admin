import { Create, Edit, useForm, useSelect } from "@refinedev/antd";
import {
  Form, Input, Select, Table, Tag, Button, Space,
  DatePicker, Typography, Divider, message, Modal, Row, Col,
} from "antd";
import {
  HistoryOutlined, SwapOutlined, EnvironmentOutlined,
  CheckCircleFilled, MinusCircleOutlined,
} from "@ant-design/icons";
import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { axiosInstance } from "../../providers/dataProvider";

const { Text } = Typography;

// ── Sección de asignación de turno ────────────────────────────────────────

interface ShiftType { id: number; name: string; start_time: string; end_time: string }
interface Assignment {
  id: number; shift_type_id: number; effective_date: string;
  is_active: boolean; shift_type?: ShiftType;
}

const ShiftAssignmentSection = ({ employeeId }: { employeeId: number }) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [shiftTypes, setShiftTypes]   = useState<ShiftType[]>([]);
  const [loading, setLoading]         = useState(false);
  const [modalOpen, setModalOpen]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [assignRes, typesRes] = await Promise.all([
        axiosInstance.get(`/shifts/admin/assignments/${employeeId}`),
        axiosInstance.get("/shifts/admin/shift-types"),
      ]);
      setAssignments(assignRes.data);
      setShiftTypes(typesRes.data.filter((s: any) => s.is_active));
    } catch {
      message.error("Error al cargar asignaciones de turno");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [employeeId]);

  const active = assignments.find((a) => a.is_active);

  const onSave = async (values: any) => {
    setSaving(true);
    try {
      await axiosInstance.post("/shifts/admin/assignments", {
        employee_id:    employeeId,
        shift_type_id:  values.shift_type_id,
        effective_date: values.effective_date.format("YYYY-MM-DD"),
      });
      message.success("Turno asignado correctamente");
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.detail ?? "Error al asignar turno");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Divider orientation="left">
        <Space>
          <HistoryOutlined />
          Asignación de Turno
        </Space>
      </Divider>

      <Space direction="vertical" style={{ width: "100%", marginBottom: 12 }}>
        <Space style={{ justifyContent: "space-between", width: "100%" }}>
          <Text type="secondary">
            Turno actual:{" "}
            <Text strong>
              {active?.shift_type?.name ?? "Sin asignar"}
            </Text>
            {active && (
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                (desde {active.effective_date})
              </Text>
            )}
          </Text>
          <Button
            size="small"
            icon={<SwapOutlined />}
            onClick={() => setModalOpen(true)}
          >
            Cambiar turno
          </Button>
        </Space>
      </Space>

      <Table
        dataSource={assignments}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 5 }}
        columns={[
          {
            title: "Turno",
            dataIndex: ["shift_type", "name"],
            render: (name: string) => name ?? "—",
          },
          {
            title: "Horario",
            render: (_: any, r: Assignment) =>
              r.shift_type
                ? `${r.shift_type.start_time?.slice(0, 5)} – ${r.shift_type.end_time?.slice(0, 5)}`
                : "—",
          },
          {
            title: "Vigente desde",
            dataIndex: "effective_date",
          },
          {
            title: "Estado",
            dataIndex: "is_active",
            render: (v: boolean) => (
              <Tag color={v ? "green" : "default"}>{v ? "Activo" : "Histórico"}</Tag>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        title="Cambiar asignación de turno"
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="Asignar"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item
            name="shift_type_id"
            label="Tipo de turno"
            rules={[{ required: true, message: "Selecciona un turno" }]}
          >
            <Select
              placeholder="Seleccionar turno"
              options={shiftTypes.map((s) => ({
                label: `${s.name} (${s.start_time?.slice(0, 5)} – ${s.end_time?.slice(0, 5)})`,
                value: s.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="effective_date"
            label="Fecha de vigencia"
            initialValue={dayjs()}
            rules={[{ required: true, message: "Requerida" }]}
          >
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ── Sección Domicilio (modal) ──────────────────────────────────────────────

interface AddressData {
  calle?: string; num_exterior?: string; num_interior?: string;
  colonia?: string; municipio?: string; estado?: string; codigo_postal?: string;
}

const AddressSection = ({
  employeeId,
  initialData,
  onChange,
}: {
  employeeId?: number;
  initialData: AddressData;
  onChange: (data: AddressData) => void;
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [addrForm]                = Form.useForm();

  const hasAddress = !!(
    initialData.calle || initialData.colonia || initialData.municipio
  );

  const onSave = async (values: AddressData) => {
    if (employeeId) {
      setSaving(true);
      try {
        await axiosInstance.patch(`/employees/${employeeId}`, values);
        message.success("Domicilio guardado correctamente");
        onChange(values);
        setModalOpen(false);
      } catch (err: any) {
        message.error(err?.response?.data?.detail ?? "Error al guardar domicilio");
      } finally {
        setSaving(false);
      }
    } else {
      onChange(values);
      setModalOpen(false);
    }
  };

  const openModal = () => {
    addrForm.setFieldsValue(initialData);
    setModalOpen(true);
  };

  return (
    <>
      <Divider orientation="left" style={{ marginTop: 24 }}>
        <Space>
          <EnvironmentOutlined />
          Domicilio
        </Space>
      </Divider>

      <Button icon={<EnvironmentOutlined />} onClick={openModal} style={{ marginBottom: 16 }}>
        Ver / Editar Domicilio{" "}
        {hasAddress
          ? <CheckCircleFilled style={{ color: "#52c41a", marginLeft: 6 }} />
          : <MinusCircleOutlined style={{ color: "#bbb", marginLeft: 6 }} />
        }
      </Button>

      <Modal
        open={modalOpen}
        title="Domicilio del Empleado"
        onCancel={() => setModalOpen(false)}
        onOk={() => addrForm.submit()}
        okText="Guardar Domicilio"
        confirmLoading={saving}
        width={560}
      >
        <Form form={addrForm} layout="vertical" onFinish={onSave} style={{ marginTop: 8 }}>
          <Form.Item label="Calle" name="calle">
            <Input placeholder="Ej: Av. Revolución" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Núm. Exterior" name="num_exterior">
                <Input placeholder="Ej: 123" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Núm. Interior" name="num_interior">
                <Input placeholder="Ej: A, 2B" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Colonia" name="colonia">
            <Input placeholder="Ej: Col. Centro" />
          </Form.Item>
          <Form.Item label="Municipio" name="municipio">
            <Input placeholder="Ej: Zapopan" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item label="Estado" name="estado">
                <Input placeholder="Ej: Jalisco" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="Código Postal" name="codigo_postal">
                <Input placeholder="Ej: 45010" maxLength={10} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

// ── Helpers de validación ──────────────────────────────────────────────────

const CURP_RE = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{2}[A-Z]{3}[0-9A-Z][0-9]$/;
const RFC_RE  = /^[A-Z]{4}[0-9]{6}[A-Z0-9]{3}$/;

const CharCounter = ({ value, max }: { value?: string; max: number }) => {
  const len = (value ?? "").length;
  return (
    <span style={{ fontSize: 11, color: len === max ? "#52c41a" : "#999" }}>
      {len}/{max} caracteres
    </span>
  );
};

// ── Opciones de rol ────────────────────────────────────────────────────────

const roleOptions = [
  { label: "Administrador", value: "admin" },
  { label: "Supervisor",    value: "supervisor" },
  { label: "Empleado",      value: "employee" },
];

// ── Campos del formulario principal ───────────────────────────────────────

const EmployeeFormFields = ({
  isEdit,
  employeeId,
}: {
  isEdit: boolean;
  employeeId?: number;
}) => {
  const { selectProps: plantSelectProps } = useSelect({
    resource:    "plants",
    optionLabel: "name",
    optionValue: "id",
  });

  const form = Form.useFormInstance();
  const curpValue = Form.useWatch("curp", form);
  const rfcValue  = Form.useWatch("rfc", form);

  const [addressData, setAddressData] = useState<AddressData>({});

  const onAddressChange = (data: AddressData) => {
    setAddressData(data);
    if (!isEdit) {
      form.setFieldsValue(data);
    }
  };

  return (
    <>
      {/* ── Datos básicos ──────────────────────────────────────────────── */}
      <Form.Item label="Nombre completo" name="name"
        rules={[{ required: true, message: "Requerido" }]}>
        <Input placeholder="Ej: Juan García López" />
      </Form.Item>

      <Form.Item label="Número de empleado" name="employee_no"
        rules={[{ required: true, message: "Requerido" }]}>
        <Input placeholder="Ej: EMP001" disabled={isEdit}
          style={{ textTransform: "uppercase" }} />
      </Form.Item>

      <Form.Item label="Email" name="email"
        rules={[{ required: true, type: "email", message: "Email inválido" }]}>
        <Input placeholder="empleado@comter.mx" />
      </Form.Item>

      {/* ── Contacto ───────────────────────────────────────────────────── */}
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label="Teléfono del empleado" name="phone">
            <Input placeholder="Ej: 3312345678" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Tel. de emergencias"
            name="emergency_phone"
            rules={[{
              pattern: /^[\d\s\-\+]{10,20}$/,
              message: "Mínimo 10 dígitos (números, +, guión)",
            }]}
          >
            <Input placeholder="Ej: 3398765432" />
          </Form.Item>
        </Col>
      </Row>

      {/* ── Rol y planta ───────────────────────────────────────────────── */}
      <Form.Item label="Rol" name="role"
        rules={[{ required: true, message: "Requerido" }]}>
        <Select options={roleOptions} />
      </Form.Item>

      <Form.Item label="Planta asignada" name="plant_id">
        <Select {...plantSelectProps} placeholder="Sin asignar" allowClear />
      </Form.Item>

      {!isEdit && (
        <Form.Item label="Contraseña" name="password"
          rules={[
            { required: true, message: "Requerido" },
            { min: 6, message: "Mínimo 6 caracteres" },
          ]}>
          <Input.Password placeholder="Mínimo 6 caracteres" />
        </Form.Item>
      )}

      {/* ── Datos Fiscales y Laborales ─────────────────────────────────── */}
      <Divider orientation="left" style={{ marginTop: 24 }}>
        Datos Fiscales y Laborales
      </Divider>

      {/* CURP y RFC */}
      <Row gutter={16}>
        <Col span={14}>
          <Form.Item
            label="CURP"
            name="curp"
            extra={<CharCounter value={curpValue} max={18} />}
            rules={[{
              validator: (_, v) => {
                if (!v) return Promise.resolve();
                const upper = v.toUpperCase();
                if (upper.length !== 18 || !CURP_RE.test(upper)) {
                  return Promise.reject(
                    "El CURP debe tener 18 caracteres con el formato correcto (ej. AAAA000000HAABBB01)"
                  );
                }
                return Promise.resolve();
              },
            }]}
          >
            <Input
              placeholder="AAAA000000HAABBB01"
              maxLength={18}
              onChange={(e) => form.setFieldValue("curp", e.target.value.toUpperCase())}
            />
          </Form.Item>
        </Col>
        <Col span={10}>
          <Form.Item
            label="RFC"
            name="rfc"
            extra={<CharCounter value={rfcValue} max={13} />}
            rules={[{
              validator: (_, v) => {
                if (!v) return Promise.resolve();
                const upper = v.toUpperCase();
                if (upper.length !== 13 || !RFC_RE.test(upper)) {
                  return Promise.reject(
                    "El RFC de persona física debe tener 13 caracteres (ej. AAAA000000AA1)"
                  );
                }
                return Promise.resolve();
              },
            }]}
          >
            <Input
              placeholder="AAAA000000AA1"
              maxLength={13}
              onChange={(e) => form.setFieldValue("rfc", e.target.value.toUpperCase())}
            />
          </Form.Item>
        </Col>
      </Row>

      {/* NSS, Cuenta bancaria, Clínica IMSS */}
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item
            label="NSS"
            name="nss"
            rules={[{
              pattern: /^[0-9]{11}$/,
              message: "El NSS debe tener exactamente 11 dígitos",
            }]}
          >
            <Input
              placeholder="00000000000"
              maxLength={11}
              inputMode="numeric"
              onBeforeInput={(e) => {
                const data = (e.nativeEvent as InputEvent).data;
                if (data && !/^[0-9]+$/.test(data)) e.preventDefault();
              }}
            />
          </Form.Item>
        </Col>
        <Col span={10}>
          <Form.Item
            label="Núm. Cuenta Bancaria"
            name="bank_account"
            rules={[{
              pattern: /^[0-9]{10,20}$/,
              message: "El número de cuenta debe tener entre 10 y 20 dígitos",
            }]}
          >
            <Input
              placeholder="Cuenta bancaria"
              maxLength={20}
              inputMode="numeric"
              onBeforeInput={(e) => {
                const data = (e.nativeEvent as InputEvent).data;
                if (data && !/^[0-9]+$/.test(data)) e.preventDefault();
              }}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item
            label="Clínica IMSS"
            name="imss_clinic"
            rules={[{
              pattern: /^[0-9]{1,4}$/,
              message: "Ingresa entre 1 y 4 dígitos",
            }]}
          >
            <Input
              placeholder="00"
              maxLength={4}
              inputMode="numeric"
              onBeforeInput={(e) => {
                const data = (e.nativeEvent as InputEvent).data;
                if (data && !/^[0-9]+$/.test(data)) e.preventDefault();
              }}
            />
          </Form.Item>
        </Col>
      </Row>

      {/* Campos domicilio ocultos para creación (se llenan desde el modal) */}
      {!isEdit && (
        <>
          <Form.Item name="calle"         hidden><Input /></Form.Item>
          <Form.Item name="num_exterior"  hidden><Input /></Form.Item>
          <Form.Item name="num_interior"  hidden><Input /></Form.Item>
          <Form.Item name="colonia"       hidden><Input /></Form.Item>
          <Form.Item name="municipio"     hidden><Input /></Form.Item>
          <Form.Item name="estado"        hidden><Input /></Form.Item>
          <Form.Item name="codigo_postal" hidden><Input /></Form.Item>
        </>
      )}

      {/* ── Domicilio ──────────────────────────────────────────────────── */}
      <AddressSection
        employeeId={isEdit ? employeeId : undefined}
        initialData={addressData}
        onChange={onAddressChange}
      />
    </>
  );
};

// ── Exports ────────────────────────────────────────────────────────────────

export const EmployeeCreate = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Create
      saveButtonProps={{ ...saveButtonProps, children: "Guardar" }}
      title="Nuevo Empleado"
    >
      <Form
        {...formProps}
        layout="vertical"
        initialValues={{ role: "employee", ...formProps.initialValues }}
      >
        <EmployeeFormFields isEdit={false} />
      </Form>
    </Create>
  );
};

export const EmployeeEdit = () => {
  const { formProps, saveButtonProps, id } = useForm();
  return (
    <Edit
      saveButtonProps={{ ...saveButtonProps, children: "Guardar" }}
      title="Editar Empleado"
    >
      <Form {...formProps} layout="vertical">
        <EmployeeFormFields isEdit={true} employeeId={id ? Number(id) : undefined} />
        {id && <ShiftAssignmentSection employeeId={Number(id)} />}
      </Form>
    </Edit>
  );
};
