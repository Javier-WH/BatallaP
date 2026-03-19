import React, { useState } from 'react';
import { Modal, Form, Input, Select, Button, message, Alert, Descriptions, Typography } from 'antd';
import {
  SearchOutlined,
  UserAddOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  IdcardOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { searchGuardian, createGuardian } from '@/services/guardians';
import type { GuardianProfileResponse } from '@/services/guardians';

const { Text } = Typography;

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-4 mb-4 mt-2">
    <div className="h-px bg-gray-200 flex-1"></div>
    <span className="text-gray-500 font-medium text-xs uppercase tracking-wider">{children}</span>
    <div className="h-px bg-gray-200 flex-1"></div>
  </div>
);

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
        message.warning('No existe ningún representante registrado con ese documento.');
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
      title={
        <div className="flex items-center gap-2 py-2">
          <UserOutlined className="text-blue-600 text-xl" />
          <span className="font-headline text-xl">Buscar o Registrar Representante</span>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      width={showRegister ? 850 : 550}
      centered
      className="luxury-modal"
      footer={
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button key="cancel" onClick={handleCancel} className="hover:bg-gray-100">
            Cancelar
          </Button>
          {!showRegister && (
            <Button
              key="select"
              type="primary"
              onClick={handleSelect}
              disabled={!person}
              className="bg-blue-600 hover:bg-blue-700 shadow-md"
            >
              Seleccionar Representante
            </Button>
          )}
          {showRegister && (
            <Button
              key="register"
              type="primary"
              icon={<UserAddOutlined />}
              onClick={handleRegister}
              loading={loading}
              className="bg-blue-600 hover:bg-blue-700 shadow-lg px-6"
            >
              Registrar y Seleccionar
            </Button>
          )}
        </div>
      }
    >
      {!showRegister ? (
        <div className="py-6">
          <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 mb-6">
            <Text type="secondary" className="block mb-4 text-center">
              Ingrese el documento de identidad para buscar en la base de datos
            </Text>
            <Form form={form} layout="vertical" initialValues={{ documentType: 'Venezolano' }}>
              <div className="flex gap-3">
                <Form.Item name="documentType" className="mb-0 w-32">
                  <Select size="large" className="w-full">
                    <Select.Option value="Venezolano">V</Select.Option>
                    <Select.Option value="Extranjero">E</Select.Option>
                    <Select.Option value="Pasaporte">P</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item
                  name="document"
                  className="mb-0 flex-1"
                  rules={[{ required: true, message: 'Ingrese documento' }]}
                >
                  <Input
                    size="large"
                    placeholder="Número de documento"
                    prefix={<IdcardOutlined className="text-gray-400" />}
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
                <Button
                  type="primary"
                  size="large"
                  icon={<SearchOutlined />}
                  loading={loading}
                  onClick={handleSearch}
                  className="bg-blue-600 shadow-md"
                >
                  Buscar
                </Button>
              </div>
            </Form>
          </div>

          {person && (
            <div className="animate-fade-in">
              <Alert
                message={
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-green-700">¡Representante Encontrado!</span>
                  </div>
                }
                description={
                  <div className="mt-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label={<span className="text-gray-500">Nombre Completo</span>}>
                        <span className="font-semibold text-gray-800 text-lg">{person.firstName} {person.lastName}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label={<span className="text-gray-500">Teléfono</span>}>
                        <span className="font-medium">{person.phone}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label={<span className="text-gray-500">Correo</span>}>
                        {person.email || 'No registrado'}
                      </Descriptions.Item>
                    </Descriptions>
                  </div>
                }
                type="success"
                showIcon
                className="border-green-200 bg-green-50 rounded-xl"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="py-2">
          <Alert
            message="Representante no encontrado"
            description={
              <div className="flex justify-between items-center">
                <span>No se encontró registro para <strong>{searchedDoc?.type} {searchedDoc?.num}</strong>. Complete los datos para registrarlo.</span>
                <Button size="small" type="link" onClick={() => setShowRegister(false)}>
                  Volver a buscar
                </Button>
              </div>
            }
            type="info"
            showIcon
            className="mb-6 border-blue-200 bg-blue-50 rounded-xl"
          />

          <Form form={registerForm} layout="vertical" className="px-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              <div className="md:col-span-2">
                <SectionTitle>Datos Personales</SectionTitle>
              </div>

              <Form.Item name="firstName" label="Nombres" rules={[{ required: true }]}>
                <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="Ej. Juan Carlos" className="bg-gray-50" />
              </Form.Item>
              <Form.Item name="lastName" label="Apellidos" rules={[{ required: true }]}>
                <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="Ej. Pérez Rodriguez" className="bg-gray-50" />
              </Form.Item>

              <Form.Item name="documentType" label="Tipo Doc" rules={[{ required: true }]}>
                <Select disabled className="bg-gray-50">
                  <Select.Option value="Venezolano">Venezolano</Select.Option>
                  <Select.Option value="Extranjero">Extranjero</Select.Option>
                  <Select.Option value="Pasaporte">Pasaporte</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="document" label="Documento" rules={[{ required: true }]}>
                <Input disabled prefix={<IdcardOutlined className="text-gray-400" />} className="bg-gray-50" />
              </Form.Item>

              <div className="md:col-span-2">
                <SectionTitle>Información de Contacto</SectionTitle>
              </div>

              <Form.Item name="phone" label="Teléfono Mobile" rules={[{ required: true }]}>
                <Input prefix={<PhoneOutlined className="text-gray-400" />} placeholder="04XX-XXXXXXX" className="bg-gray-50" />
              </Form.Item>
              <Form.Item name="email" label="Correo Electrónico" rules={[{ type: 'email' }]}>
                <Input prefix={<MailOutlined className="text-gray-400" />} placeholder="ejemplo@correo.com" className="bg-gray-50" />
              </Form.Item>

              <div className="md:col-span-2">
                <SectionTitle>Dirección de Habitación</SectionTitle>
              </div>

              <Form.Item name="address" label="Dirección Detallada" className="md:col-span-2" rules={[{ required: true }]}>
                <Input.TextArea
                  rows={2}
                  placeholder="Calle, Casa, Sector..."
                  className="bg-gray-50"
                  style={{ resize: 'none' }}
                />
              </Form.Item>

              <Form.Item name="residenceState" label="Estado">
                <Input prefix={<EnvironmentOutlined className="text-gray-400" />} className="bg-gray-50" />
              </Form.Item>
              <Form.Item name="residenceMunicipality" label="Municipio">
                <Input prefix={<EnvironmentOutlined className="text-gray-400" />} className="bg-gray-50" />
              </Form.Item>

              {/* Force Parroquia to take remaining space or align nicely */}
              <Form.Item name="residenceParish" label="Parroquia" className="md:col-span-2">
                <Input prefix={<EnvironmentOutlined className="text-gray-400" />} className="bg-gray-50" />
              </Form.Item>
            </div>
          </Form>
        </div>
      )}
    </Modal>
  );
};

export default SearchGuardianModal;
