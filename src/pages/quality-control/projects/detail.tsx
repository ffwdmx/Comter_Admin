// src/pages/quality-control/projects/detail.tsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card, Row, Col, Tag, Typography, Button, Tabs, Table, Space, Statistic,
  Modal, Form, Select, App, Tooltip, Spin, Empty, Alert,
} from "antd";
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined,
  UserAddOutlined, DeleteOutlined, DownloadOutlined, RobotOutlined,
  ReloadOutlined, ExperimentOutlined,
} from "@ant-design/icons";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  Legend, ReferenceLine, ResponsiveContainer,
  ComposedChart, Bar, Line as RLine,
} from "recharts";
import { axiosInstance } from "../../../providers/dataProvider";

// ── Types ──────────────────────────────────────────────────────────────────

interface QCProject {
  id: number; name: string; part_number: string; client_id: number;
  component_type: string; inspection_type: string; status: string;
  target_yield: number; min_acceptable_yield: number;
  opportunities_per_unit: number; description?: string;
}

interface QCProjectStats {
  total_inspected: number; total_rejected: number;
  avg_fpy?: number; avg_overall_yield?: number;
  current_dpmo?: number; current_ppm?: number;
  inspections_count: number; last_inspection_date?: string;
  yield_status: string; below_target_days: number;
}

interface TrendPoint {
  date: string; fpy?: number; overall_yield?: number;
  total_inspected: number; total_rejected: number;
}

interface ParetoPoint {
  defect_type_name: string; defect_code: string; severity: string;
  quantity: number; percentage: number; cumulative_pct: number;
}

interface QCInspection {
  id: number; inspection_date: string; shift: string; status: string;
  total_inspected: number; total_rejected: number; fpy?: number;
  overall_yield?: number; dpmo?: number; ppm?: number;
  employee_name?: string; yield_status?: string;
  lot_number?: string; review_comment?: string;
}

interface Employee { id: number; name: string; employee_no: string; }
interface Assignment { id: number; employee_id: number; employee_name?: string; is_active: boolean; }

// ── Helpers ────────────────────────────────────────────────────────────────

const YIELD_COLOR: Record<string, string> = {
  green: "#2E7D32", yellow: "#F9A825", red: "#C62828",
};
const YIELD_LABEL: Record<string, string> = {
  green: "En objetivo", yellow: "Atención requerida", red: "Situación crítica",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "default", submitted: "blue", approved: "green", rejected: "red",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador", submitted: "Pendiente", approved: "Aprobado", rejected: "Rechazado",
};
const SHIFT_LABEL: Record<string, string> = {
  morning: "Mañana", afternoon: "Tarde", night: "Noche",
};

const fmtDate = (d: string) => {
  const dt = new Date(d);
  return `${dt.getDate().toString().padStart(2,"0")}/${(dt.getMonth()+1).toString().padStart(2,"0")}`;
};

// ── KPI Card ───────────────────────────────────────────────────────────────

const KpiCard = ({
  title, value, suffix = "", color = "#1B3A6B", precision = 2,
}: {
  title: string; value?: number | null; suffix?: string; color?: string; precision?: number;
}) => (
  <Card size="small" style={{ textAlign: "center" }}>
    <Statistic
      title={title}
      value={value != null ? value : undefined}
      precision={precision}
      suffix={suffix}
      valueStyle={{ color, fontSize: 22, fontWeight: 900 }}
      formatter={(v) => v == null ? "—" : String(v)}
    />
    {value == null && (
      <Typography.Text type="secondary" style={{ fontSize: 20, fontWeight: 900 }}>—</Typography.Text>
    )}
  </Card>
);

// ── Yield Status Badge ─────────────────────────────────────────────────────

const YieldStatusBadge = ({ status }: { status?: string }) => {
  if (!status) return <Tag>Sin datos</Tag>;
  return (
    <Tag color={status === "green" ? "success" : status === "yellow" ? "warning" : "error"} style={{ fontSize: 13, padding: "4px 10px" }}>
      {YIELD_LABEL[status] ?? status}
    </Tag>
  );
};

// ── Trend Chart ────────────────────────────────────────────────────────────

