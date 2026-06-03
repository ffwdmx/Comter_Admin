// src/pages/attendance/PendingRequests.tsx
import { useEffect, useState } from "react";
import {
  Table, Button, Tag, Space, Modal, Input, Typography,
  Badge, Tooltip, message as antMessage,
} from "antd";
import {
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { axiosInstance } from "../../providers/dataProvider";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "America/Mexico_City";

interface PendingRequest {
  id:              number;
  employee_id:     number;
  employee_name:   string | null;
  employee_no:     string | null;
  supervisor_id:   number | null;
  supervisor_name: string | null;
  type:            "check_in" | "check_out";
  timestamp:       string;
  notes:           string | null;
  created_at:      string;
}

export function PendingRequests() {
  const [data,    setData]    = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Reject modal state
  const [rejectId,     setRejectId]     = useState<number | null>(null);
  const [rejectNotes,  setRejectNotes]  = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/attendance/pending");
      setData(res.data as PendingRequest[]);
    } catch {
      antMessage.error("No se pudieron cargar las solicitudes pendientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: number) => {
    try {
      await axiosInstance.patch(`/attendance/${id}/approve`);
      antMessage.success("Solicitud aprobada.");
      load();
    } catch (e: any) {
      antMessage.error(e?.response?.data?.detail ?? "Error al aprobar.");
    }
  };

  const openReject = (id: number) => {
    setRejectId(id);
    setRejectNotes("");
  };

  const handleReject = async () => {
    if (rejectId === null) return;
    setRejectLoading(true);
    try {
      await axiosInstance.patch(`/attendance/${rejectId}/reject`, { notes: rejectNotes || null });
      antMessage.success("Solicitud rechazada.");
      setRejectId(null);
      load();
    } catch (e: any) {
      antMessage.error(e?.response?.data?.detail ?? "Error al rechazar.");
    } finally {
      setRejectLoading(false);
    }
  };

  const columns = [
    {
      title: "Empleado",
      render: (_: unknown, r: PendingRequest) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{r.employee_name ?? "—"}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.employee_no ?? "—"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Supervisor",
      dataIndex: "supervisor_name",
      render: (v: string | null) => v ?? "—",
    },
    {
      title: "Tipo",
      dataIndex: "type",
      render: (t: string) =>
        t === "check_in" ? (
          <Tag color="green">Entrada</Tag>
        ) : (
          <Tag color="red">Salida</Tag>
        ),
    },
    {
      title: "Hora solicitada",
      dataIndex: "timestamp",
      render: (ts: string) =>
        dayjs.utc(ts).tz(TZ).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Enviada",
      dataIndex: "created_at",
      render: (ts: string) =>
        dayjs.utc(ts).tz(TZ).format("DD/MM HH:mm"),
    },
    {
      title: "Notas",
      dataIndex: "notes",
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <Typography.Text ellipsis style={{ maxWidth: 180 }}>
              {v}
            </Typography.Text>
          </Tooltip>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "Acciones",
      render: (_: unknown, r: PendingRequest) => (
        <Space>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            size="small"
            onClick={() => handleApprove(r.id)}
          >
            Aprobar
          </Button>
          <Button
            danger
            icon={<CloseCircleOutlined />}
            size="small"
            onClick={() => openReject(r.id)}
          >
            Rechazar
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }} align="center">
        <ClockCircleOutlined style={{ fontSize: 22, color: "#faad14" }} />
        <Typography.Title level={4} style={{ margin: 0 }}>
          Solicitudes Pendientes de Supervisor
        </Typography.Title>
        <Badge count={data.length} style={{ backgroundColor: "#faad14" }} />
      </Space>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: "Sin solicitudes pendientes" }}
      />

      <Modal
        open={rejectId !== null}
        title="Rechazar solicitud"
        onCancel={() => setRejectId(null)}
        onOk={handleReject}
        okText="Rechazar"
        okButtonProps={{ danger: true, loading: rejectLoading }}
        cancelText="Cancelar"
      >
        <Typography.Paragraph>
          Puedes agregar un motivo opcional de rechazo:
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          placeholder="Motivo de rechazo (opcional)"
          value={rejectNotes}
          onChange={(e) => setRejectNotes(e.target.value)}
        />
      </Modal>
    </div>
  );
}
