import React, { useState } from 'react';
import { Modal, Form, Input, Select, Button, message, Alert, Descriptions, Divider, Row, Col } from 'antd';
import { SearchOutlined, UserAddOutlined } from '@ant-design/icons';
import { searchGuardian, createGuardian } from '@/services/guardians';
import type { GuardianProfileResponse } from '@/services/guardians';

interface SearchGuardianModalProps {
  visible: boolean;
  onCancel: () => void;
  onSelect: (guardian: GuardianProfileResponse) => void;
}

const SearchGuardianModal: React.FC<SearchGuardianModalProps> = ({ visible, onCancel, onSelect }) => {
  const [form] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [person, setPerson] = useState<GuardianProfileResponse | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [searchedDoc, setSearchedDoc] = useState<{ type: string; num: string } | null>(null);

  const handleSearch = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      setPerson(null);
      setShowRegister(false);
      setSearchedDoc({ type: values.documentType, num: values.document });

      const result = await searchGuardian(values.documentType, values.document);
      if (result) {
        setPerson(result);
        message.success('Representante encontrado');
      } else {
        message.warning('No existe ningún representante registrado con ese documento. Proceda a registrarlo.');
        setShowRegister(true);
        // Pre-fill register form
        registerForm.setFieldsValue({
          documentType: values.documentType,
          document: values.document,
          firstName: '',
          lastName: '',
          phone: '',
          email: '',
          address: ''
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      const values = await registerForm.validateFields();
      setLoading(true);
      const created = await createGuardian(values);
      message.success('Representante registrado exitosamente');
      onSelect(created);
      handleCancel();
    } catch (error) {
      console.error(error);
      message.error('Error al registrar representante');
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
    registerForm.resetFields();
    setPerson(null);
    setShowRegister(false);
    setSearchedDoc(null);
    onCancel();
  };

  return (
    <Modal
      title="Buscar o Registrar Representante"
      open={visible}
      onCancel={handleCancel}
      width={showRegister ? 800 : 520}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancelar
        </Button>,
        !showRegister && (
          <Button key="select" type="primary" onClick={handleSelect} disabled={!person}>
            Seleccionar
          </Button>
        ),
        showRegister && (
          <Button key="register" type="primary" icon={<UserAddOutlined />} onClick={handleRegister} loading={loading}>
            Registrar y Seleccionar
          </Button>
        )
      ]}
    >
      {!showRegister ? (
        <>
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
        </>
      ) : (
        <>
          <Alert
            message="Representante no encontrado"
            description={`No se encontró registro para ${searchedDoc?.type} ${searchedDoc?.num}. Por favor complete los datos para registrarlo.`}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
            action={
              <Button size="small" type="link" onClick={() => setShowRegister(false)}>
                Volver a buscar
              </Button>
            }
          />
          <Form form={registerForm} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="firstName" label="Nombres" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="lastName" label="Apellidos" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="documentType" label="Tipo Doc" rules={[{ required: true }]}>
                  <Select disabled>
                    <Select.Option value="Venezolano">Venezolano</Select.Option>
                    <Select.Option value="Extranjero">Extranjero</Select.Option>
                    <Select.Option value="Pasaporte">Pasaporte</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item name="document" label="Documento" rules={[{ required: true }]}>
                  <Input disabled />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="phone" label="Teléfono Principal" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="address" label="Dirección" rules={[{ required: true }]}>
              <Input.TextArea rows={2} />
            </Form.Item>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="residenceState" label="Estado">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="residenceMunicipality" label="Municipio">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="residenceParish" label="Parroquia">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </>
      )}
    </Modal>
  );
};

export default SearchGuardianModal;