const TrendChart = ({
  data, target, minAcceptable,
}: {
  data: TrendPoint[]; target: number; minAcceptable: number;
}) => {
  if (!data.length) return <Empty description="Sin datos de tendencia" />;
  const formatted = data.map((d) => ({ ...d, date: fmtDate(d.date) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={formatted} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={[Math.max(0, minAcceptable - 5), 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
        <RechartTooltip formatter={(v) => [`${Number(v)?.toFixed(2)}%`]} />
        <Legend />
        <ReferenceLine y={target}        stroke="#1B3A6B" strokeDasharray="6 3" label={{ value: `Obj ${target}%`, fill: "#1B3A6B", fontSize: 10 }} />
        <ReferenceLine y={minAcceptable} stroke="#C62828" strokeDasharray="4 4" label={{ value: `Mín ${minAcceptable}%`, fill: "#C62828", fontSize: 10 }} />
        <Line type="monotone" dataKey="fpy"           name="FPY"           stroke="#1B3A6B" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="overall_yield" name="Overall Yield" stroke="#2E7D32" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Pareto Chart ───────────────────────────────────────────────────────────

const ParetoChart = ({ data }: { data: ParetoPoint[] }) => {
  if (!data.length) return <Empty description="Sin datos de defectos" />;
  const formatted = data.map((d) => ({
    name:       d.defect_code,
    fullName:   d.defect_type_name,
    quantity:   d.quantity,
    cumulative: d.cumulative_pct,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={formatted} margin={{ top: 8, right: 40, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis yAxisId="left"  orientation="left"  tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
        <RechartTooltip
          formatter={(v, name) =>
            name === "Acumulado" ? [`${Number(v).toFixed(1)}%`, name] : [v, name]
          }
        />
        <Legend />
        <Bar      yAxisId="left"  dataKey="quantity"   name="Cantidad"  fill="#1B3A6B" />
        <RLine    yAxisId="right" dataKey="cumulative" name="Acumulado" stroke="#C62828" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────

export const QCProjectDetail = () => {
  const { message } = App.useApp();
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const projectId   = Number(id);

  const [project,     setProject]     = useState<QCProject | null>(null);
  const [stats,       setStats]       = useState<QCProjectStats | null>(null);
  const [trend,       setTrend]       = useState<TrendPoint[]>([]);
  const [pareto,      setPareto]      = useState<ParetoPoint[]>([]);
  const [inspections, setInspections] = useState<QCInspection[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [assignModal, setAssignModal] = useState(false);
  const [assignForm]  = Form.useForm();
  const [assigning,   setAssigning]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: proj },
        { data: st },
        { data: tr },
        { data: par },
        { data: insps },
        { data: asgns },
        { data: emps },
      ] = await Promise.all([
        axiosInstance.get(`/qc/projects/${projectId}`),
        axiosInstance.get(`/qc/projects/${projectId}/stats`),
        axiosInstance.get(`/qc/projects/${projectId}/trend`),
        axiosInstance.get(`/qc/projects/${projectId}/pareto`),
        axiosInstance.get(`/qc/inspections/`, { params: { project_id: projectId, limit: 100 } }),
        axiosInstance.get(`/qc/projects/${projectId}/assignments/`),
        axiosInstance.get("/employees", { params: { limit: 300 } }),
      ]);
      setProject(proj);
      setStats(st);
      setTrend(Array.isArray(tr) ? tr : []);
      setPareto(Array.isArray(par) ? par : []);
      setInspections(Array.isArray(insps) ? insps : []);
      setAssignments(Array.isArray(asgns) ? asgns : asgns?.items ?? []);
      const empList = Array.isArray(emps) ? emps : emps?.items ?? [];
      setEmployees(empList);
    } catch {
      message.error("Error cargando detalle del proyecto");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (inspId: number, approved: boolean) => {
    try {
      await axiosInstance.patch(`/qc/inspections/${inspId}/approve`, {
        approved,
        comment: approved ? "Aprobado desde portal" : "Rechazado desde portal",
      });
      message.success(approved ? "Registro aprobado" : "Registro rechazado");
      const { data } = await axiosInstance.get(`/qc/inspections/`, { params: { project_id: projectId, limit: 100 } });
      setInspections(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      message.error(detail ?? "Error");
    }
  };

  const handleAssign = async (values: { employee_id: number }) => {
    setAssigning(true);
    try {
      await axiosInstance.post(`/qc/projects/${projectId}/assignments/`, values);
      message.success("Inspector asignado");
      setAssignModal(false);
      assignForm.resetFields();
      const { data } = await axiosInstance.get(`/qc/projects/${projectId}/assignments/`);
      setAssignments(Array.isArray(data) ? data : data?.items ?? []);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      message.error(detail ?? "Error al asignar");
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveAssignment = async (assignId: number) => {
    try {
      await axiosInstance.delete(`/qc/assignments/${assignId}`);
      message.success("Asignación eliminada");
      setAssignments((prev) => prev.filter((a) => a.id !== assignId));
    } catch {
      message.error("Error al eliminar asignación");
    }
  };

  const downloadReport = async (fmt: "excel" | "pdf") => {
    try {
      const resp = await axiosInstance.get(
        `/reports/qc/projects/${projectId}/${fmt}`,
        { responseType: "blob" },
      );
      const ext      = fmt === "excel" ? "xlsx" : "pdf";
      const url      = window.URL.createObjectURL(new Blob([resp.data]));
      const link     = document.createElement("a");
      link.href      = url;
      link.download  = `reporte_qc_proyecto_${projectId}.${ext}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error("Error generando reporte");
    }
  };

  const requestAI = async () => {
    try {
      await axiosInstance.post(`/ai/projects/${projectId}/analyze`);
      message.info("Análisis IA iniciado en segundo plano. Regresa en unos minutos.");
    } catch {
      message.error("Error iniciando análisis IA");
    }
  };

  if (loading) return <Spin style={{ display: "block", margin: "120px auto" }} />;
  if (!project) return <Alert type="error" message="Proyecto no encontrado" />;

  const target = parseFloat(String(project.target_yield));
  const minAcc = parseFloat(String(project.min_acceptable_yield));

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/quality-control/projects")} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ExperimentOutlined style={{ fontSize: 22, color: "#1B3A6B" }} />
            <Typography.Title level={4} style={{ margin: 0 }}>{project.name}</Typography.Title>
            <Tag color={project.status === "active" ? "green" : "default"}>
              {project.status === "active" ? "Activo" : project.status}
            </Tag>
            <YieldStatusBadge status={stats?.yield_status} />
          </div>
          <Typography.Text type="secondary">NP: {project.part_number} · Objetivo: {target}% · Mín: {minAcc}%</Typography.Text>
        </div>
        <Space>
          <Tooltip title="Recargar">
            <Button icon={<ReloadOutlined />} onClick={load} />
          </Tooltip>
          <Tooltip title="Solicitar análisis IA">
            <Button icon={<RobotOutlined />} onClick={requestAI}>Análisis IA</Button>
          </Tooltip>
          <Button icon={<DownloadOutlined />} onClick={() => downloadReport("excel")}>Excel</Button>
          <Button icon={<DownloadOutlined />} type="primary" onClick={() => downloadReport("pdf")}>PDF</Button>
        </Space>
      </div>

      {/* KPI row */}
      {stats && (
        <Row gutter={12} style={{ marginBottom: 20 }}>
          <Col span={4}>
            <KpiCard title="FPY Promedio" value={stats.avg_fpy} suffix="%" color={YIELD_COLOR[stats.yield_status] ?? "#1B3A6B"} />
          </Col>
          <Col span={4}>
            <KpiCard title="Overall Yield" value={stats.avg_overall_yield} suffix="%" color="#2E7D32" />
          </Col>
          <Col span={4}>
            <KpiCard title="DPMO" value={stats.current_dpmo} suffix="" precision={0} color="#6A1B9A" />
          </Col>
          <Col span={4}>
            <KpiCard title="PPM" value={stats.current_ppm} suffix="" precision={0} color="#00838F" />
          </Col>
          <Col span={4}>
            <KpiCard title="Inspeccionado" value={stats.total_inspected} suffix=" pzas" precision={0} color="#1B3A6B" />
          </Col>
          <Col span={4}>
            <KpiCard title="Días bajo target" value={stats.below_target_days} suffix=" días" precision={0} color={stats.below_target_days > 0 ? "#C62828" : "#2E7D32"} />
          </Col>
        </Row>
      )}

      {/* Tabs */}
      <Tabs
        defaultActiveKey="dashboard"
        items={[
          {
            key: "dashboard",
            label: "Dashboard",
            children: (
              <Row gutter={16}>
                <Col span={14}>
                  <Card title="Tendencia FPY" size="small">
                    <TrendChart data={trend} target={target} minAcceptable={minAcc} />
                  </Card>
                </Col>
                <Col span={10}>
                  <Card title="Pareto de Defectos" size="small">
                    <ParetoChart data={pareto} />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "inspections",
            label: `Registros (${inspections.length})`,
            children: (
              <Table
                dataSource={inspections}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 20 }}
              >
                <Table.Column title="Fecha" dataIndex="inspection_date"
                  render={(v) => new Date(v).toLocaleDateString("es-MX")} />
                <Table.Column title="Turno" dataIndex="shift"
                  render={(v) => SHIFT_LABEL[v] ?? v} />
                <Table.Column title="Inspector" dataIndex="employee_name" render={(v) => v ?? "—"} />
                <Table.Column title="Insp." dataIndex="total_inspected" align="center" />
                <Table.Column title="Rech." dataIndex="total_rejected" align="center" />
                <Table.Column title="FPY" dataIndex="fpy" align="center"
                  render={(v) => {
                    if (v == null) return "—";
                    const fv = parseFloat(v);
                    const color = fv >= target ? "#2E7D32" : fv >= minAcc ? "#F9A825" : "#C62828";
                    return <Typography.Text strong style={{ color }}>{fv.toFixed(2)}%</Typography.Text>;
                  }}
                />
                <Table.Column title="DPMO" dataIndex="dpmo" align="center"
                  render={(v) => v != null ? Math.round(parseFloat(v)).toLocaleString() : "—"} />
                <Table.Column title="Estado" dataIndex="status"
                  render={(v) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] ?? v}</Tag>}
                />
                <Table.Column title="Acciones" align="center"
                  render={(_: unknown, record: QCInspection) =>
                    record.status === "submitted" ? (
                      <Space size={4}>
                        <Tooltip title="Aprobar">
                          <Button
                            size="small" type="primary"
                            icon={<CheckCircleOutlined />}
                            onClick={() => handleApprove(record.id, true)}
                          />
                        </Tooltip>
                        <Tooltip title="Rechazar">
                          <Button
                            size="small" danger
                            icon={<CloseCircleOutlined />}
                            onClick={() => handleApprove(record.id, false)}
                          />
                        </Tooltip>
                      </Space>
                    ) : null
                  }
                />
              </Table>
            ),
          },
          {
            key: "assignments",
            label: `Inspectores (${assignments.filter((a) => a.is_active).length})`,
            children: (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <Button
                    type="primary"
                    icon={<UserAddOutlined />}
                    onClick={() => setAssignModal(true)}
                  >
                    Asignar inspector
                  </Button>
                </div>
                <Table dataSource={assignments} rowKey="id" size="small">
                  <Table.Column title="Inspector" dataIndex="employee_name"
                    render={(v, record: Assignment) => {
                      const emp = employees.find((e) => e.id === record.employee_id);
                      return v ?? emp?.name ?? `ID ${record.employee_id}`;
                    }}
                  />
                  <Table.Column title="Estado" dataIndex="is_active"
                    render={(v) => <Tag color={v ? "green" : "default"}>{v ? "Activo" : "Inactivo"}</Tag>}
                  />
                  <Table.Column title="Acciones" align="center"
                    render={(_: unknown, record: Assignment) => (
                      <Tooltip title="Eliminar asignación">
                        <Button
                          size="small" danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveAssignment(record.id)}
                        />
                      </Tooltip>
                    )}
                  />
                </Table>
              </>
            ),
          },
          {
            key: "pareto-table",
            label: "Defectos",
            children: (
              <Table dataSource={pareto} rowKey="defect_code" size="small">
                <Table.Column title="Código"   dataIndex="defect_code"      />
                <Table.Column title="Defecto"  dataIndex="defect_type_name" />
                <Table.Column title="Severidad" dataIndex="severity"
                  render={(v) => {
                    const color = v === "critical" ? "red" : v === "major" ? "orange" : "gold";
                    const label = v === "critical" ? "Crítico" : v === "major" ? "Mayor" : "Menor";
                    return <Tag color={color}>{label}</Tag>;
                  }}
                />
                <Table.Column title="Cantidad"  dataIndex="quantity"       align="right" />
                <Table.Column title="% del total" dataIndex="percentage"   align="right"
                  render={(v) => `${v.toFixed(2)}%`} />
                <Table.Column title="% acumulado" dataIndex="cumulative_pct" align="right"
                  render={(v) => `${v.toFixed(2)}%`} />
              </Table>
            ),
          },
        ]}
      />

      {/* Assign Modal */}
      <Modal
        open={assignModal}
        title="Asignar inspector al proyecto"
        onOk={() => assignForm.submit()}
        onCancel={() => { setAssignModal(false); assignForm.resetFields(); }}
        confirmLoading={assigning}
        okText="Asignar"
      >
        <Form form={assignForm} layout="vertical" onFinish={handleAssign} style={{ marginTop: 16 }}>
          <Form.Item
            label="Inspector (empleado)"
            name="employee_id"
            rules={[{ required: true, message: "Selecciona un empleado" }]}
          >
            <Select
              showSearch
              placeholder="Buscar empleado..."
              filterOption={(input, option) =>
                (String(option?.label ?? "")).toLowerCase().includes(input.toLowerCase())
              }
              options={employees.map((e) => ({
                label: `${e.name} (${e.employee_no})`,
                value: e.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
