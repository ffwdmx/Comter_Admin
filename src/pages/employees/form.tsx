import { Create, Edit, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select } from "antd";

const roleOptions = [
  { label: "Administrador", value: "admin" },
  { label: "Supervisor",    value: "supervisor" },
  { label: "Empleado",      value: "employee" },
];

const EmployeeFormFields = ({ isEdit }: { isEdit: boolean }) => {
  const { selectProps: plantSelectProps } = useSelect({
    resource:  "plants",
    optionLabel: "name",
    optionValue: "id",
  });

  return (
    <>
      <Form.Item label="Nombre completo" name="name"
        rules={[{ required: true, message: "Requerido" }]}>
        <Input placeholder="Ej: Juan García López" />
      </Form.Item>

      <Form.Item label="Número de empleado" name="employee_no"
        rules={[{ required: true, message: "Requerido" }]}>
        <Input placeholder="Ej: EMP001" disabled={isEdit}
          style={{ textTransform: "uppercase" }} />
      </Form.Item>

      <Form.Item label="Email" name="email"
        rules={[{ required: true, type: "email", message: "Email inválido" }]}>
        <Input placeholder="empleado@comter.mx" />
      </Form.Item>

      <Form.Item label="Teléfono" name="phone">
        <Input placeholder="Ej: 3312345678" />
      </Form.Item>

      <Form.Item label="Rol" name="role"
        rules={[{ required: true, message: "Requerido" }]}
        initialValue="employee">
        <Select options={roleOptions} />
      </Form.Item>

      <Form.Item label="Planta asignada" name="plant_id">
        <Select {...plantSelectProps} placeholder="Sin asignar" allowClear />
      </Form.Item>

      {!isEdit && (
        <Form.Item label="Contraseña" name="password"
          rules={[
            { required: true, message: "Requerido" },
            { min: 6, message: "Mínimo 6 caracteres" },
          ]}>
          <Input.Password placeholder="Mínimo 6 caracteres" />
        </Form.Item>
      )}
    </>
  );
};

export const EmployeeCreate = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Create saveButtonProps={saveButtonProps} title="Nuevo Empleado">
      <Form {...formProps} layout="vertical">
        <EmployeeFormFields isEdit={false} />
      </Form>
    </Create>
  );
};

export const EmployeeEdit = () => {
  const { formProps, saveButtonProps } = useForm();
  return (
    <Edit saveButtonProps={saveButtonProps} title="Editar Empleado">
      <Form {...formProps} layout="vertical">
        <EmployeeFormFields isEdit={true} />
      </Form>
    </Edit>
  );
};
