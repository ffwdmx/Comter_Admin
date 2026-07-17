// src/pages/quality-control/inspections/review.tsx
import { useState, useEffect } from "react";
import {
  Table, Tag, Typography, Button, Space, Select, DatePicker, Input,
  Tooltip, App, Modal, Form, Drawer, Descriptions, Statistic,
  Row, Col, Divider, InputNumber,
} from "antd";
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined,
  SearchOutlined, ReloadOutlined, WarningOutlined, SendOutlined,
  EditOutlined, PlusOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { axiosInstance } from "../../../providers/dataProvider";

interface QCInspection {
  id: number; project_id: number; employee_id: number;
  inspection_date: string; shift: string; status: string;
  lot_number?: string; total_inspected: number; total_rejected: number;
  rejected_critical: number; rejected_major: number; rejected_minor: number;
  reworked_qty: number; rework_passed: number; rework_failed: number;
  fpy?: number; overall_yield?: number; dpmo?: number; ppm?: number;
  observations?: string; corrective_actions?: string;
  employee_name?: string; project_name?: string;
  yield_status?: string; review_comment?: string;
  defect_records?: DefectRecord[];
}

interface DefectRecord {
  id: number; defect_type_id: number; defect_type_name?: string;
  defect_code?: string; severity: string; quantity: number; location_zone?: string;
}

interface QCProject { id: number; name: string; }

interface QCDefectType {
  id: number; code: string; name: string;
  severity_default: string; category: string;
  project_id: number | null; is_active: boolean;
}

interface Employee { id: number; name: string; employee_no: string; }

const SHIFT_LABEL: Record<string, string> = {
  morning: "Mañana", afternoon: "Tarde", night: "Noche",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "default", submitted: "blue", approved: "green", rejected: "red",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador", submitted: "Pendiente revisión", approved: "Aprobado", rejected: "Rechazado",
};
const SEV_COLOR: Record<string, string> = {
  critical: "red", major: "orange", minor: "gold",
};
const SEV_LABEL: Record<string, string> = {
  critical: "Crítico", major: "Mayor", minor: "Menor",
};
const YIELD_COLOR: Record<string, string> = {
  green: "#2E7D32", yellow: "#F9A825", red: "#C62828",
};

