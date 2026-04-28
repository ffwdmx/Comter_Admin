import { useState, useEffect, useCallback } from "react";
import {
  Table, Button, Tag, Space, Typography, Card, Select,
  Popconfirm, message, Tooltip,
} from "antd";
import {
  PlusOutlined, EditOutlined, CheckCircleOutlined,
  StopOutlined, ClockCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../providers/dataProvider";

const { Title, Text } = Typography;

interface ShiftType {
  id: number;
  plant_id: number;
  name: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  is_overnight: boolean;
  late_tolerance_minutes: number;
  early_exit_timeout_minutes: number;
  overtime_timeout_minutes: number;
  notify_before_end_minutes: number;
  notify_after_end_minutes: number;
  is_active: boolean;
}

interface Plant {
  id: number;
  name: string;
}

export const ShiftTypeList = () => {
  const navigate = useNavigate();
  const [shifts, setShifts]     = useState<ShiftType[]>([]);
  const [plants, setPlants]     = useState<Plant[]>([]);
  const [plantFilter, setPlant] = useState<number | undefined>();
  const [loading, setLoading]   = useState(false);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const params = plantFilter ? `?plant_id=${plantFilter}` : "";
      const [shiftsRes, plantsRes] = await Promise.all([
        axiosInstance.get(`/shifts/admin/shift-types${params}`),
        axiosInstance.get("/plants"),
      ]);
      setShifts(shiftsRes.data);
      setPlants(Array.isArray(plantsRes.data) ? plantsRes.data : plantsRes.data.items ?? []);
    } catch {
      message.error("Error al cargar tipos de turno");
    } finally {
      setLoading(false);
    }
  }, [plantFilter]);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  const toggleActive = async (id: number, currentActive: boolean) => {
    try {
      await axiosInstance.patch(`/shifts/admin/shift-types/${id}`, {
        is_active: !currentActive,
      });
      message.success(currentActive ? "Turno desactivado" : "Turno activado");
      fetchShifts();
    } catch {
      message.error("Error al actualizar estado");
    }
  };

  const plantName = (id: number) =>
    plants.find((p) => p.id === id)?.name ?? `Planta ${id}`;

  const columns = [
    {
      title: "Turno",
      dataIndex: "name",
      render: (name: string, r: ShiftType) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {plantName(r.plant_id)}
          </Text>
        </Space>
      ),
    },
    {
      title: "Horario",
      render: (_: any, r: ShiftType) => (
        <Space direction="vertical" size={0}>
          <Text>
            <ClockCircleOutlined style={{ marginRight: 4, color: "#1B3A6B" }} />
            {r.start_time} → {r.end_time}
            {r.is_overnight && (
              <Tag color="purple" style={{ marginLeft: 6, fontSize: 11 }}>Nocturno</Tag>
            )}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.duration_hours}h de duración
          </Text>
        </Space>
      ),
    },
    {
      title: "Tolerancias",
      render: (_: any, r: ShiftType) => (
        <Space direction="vertical" size={0} style={{ fontSize: 12 }}>
          <Text type="secondary">Entrada: <Text strong>{r.late_tolerance_minutes} min</Text></Text>
          <Text type="secondary">Salida ant.: <Text strong>{r.early_exit_timeout_minutes} min</Text></Text>
          <Text type="secondary">Tiempo extra: <Text strong>{r.overtime_timeout_minutes} min</Text></Text>
        </Space>
      ),
    },
    {
      title: "Notificaciones",
      render: (_: any, r: ShiftType) => (
        <Space direction="vertical" size={0} style={{ fontSize: 12 }}>
          <Text type="secondary">Antes del fin: <Text strong>{r.notify_before_end_minutes} min</Text></Text>
          <Text type="secondary">Tras el fin: <Text strong>{r.notify_after_end_minutes} min</Text></Text>
        </Space>
      ),
    },
    {
      title: "Estado",
      dataIndex: "is_active",
      render: (v: boolean) => (
        <Tag color={v ? "green" : "red"} icon={v ? <CheckCircleOutlined /> : <StopOutlined />}>
          {v ? "Activo" : "Inactivo"}
        </Tag>
      ),
    },
    {
      title: "Acciones",
      render: (_: any, r: ShiftType) => (
        <Space>
          <Tooltip title="Editar">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/shifts/edit/${r.id}`)}
            />
          </Tooltip>
          <Popconfirm
            title={r.is_active ? "¿Desactivar este turno?" : "¿Activar este turno?"}
            onConfirm={() => toggleActive(r.id, r.is_active)}
            okText="Sí"
            cancelText="No"
          >
            <Tooltip title={r.is_active ? "Desactivar" : "Activar"}>
              <Button
                size="small"
                danger={r.is_active}
                icon={r.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<Title level={4} style={{ margin: 0 }}>Tipos de Turno</Title>}
      extra={
        <Space>
          <Select
            placeholder="Filtrar por planta"
            allowClear
            style={{ width: 200 }}
            onChange={(v) => setPlant(v)}
            options={plants.map((p) => ({ label: p.name, value: p.id }))}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/shifts/create")}
          >
            Nuevo Turno
          </Button>
        </Space>
      }
    >
      <Table
        dataSource={shifts}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15 }}
      />
    </Card>
  );
};
