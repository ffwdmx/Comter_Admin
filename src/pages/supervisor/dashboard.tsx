import { useState, useEffect, useCallback } from "react";
import {
  Card, Col, Row, Typography, Tag, Button, Space, Badge,
  Table, Modal, message, Divider, Empty, Spin, Statistic,
  Alert,
} from "antd";
import {
  ClockCircleOutlined, UserOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
  DollarOutlined, MinusCircleOutlined, WarningOutlined,
} from "@ant-design/icons";
import { axiosInstance } from "../../providers/dataProvider";

const { Title, Text } = Typography;

// ── Tipos ──────────────────────────────────────────────────────────────────

interface PendingRequest {
  id: number;
  employee_id: number;
  employee_name?: string;
  request_type: string;
  hours_worked_at_request: number;
  expires_at: string;
  status: string;
  shift_record_id: number;
}

interface OpenShift {
  shift_record_id: number;
  employee_id: number;
  employee_name: string;
  employee_no: string;
  shift_name?: string;
  scheduled_end: string;
  minutes_past_end: number;
  actual_check_in?: string;
}

interface AbsenceAlert {
  employee_id: number;
  employee_name: string;
  employee_no: string;
  cumulative_absence_count: number;
  latest_absence_date: string;
  absence_record_id: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

const minutesUntilExpiry = (expiresAt: string) => {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 60000));
};

// ── Sección: Solicitudes Pendientes ───────────────────────────────────────

