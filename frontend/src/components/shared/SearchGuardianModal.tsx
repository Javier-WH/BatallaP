import React, { useState } from 'react';
import { Modal, Form, Input, Select, Button, message, Alert, Descriptions } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { searchGuardian } from '@/services/guardians';
import type { GuardianProfileResponse } from '@/services/guardians';

interface SearchGuardianModalProps {
  visible: boolean;
  onCancel: () => void;
  onSelect: (guardian: GuardianProfileResponse) => void;
}

const SearchGuardianModal: React.FC<SearchGuardianModalProps> = ({ visible, onCancel, onSelect }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [person, setPerson] = useState<GuardianProfileResponse | null>(null);

  const handleSearch = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      setPerson(null);
      const result = await searchGuardian(values.documentType, values.document);
      if (result) {
        setPerson(result);
        message.success('Representante encontrado');
      } else {
        message.warning('No se encontró ningún representante con ese documento');
      }
    } catch (error) {
      console.error(error);
      // Form validation error or api error
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (person) {
      onSelect(person);
      handleCancel();
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setPerson(null);
    onCancel();
  };

  return (
    <Modal
      title="Buscar Representante"
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancelar
        </Button>,
        <Button key="select" type="primary" onClick={handleSelect} disabled={!person}>
          Seleccionar
        </Button>
      ]}
    >
      <Form form={form} layout="inline" initialValues={{ documentType: 'Venezolano' }}>
        <Form.Item name="documentType" style={{ width: 120 }}>
          <Select>
            <Select.Option value="Venezolano">Venezolano</Select.Option>
            <Select.Option value="Extranjero">Extranjero</Select.Option>
            <Select.Option value="Pasaporte">Pasaporte</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="document" style={{ flex: 1 }} rules={[{ required: true, message: 'Ingrese documento' }]}>
          <Input placeholder="Número de documento" onPressEnter={handleSearch} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={handleSearch} />
        </Form.Item>
      </Form>

      {person && (
        <Alert
          message="Representante Encontrado"
          description={
            <Descriptions size="small" column={1} style={{ marginTop: 8 }}>
              <Descriptions.Item label="Nombres">{person.firstName} {person.lastName}</Descriptions.Item>
              <Descriptions.Item label="Teléfono">{person.phone}</Descriptions.Item>
            </Descriptions>
          }
          type="success"
          showIcon
          style={{ marginTop: 20 }}
        />
      )}
    </Modal>
  );
};

export default SearchGuardianModal;