export const InspectionReview = () => {
  const { message } = App.useApp();
  const [inspections, setInspections] = useState<QCInspection[]>([]);
  const [projects,    setProjects]    = useState<QCProject[]>([]);
  const [loading,     setLoading]     = useState(false);

  // Filters
  const [projectFilter, setProjectFilter]   = useState<number | null>(null);
  const [statusFilter,  setStatusFilter]    = useState<string>("submitted");
  const [dateFrom,      setDateFrom]        = useState<string | null>(null);
  const [dateTo,        setDateTo]          = useState<string | null>(null);
  const [search,        setSearch]          = useState("");

  // Detail drawer
  const [detailInsp,    setDetailInsp]    = useState<QCInspection | null>(null);
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Review modal
  const [reviewId,      setReviewId]      = useState<number | null>(null);
  const [reviewApprove, setReviewApprove] = useState(true);
  const [reviewForm]  = Form.useForm();
  const [reviewing,   setReviewing]  = useState(false);

  // Edit drawer
  const [editInsp, setEditInsp] = useState<QCInspection | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [saving,   setSaving]   = useState(false);

  // ── Create drawer ──────────────────────────────────────────────────────
  const [createOpen,     setCreateOpen]     = useState(false);
  const [createForm]   = Form.useForm();
  const [creating,       setCreating]       = useState(false);
  const [defectTypes,    setDefectTypes]    = useState<QCDefectType[]>([]);
  const [loadingDefs,    setLoadingDefs]    = useState(false);
  const [employees,      setEmployees]      = useState<Employee[]>([]);
  const [selectedProjId, setSelectedProjId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 200 };
      if (projectFilter) params.project_id = projectFilter;
      if (statusFilter)  params.status     = statusFilter;
      if (dateFrom)      params.date_from  = dateFrom;
      if (dateTo)        params.date_to    = dateTo;

      const [{ data: insps }, { data: projs }] = await Promise.all([
        axiosInstance.get("/qc/inspections/", { params }),
        axiosInstance.get("/qc/projects/"),
      ]);
      setInspections(Array.isArray(insps) ? insps : []);
      setProjects(Array.isArray(projs) ? projs : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectFilter, statusFilter, dateFrom, dateTo]);

  // Cargar empleados una vez al abrir el drawer de creación
  const openCreate = async () => {
    createForm.resetFields();
    setDefectTypes([]);
    setSelectedProjId(null);
    setCreateOpen(true);
    if (employees.length === 0) {
      try {
        const { data } = await axiosInstance.get("/employees", { params: { limit: 300 } });
        setEmployees(Array.isArray(data) ? data : (data?.items ?? []));
      } catch {
        // no crítico — el selector mostrará lista vacía
      }
    }
  };

  const onProjectSelect = async (projectId: number) => {
    setSelectedProjId(projectId);
    setDefectTypes([]);
    // Limpiar las cantidades de defectos previas
    const fields: Record<string, number> = {};
    defectTypes.forEach((dt) => { fields[`defect_${dt.id}`] = 0; });
    createForm.setFieldsValue(fields);

    setLoadingDefs(true);
    try {
      const { data } = await axiosInstance.get("/qc/defect-types/", {
        params: { project_id: projectId },
      });
      setDefectTypes(Array.isArray(data) ? data.filter((d: QCDefectType) => d.is_active) : []);
    } catch {
      message.error("No se pudieron cargar los tipos de defecto del proyecto.");
    } finally {
      setLoadingDefs(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedProjId) { message.warning("Selecciona un proyecto."); return; }
    let values: Record<string, unknown>;
    try {
      values = await createForm.validateFields();
    } catch {
      return;
    }

    // Calcular rechazados por severidad a partir de los defectos capturados
    let rejCritical = 0, rejMajor = 0, rejMinor = 0;
    const defectsToAdd: { defect_type_id: number; quantity: number; severity: string }[] = [];

    for (const dt of defectTypes) {
      const qty = Number(values[`defect_${dt.id}`] ?? 0);
      if (qty > 0) {
        defectsToAdd.push({ defect_type_id: dt.id, quantity: qty, severity: dt.severity_default });
        if (dt.severity_default === "critical") rejCritical += qty;
        else if (dt.severity_default === "major") rejMajor += qty;
        else rejMinor += qty;
      }
    }

    const totalInsp = Number(values.total_inspected ?? 0);
    if (totalInsp <= 0) { message.warning("El total inspeccionado debe ser mayor a 0."); return; }
    if (rejCritical + rejMajor + rejMinor > totalInsp) {
      message.warning("La suma de defectos supera el total inspeccionado.");
      return;
    }

    const inspDate = (values.inspection_date as Dayjs).format("YYYY-MM-DD");

    setCreating(true);
    try {
      // 1. Crear la inspección
      const { data: newInsp } = await axiosInstance.post("/qc/inspections/", {
        project_id:        selectedProjId,
        employee_id:       values.employee_id ?? null,
        inspection_date:   inspDate,
        shift:             values.shift,
        lot_number:        values.lot_number || null,
        total_inspected:   totalInsp,
        rejected_critical: rejCritical,
        rejected_major:    rejMajor,
        rejected_minor:    rejMinor,
        observations:      values.observations || null,
      });

      // 2. Registrar defectos individuales
      for (const d of defectsToAdd) {
        await axiosInstance.post(`/qc/inspections/${newInsp.id}/defects`, d);
      }

      message.success("Registro de inspección creado correctamente.");
      setCreateOpen(false);
      createForm.resetFields();
      setDefectTypes([]);
      setSelectedProjId(null);
      load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      message.error(detail ?? "Error al crear el registro.");
    } finally {
      setCreating(false);
    }
  };

  // ── Resto de handlers ──────────────────────────────────────────────────

  const openDetail = async (insp: QCInspection) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const { data } = await axiosInstance.get(`/qc/inspections/${insp.id}`);
      setDetailInsp(data);
    } finally {
      setDetailLoading(false);
    }
  };

  const openReview = (id: number, approve: boolean) => {
    setReviewId(id);
    setReviewApprove(approve);
    reviewForm.resetFields();
  };

  const openEdit = (insp: QCInspection) => {
    setEditInsp(insp);
    editForm.setFieldsValue({
      lot_number:         insp.lot_number ?? "",
      total_inspected:    insp.total_inspected,
      rejected_critical:  insp.rejected_critical,
      rejected_major:     insp.rejected_major,
      rejected_minor:     insp.rejected_minor,
      reworked_qty:       insp.reworked_qty,
      rework_passed:      insp.rework_passed,
      observations:       insp.observations ?? "",
      corrective_actions: insp.corrective_actions ?? "",
    });
    setEditOpen(true);
  };

  const submitEdit = async (values: Record<string, unknown>) => {
    if (!editInsp) return;
    setSaving(true);
    try {
      await axiosInstance.patch(`/qc/inspections/${editInsp.id}`, values);
      message.success("Registro actualizado. Regresó a estado Pendiente de revisión.");
      setEditOpen(false);
      setEditInsp(null);
      load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      message.error(detail ?? "Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  };

  const submitDraft = async (id: number) => {
    try {
      await axiosInstance.patch(`/qc/inspections/${id}/submit`);
      message.success("Registro enviado para revisión");
      load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      message.error(detail ?? "Error al enviar");
    }
  };

  const submitReview = async (values: { comment?: string }) => {
    if (!reviewId) return;
    setReviewing(true);
    try {
      await axiosInstance.patch(`/qc/inspections/${reviewId}/approve`, {
        approved: reviewApprove,
        comment:  values.comment ?? (reviewApprove ? "Aprobado" : "Rechazado"),
      });
      message.success(reviewApprove ? "Registro aprobado" : "Registro rechazado");
      setReviewId(null);
      reviewForm.resetFields();
      load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      message.error(detail ?? "Error al procesar");
    } finally {
      setReviewing(false);
    }
  };

  const filtered = inspections.filter((i) => {
    const q = search.toLowerCase();
    return (
      !search ||
      (i.project_name ?? "").toLowerCase().includes(q) ||
      (i.employee_name ?? "").toLowerCase().includes(q)
    );
  });

  const pendingCount = inspections.filter((i) => i.status === "submitted").length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Revisión de Inspecciones QC
          </Typography.Title>
          {pendingCount > 0 && statusFilter === "submitted" && (
            <Typography.Text type="warning">
              <WarningOutlined /> {pendingCount} registro{pendingCount > 1 ? "s" : ""} pendiente{pendingCount > 1 ? "s" : ""} de revisión
            </Typography.Text>
          )}
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
          >
            Nuevo Registro
          </Button>
          <Tooltip title="Recargar">
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
          </Tooltip>
        </Space>
      </div>

      {/* Filters */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Proyecto o inspector..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
        <Select
          placeholder="Proyecto"
          allowClear
          style={{ width: 220 }}
          value={projectFilter}
          onChange={setProjectFilter}
          showSearch
          filterOption={(input, option) =>
            (String(option?.label ?? "")).toLowerCase().includes(input.toLowerCase())
          }
          options={projects.map((p) => ({ label: p.name, value: p.id }))}
        />
        <Select
          style={{ width: 180 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: "Pendientes",  value: "submitted" },
            { label: "Aprobados",   value: "approved"  },
            { label: "Rechazados",  value: "rejected"  },
            { label: "Borradores",  value: "draft"     },
            { label: "Todos",       value: ""          },
          ]}
        />
        <DatePicker
          placeholder="Desde"
          format="DD/MM/YYYY"
          onChange={(d) => setDateFrom(d ? d.format("YYYY-MM-DD") : null)}
          value={dateFrom ? dayjs(dateFrom) : null}
        />
        <DatePicker
          placeholder="Hasta"
          format="DD/MM/YYYY"
          onChange={(d) => setDateTo(d ? d.format("YYYY-MM-DD") : null)}
          value={dateTo ? dayjs(dateTo) : null}
        />
      </Space>

      <Table
        dataSource={filtered}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        size="small"
        rowClassName={(_: QCInspection) => ""}
      >
        <Table.Column
          title="Proyecto"
          dataIndex="project_name"
          render={(v, record: QCInspection) => (
            <Typography.Text strong>{v ?? `ID ${record.project_id}`}</Typography.Text>
          )}
        />
        <Table.Column title="Inspector"  dataIndex="employee_name" render={(v) => v ?? "—"} />
        <Table.Column
          title="Fecha"
          dataIndex="inspection_date"
          render={(v) => dayjs(v, "YYYY-MM-DD").format("DD/MM/YYYY")}
        />
        <Table.Column title="Turno" dataIndex="shift" render={(v) => SHIFT_LABEL[v] ?? v} />
        <Table.Column title="Insp." dataIndex="total_inspected" align="center" />
        <Table.Column title="Rech." dataIndex="total_rejected"  align="center" />
        <Table.Column
          title="FPY"
          dataIndex="fpy"
          align="center"
          render={(v, record: QCInspection) => {
            if (v == null) return "—";
            const color = YIELD_COLOR[record.yield_status ?? ""] ?? "#1B3A6B";
            return (
              <Typography.Text strong style={{ color }}>
                {parseFloat(v).toFixed(2)}%
              </Typography.Text>
            );
          }}
        />
        <Table.Column
          title="Estado"
          dataIndex="status"
          align="center"
          render={(v) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] ?? v}</Tag>}
        />
        <Table.Column
          title="Acciones"
          align="center"
          render={(_: unknown, record: QCInspection) => (
            <Space size={4}>
              <Tooltip title="Ver detalle">
                <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
              </Tooltip>
              <Tooltip title="Editar registro">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
              </Tooltip>
              {record.status === "draft" && (
                <Tooltip title="Enviar para revisión">
                  <Button
                    size="small"
                    icon={<SendOutlined />}
                    onClick={() => submitDraft(record.id)}
                  />
                </Tooltip>
              )}
              {(record.status === "submitted" || record.status === "draft") && (
                <>
                  <Tooltip title="Aprobar">
                    <Button
                      size="small" type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => openReview(record.id, true)}
                    />
                  </Tooltip>
                  <Tooltip title="Rechazar">
                    <Button
                      size="small" danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => openReview(record.id, false)}
                    />
                  </Tooltip>
                </>
              )}
            </Space>
          )}
        />
      </Table>

      {/* ── Drawer: Nuevo Registro ─────────────────────────────────────────── */}
      <Drawer
        open={createOpen}
        onClose={() => { setCreateOpen(false); createForm.resetFields(); setDefectTypes([]); setSelectedProjId(null); }}
        title="Nuevo Registro de Inspección QC"
        width={560}
        footer={
          <Space style={{ justifyContent: "flex-end", width: "100%", display: "flex" }}>
            <Button onClick={() => { setCreateOpen(false); createForm.resetFields(); setDefectTypes([]); setSelectedProjId(null); }}>
              Cancelar
            </Button>
            <Button type="primary" loading={creating} onClick={handleCreate}>
              Crear Registro
            </Button>
          </Space>
        }
      >
        <Form form={createForm} layout="vertical">
          {/* Proyecto */}
          <Form.Item
            label="Proyecto"
            name="project_id"
            rules={[{ required: true, message: "Selecciona un proyecto" }]}
          >
            <Select
              placeholder="Selecciona el proyecto..."
              showSearch
              filterOption={(input, option) =>
                (String(option?.label ?? "")).toLowerCase().includes(input.toLowerCase())
              }
              options={projects.map((p) => ({ label: p.name, value: p.id }))}
              onChange={(v) => { createForm.setFieldValue("project_id", v); onProjectSelect(v); }}
            />
          </Form.Item>

          {/* Inspector */}
          <Form.Item label="Inspector" name="employee_id">
            <Select
              placeholder="Inspector (opcional — por defecto tú mismo)"
              showSearch
              allowClear
              filterOption={(input, option) =>
                (String(option?.label ?? "")).toLowerCase().includes(input.toLowerCase())
              }
              options={employees.map((e) => ({
                label: `${e.employee_no} — ${e.name}`,
                value: e.id,
              }))}
            />
          </Form.Item>

          {/* Fecha y Turno */}
          <Row gutter={12}>
            <Col span={13}>
              <Form.Item
                label="Fecha de inspección"
                name="inspection_date"
                rules={[{ required: true, message: "Selecciona la fecha" }]}
                initialValue={dayjs()}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={11}>
              <Form.Item
                label="Turno"
                name="shift"
                rules={[{ required: true, message: "Selecciona el turno" }]}
              >
                <Select
                  options={[
                    { label: "Mañana",  value: "morning"   },
                    { label: "Tarde",   value: "afternoon" },
                    { label: "Noche",   value: "night"     },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Lote */}
          <Form.Item label="Número de lote" name="lot_number">
            <Input placeholder="Ej. L-2025-001 (opcional)" />
          </Form.Item>

          {/* Total inspeccionado */}
          <Form.Item
            label="Total inspeccionado"
            name="total_inspected"
            rules={[{ required: true, message: "Requerido" }]}
          >
            <InputNumber min={1} style={{ width: "100%" }} placeholder="Piezas inspeccionadas" />
          </Form.Item>

          {/* Defectos por tipo */}
          {selectedProjId && (
            <>
              <Divider orientation="left" plain style={{ fontSize: 13 }}>
                Defectos capturados
              </Divider>

              {loadingDefs ? (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Cargando tipos de defecto...
                </Typography.Text>
              ) : defectTypes.length === 0 ? (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Sin tipos de defecto configurados para este proyecto.
                </Typography.Text>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {defectTypes.map((dt) => (
                    <div
                      key={dt.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        background: "#fafafa", borderRadius: 6,
                        padding: "6px 10px", border: "1px solid #f0f0f0",
                      }}
                    >
                      <Tag
                        color={SEV_COLOR[dt.severity_default]}
                        style={{ minWidth: 60, textAlign: "center", fontSize: 11 }}
                      >
                        {SEV_LABEL[dt.severity_default]}
                      </Tag>
                      <Typography.Text style={{ flex: 1, fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>{dt.code}</span> — {dt.name}
                      </Typography.Text>
                      <Form.Item
                        name={`defect_${dt.id}`}
                        initialValue={0}
                        style={{ margin: 0, width: 80 }}
                      >
                        <InputNumber min={0} style={{ width: "100%" }} size="small" />
                      </Form.Item>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Observaciones */}
          <Divider orientation="left" plain style={{ fontSize: 13, marginTop: 20 }}>
            Notas
          </Divider>
          <Form.Item label="Observaciones" name="observations">
            <Input.TextArea rows={3} placeholder="Observaciones generales (opcional)" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Drawer: Editar Registro ───────────────────────────────────────── */}
      <Drawer
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditInsp(null); }}
        title={`Editar registro — ${editInsp?.project_name ?? ""}`}
        width={520}
        footer={
          <Space style={{ justifyContent: "flex-end", width: "100%", display: "flex" }}>
            <Button onClick={() => { setEditOpen(false); setEditInsp(null); }}>Cancelar</Button>
            <Button type="primary" loading={saving} onClick={() => editForm.submit()}>
              Guardar cambios
            </Button>
          </Space>
        }
      >
        {editInsp && (
          <>
            {(editInsp.status === "approved" || editInsp.status === "rejected") && (
              <div style={{
                background: "#FFF3CD", border: "1px solid #FBBF24", borderRadius: 6,
                padding: "8px 12px", marginBottom: 16, fontSize: 13, color: "#92400E",
              }}>
                Al guardar, el registro regresará a <strong>Pendiente de revisión</strong> para ser aprobado nuevamente.
              </div>
            )}
            <Form form={editForm} layout="vertical" onFinish={submitEdit}>
              <Form.Item label="Número de lote" name="lot_number">
                <Input placeholder="Ej. L-2025-001" />
              </Form.Item>
              <Divider orientation="left" plain style={{ fontSize: 13 }}>Cantidades</Divider>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Total inspeccionado" name="total_inspected"
                    rules={[{ required: true, message: "Requerido" }]}>
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Rechazados críticos" name="rejected_critical">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Rechazados mayores" name="rejected_major">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Rechazados menores" name="rejected_minor">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Retrabajado" name="reworked_qty">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Retr. que pasó" name="rework_passed">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
              <Divider orientation="left" plain style={{ fontSize: 13 }}>Notas</Divider>
              <Form.Item label="Observaciones" name="observations">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item label="Acciones correctivas" name="corrective_actions">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Form>
          </>
        )}
      </Drawer>

      {/* ── Modal: Aprobar / Rechazar ─────────────────────────────────────── */}
      <Modal
        open={reviewId != null}
        title={reviewApprove ? "Aprobar registro" : "Rechazar registro"}
        onOk={() => reviewForm.submit()}
        onCancel={() => { setReviewId(null); reviewForm.resetFields(); }}
        confirmLoading={reviewing}
        okText={reviewApprove ? "Aprobar" : "Rechazar"}
        okButtonProps={{ danger: !reviewApprove }}
      >
        <Form form={reviewForm} layout="vertical" onFinish={submitReview} style={{ marginTop: 16 }}>
          <Form.Item label="Comentario (opcional)" name="comment">
            <Input.TextArea
              rows={3}
              placeholder={reviewApprove ? "Ej: Revisado y conforme" : "Ej: FPY por debajo del mínimo, requiere acción correctiva"}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Drawer: Detalle del registro ─────────────────────────────────── */}
      <Drawer
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailInsp(null); }}
        title="Detalle del Registro"
        width={600}
        loading={detailLoading}
      >
        {detailInsp && (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Proyecto"  span={2}>{detailInsp.project_name}</Descriptions.Item>
              <Descriptions.Item label="Inspector">{detailInsp.employee_name}</Descriptions.Item>
              <Descriptions.Item label="Fecha">{dayjs(detailInsp.inspection_date, "YYYY-MM-DD").format("DD/MM/YYYY")}</Descriptions.Item>
              <Descriptions.Item label="Turno">{SHIFT_LABEL[detailInsp.shift] ?? detailInsp.shift}</Descriptions.Item>
              <Descriptions.Item label="Lote">{detailInsp.lot_number ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Estado" span={2}>
                <Tag color={STATUS_COLOR[detailInsp.status]}>{STATUS_LABEL[detailInsp.status]}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider>KPIs</Divider>
            <Row gutter={12}>
              {[
                { t: "FPY",           v: detailInsp.fpy,          s: "%", c: YIELD_COLOR[detailInsp.yield_status ?? ""] ?? "#1B3A6B" },
                { t: "Overall Yield", v: detailInsp.overall_yield, s: "%", c: "#2E7D32" },
                { t: "DPMO",          v: detailInsp.dpmo,          s: "",  c: "#6A1B9A" },
                { t: "PPM",           v: detailInsp.ppm,           s: "",  c: "#00838F" },
              ].map(({ t, v, s, c }) => (
                <Col span={6} key={t}>
                  <Statistic
                    title={t}
                    value={v != null ? parseFloat(String(v)).toFixed(2) : "—"}
                    suffix={s}
                    valueStyle={{ color: c, fontSize: 18, fontWeight: 900 }}
                  />
                </Col>
              ))}
            </Row>

            <Divider>Cantidades</Divider>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Total inspeccionado">{detailInsp.total_inspected}</Descriptions.Item>
              <Descriptions.Item label="Total rechazado">{detailInsp.total_rejected}</Descriptions.Item>
              <Descriptions.Item label="Críticos">{detailInsp.rejected_critical}</Descriptions.Item>
              <Descriptions.Item label="Mayores">{detailInsp.rejected_major}</Descriptions.Item>
              <Descriptions.Item label="Menores">{detailInsp.rejected_minor}</Descriptions.Item>
              <Descriptions.Item label="Retrabajado">{detailInsp.reworked_qty}</Descriptions.Item>
            </Descriptions>

            {detailInsp.observations && (
              <>
                <Divider>Observaciones</Divider>
                <Typography.Paragraph>{detailInsp.observations}</Typography.Paragraph>
              </>
            )}

            {detailInsp.corrective_actions && (
              <>
                <Divider>Acciones correctivas</Divider>
                <Typography.Paragraph>{detailInsp.corrective_actions}</Typography.Paragraph>
              </>
            )}

            {detailInsp.defect_records && detailInsp.defect_records.length > 0 && (
              <>
                <Divider>Defectos capturados</Divider>
                <Table
                  dataSource={detailInsp.defect_records}
                  rowKey="id"
                  size="small"
                  pagination={false}
                >
                  <Table.Column title="Defecto"   dataIndex="defect_type_name" />
                  <Table.Column title="Código"    dataIndex="defect_code" />
                  <Table.Column
                    title="Severidad"
                    dataIndex="severity"
                    render={(v) => <Tag color={SEV_COLOR[v]}>{SEV_LABEL[v] ?? v}</Tag>}
                  />
                  <Table.Column title="Cant." dataIndex="quantity" align="right" />
                  <Table.Column title="Zona"  dataIndex="location_zone" render={(v) => v ?? "—"} />
                </Table>
              </>
            )}

            {detailInsp.review_comment && (
              <>
                <Divider>Comentario de revisión</Divider>
                <Typography.Paragraph type="secondary">{detailInsp.review_comment}</Typography.Paragraph>
              </>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
};
