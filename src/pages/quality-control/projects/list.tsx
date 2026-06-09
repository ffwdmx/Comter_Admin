// src/pages/quality-control/projects/list.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table, Tag, Button, Space, Typography, Input, Select, Tooltip, App,
} from "antd";
import {
  PlusOutlined, EyeOutlined, EditOutlined, SearchOutlined,
  ExperimentOutlined, ReloadOutlined,
} from "@ant-design/icons";
import { axiosInstance } from "../../../providers/dataProvider";

interface QCProjectListItem {
  id: number;
  name: string;
  part_number: string;
  component_type: string;
  inspection_type: string;
  status: string;
  target_yield: number;
  min_acceptable_yield: number;
  client_name?: string;
  my_yield_today?: number;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activo", paused: "En pausa", completed: "Terminado",
};
const STATUS_COLORS: Record<string, string> = {
  active: "green", paused: "orange", completed: "default",
};
const COMPONENT_LABELS: Record<string, string> = {
  electronic: "Electrónico", mechanical: "Mecánico",
  assembly: "Ensamble", plastic: "Plástico", other: "Otro",
};

export const QCProjectList = () => {
  const { message } = App.useApp();
  const [projects, setProjects]   = useState<QCProjectListItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get("/qc/projects/");
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      message.error("Error cargando proyectos QC");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(q) ||
      p.part_number.toLowerCase().includes(q) ||
      (p.client_name ?? "").toLowerCase().includes(q);
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div
        style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 16,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          Proyectos de Control de Calidad
        </Typography.Title>
        <Space>
          <Tooltip title="Recargar">
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
          </Tooltip>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/quality-control/projects/create")}
          >
            Nuevo Proyecto
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Buscar por nombre, NP o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 320 }}
          allowClear
        />
        <Select
          placeholder="Estado"
          allowClear
          style={{ width: 160 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: "Activo",     value: "active"    },
            { label: "En pausa",   value: "paused"    },
            { label: "Terminado",  value: "completed" },
          ]}
        />
      </Space>

      <Table
        dataSource={filtered}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 15 }}
        bordered
      >
        <Table.Column
          title="Proyecto"
          render={(_: unknown, record: QCProjectListItem) => (
            <Space>
              <ExperimentOutlined style={{ color: "#1B3A6B", fontSize: 18 }} />
              <div>
                <Typography.Text strong>{record.name}</Typography.Text>
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  NP: {record.part_number}
                </Typography.Text>
              </div>
            </Space>
          )}
        />
        <Table.Column title="Cliente" dataIndex="client_name" render={(v) => v ?? "—"} />
        <Table.Column
          title="Componente"
          dataIndex="component_type"
          render={(v) => <Tag>{COMPONENT_LABELS[v] ?? v}</Tag>}
        />
        <Table.Column
          title="Objetivo FPY"
          dataIndex="target_yield"
          align="center"
          render={(v) => <Typography.Text strong>{parseFloat(v).toFixed(2)}%</Typography.Text>}
        />
        <Table.Column
          title="Mín. aceptable"
          dataIndex="min_acceptable_yield"
          align="center"
          render={(v) => `${parseFloat(v).toFixed(2)}%`}
        />
        <Table.Column
          title="Mi FPY hoy"
          dataIndex="my_yield_today"
          align="center"
          render={(v, record: QCProjectListItem) => {
            if (v == null) return <Typography.Text type="secondary">—</Typography.Text>;
            const target = parseFloat(String(record.target_yield));
            const min    = parseFloat(String(record.min_acceptable_yield));
            const color  = v >= target ? "#2E7D32" : v >= min ? "#F9A825" : "#C62828";
            return (
              <Typography.Text strong style={{ color }}>
                {v.toFixed(2)}%
              </Typography.Text>
            );
          }}
        />
        <Table.Column
          title="Estado"
          dataIndex="status"
          align="center"
          render={(v) => (
            <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v] ?? v}</Tag>
          )}
        />
        <Table.Column
          title="Acciones"
          align="center"
          render={(_: unknown, record: QCProjectListItem) => (
            <Space>
              <Tooltip title="Ver detalle">
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => navigate(`/quality-control/projects/${record.id}`)}
                />
              </Tooltip>
              <Tooltip title="Editar">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/quality-control/projects/edit/${record.id}`)}
                />
              </Tooltip>
            </Space>
          )}
        />
      </Table>
    </div>
  );
};
