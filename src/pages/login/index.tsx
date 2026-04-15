import { useLogin } from "@refinedev/core";
import { Form, Input, Button, Typography, Alert } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useState } from "react";

export const LoginPage = () => {
  const { mutate: login, isLoading } = useLogin<{ username: string; password: string }>();
  const [error, setError] = useState<string | null>(null);

  const onFinish = (values: { username: string; password: string }) => {
    setError(null);
    login(values, {
      onError: (err: any) => {
        setError(err?.message || err?.error?.message || "Credenciales incorrectas");
      },
    });
  };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100vw",
      background: "linear-gradient(135deg, #1B3A6B 0%, #2563A8 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
        padding: "48px 40px",
        width: 420,
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Typography.Title level={2} style={{ color: "#1B3A6B", margin: 0 }}>
            COMTER
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Panel de Administración · Control de Calidad y Asistencia
          </Typography.Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 20 }}
          />
        )}

        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item
            label="Número de empleado"
            name="username"
            rules={[{ required: true, message: "Ingresa tu número de empleado" }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: "#aaa" }} />}
              placeholder="Ej: ADMIN001"
            />
          </Form.Item>

          <Form.Item
            label="Contraseña"
            name="password"
            rules={[{ required: true, message: "Ingresa tu contraseña" }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#aaa" }} />}
              placeholder="Contraseña"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              style={{
                height: 48,
                fontSize: 16,
                fontWeight: 600,
                background: "#1B3A6B",
                borderColor: "#1B3A6B",
              }}
            >
              Ingresar
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};
