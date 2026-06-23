// src/pages/attendance/WeeklyReview.tsx
import { useEffect, useState, useCallback } from "react";
import {
  Table, Tag, Button, Modal, Form, TimePicker, Select,
  Space, Typography, Spin, Tooltip, DatePicker, App,
  Popconfirm, Radio, InputNumber, Input, Badge, Alert,
} from "antd";
import {
  LeftOutlined, RightOutlined, PlusOutlined,
  EditOutlined, DeleteOutlined, SendOutlined, StopOutlined,
  MedicineBoxOutlined, CheckOutlined, CloseOutlined,
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
  shift_start:  string | null;
  shift_end:    string | null;
  days: Record<string, DayCell>;
}

interface WeeklyReviewData {
  week_start: string;
  week_end:   string;
  rows: ReviewRow[];
}

interface SpecialEvent {
  id:                  number;
  employee_id:         number;
  employee_name:       string;
  employee_no:         string;
  event_type:          "permiso_sin_goce" | "incapacidad" | "vacaciones";
  start_date:          string;
  end_date:            string;
  partial_hours:       number | null;
  notes:               string | null;
  imss_folio:          string | null;
  registered_by:       number | null;
  registered_by_name:  string;
  approval_status:     "pending" | "approved" | "rejected";
  approved_by:         number | null;
  approved_by_name:    string;
  corrects_absence:    boolean;
  is_active:           boolean;
  total_days:          number;
}

interface DaySpecialStatus {
  event:                  SpecialEvent;
  day_number_in_sequence: number;
  imss_responsibility:    boolean;
}

type SpecialEventsMap = Record<number, Record<string, DaySpecialStatus>>;

// ── Helpers ────────────────────────────────────────────────────────────────

function toMX(iso: string | null): string {
  if (!iso) return "—";
  return dayjs.utc(iso).tz(TZ).format("HH:mm");
}

function getDefaultWeekStart(): Dayjs {
  const today = dayjs();
  const THU   = 4;
  const dow   = today.day();
  const daysSinceThu = (dow - THU + 7) % 7;
  return today.subtract(daysSinceThu, "day").startOf("day");
}

const DAY_NAMES_ES: Record<number, string> = {
  0: "Dom", 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb",
};

function buildSpecialEventsMap(events: SpecialEvent[]): SpecialEventsMap {
  const map: SpecialEventsMap = {};
  for (const event of events) {
    if (event.approval_status === "rejected") continue;
    if (!map[event.employee_id]) map[event.employee_id] = {};
    let current  = new Date(event.start_date + "T00:00:00");
    const end    = new Date(event.end_date   + "T00:00:00");
    let dayNumber = 1;
    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];
      map[event.employee_id][dateStr] = {
        event,
        day_number_in_sequence: dayNumber,
        imss_responsibility:    event.event_type === "incapacidad" && dayNumber >= 4,
      };
      current.setDate(current.getDate() + 1);
      dayNumber++;
    }
  }
  return map;
}

// ── Componente principal ────────────────────────────────────────────────────

