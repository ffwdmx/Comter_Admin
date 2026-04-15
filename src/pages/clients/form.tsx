import { Create, Edit, useForm } from "@refinedev/antd";
import { Form, Input } from "antd";

const ClientFormFields = () => (
  <>
    <Form.Item label="Nombre del cliente" name="name"
      rules={[{ required: true, message: "Requerido" }]}>
      <Input placeholder="Ej: Ford Motor Company" />
    </Form.Item>

    <Form.Item label="Industria" name="industry">
      <Input placeholder="Ej: Automotriz, Electrónica…" />
    </Form.Item>
  </>
);

export const ClientCreate = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Create saveButtonProps={saveButtonProps} title="Nuevo Cliente">
      <Form {...formProps} layout="vertical">
        <ClientFormFields />
      </Form>
    </Create>
  );
};

export const ClientEdit = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Edit saveButtonProps={saveButtonProps} title="Editar Cliente">
      <Form {...formProps} layout="vertical">
        <ClientFormFields />
      </Form>
    </Edit>
  );
};
