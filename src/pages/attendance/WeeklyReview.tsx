// src/pages/attendance/WeeklyReview.tsx
import { useEffect, useState, useCallback } from "react";
import {
  Table, Tag, Button, Modal, Form, TimePicker, Select,
  Space, Typography, Spin, Tooltip, DatePicker, message,
  Popconfirm,
} from "antd";
import {
  LeftOutlined, RightOutlined, PlusOutlined,
  EditOutlined, DeleteOutlined, SendOutlined, StopOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { axiosInstance } from "../../providers/dataProvider";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "America/Mexico_City";

const { Text, Title } = Typography;

// ── Tipos ──────────────────────────────────────────────────────────────────

interface AttendancePair {
  check_in_id:    number | null;
  check_out_id:   number | null;
  check_in_time:  string | null;
  check_out_time: string | null;
  hours_worked:   number | null;
  notes:          string | null;
}

interface DayCell {
  source: "attendance" | "absent" | "empty";
  pairs:  AttendancePair[];
}

interface ReviewRow {
  employee_id:  number;
  employee_no:  string;
  name:         string;
  plant_name:   string | null;
  shift_name:   string | null;
  shift_start:  string | null;  // "HH:MM" hora entrada del turno
  shift_end:    string | null;  // "HH:MM" hora salida del turno
  days: Record<string, DayCell>;
}

interface WeeklyReviewData {
  week_start: string;
  week_end:   string;
  rows: ReviewRow[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toMX(iso: string | null): string {
  if (!iso) return "—";
  return dayjs.utc(iso).tz(TZ).format("HH:mm");
}

/**
 * Devuelve el jueves de inicio del periodo vigente (Jue–Mié).
 * Si hoy es jueves, devuelve el jueves de la semana PASADA (periodo cerrado).
 * dayjs.day(): 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb
 */
function getDefaultWeekStart(): Dayjs {
  const today = dayjs();
  const THU   = 4;
  const dow   = today.day();
  if (dow === THU) {
    // Hoy es jueves → periodo cerrado empieza el jueves pasado
    return today.subtract(7, "day").startOf("day");
  }
  const daysSinceThu = (dow - THU + 7) % 7;
  return today.subtract(daysSinceThu, "day").startOf("day");
}

// Nombres de día en español por índice dayjs (0=Dom…6=Sáb)
const DAY_NAMES_ES: Record<number, string> = {
  0: "Dom", 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb",
};

// ── Componente principal ────────────────────────────────────────────────────

export function WeeklyReview() {
  const [weekStart, setWeekStart] = useState<Dayjs>(getDefaultWeekStart);
  const [data, setData]           = useState<WeeklyReviewData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [sending, setSending]     = useState(false);

  // Modal: agregar registro
  const [addModal, setAddModal] = useState<{
    open: boolean;
    employeeId:   number;
    employeeName: string;
    date:         string;
    shiftStart:   string | null;
    shiftEnd:     string | null;
    shiftName:    string | null;
  } | null>(null);
  const [addForm] = Form.useForm();

  // Modal: editar registro
  const [editModal, setEditModal] = useState<{
    open: boolean;
    attendanceId: number;
    employeeName: string;
    currentTime: string;
    label: string;
  } | null>(null);
  const [editForm] = Form.useForm();

  // Modal: dar de baja
  const [bajaModal, setBajaModal] = useState<{
    open: boolean;
    employeeId: number;
    employeeName: string;
  } | null>(null);
  const [bajaForm] = Form.useForm();

  // ── Carga de datos ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/attendance/weekly-review", {
        params: { week_start: weekStart.format("YYYY-MM-DD") },
      });
      setData(res.data);
    } catch {
      message.error("Error al cargar la asistencia semanal.");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Días de la semana ───────────────────────────────────────────────────

  const days: string[] = data
    ? Array.from({ length: 7 }, (_, i) =>
        dayjs(data.week_start).add(i, "day").format("YYYY-MM-DD")
      )
    : [];

  // ── Enviar reporte ──────────────────────────────────────────────────────

  const handleSendReport = async () => {
    setSending(true);
    try {
      const res = await axiosInstance.post("/attendance/send-report", {
        week_start: weekStart.format("YYYY-MM-DD"),
      });
      message.success(res.data.message ?? "Reporte enviado correctamente.");
    } catch (err: any) {
      message.error(
        err?.response?.data?.detail ?? "Error al enviar el reporte."
      );
    } finally {
      setSending(false);
    }
  };

  // Pre-llenar hora al seleccionar tipo (entrada→turno inicio, salida→turno fin)
  const handleAddTypeChange = (type: string) => {
    if (!addModal) return;
    const timeStr = type === "check_in" ? addModal.shiftStart : addModal.shiftEnd;
    if (timeStr) {
      addForm.setFieldValue("hora", dayjs(timeStr, "HH:mm"));
    } else {
      addForm.setFieldValue("hora", null);
    }
  };

  // ── Agregar registro ────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!addModal) return;
    try {
      const values = await addForm.validateFields();
      const time: Dayjs = values.hora;
      const ts = dayjs.tz(
        `${addModal.date} ${time.format("HH:mm")}`,
        "YYYY-MM-DD HH:mm",
        TZ,
      ).utc().toISOString();

      await axiosInstance.post("/attendance/admin", {
        employee_id: addModal.employeeId,
        type:        values.type,
        timestamp:   ts,
        notes:       values.notes ?? null,
      });
      message.success("Registro agregado.");
      setAddModal(null);
      addForm.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return; // validación del form
      message.error(err?.response?.data?.detail ?? "Error al agregar registro.");
    }
  };

  // ── Editar registro ─────────────────────────────────────────────────────

  const handleEdit = async () => {
    if (!editModal) return;
    try {
      const values = await editForm.validateFields();
      const time: Dayjs = values.hora;
      // Mantenemos la fecha original del registro, solo cambiamos la hora
      const existingDate = dayjs.utc(editModal.currentTime).tz(TZ).format("YYYY-MM-DD");
      const ts = dayjs.tz(
        `${existingDate} ${time.format("HH:mm")}`,
        "YYYY-MM-DD HH:mm",
        TZ,
      ).utc().toISOString();

      await axiosInstance.patch(`/attendance/admin/${editModal.attendanceId}`, {
        timestamp: ts,
        notes:     values.notes ?? null,
      });
      message.success("Registro actualizado.");
      setEditModal(null);
      editForm.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail ?? "Error al actualizar registro.");
    }
  };

  // ── Eliminar registro ───────────────────────────────────────────────────

  const handleDelete = async (attendanceId: number) => {
    try {
      await axiosInstance.delete(`/attendance/admin/${attendanceId}`);
      message.success("Registro eliminado.");
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail ?? "Error al eliminar registro.");
    }
  };

  // ── Dar de baja ─────────────────────────────────────────────────────────

  const handleBaja = async () => {
    if (!bajaModal) return;
    try {
      const values = await bajaForm.validateFields();
      await axiosInstance.patch(`/employees/${bajaModal.employeeId}/terminate`, {
        reason: values.reason,
        date:   values.date.format("YYYY-MM-DD"),
      });
      message.success(`${bajaModal.employeeName} dado de baja.`);
      setBajaModal(null);
      bajaForm.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail ?? "Error al dar de baja.");
    }
  };

  // ── Columnas de la tabla ────────────────────────────────────────────────

  const employeeCol = {
    title:     "Empleado",
    dataIndex: "name",
    key:       "name",
    fixed:     "left" as const,
    width:     200,
    render: (_: string, row: ReviewRow) => (
      <Space direction="vertical" size={0}>
        <Text strong style={{ fontSize: 13 }}>{row.name}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{row.employee_no}</Text>
        <Button
          type="link"
          size="small"
          danger
          icon={<StopOutlined />}
          style={{ padding: 0, fontSize: 11, height: "auto" }}
          onClick={() =>
            setBajaModal({ open: true, employeeId: row.employee_id, employeeName: row.name })
          }
        >
          Dar de baja
        </Button>
      </Space>
    ),
  };

  const plantCol = {
    title:     "Planta",
    dataIndex: "plant_name",
    key:       "plant_name",
    fixed:     "left" as const,
    width:     130,
    render:    (v: string | null) => <Text style={{ fontSize: 12 }}>{v ?? "—"}</Text>,
  };

  const dayCols = days.map((dateStr) => {
    const d     = dayjs(dateStr);
    const label = `${DAY_NAMES_ES[d.day()]}\n${d.format("DD/MM")}`;
    return {
      title: (
        <div style={{ textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.3 }}>
          {label}
        </div>
      ),
      key:   dateStr,
      width: 148,
      render: (_: unknown, row: ReviewRow) => {
        const cell = row.days[dateStr];
        if (!cell) return null;
        return (
          <CellRenderer
            cell={cell}
            employeeId={row.employee_id}
            employeeName={row.name}
            date={dateStr}
            onAdd={() =>
              setAddModal({
                open: true,
                employeeId:   row.employee_id,
                employeeName: row.name,
                date:         dateStr,
                shiftStart:   row.shift_start,
                shiftEnd:     row.shift_end,
                shiftName:    row.shift_name,
              })
            }
            onEdit={(id, time, lbl) => {
              setEditModal({ open: true, attendanceId: id, employeeName: row.name, currentTime: time, label: lbl });
              editForm.setFieldsValue({ hora: dayjs.utc(time).tz(TZ) });
            }}
            onDelete={handleDelete}
          />
        );
      },
    };
  });

  const columns = [employeeCol, plantCol, ...dayCols];

  // ── Render ──────────────────────────────────────────────────────────────

  const isAtLatestPeriod = !weekStart.isBefore(getDefaultWeekStart(), "day");

  return (
    <div style={{ padding: 24 }}>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Revisión de Asistencia Semanal</Title>
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={sending}
          onClick={() =>
            Modal.confirm({
              title:   "¿Enviar reporte al contador?",
              content: `Se enviará el reporte de la semana ${weekStart.format("DD/MM")} – ${weekStart.add(6, "day").format("DD/MM/YYYY")} por correo electrónico.`,
              okText:  "Enviar",
              cancelText: "Cancelar",
              onOk:    handleSendReport,
            })
          }
        >
          Enviar Reporte por Email
        </Button>
      </div>

      {/* Navegación de semana */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => setWeekStart(w => w.subtract(7, "day"))}
        />
        <Text strong style={{ fontSize: 14 }}>
          Semana del {weekStart.format("DD/MM/YYYY")} al {weekStart.add(6, "day").format("DD/MM/YYYY")}
        </Text>
        <Button
          icon={<RightOutlined />}
          disabled={isAtLatestPeriod}
          onClick={() => setWeekStart(w => w.add(7, "day"))}
        />
      </div>

      {/* Tabla */}
      <Spin spinning={loading}>
        <Table
          dataSource={data?.rows ?? []}
          columns={columns}
          rowKey="employee_id"
          scroll={{ x: 1380 }}
          pagination={false}
          size="small"
          bordered
        />
      </Spin>

      {/* Modal: Agregar registro */}
      <Modal
        title={`Agregar registro — ${addModal?.employeeName ?? ""} · ${addModal?.date ?? ""}`}
        open={addModal?.open ?? false}
        onOk={handleAdd}
        onCancel={() => { setAddModal(null); addForm.resetFields(); }}
        okText="Guardar"
        cancelText="Cancelar"
        destroyOnClose
      >
        {addModal?.shiftName && (
          <div style={{
            background: "#f0f5ff", border: "1px solid #adc6ff",
            borderRadius: 8, padding: "8px 14px", marginBottom: 16,
          }}>
            <Text style={{ fontSize: 12 }}>
              <strong>Turno asignado:</strong> {addModal.shiftName}
              {addModal.shiftStart && addModal.shiftEnd &&
                ` · ${addModal.shiftStart} – ${addModal.shiftEnd}`}
            </Text>
          </div>
        )}
        <Form form={addForm} layout="vertical">
          <Form.Item name="type" label="Tipo" rules={[{ required: true, message: "Selecciona el tipo" }]}>
            <Select placeholder="Selecciona" onChange={handleAddTypeChange}>
              <Select.Option value="check_in">Entrada</Select.Option>
              <Select.Option value="check_out">Salida</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="hora"
            label="Hora (hora México)"
            extra={addModal?.shiftStart ? "Se pre-llenó con el horario del turno — ajusta si es necesario." : undefined}
            rules={[{ required: true, message: "Ingresa la hora" }]}
          >
            <TimePicker format="HH:mm" style={{ width: "100%" }} minuteStep={1} />
          </Form.Item>
          <Form.Item name="notes" label="Notas (opcional)">
            <Select.Option value="">—</Select.Option>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Editar registro */}
      <Modal
        title={`Editar ${editModal?.label ?? ""} — ${editModal?.employeeName ?? ""}`}
        open={editModal?.open ?? false}
        onOk={handleEdit}
        onCancel={() => { setEditModal(null); editForm.resetFields(); }}
        okText="Guardar"
        cancelText="Cancelar"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="hora" label="Hora (hora México)" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: "100%" }} minuteStep={1} />
          </Form.Item>
          <Form.Item name="notes" label="Notas (opcional)">
            <Select.Option value="">—</Select.Option>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Dar de baja */}
      <Modal
        title={`Dar de baja — ${bajaModal?.employeeName ?? ""}`}
        open={bajaModal?.open ?? false}
        onOk={handleBaja}
        onCancel={() => { setBajaModal(null); bajaForm.resetFields(); }}
        okText="Confirmar baja"
        okButtonProps={{ danger: true }}
        cancelText="Cancelar"
        destroyOnClose
      >
        <Form form={bajaForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="reason" label="Motivo de baja" rules={[{ required: true, message: "Selecciona el motivo" }]}>
            <Select placeholder="Selecciona">
              <Select.Option value="resigned">Renuncia voluntaria</Select.Option>
              <Select.Option value="fired">Despido</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="date" label="Fecha de baja" rules={[{ required: true, message: "Selecciona la fecha" }]}>
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ── Celda de día ────────────────────────────────────────────────────────────

interface CellProps {
  cell:         DayCell;
  employeeId:   number;
  employeeName: string;
  date:         string;
  onAdd:        () => void;
  onEdit:       (id: number, time: string, label: string) => void;
  onDelete:     (id: number) => void;
}

function CellRenderer({ cell, date, onAdd, onEdit, onDelete }: CellProps) {
  const today  = dayjs().format("YYYY-MM-DD");
  const isPast = date < today;

  if (cell.source === "absent") {
    return (
      <Space direction="vertical" size={4} align="center" style={{ width: "100%" }}>
        <Tag color="error" style={{ margin: 0 }}>FALTA</Tag>
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={onAdd} style={{ fontSize: 10 }}>
          Corregir
        </Button>
      </Space>
    );
  }

  if (cell.source === "empty") {
    return (
      <Space direction="vertical" size={2} align="center" style={{ width: "100%" }}>
        {isPast && <Tag color="default" style={{ margin: 0, fontSize: 11 }}>Sin registro</Tag>}
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={onAdd} style={{ fontSize: 11 }}>
          Agregar
        </Button>
      </Space>
    );
  }

  // source === "attendance" — uno o varios pares (turno simple / doble turno)
  const totalHours = cell.pairs.reduce((acc, p) => acc + (p.hours_worked ?? 0), 0);

  return (
    <Space direction="vertical" size={4} style={{ width: "100%" }}>
      {cell.pairs.map((pair, idx) => (
        <PairRow
          key={`${pair.check_in_id}-${pair.check_out_id}-${idx}`}
          pair={pair}
          label={cell.pairs.length > 1 ? `T${idx + 1}` : undefined}
          onEdit={onEdit}
          onDelete={onDelete}
          onAdd={onAdd}
        />
      ))}

      {/* Total horas si hay más de un par */}
      {cell.pairs.length > 1 && totalHours > 0 && (
        <Text type="secondary" style={{ fontSize: 10 }}>
          Total: {totalHours.toFixed(1)}h
        </Text>
      )}

      {/* Botón para agregar un turno adicional */}
      <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={onAdd}
        style={{ fontSize: 10, width: "100%" }}>
        + Turno
      </Button>
    </Space>
  );
}

// ── Fila de un par entrada/salida ──────────────────────────────────────────

interface PairRowProps {
  pair:     AttendancePair;
  label?:   string;          // "T1", "T2" — solo cuando hay doble turno
  onEdit:   (id: number, time: string, label: string) => void;
  onDelete: (id: number) => void;
  onAdd:    () => void;
}

function PairRow({ pair, label, onEdit, onDelete, onAdd }: PairRowProps) {
  const ciTime = toMX(pair.check_in_time);
  const coTime = toMX(pair.check_out_time);
  const hours  = pair.hours_worked != null ? `${pair.hours_worked.toFixed(1)}h` : null;

  return (
    <Space direction="vertical" size={2} style={{ width: "100%" }}>
      {label && (
        <Text type="secondary" style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5 }}>
          {label}
        </Text>
      )}

      {/* Entrada */}
      {pair.check_in_id != null ? (
        <Space size={3} align="center">
          <Tag color="success" style={{ margin: 0, fontSize: 11 }}>{ciTime}</Tag>
          <Tooltip title="Editar entrada">
            <Button size="small" type="text" icon={<EditOutlined style={{ fontSize: 11 }} />}
              onClick={() => onEdit(pair.check_in_id!, pair.check_in_time!, "entrada")}
              style={{ padding: "0 2px", height: "auto" }} />
          </Tooltip>
          <Popconfirm title="¿Eliminar registro de entrada?" okText="Eliminar"
            okButtonProps={{ danger: true }} cancelText="Cancelar"
            onConfirm={() => onDelete(pair.check_in_id!)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined style={{ fontSize: 11 }} />}
              style={{ padding: "0 2px", height: "auto" }} />
          </Popconfirm>
        </Space>
      ) : null}

      {/* Salida */}
      {pair.check_out_id != null ? (
        <Space size={3} align="center">
          <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>{coTime}</Tag>
          <Tooltip title="Editar salida">
            <Button size="small" type="text" icon={<EditOutlined style={{ fontSize: 11 }} />}
              onClick={() => onEdit(pair.check_out_id!, pair.check_out_time!, "salida")}
              style={{ padding: "0 2px", height: "auto" }} />
          </Tooltip>
          <Popconfirm title="¿Eliminar registro de salida?" okText="Eliminar"
            okButtonProps={{ danger: true }} cancelText="Cancelar"
            onConfirm={() => onDelete(pair.check_out_id!)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined style={{ fontSize: 11 }} />}
              style={{ padding: "0 2px", height: "auto" }} />
          </Popconfirm>
        </Space>
      ) : pair.check_in_id != null ? (
        // Tiene entrada pero no salida
        <Space size={3} align="center">
          <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>Sin salida</Tag>
          <Button size="small" type="dashed" icon={<PlusOutlined />}
            onClick={onAdd} style={{ fontSize: 10 }}>
            + Salida
          </Button>
        </Space>
      ) : null}

      {/* Horas del par */}
      {hours && (
        <Text type="secondary" style={{ fontSize: 10 }}>{hours}</Text>
      )}
    </Space>
  );
}
