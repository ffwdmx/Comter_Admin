// src/pages/attendance/ExtraShiftRequests.tsx
import { useEffect, useState } from "react";
import {
  Table, Button, Tag, Space, Typography, Badge, message as antMessage,
} from "antd";
import { CheckCircleOutlined, CloseCircleOutlined, SwapOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { axiosInstance } from "../../providers/dataProvider";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "America/Mexico_City";

interface ExtraShiftRequest {
  id:            number;
  employee_id:   number;
  employee_name: string | null;
  employee_no:   string | null;
  plant_id:      number | null;
  date:          string;
  status:        string;
  notes:         string | null;
  created_at:    string;
}

export function ExtraShiftRequests() {
  const [data,    setData]    = useState<ExtraShiftRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/attendance/extra-shifts/pending");
      setData(res.data as ExtraShiftRequest[]);
    } catch {
      antMessage.error("No se pudieron cargar las solicitudes de segundo turno.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: number) => {
    try {
      await axiosInstance.patch(`/attendance/extra-shifts/${id}/approve`);
      antMessage.success("Segundo turno autorizado.");
      load();
    } catch (e: any) {
      antMessage.error(e?.response?.data?.detail ?? "Error al autorizar.");
    }
  };

  const handleReject = async (id: number) => {
    try {
      await axiosInstance.patch(`/attendance/extra-shifts/${id}/reject`, { notes: null });
      antMessage.success("Solicitud rechazada.");
      load();
    } catch (e: any) {
      antMessage.error(e?.response?.data?.detail ?? "Error al rechazar.");
    }
  };

  const columns = [
    {
      title: "Empleado",
      render: (_: unknown, r: ExtraShiftRequest) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{r.employee_name ?? "—"}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.employee_no ?? "—"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Fecha",
      dataIndex: "date",
      render: (d: string) => dayjs(d).format("DD/MM/YYYY"),
    },
    {
      title: "Solicitado",
      dataIndex: "created_at",
      render: (ts: string) => dayjs.utc(ts).tz(TZ).format("DD/MM HH:mm"),
    },
    {
      title: "Estado",
      dataIndex: "status",
      render: (s: string) => {
        if (s === "pending")  return <Tag color="orange">Pendiente</Tag>;
        if (s === "approved") return <Tag color="green">Autorizado</Tag>;
        return <Tag color="red">Rechazado</Tag>;
      },
    },
    {
      title: "Acciones",
      render: (_: unknown, r: ExtraShiftRequest) => (
        <Space>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            size="small"
            onClick={() => handleApprove(r.id)}
          >
            Autorizar
          </Button>
          <Button
            danger
            icon={<CloseCircleOutlined />}
            size="small"
            onClick={() => handleReject(r.id)}
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
        <SwapOutlined style={{ fontSize: 22, color: "#1677ff" }} />
        <Typography.Title level={4} style={{ margin: 0 }}>
          Solicitudes de Segundo Turno
        </Typography.Title>
        <Badge count={data.length} />
      </Space>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: "Sin solicitudes pendientes de segundo turno" }}
      />
    </div>
  );
}