const PendingRequestsSection = ({
  requests, loading, onRespond,
}: {
  requests: PendingRequest[];
  loading: boolean;
  onRespond: (id: number, decision: string) => void;
}) => (
  <Card
    title={
      <Space>
        <ClockCircleOutlined style={{ color: "#faad14" }} />
        <span>Solicitudes Pendientes</span>
        <Badge count={requests.length} showZero color={requests.length > 0 ? "#faad14" : "#ccc"} />
      </Space>
    }
    loading={loading}
    style={{ marginBottom: 16 }}
  >
    {requests.length === 0 ? (
      <Empty description="Sin solicitudes pendientes" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    ) : (
      <Row gutter={[12, 12]}>
        {requests.map((r) => {
          const minsLeft = minutesUntilExpiry(r.expires_at);
          const isOvertime = r.request_type === "overtime";
          return (
            <Col key={r.id} xs={24} md={12} xl={8}>
              <Card
                size="small"
                style={{
                  border: `1px solid ${minsLeft < 5 ? "#ff4d4f" : "#faad14"}`,
                  borderRadius: 8,
                }}
                bodyStyle={{ padding: 12 }}
              >
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <Space style={{ justifyContent: "space-between", width: "100%" }}>
                    <Text strong>{r.employee_name ?? `Empleado #${r.employee_id}`}</Text>
                    <Tag color={isOvertime ? "blue" : "orange"}>
                      {isOvertime ? "Tiempo Extra" : "Salida Anticipada"}
                    </Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Trabajado: <Text strong>{r.hours_worked_at_request.toFixed(2)}h</Text>
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Vence en:{" "}
                    <Text strong style={{ color: minsLeft < 5 ? "#ff4d4f" : "#fa8c16" }}>
                      {minsLeft} min
                    </Text>
                  </Text>
                  <Divider style={{ margin: "6px 0" }} />
                  <Space wrap>
                    {!isOvertime && (
                      <>
                        <Button
                          size="small"
                          type="primary"
                          icon={<DollarOutlined />}
                          onClick={() => onRespond(r.id, "approved_full_pay")}
                        >
                          Con goce
                        </Button>
                        <Button
                          size="small"
                          icon={<MinusCircleOutlined />}
                          onClick={() => onRespond(r.id, "approved_deducted")}
                        >
                          Con descuento
                        </Button>
                      </>
                    )}
                    {isOvertime && (
                      <Button
                        size="small"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={() => onRespond(r.id, "approved_full_pay")}
                      >
                        Aprobar
                      </Button>
                    )}
                    <Button
                      size="small"
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => onRespond(r.id, "rejected")}
                    >
                      Rechazar
                    </Button>
                  </Space>
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>
    )}
  </Card>
);

// ── Sección: Turnos sin cerrar ─────────────────────────────────────────────

const OpenShiftsSection = ({
  openShifts, loading, onForceClose,
}: {
  openShifts: OpenShift[];
  loading: boolean;
  onForceClose: (id: number, name: string) => void;
}) => (
  <Card
    title={
      <Space>
        <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />
        <span>Turnos sin Cerrar</span>
        <Badge count={openShifts.length} showZero color={openShifts.length > 0 ? "#ff4d4f" : "#ccc"} />
      </Space>
    }
    loading={loading}
    style={{ marginBottom: 16 }}
  >
    {openShifts.length === 0 ? (
      <Empty description="Todos los turnos están cerrados" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    ) : (
      <Table
        dataSource={openShifts}
        rowKey="shift_record_id"
        pagination={false}
        size="small"
        columns={[
          {
            title: "Empleado",
            render: (_: any, r: OpenShift) => (
              <Space>
                <UserOutlined style={{ color: "#1B3A6B" }} />
                <Space direction="vertical" size={0}>
                  <Text strong>{r.employee_name}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{r.employee_no}</Text>
                </Space>
              </Space>
            ),
          },
          {
            title: "Turno",
            dataIndex: "shift_name",
            render: (v: string) => v ?? "—",
          },
          {
            title: "Fin programado",
            dataIndex: "scheduled_end",
            render: (v: string) => fmtTime(v),
          },
          {
            title: "Tiempo excedido",
            dataIndex: "minutes_past_end",
            render: (v: number) => (
              <Text style={{ color: v > 60 ? "#ff4d4f" : "#fa8c16" }} strong>
                {v} min
              </Text>
            ),
          },
          {
            title: "Acción",
            render: (_: any, r: OpenShift) => (
              <Button
                size="small"
                danger
                onClick={() => onForceClose(r.shift_record_id, r.employee_name)}
              >
                Cerrar turno
              </Button>
            ),
          },
        ]}
      />
    )}
  </Card>
);

// ── Sección: Alertas de Faltas ─────────────────────────────────────────────

const AbsenceAlertsSection = ({
  alerts, loading, onDecide,
}: {
  alerts: AbsenceAlert[];
  loading: boolean;
  onDecide: (employeeId: number, name: string, count: number, lastDay: string) => void;
}) => (
  <Card
    title={
      <Space>
        <WarningOutlined style={{ color: "#ff4d4f" }} />
        <span>Alertas de Faltas</span>
        <Badge count={alerts.length} showZero color={alerts.length > 0 ? "#ff4d4f" : "#ccc"} />
      </Space>
    }
    loading={loading}
  >
    {alerts.length === 0 ? (
      <Empty description="Sin alertas de faltas pendientes" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    ) : (
      <Row gutter={[12, 12]}>
        {alerts.map((a) => (
          <Col key={a.employee_id} xs={24} md={12} xl={8}>
            <Card
              size="small"
              style={{ border: "1px solid #ff4d4f", borderRadius: 8 }}
              bodyStyle={{ padding: 12 }}
            >
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <Space style={{ justifyContent: "space-between", width: "100%" }}>
                  <Text strong>{a.employee_name}</Text>
                  <Tag color="red">{a.employee_no}</Tag>
                </Space>
                <Statistic
                  title="Faltas acumuladas"
                  value={a.cumulative_absence_count}
                  valueStyle={{ color: "#ff4d4f", fontSize: 24 }}
                  prefix={<WarningOutlined />}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Última falta: {fmtDate(a.latest_absence_date)}
                </Text>
                <Divider style={{ margin: "6px 0" }} />
                <Button
                  block
                  size="small"
                  onClick={() =>
                    onDecide(a.employee_id, a.employee_name, a.cumulative_absence_count, a.latest_absence_date)
                  }
                  style={{ borderColor: "#ff4d4f", color: "#ff4d4f" }}
                >
                  Ver opciones
                </Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    )}
  </Card>
);

// ── Dashboard principal ────────────────────────────────────────────────────

export const SupervisorDashboard = () => {
  const [requests, setRequests]   = useState<PendingRequest[]>([]);
  const [openShifts, setOpen]     = useState<OpenShift[]>([]);
  const [alerts, setAlerts]       = useState<AbsenceAlert[]>([]);
  const [loading, setLoading]     = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Modal de decisión de falta
  const [absenceModal, setAbsenceModal] = useState<{
    visible: boolean;
    employeeId: number;
    name: string;
    count: number;
    lastDay: string;
  } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, openRes, alertRes] = await Promise.allSettled([
        axiosInstance.get("/shifts/requests/pending"),
        axiosInstance.get("/shifts/supervisor/open-shifts"),
        axiosInstance.get("/shifts/supervisor/absence-alerts"),
      ]);
      if (reqRes.status   === "fulfilled") setRequests(reqRes.value.data);
      if (openRes.status  === "fulfilled") setOpen(openRes.value.data);
      if (alertRes.status === "fulfilled") setAlerts(alertRes.value.data);
      setLastUpdate(new Date());
    } catch {
      // errores individuales ya manejados por Promise.allSettled
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial + auto-refresh cada 30 s
  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, 30_000);
    return () => clearInterval(timer);
  }, [fetchAll]);

  // Responder solicitud
  const handleRespond = async (requestId: number, decision: string) => {
    try {
      await axiosInstance.post(`/shifts/requests/${requestId}/respond`, { decision });
      const labels: Record<string, string> = {
        approved_full_pay:  "Aprobado con goce",
        approved_deducted:  "Aprobado con descuento",
        rejected:           "Rechazado",
      };
      message.success(labels[decision] ?? "Procesado");
      fetchAll();
    } catch (err: any) {
      message.error(err?.response?.data?.detail ?? "Error al procesar solicitud");
    }
  };

  // Cerrar turno forzado
  const handleForceClose = (shiftRecordId: number, employeeName: string) => {
    Modal.confirm({
      title:   `¿Cerrar el turno de ${employeeName}?`,
      content: "Se calculará el tiempo trabajado hasta ahora y se enviará una notificación al empleado.",
      okText:      "Cerrar turno",
      okType:      "danger",
      cancelText:  "Cancelar",
      onOk: async () => {
        try {
          await axiosInstance.post(`/shifts/supervisor/force-close/${shiftRecordId}`);
          message.success(`Turno de ${employeeName} cerrado`);
          fetchAll();
        } catch (err: any) {
          message.error(err?.response?.data?.detail ?? "Error al cerrar turno");
        }
      },
    });
  };

  // Decisión de falta
  const openAbsenceModal = (
    employeeId: number, name: string, count: number, lastDay: string,
  ) => setAbsenceModal({ visible: true, employeeId, name, count, lastDay });

  const handleAbsenceDecision = async (decision: "terminate" | "continue") => {
    if (!absenceModal) return;
    const { employeeId, name } = absenceModal;

    if (decision === "terminate") {
      Modal.confirm({
        title:   `¿Confirmas la baja de ${name}?`,
        content: (
          <div>
            <p>
              Último día de trabajo:{" "}
              <strong>{absenceModal.lastDay ? fmtDate(absenceModal.lastDay) : "—"}</strong>
            </p>
            <Alert
              type="error"
              message="Esta acción no se puede deshacer."
              style={{ marginTop: 8 }}
            />
          </div>
        ),
        okText:     "Confirmar baja",
        okType:     "danger",
        cancelText: "Cancelar",
        onOk: async () => {
          try {
            await axiosInstance.post(`/shifts/supervisor/absence-decision/${employeeId}`, {
              decision: "terminate",
            });
            message.success(`${name} dado de baja correctamente`);
            setAbsenceModal(null);
            fetchAll();
          } catch (err: any) {
            message.error(err?.response?.data?.detail ?? "Error al procesar la baja");
          }
        },
      });
    } else {
      try {
        await axiosInstance.post(`/shifts/supervisor/absence-decision/${employeeId}`, {
          decision: "continue",
        });
        message.success(`Contrato de ${name} continúa. Las faltas acumuladas no se reinician.`);
        setAbsenceModal(null);
        fetchAll();
      } catch (err: any) {
        message.error(err?.response?.data?.detail ?? "Error al procesar decisión");
      }
    }
  };

  const totalAlerts = requests.length + openShifts.length + alerts.length;

  return (
    <div>
      {/* Header */}
      <Space style={{ justifyContent: "space-between", width: "100%", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Dashboard Supervisor
          {totalAlerts > 0 && (
            <Badge count={totalAlerts} style={{ marginLeft: 8 }} />
          )}
        </Title>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Actualizado: {lastUpdate.toLocaleTimeString("es-MX")}
          </Text>
          <Button
            size="small"
            icon={<ReloadOutlined spin={loading} />}
            onClick={fetchAll}
            loading={loading}
          >
            Actualizar
          </Button>
        </Space>
      </Space>

      {loading && requests.length === 0 && openShifts.length === 0 && alerts.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <PendingRequestsSection
            requests={requests}
            loading={false}
            onRespond={handleRespond}
          />
          <OpenShiftsSection
            openShifts={openShifts}
            loading={false}
            onForceClose={handleForceClose}
          />
          <AbsenceAlertsSection
            alerts={alerts}
            loading={false}
            onDecide={openAbsenceModal}
          />
        </>
      )}

      {/* Modal decisión de falta */}
      <Modal
        open={absenceModal?.visible ?? false}
        title={
          <Space>
            <WarningOutlined style={{ color: "#ff4d4f" }} />
            <span>Alerta de Faltas — {absenceModal?.name}</span>
          </Space>
        }
        footer={null}
        onCancel={() => setAbsenceModal(null)}
        width={480}
      >
        {absenceModal && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Alert
              type="warning"
              message={
                <span>
                  <strong>{absenceModal.name}</strong> ha acumulado{" "}
                  <strong style={{ color: "#ff4d4f" }}>
                    {absenceModal.count} faltas
                  </strong>{" "}
                  en total. La cuenta no se reinicia en ningún caso.
                </span>
              }
            />
            <Row gutter={12}>
              <Col span={12}>
                <Button
                  block
                  danger
                  size="large"
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleAbsenceDecision("terminate")}
                >
                  Dar de baja
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  block
                  type="primary"
                  size="large"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleAbsenceDecision("continue")}
                >
                  Continuar contrato
                </Button>
              </Col>
            </Row>
          </Space>
        )}
      </Modal>
    </div>
  );
};
