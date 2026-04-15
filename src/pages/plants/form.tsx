import { Create, Edit, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, InputNumber, Button, Space, Alert, Select } from "antd";
import { AimOutlined } from "@ant-design/icons";
import { useState } from "react";

const PlantFormFields = () => {
  const [gpsLoading, setGpsLoading] = useState(false);
  const form = Form.useFormInstance();

  const { selectProps: clientSelectProps } = useSelect({
    resource: "clients",
    optionLabel: "name",
    optionValue: "id",
  });

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setFieldsValue({
          latitude:  parseFloat(pos.coords.latitude.toFixed(7)),
          longitude: parseFloat(pos.coords.longitude.toFixed(7)),
        });
        setGpsLoading(false);
      },
      () => {
        alert("No se pudo obtener la ubicación");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <>
      <Form.Item label="Cliente" name="client_id">
        <Select
          {...clientSelectProps}
          placeholder="Selecciona un cliente"
          allowClear
        />
      </Form.Item>

      <Form.Item label="Nombre de la planta" name="name"
        rules={[{ required: true, message: "Requerido" }]}>
        <Input placeholder="Ej: Planta Principal Zapopan" />
      </Form.Item>

      <Form.Item label="Dirección" name="address">
        <Input placeholder="Ej: Av. Patria 1234, Zapopan, Jalisco" />
      </Form.Item>

      <Alert
        message="Coordenadas GPS"
        description="Ingresa las coordenadas manualmente o usa el botón para obtener tu ubicación actual."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Button icon={<AimOutlined />} onClick={getCurrentLocation}
        loading={gpsLoading} style={{ marginBottom: 16 }}>
        Usar mi ubicación actual
      </Button>

      <Space style={{ width: "100%" }}>
        <Form.Item label="Latitud" name="latitude"
          rules={[{ required: true, message: "Requerido" }]}
          style={{ flex: 1 }}>
          <InputNumber
            placeholder="20.6750"
            precision={7} step={0.0001}
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Form.Item label="Longitud" name="longitude"
          rules={[{ required: true, message: "Requerido" }]}
          style={{ flex: 1 }}>
          <InputNumber
            placeholder="-103.3938"
            precision={7} step={0.0001}
            style={{ width: "100%" }}
          />
        </Form.Item>
      </Space>

      <Form.Item label="Radio de geofence (metros)" name="radius_m"
        initialValue={100}
        rules={[{ required: true, message: "Requerido" }]}
        extra="Radio en metros dentro del cual se acepta el check-in.">
        <InputNumber min={50} max={5000} style={{ width: 200 }} addonAfter="m" />
      </Form.Item>
    </>
  );
};

export const PlantCreate = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Create saveButtonProps={saveButtonProps} title="Nueva Planta">
      <Form {...formProps} layout="vertical">
        <PlantFormFields />
      </Form>
    </Create>
  );
};

export const PlantEdit = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Edit saveButtonProps={saveButtonProps} title="Editar Planta">
      <Form {...formProps} layout="vertical">
        <PlantFormFields />
      </Form>
    </Edit>
  );
};