export function WeeklyReview() {
  const { message } = App.useApp();

  const [weekStart, setWeekStart] = useState<Dayjs>(getDefaultWeekStart);
  const [data, setData]           = useState<WeeklyReviewData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [sending, setSending]     = useState(false);
  const [specialEventsMap, setSpecialEventsMap] = useState<SpecialEventsMap>({});
  const [pendingCorrections, setPendingCorrections] = useState<SpecialEvent[]>([]);

  // Modal: agregar registro de asistencia
  const [addModal, setAddModal] = useState<{
    open: boolean;
    employeeId:   number;
    employeeName: string;
    date:         string;
    shiftStart:   string | null;
    shiftEnd:     string | null;
    shiftName:    string | null;
    forceType:    "check_out" | null;
  } | null>(null);
  const [addForm] = Form.useForm();

  // Modal: editar registro de asistencia
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

  // Modal: registrar permiso/incapacidad/vacaciones (flujo normal)
  const [specialModal, setSpecialModal] = useState(false);
  const [specialForm] = Form.useForm();
  const [specialEventType, setSpecialEventType] = useState<"permiso_sin_goce" | "incapacidad" | "vacaciones">("permiso_sin_goce");
  const [submittingSpecial, setSubmittingSpecial] = useState(false);

  // Modal: editar/cancelar evento especial existente
  const [editSpecialModal, setEditSpecialModal] = useState<{
    open: boolean;
    event: SpecialEvent;
    dayStatus: DaySpecialStatus;
  } | null>(null);
  const [editSpecialForm] = Form.useForm();
  const [submittingEditSpecial, setSubmittingEditSpecial] = useState(false);

  // Modal: corregir falta → asignar permiso/vacaciones (flujo de corrección pendiente)
  const [correctionModal, setCorrectionModal] = useState<{
    open: boolean;
    employeeId:   number;
    employeeName: string;
    date:         string;
  } | null>(null);
  const [correctionForm] = Form.useForm();
  const [correctionEventType, setCorrectionEventType] = useState<"permiso_sin_goce" | "incapacidad" | "vacaciones">("permiso_sin_goce");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Modal: rechazar corrección
  const [rejectModal, setRejectModal] = useState<{
    open: boolean;
    eventId: number;
  } | null>(null);
  const [rejectForm] = Form.useForm();

  // ── Carga de datos ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reviewRes, specialRes, pendingRes] = await Promise.all([
        axiosInstance.get("/attendance/weekly-review", {
          params: { week_start: weekStart.format("YYYY-MM-DD") },
        }),
        axiosInstance.get("/attendance/special/", {
          params: {
            date_from: weekStart.format("YYYY-MM-DD"),
            date_to:   weekStart.add(6, "day").format("YYYY-MM-DD"),
            limit:     500,
          },
        }),
        axiosInstance.get("/attendance/special/", {
          params: { approval_status: "pending", limit: 200 },
        }),
      ]);
      setData(reviewRes.data);
      setSpecialEventsMap(buildSpecialEventsMap(specialRes.data));
      setPendingCorrections(Array.isArray(pendingRes.data) ? pendingRes.data : []);
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
      const res = await axiosInstance.post(
        "/attendance/send-report",
        { week_start: weekStart.format("YYYY-MM-DD") },
        { timeout: 60_000 },
      );
      message.success(res.data.message ?? "Reporte enviado correctamente.", 6);
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? err?.message ?? "Error al enviar el reporte.";
      message.error(detail, 8);
    } finally {
      setSending(false);
    }
  };

  const handleAddTypeChange = (type: string) => {
    if (!addModal) return;
    const timeStr = type === "check_in" ? addModal.shiftStart : addModal.shiftEnd;
    if (timeStr) {
      addForm.setFieldValue("hora", dayjs(timeStr, "HH:mm"));
    } else {
      addForm.setFieldValue("hora", null);
    }
  };

  // ── Agregar registro de asistencia ──────────────────────────────────────

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
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail ?? "Error al agregar registro.");
    }
  };

  // ── Editar registro de asistencia ───────────────────────────────────────

  const handleEdit = async () => {
    if (!editModal) return;
    try {
      const values = await editForm.validateFields();
      const time: Dayjs = values.hora;
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

  // ── Eliminar registro de asistencia ─────────────────────────────────────

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
        termination_reason: values.reason,
        termination_date:   values.date.format("YYYY-MM-DD"),
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

  // ── Registrar permiso/incapacidad/vacaciones (flujo normal) ────────────

  const handleSpecialSubmit = async () => {
    setSubmittingSpecial(true);
    try {
      const values = await specialForm.validateFields();
      const [start, end] = values.date_range as [Dayjs, Dayjs];
      await axiosInstance.post("/attendance/special/", {
        employee_id:   values.employee_id,
        event_type:    values.event_type,
        start_date:    start.format("YYYY-MM-DD"),
        end_date:      end.format("YYYY-MM-DD"),
        partial_hours: values.partial_hours ?? null,
        notes:         values.notes ?? null,
        imss_folio:    values.imss_folio ?? null,
        corrects_absence: false,
      });
      message.success("Evento registrado correctamente.");
      setSpecialModal(false);
      specialForm.resetFields();
      setSpecialEventType("permiso_sin_goce");
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail ?? "Error al registrar el evento.");
    } finally {
      setSubmittingSpecial(false);
    }
  };

  // ── Actualizar evento especial ──────────────────────────────────────────

  const handleEditSpecialSubmit = async () => {
    if (!editSpecialModal) return;
    setSubmittingEditSpecial(true);
    try {
      const values = await editSpecialForm.validateFields();
      const payload: Record<string, any> = {};
      if (values.end_date)   payload.end_date   = (values.end_date as Dayjs).format("YYYY-MM-DD");
      if (values.notes)      payload.notes       = values.notes;
      if (values.imss_folio) payload.imss_folio  = values.imss_folio;
      await axiosInstance.patch(
        `/attendance/special/${editSpecialModal.event.id}`,
        payload,
      );
      message.success("Evento actualizado.");
      setEditSpecialModal(null);
      editSpecialForm.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail ?? "Error al actualizar el evento.");
    } finally {
      setSubmittingEditSpecial(false);
    }
  };

  const handleCancelSpecial = async (eventId: number) => {
    try {
      await axiosInstance.delete(`/attendance/special/${eventId}`);
      message.success("Evento cancelado.");
      setEditSpecialModal(null);
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail ?? "Error al cancelar el evento.");
    }
  };

  // ── Corregir falta → crear corrección pendiente ─────────────────────────

  const handleCorrectionSubmit = async () => {
    if (!correctionModal) return;
    setSubmittingCorrection(true);
    try {
      const values = await correctionForm.validateFields();
      const endDate = values.end_date
        ? (values.end_date as Dayjs).format("YYYY-MM-DD")
        : correctionModal.date;

      await axiosInstance.post("/attendance/special/", {
        employee_id:      correctionModal.employeeId,
        event_type:       values.event_type,
        start_date:       correctionModal.date,
        end_date:         endDate,
        partial_hours:    values.partial_hours ?? null,
        notes:            values.notes,
        imss_folio:       values.imss_folio ?? null,
        corrects_absence: true,
      });
      message.success("Corrección enviada — pendiente de aprobación por un administrador.");
      setCorrectionModal(null);
      correctionForm.resetFields();
      setCorrectionEventType("permiso_sin_goce");
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail ?? "Error al registrar la corrección.");
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // ── Aprobar / Rechazar correcciones ─────────────────────────────────────

  const handleApprove = async (eventId: number) => {
    try {
      await axiosInstance.patch(`/attendance/special/${eventId}/approve`);
      message.success("Corrección aprobada.");
      setEditSpecialModal(null);
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail ?? "Error al aprobar.");
    }
  };

  const handleReject = async (eventId: number, notes?: string) => {
    try {
      await axiosInstance.patch(`/attendance/special/${eventId}/reject`, {
        rejection_notes: notes ?? null,
      });
      message.success("Corrección rechazada — la falta se restaura.");
      setRejectModal(null);
      rejectForm.resetFields();
      setEditSpecialModal(null);
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail ?? "Error al rechazar.");
    }
  };

  // ── Columnas de la tabla ────────────────────────────────────────────────

  const allEmployees = data?.rows ?? [];

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
        const cell    = row.days[dateStr];
        const special = specialEventsMap[row.employee_id]?.[dateStr];

        if (special) {
          return (
            <SpecialEventCell
              status={special}
              onEdit={() => setEditSpecialModal({
                open: true,
                event: special.event,
                dayStatus: special,
              })}
            />
          );
        }

        if (!cell) return null;
        return (
          <CellRenderer
            cell={cell}
            employeeId={row.employee_id}
            employeeName={row.name}
            date={dateStr}
            onAdd={() => {
              setAddModal({
                open: true,
                employeeId:   row.employee_id,
                employeeName: row.name,
                date:         dateStr,
                shiftStart:   row.shift_start,
                shiftEnd:     row.shift_end,
                shiftName:    row.shift_name,
                forceType:    null,
              });
              addForm.setFieldsValue({ type: undefined, hora: row.shift_start ? dayjs(row.shift_start, "HH:mm") : undefined });
            }}
            onAddSalida={() => {
              setAddModal({
                open: true,
                employeeId:   row.employee_id,
                employeeName: row.name,
                date:         dateStr,
                shiftStart:   row.shift_start,
                shiftEnd:     row.shift_end,
                shiftName:    row.shift_name,
                forceType:    "check_out",
              });
              addForm.setFieldsValue({ type: "check_out", hora: row.shift_end ? dayjs(row.shift_end, "HH:mm") : undefined });
            }}
            onEdit={(id, time, lbl) => {
              setEditModal({ open: true, attendanceId: id, employeeName: row.name, currentTime: time, label: lbl });
              editForm.setFieldsValue({ hora: dayjs.utc(time).tz(TZ) });
            }}
            onDelete={handleDelete}
            onAssignSpecial={() => {
              setCorrectionModal({
                open:         true,
                employeeId:   row.employee_id,
                employeeName: row.name,
                date:         dateStr,
              });
              correctionForm.resetFields();
              correctionForm.setFieldsValue({ event_type: "permiso_sin_goce" });
              setCorrectionEventType("permiso_sin_goce");
            }}
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
        <Space>
          <Button
            icon={<MedicineBoxOutlined />}
            onClick={() => setSpecialModal(true)}
          >
            + Permiso / Incapacidad / Vacaciones
          </Button>
          <Popconfirm
            title="¿Enviar reporte al contador?"
            description={`Semana ${weekStart.format("DD/MM")} – ${weekStart.add(6, "day").format("DD/MM/YYYY")} por correo electrónico.`}
            okText="Enviar"
            cancelText="Cancelar"
            okButtonProps={{ loading: sending }}
            onConfirm={handleSendReport}
          >
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={sending}
            >
              Enviar Reporte por Email
            </Button>
          </Popconfirm>
        </Space>
      </div>

      {/* ── Correcciones pendientes de aprobación ─────────────────────────── */}
      {pendingCorrections.length > 0 && (
        <div style={{
          background: "#fffbe6",
          border: "1px solid #ffe58f",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
        }}>
          <Text strong style={{ fontSize: 14, color: "#d46b08", display: "block", marginBottom: 10 }}>
            ⚠ Correcciones de falta pendientes de aprobación ({pendingCorrections.length})
          </Text>
          <Space direction="vertical" style={{ width: "100%" }} size={6}>
            {pendingCorrections.map(evt => (
              <div key={evt.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "white", borderRadius: 6, padding: "8px 12px",
                border: "1px solid #ffd591",
              }}>
                <Space size={8} wrap>
                  <Text strong style={{ fontSize: 12 }}>{evt.employee_name}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>({evt.employee_no})</Text>
                  <Tag color="orange" style={{ fontSize: 10 }}>
                    {evt.event_type === "vacaciones"
                      ? "VACACIONES"
                      : evt.event_type === "permiso_sin_goce"
                      ? "PERMISO"
                      : "INCAPACIDAD"}
                  </Tag>
                  <Text style={{ fontSize: 11 }}>
                    {dayjs(evt.start_date).format("DD/MM")} — {dayjs(evt.end_date).format("DD/MM/YYYY")}
                  </Text>
                  {evt.notes && (
                    <Tooltip title={evt.notes}>
                      <Text type="secondary" style={{ fontSize: 11, fontStyle: "italic" }}>
                        "{evt.notes.length > 50 ? evt.notes.slice(0, 47) + "…" : evt.notes}"
                      </Text>
                    </Tooltip>
                  )}
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    Registrado por: {evt.registered_by_name}
                  </Text>
                </Space>
                <Space>
                  <Popconfirm
                    title="¿Aprobar esta corrección?"
                    description="La falta será reemplazada por el evento indicado."
                    okText="Aprobar"
                    cancelText="Cancelar"
                    onConfirm={() => handleApprove(evt.id)}
                  >
                    <Button size="small" type="primary" icon={<CheckOutlined />}>
                      Aprobar
                    </Button>
                  </Popconfirm>
                  <Button
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => setRejectModal({ open: true, eventId: evt.id })}
                  >
                    Rechazar
                  </Button>
                </Space>
              </div>
            ))}
          </Space>
        </div>
      )}

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

      {/* Leyenda de colores */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12, fontSize: 12, color: "#555" }}>
        <span><Badge color="green"    /> Entrada registrada</span>
        <span><Badge color="gold"     /> Salida registrada</span>
        <span><Badge color="red"      /> Falta</span>
        <span><Badge color="blue"     /> Permiso sin goce</span>
        <span><Badge color="geekblue" /> Vacaciones</span>
        <span><Badge color="orange"   /> Incapacidad (días 1-3, patrón)</span>
        <span><Badge color="purple"   /> Incapacidad (día 4+, IMSS)</span>
        <span><Badge color="default"  /> Corrección pendiente de aprobación</span>
      </div>

      {/* ── Modal: Agregar registro de asistencia ───────────────────────── */}
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
          {addModal?.forceType === "check_out" ? (
            <Form.Item label="Tipo">
              <Tag color="orange" style={{ fontSize: 13, padding: "2px 10px" }}>Salida</Tag>
              <Form.Item name="type" hidden><input /></Form.Item>
            </Form.Item>
          ) : (
            <Form.Item name="type" label="Tipo" rules={[{ required: true, message: "Selecciona el tipo" }]}>
              <Select placeholder="Selecciona" onChange={handleAddTypeChange}>
                <Select.Option value="check_in">Entrada</Select.Option>
                <Select.Option value="check_out">Salida</Select.Option>
              </Select>
            </Form.Item>
          )}
          <Form.Item
            name="hora"
            label="Hora (hora México)"
            extra="Se pre-llenó con el horario del turno — ajusta si es necesario."
            rules={[{ required: true, message: "Ingresa la hora" }]}
          >
            <TimePicker format="HH:mm" style={{ width: "100%" }} minuteStep={1} />
          </Form.Item>
          <Form.Item name="notes" label="Notas (opcional)">
            <Select.Option value="">—</Select.Option>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: Editar registro de asistencia ────────────────────────── */}
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

      {/* ── Modal: Dar de baja ───────────────────────────────────────────── */}
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

      {/* ── Modal: Registrar permiso/incapacidad/vacaciones (flujo normal) ── */}
      <Modal
        title="Registrar Permiso, Incapacidad o Vacaciones"
        open={specialModal}
        onCancel={() => {
          setSpecialModal(false);
          specialForm.resetFields();
          setSpecialEventType("permiso_sin_goce");
        }}
        footer={null}
        destroyOnClose
        width={540}
      >
        <Form form={specialForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="employee_id" label="Empleado" rules={[{ required: true, message: "Selecciona el empleado" }]}>
            <Select
              showSearch
              placeholder="Buscar empleado..."
              filterOption={(input, opt) =>
                (opt?.label as string ?? "").toLowerCase().includes(input.toLowerCase())
              }
              options={allEmployees.map(e => ({
                value: e.employee_id,
                label: `${e.employee_no} — ${e.name}`,
              }))}
            />
          </Form.Item>

          <Form.Item name="event_type" label="Tipo" rules={[{ required: true }]} initialValue="permiso_sin_goce">
            <Radio.Group
              onChange={e => {
                setSpecialEventType(e.target.value);
                specialForm.setFieldValue("partial_hours", null);
              }}
            >
              <Radio.Button value="permiso_sin_goce">Permiso sin goce</Radio.Button>
              <Radio.Button value="vacaciones">Vacaciones</Radio.Button>
              <Radio.Button value="incapacidad">Incapacidad (IMSS)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="date_range" label="Período" rules={[{ required: true, message: "Selecciona el período" }]}>
            <DatePicker.RangePicker
              format="DD/MM/YYYY"
              placeholder={["Fecha de inicio", "Fecha final"]}
              style={{ width: "100%" }}
              disabledDate={d => !!d && d > dayjs().add(15, "day")}
            />
          </Form.Item>

          {specialEventType === "permiso_sin_goce" && (
            <Form.Item
              name="partial_hours"
              label="¿Permiso de horas? (dejar en blanco si es día completo)"
            >
              <InputNumber min={0.5} max={12} step={0.5} placeholder="Ej: 4.0" style={{ width: "100%" }} />
            </Form.Item>
          )}

          {specialEventType === "incapacidad" && (
            <Form.Item name="imss_folio" label="Folio IMSS (opcional)">
              <Input placeholder="Número de folio del certificado de incapacidad" />
            </Form.Item>
          )}

          <Form.Item name="notes" label="Notas / Motivo (opcional)">
            <Input.TextArea
              rows={2}
              placeholder={
                specialEventType === "incapacidad"
                  ? "Diagnóstico o motivo de la incapacidad (opcional)"
                  : specialEventType === "vacaciones"
                  ? "Observaciones sobre el período vacacional (opcional)"
                  : "Motivo del permiso (opcional)"
              }
            />
          </Form.Item>
        </Form>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <Button onClick={() => {
            setSpecialModal(false);
            specialForm.resetFields();
            setSpecialEventType("permiso_sin_goce");
          }}>
            Cancelar
          </Button>
          <Button type="primary" loading={submittingSpecial} onClick={handleSpecialSubmit}>
            Registrar
          </Button>
        </div>
      </Modal>

      {/* ── Modal: Editar / cancelar evento especial existente ───────────── */}
      {editSpecialModal && (
        <Modal
          title={
            editSpecialModal.event.event_type === "incapacidad"
              ? `Incapacidad — ${editSpecialModal.event.employee_name}`
              : editSpecialModal.event.event_type === "vacaciones"
              ? `Vacaciones — ${editSpecialModal.event.employee_name}`
              : `Permiso sin goce — ${editSpecialModal.event.employee_name}`
          }
          open={editSpecialModal.open}
          onCancel={() => { setEditSpecialModal(null); editSpecialForm.resetFields(); }}
          footer={null}
          destroyOnClose
          width={480}
        >
          {/* Banner de corrección pendiente con acciones de aprobar/rechazar */}
          {editSpecialModal.event.approval_status === "pending" && (
            <Alert
              type="warning"
              showIcon
              message="Corrección pendiente de aprobación"
              description={`Registrado por: ${editSpecialModal.event.registered_by_name}${editSpecialModal.event.notes ? ` — "${editSpecialModal.event.notes}"` : ""}`}
              style={{ marginBottom: 16 }}
              action={
                <Space direction="vertical" size={4}>
                  <Popconfirm
                    title="¿Aprobar esta corrección?"
                    description="La falta será reemplazada por el evento indicado."
                    okText="Aprobar"
                    cancelText="Cancelar"
                    onConfirm={() => handleApprove(editSpecialModal.event.id)}
                  >
                    <Button size="small" type="primary" icon={<CheckOutlined />} block>
                      Aprobar
                    </Button>
                  </Popconfirm>
                  <Button
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    block
                    onClick={() => setRejectModal({ open: true, eventId: editSpecialModal.event.id })}
                  >
                    Rechazar
                  </Button>
                </Space>
              }
            />
          )}

          <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
            <Text>
              <strong>Período:</strong>{" "}
              {dayjs(editSpecialModal.event.start_date).format("DD/MM/YYYY")} —{" "}
              {dayjs(editSpecialModal.event.end_date).format("DD/MM/YYYY")}
              {" "}({editSpecialModal.event.total_days} día{editSpecialModal.event.total_days !== 1 ? "s" : ""})
            </Text>
            {editSpecialModal.event.event_type === "incapacidad" && (
              <Text>
                <strong>Hoy es el día:</strong> {editSpecialModal.dayStatus.day_number_in_sequence}
                {" — "}
                {editSpecialModal.dayStatus.imss_responsibility
                  ? <Tag color="purple">Responsabilidad IMSS</Tag>
                  : <Tag color="orange">Responsabilidad patrón</Tag>
                }
              </Text>
            )}
            {editSpecialModal.event.imss_folio && (
              <Text><strong>Folio IMSS:</strong> {editSpecialModal.event.imss_folio}</Text>
            )}
            {editSpecialModal.event.notes && (
              <Text><strong>Notas:</strong> {editSpecialModal.event.notes}</Text>
            )}
            <Text type="secondary" style={{ fontSize: 11 }}>
              Registrado por: {editSpecialModal.event.registered_by_name}
            </Text>
          </Space>

          <Form form={editSpecialForm} layout="vertical">
            {editSpecialModal.event.event_type === "incapacidad" && (
              <Form.Item name="end_date" label="Cerrar incapacidad en (nueva fecha fin)">
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: "100%" }}
                  disabledDate={d =>
                    !!d && d < dayjs(editSpecialModal.event.start_date)
                  }
                  placeholder="Dejar vacío para mantener fecha actual"
                />
              </Form.Item>
            )}
            {editSpecialModal.event.event_type === "incapacidad" && (
              <Form.Item name="imss_folio" label="Actualizar folio IMSS">
                <Input placeholder={editSpecialModal.event.imss_folio ?? "Número de folio"} />
              </Form.Item>
            )}
            <Form.Item name="notes" label="Actualizar notas">
              <Input.TextArea rows={2} placeholder={editSpecialModal.event.notes ?? "Notas"} />
            </Form.Item>
          </Form>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <Popconfirm
              title="¿Cancelar este evento?"
              description="El evento se marcará como inactivo. Esta acción no se puede deshacer."
              okText="Sí, cancelar"
              okButtonProps={{ danger: true }}
              cancelText="No"
              onConfirm={() => handleCancelSpecial(editSpecialModal.event.id)}
            >
              <Button danger>Cancelar evento</Button>
            </Popconfirm>
            <Space>
              <Button onClick={() => { setEditSpecialModal(null); editSpecialForm.resetFields(); }}>
                Cerrar
              </Button>
              <Button
                type="primary"
                loading={submittingEditSpecial}
                onClick={handleEditSpecialSubmit}
              >
                Guardar cambios
              </Button>
            </Space>
          </div>
        </Modal>
      )}

      {/* ── Modal: Corregir falta → asignar permiso/vacaciones ─────────────── */}
      <Modal
        title={`Corregir falta — ${correctionModal?.employeeName ?? ""}`}
        open={correctionModal?.open ?? false}
        onCancel={() => { setCorrectionModal(null); correctionForm.resetFields(); setCorrectionEventType("permiso_sin_goce"); }}
        footer={null}
        destroyOnClose
        width={520}
      >
        <Alert
          type="warning"
          showIcon
          message="Esta corrección reemplazará la falta y quedará pendiente de aprobación por un administrador."
          style={{ marginBottom: 16 }}
        />
        {correctionModal && (
          <div style={{
            background: "#f5f5f5", borderRadius: 6, padding: "6px 12px",
            marginBottom: 16, fontSize: 13,
          }}>
            <strong>Fecha:</strong> {dayjs(correctionModal.date).format("dddd DD/MM/YYYY")}
          </div>
        )}
        <Form form={correctionForm} layout="vertical">
          <Form.Item
            name="event_type"
            label="Tipo de corrección"
            rules={[{ required: true }]}
            initialValue="permiso_sin_goce"
          >
            <Radio.Group onChange={e => {
              setCorrectionEventType(e.target.value);
              correctionForm.setFieldValue("partial_hours", null);
              correctionForm.setFieldValue("imss_folio", null);
            }}>
              <Space direction="vertical">
                <Radio value="permiso_sin_goce">Permiso sin goce de sueldo</Radio>
                <Radio value="vacaciones">Vacaciones</Radio>
                <Radio value="incapacidad">Incapacidad (IMSS)</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="end_date"
            label="Fecha fin (si el período va más allá de este día)"
          >
            <DatePicker
              format="DD/MM/YYYY"
              style={{ width: "100%" }}
              placeholder={`${correctionModal?.date ?? ""} (solo este día)`}
              disabledDate={d => !!d && d < dayjs(correctionModal?.date ?? "")}
            />
          </Form.Item>

          {correctionEventType === "permiso_sin_goce" && (
            <Form.Item name="partial_hours" label="¿Permiso de horas? (dejar en blanco si es día completo)">
              <InputNumber min={0.5} max={12} step={0.5} placeholder="Ej: 4.0" style={{ width: "100%" }} />
            </Form.Item>
          )}

          {correctionEventType === "incapacidad" && (
            <Form.Item name="imss_folio" label="Folio IMSS (opcional)">
              <Input placeholder="Número de folio del certificado de incapacidad" />
            </Form.Item>
          )}

          <Form.Item
            name="notes"
            label="Justificación / Motivo"
            rules={[{ required: true, message: "Indica el motivo de la corrección" }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="Describe el motivo por el que se corrige esta falta..."
            />
          </Form.Item>
        </Form>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <Button onClick={() => { setCorrectionModal(null); correctionForm.resetFields(); setCorrectionEventType("permiso_sin_goce"); }}>
            Cancelar
          </Button>
          <Button type="primary" loading={submittingCorrection} onClick={handleCorrectionSubmit}>
            Enviar para aprobación
          </Button>
        </div>
      </Modal>

      {/* ── Modal: Rechazar corrección ────────────────────────────────────── */}
      {rejectModal && (
        <Modal
          title="Rechazar corrección"
          open={rejectModal.open}
          onCancel={() => { setRejectModal(null); rejectForm.resetFields(); }}
          onOk={() => rejectForm.submit()}
          okText="Rechazar"
          okButtonProps={{ danger: true }}
          cancelText="Cancelar"
          destroyOnClose
        >
          <Form
            form={rejectForm}
            layout="vertical"
            style={{ marginTop: 16 }}
            onFinish={(values) => handleReject(rejectModal.eventId, values.notes)}
          >
            <Form.Item name="notes" label="Motivo del rechazo (opcional)">
              <Input.TextArea
                rows={2}
                placeholder="Explica por qué se rechaza esta corrección (el empleado o supervisor podrá verlo)..."
              />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  );
}

// ── Celda con evento especial ───────────────────────────────────────────────

interface SpecialEventCellProps {
  status: DaySpecialStatus;
  onEdit: () => void;
}

function SpecialEventCell({ status, onEdit }: SpecialEventCellProps) {
  const { event, day_number_in_sequence, imss_responsibility } = status;
  const isPending = event.approval_status === "pending";

  const renderTag = () => {
    if (event.event_type === "vacaciones") {
      return (
        <Tag
          color={isPending ? "default" : "geekblue"}
          style={{ fontWeight: 600, fontSize: 10 }}
        >
          {isPending ? "VAC · PENDIENTE" : "VACACIONES"}
        </Tag>
      );
    }

    if (event.event_type === "permiso_sin_goce") {
      return (
        <Tag
          color={isPending ? "default" : "blue"}
          style={{ fontWeight: 600 }}
        >
          {isPending
            ? "PERMISO · PENDIENTE"
            : event.partial_hours
            ? `PERMISO ${event.partial_hours}h`
            : "PERMISO"}
        </Tag>
      );
    }

    // incapacidad
    if (isPending) {
      return <Tag color="default" style={{ fontWeight: 600, fontSize: 10 }}>INCAP · PENDIENTE</Tag>;
    }
    return imss_responsibility
      ? <Tag color="purple" style={{ fontWeight: 600, fontSize: 10 }}>INCAP · Día {day_number_in_sequence} · IMSS</Tag>
      : <Tag color="orange" style={{ fontWeight: 600, fontSize: 10 }}>INCAP · Día {day_number_in_sequence} · Patrón</Tag>;
  };

  return (
    <Space direction="vertical" size={2} align="center" style={{ width: "100%" }}>
      {renderTag()}
      <Tooltip title={isPending ? "Ver / aprobar corrección pendiente" : "Ver / editar evento"}>
        <Button
          size="small" type="text"
          icon={<EditOutlined style={{ fontSize: 11 }} />}
          onClick={onEdit}
          style={{ padding: "0 2px", height: "auto" }}
        />
      </Tooltip>
    </Space>
  );
}

// ── Celda de día (asistencia normal) ───────────────────────────────────────

interface CellProps {
  cell:             DayCell;
  employeeId:       number;
  employeeName:     string;
  date:             string;
  onAdd:            () => void;
  onAddSalida:      () => void;
  onEdit:           (id: number, time: string, label: string) => void;
  onDelete:         (id: number) => void;
  onAssignSpecial?: () => void;
}

function CellRenderer({ cell, date, onAdd, onAddSalida, onEdit, onDelete, onAssignSpecial }: CellProps) {
  const today  = dayjs().format("YYYY-MM-DD");
  const isPast = date < today;

  if (cell.source === "absent") {
    return (
      <Space direction="vertical" size={3} align="center" style={{ width: "100%" }}>
        <Tag color="error" style={{ margin: 0 }}>FALTA</Tag>
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={onAdd} style={{ fontSize: 10 }}>
          Corregir registro
        </Button>
        {onAssignSpecial && (
          <Button
            size="small"
            type="link"
            icon={<MedicineBoxOutlined style={{ fontSize: 10 }} />}
            onClick={onAssignSpecial}
            style={{ fontSize: 10, padding: "0 2px", height: "auto" }}
          >
            Asignar permiso/vac.
          </Button>
        )}
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
          onAddSalida={onAddSalida}
        />
      ))}

      {cell.pairs.length > 1 && totalHours > 0 && (
        <Text type="secondary" style={{ fontSize: 10 }}>
          Total: {totalHours.toFixed(1)}h
        </Text>
      )}

      <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={onAdd}
        style={{ fontSize: 10, width: "100%" }}>
        + Turno
      </Button>
    </Space>
  );
}

// ── Fila de un par entrada/salida ──────────────────────────────────────────

interface PairRowProps {
  pair:        AttendancePair;
  label?:      string;
  onEdit:      (id: number, time: string, label: string) => void;
  onDelete:    (id: number) => void;
  onAddSalida: () => void;
}

function PairRow({ pair, label, onEdit, onDelete, onAddSalida }: PairRowProps) {
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
        <Space size={3} align="center">
          <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>Sin salida</Tag>
          <Button size="small" type="dashed" icon={<PlusOutlined />}
            onClick={onAddSalida} style={{ fontSize: 10 }}>
            + Salida
          </Button>
        </Space>
      ) : null}

      {hours && (
        <Text type="secondary" style={{ fontSize: 10 }}>{hours}</Text>
      )}
    </Space>
  );
}
