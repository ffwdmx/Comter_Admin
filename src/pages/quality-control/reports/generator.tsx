// src/pages/quality-control/reports/generator.tsx
import { useState, useEffect } from "react";
import {
  Card, Row, Col, Select, DatePicker, Button, Typography, Space,
  Divider, Alert, Statistic, Table, Tag, message, Spin,
} from "antd";
import {
  FileExcelOutlined, FilePdfOutlined, ReloadOutlined, BarChartOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { axiosInstance } from "../../../providers/dataProvider";

interface QCProject {
  id: number; name: string; part_number: string; status: string;
  target_yield: number; min_acceptable_yield: number; client_name?: string;
}

interface QCProjectStats {
  total_inspected: number; total_rejected: number;
  avg_fpy?: number; avg_overall_yield?: number;
  current_dpmo?: number; current_ppm?: number;
  inspections_count: number; last_inspection_date?: string;
  yield_status: string; below_target_days: number;
}

interface ParetoPoint {
  defect_type_name: string; defect_code: string; severity: string;
  quantity: number; percentage: number; cumulative_pct: number;
}

const YIELD_COLOR: Record<string, string> = {
  green: "#2E7D32", yellow: "#F9A825", red: "#C62828",
};
const YIELD_LABEL: Record<string, string> = {
  green: "En objetivo", yellow: "Atención requerida", red: "Situación crítica",
};
const SEV_COLOR: Record<string, string> = {
  critical: "red", major: "orange", minor: "gold",
};

export const ReportGenerator = () => {
  const [projects,  setProjects]  = useState<QCProject[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [loading,   setLoading]   = useState(false);
  const [stats,     setStats]     = useState<QCProjectStats | null>(null);
  const [pareto,    setPareto]    = useState<ParetoPoint[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingPdf,   setDownloadingPdf]   = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get("/qc/projects/");
      setProjects(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (pid: number) => {
    setStatsLoading(true);
    try {
      const [{ data: st }, { data: par }] = await Promise.all([
        axiosInstance.get(`/qc/projects/${pid}/stats`),
        axiosInstance.get(`/qc/projects/${pid}/pareto`),
      ]);
      setStats(st);
      setPareto(Array.isArray(par) ? par : []);
    } catch {
      message.error("Error cargando estadísticas");
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  useEffect(() => {
    if (projectId) loadStats(projectId);
    else { setStats(null); setPareto([]); }
  }, [projectId]);

  const selectedProject = projects.find((p) => p.id === projectId);

  const download = async (fmt: "excel" | "pdf") => {
    if (!projectId) { message.warning("Selecciona un proyecto"); return; }
    const setter = fmt === "excel" ? setDownloadingExcel : setDownloadingPdf;
    setter(true);
    try {
      const params: Record<string, string> = {};
      if (dateRange[0]) params.date_from = dateRange[0].format("YYYY-MM-DD");
      if (dateRange[1]) params.date_to   = dateRange[1].format("YYYY-MM-DD");

      const resp = await axiosInstance.get(
        `/reports/qc/projects/${projectId}/${fmt}`,
        { responseType: "blob", params },
      );
      const ext      = fmt === "excel" ? "xlsx" : "pdf";
      const url      = window.URL.createObjectURL(new Blob([resp.data]));
      const link     = document.createElement("a");
      link.href      = url;
      const name     = selectedProject?.name.replace(/\s+/g, "_") ?? "proyecto";
      link.download  = `reporte_qc_${name}_${dayjs().format("YYYY-MM-DD")}.${ext}`;
      link.click();
      window.URL.revokeObjectURL(url);
      message.success(`Reporte ${fmt.toUpperCase()} descargado`);
    } catch {
      message.error("Error generando reporte. Verifica que el proyecto tenga registros.");
    } finally {
      setter(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Typography.Title level={4} style={{ marginBottom: 20 }}>
        <BarChartOutlined /> Generador de Reportes QC
      </Typography.Title>

      {/* Selector */}
      <Card style={{ marginBottom: 20 }}>
        <Typography.Text strong style={{ display: "block", marginBottom: 12 }}>
          Configuración del reporte
        </Typography.Text>
        <Row gutter={16} align="bottom">
          <Col span={10}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Proyecto *</Typography.Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              placeholder="Selecciona un proyecto"
              loading={loading}
              showSearch
              allowClear
              value={projectId}
              onChange={setProjectId}
              filterOption={(input, option) =>
                (String(option?.label ?? "")).toLowerCase().includes(input.toLowerCase())
              }
              options={projects.map((p) => ({
                label: `${p.name} — NP: ${p.part_number}`,
                value: p.id,
              }))}
            />
          </Col>
          <Col span={10}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Rango de fechas (opcional)</Typography.Text>
            <DatePicker.RangePicker
              style={{ width: "100%", marginTop: 4 }}
              format="DD/MM/YYYY"
              value={dateRange}
              onChange={(dates) => setDateRange(dates ? [dates[0], dates[1]] : [null, null])}
              placeholder={["Fecha inicio", "Fecha fin"]}
            />
          </Col>
          <Col span={4}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => projectId && loadStats(projectId)}
              disabled={!projectId}
            >
              Actualizar
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Project summary */}
      {selectedProject && (
        <Alert
          type="info"
          style={{ marginBottom: 16 }}
          message={
            <Space>
              <Typography.Text strong>{selectedProject.name}</Typography.Text>
              <Typography.Text type="secondary">NP: {selectedProject.part_number}</Typography.Text>
              {selectedProject.client_name && (
                <Typography.Text type="secondary">· {selectedProject.client_name}</Typography.Text>
              )}
            </Space>
          }
          description={`Objetivo FPY: ${parseFloat(String(selectedProject.target_yield)).toFixed(2)}% · Mínimo: ${parseFloat(String(selectedProject.min_acceptable_yield)).toFixed(2)}%`}
        />
      )}

      {/* Stats preview */}
      {projectId && (
        <Spin spinning={statsLoading}>
          {stats && (
            <>
              <Card title="Vista previa de KPIs" style={{ marginBottom: 20 }}>
                <Row gutter={16}>
                  <Col span={4}>
                    <Statistic
                      title="FPY Promedio"
                      value={stats.avg_fpy != null ? stats.avg_fpy.toFixed(2) : "—"}
                      suffix={stats.avg_fpy != null ? "%" : ""}
                      valueStyle={{ color: YIELD_COLOR[stats.yield_status] ?? "#1B3A6B", fontWeight: 900 }}
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="Overall Yield"
                      value={stats.avg_overall_yield != null ? stats.avg_overall_yield.toFixed(2) : "—"}
                      suffix={stats.avg_overall_yield != null ? "%" : ""}
                      valueStyle={{ color: "#2E7D32", fontWeight: 900 }}
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="DPMO"
                      value={stats.current_dpmo != null ? Math.round(stats.current_dpmo) : "—"}
                      valueStyle={{ color: "#6A1B9A", fontWeight: 900 }}
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="PPM"
                      value={stats.current_ppm != null ? Math.round(stats.current_ppm) : "—"}
                      valueStyle={{ color: "#00838F", fontWeight: 900 }}
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="Total inspeccionado"
                      value={stats.total_inspected.toLocaleString()}
                      suffix="pzas"
                      valueStyle={{ fontWeight: 900 }}
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="Estado general"
                      valueRender={() => (
                        <Tag
                          color={stats.yield_status === "green" ? "success" : stats.yield_status === "yellow" ? "warning" : "error"}
                          style={{ fontSize: 14, padding: "4px 10px" }}
                        >
                          {YIELD_LABEL[stats.yield_status] ?? stats.yield_status}
                        </Tag>
                      )}
                    />
                  </Col>
                </Row>
              </Card>

              {pareto.length > 0 && (
                <Card title="Top defectos (Pareto)" size="small" style={{ marginBottom: 20 }}>
                  <Table
                    dataSource={pareto.slice(0, 8)}
                    rowKey="defect_code"
                    size="small"
                    pagination={false}
                  >
                    <Table.Column title="Código"    dataIndex="defect_code"      />
                    <Table.Column title="Defecto"   dataIndex="defect_type_name" />
                    <Table.Column
                      title="Severidad"
                      dataIndex="severity"
                      render={(v) => (
                        <Tag color={SEV_COLOR[v]}>
                          {v === "critical" ? "Crítico" : v === "major" ? "Mayor" : "Menor"}
                        </Tag>
                      )}
                    />
                    <Table.Column title="Cant."     dataIndex="quantity"          align="right" />
                    <Table.Column title="% total"   dataIndex="percentage"        align="right"
                      render={(v) => `${v.toFixed(2)}%`} />
                    <Table.Column title="% acum."   dataIndex="cumulative_pct"    align="right"
                      render={(v) => `${v.toFixed(2)}%`} />
                  </Table>
                </Card>
              )}
            </>
          )}

          {!stats && !statsLoading && projectId && (
            <Alert
              type="warning"
              message="Sin datos de inspección"
              description="Este proyecto aún no tiene registros de inspección aprobados o enviados."
            />
          )}
        </Spin>
      )}

      {/* Download buttons */}
      <Divider />
      <Card>
        <Typography.Text strong style={{ display: "block", marginBottom: 16 }}>
          Descargar reporte completo
        </Typography.Text>
        <Space size={16}>
          <Button
            size="large"
            icon={<FileExcelOutlined />}
            style={{ color: "#217346", borderColor: "#217346" }}
            loading={downloadingExcel}
            disabled={!projectId}
            onClick={() => download("excel")}
          >
            Descargar Excel
          </Button>
          <Button
            size="large"
            type="primary"
            danger
            icon={<FilePdfOutlined />}
            loading={downloadingPdf}
            disabled={!projectId}
            onClick={() => download("pdf")}
          >
            Descargar PDF
          </Button>
        </Space>
        <Typography.Text type="secondary" style={{ display: "block", marginTop: 12, fontSize: 12 }}>
          El reporte Excel incluye 4 hojas: Resumen Ejecutivo, Registros Diarios, Defectos Detallados y Pareto.
          El PDF incluye gráficas de tendencia y análisis IA (si está disponible).
        </Typography.Text>
      </Card>
    </div>
  );
};
