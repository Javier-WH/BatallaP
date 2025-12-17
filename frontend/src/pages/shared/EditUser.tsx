import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, DatePicker, Select, Radio, message, Card, Spin, Tag, Divider, Alert } from 'antd';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '@/services/api';
import dayjs from 'dayjs';
import { useAuth } from '@/context/AuthContext';

const { Option } = Select;

const EditUser: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const isMaster = currentUser?.roles?.includes('Master') || false;

  const [isStudent, setIsStudent] = useState(false);
  const [inscriptionData, setInscriptionData] = useState<any>(null);
  const [enrollStructure, setEnrollStructure] = useState<any[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [targetUserRoles, setTargetUserRoles] = useState<string[]>([]);

  const getBasePath = useCallback(() => {
    if (location.pathname.startsWith('/master')) return '/master';
    if (location.pathname.startsWith('/admin')) return '/admin';
    return isMaster ? '/master' : '/admin';
  }, [location.pathname, isMaster]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await api.get(`/users/${id}`);
        const userRoles = data.roles?.map((r: any) => r.name) || [];
        setTargetUserRoles(userRoles);

        const studentCheck = userRoles.some((r: string) =>
          ['Student', 'Estudiante', 'Alumno'].includes(r)
        );
        setIsStudent(studentCheck);

        if (studentCheck && data.inscription) {
          setInscriptionData(data.inscription);
          try {
            const structureRes = await api.get(`/academic/structure/${data.inscription.schoolPeriodId}`);
            setEnrollStructure(structureRes.data);
            setSelectedGradeId(data.inscription.gradeId);
          } catch (e) {
            console.error('Error loading structure:', e);
          }
        }

        form.setFieldsValue({
          firstName: data.firstName,
          lastName: data.lastName,
          documentType: data.documentType,
          document: data.document,
          gender: data.gender,
          birthdate: data.birthdate ? dayjs(data.birthdate) : null,
          username: data.user?.username,
          address: data.contact?.address,
          phone1: data.contact?.phone1,
          phone2: data.contact?.phone2,
          email: data.contact?.email,
          whatsapp: data.contact?.whatsapp,
          roles: userRoles,
          gradeId: data.inscription?.gradeId,
          sectionId: data.inscription?.sectionId
        });
      } catch (error) {
        console.error(error);
        message.error('Error al cargar datos del usuario');
        navigate(`${getBasePath()}/search`);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchUser();
  }, [id, form, navigate, getBasePath]);

  const onFinish = async (values: any) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        birthdate: values.birthdate ? values.birthdate.format('YYYY-MM-DD') : null
      };

      await api.put(`/users/${id}`, payload);

      if (isStudent && inscriptionData) {
        try {
          await api.put(`/inscriptions/${inscriptionData.id}`, {
            gradeId: values.gradeId,
            sectionId: values.sectionId
          });
        } catch (inscErr) {
          console.error('Error updating inscription:', inscErr);
        }
      }

      message.success('Usuario actualizado exitosamente');
      navigate(`${getBasePath()}/search`);
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.message || 'Error al actualizar usuario');
    } finally {
      setSubmitting(false);
    }
  };

  const getSectionsForGrade = (gradeId: number | null) => {
    if (!gradeId) return [];
    const item = enrollStructure.find(s => s.gradeId === gradeId);
    return item?.sections || [];
  };

  const targetHasRestrictedRoles = targetUserRoles.includes('Master') || targetUserRoles.includes('Admin');

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}><Spin size="large" /></div>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card
        title="Editar Usuario"
        extra={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isMaster && <Tag color="purple">Modo Master</Tag>}
            <Button onClick={() => navigate(`${getBasePath()}/search`)}>Volver</Button>
          </div>
        }
      >
        {!isMaster && targetHasRestrictedRoles && (
          <Alert
            message="Permisos Limitados"
            description="Este usuario tiene roles administrativos. Los roles Master y Admin no pueden ser modificados."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <h4 style={{ margin: 0, marginBottom: 8, color: '#666' }}>Credenciales de Acceso</h4>
            </div>
            <Form.Item
              name="username"
              label="Usuario (Opcional si no tiene cuenta)"
              rules={[{ required: !!form.getFieldValue('username'), message: 'El nombre de usuario es requerido si se desea crear una cuenta' }]}
            >
              <Input placeholder="Dejar en blanco si no requiere acceso" />
            </Form.Item>

            <Form.Item name="password" label="Nueva Contraseña (Dejar en blanco para no cambiar)">
              <Input.Password placeholder="******" />
            </Form.Item>

            <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
              <h4 style={{ margin: 0, marginBottom: 8, color: '#666' }}>Datos Personales</h4>
            </div>
            <Form.Item name="firstName" label="Nombre" rules={[{ required: true }]}>
              <Input />
            </Form.Item>

            <Form.Item name="lastName" label="Apellido" rules={[{ required: true }]}>
              <Input />
            </Form.Item>

            <Form.Item name="documentType" label="Tipo de Documento" rules={[{ required: true }]}>
              <Select>
                <Option value="Venezolano">Venezolano</Option>
                <Option value="Extranjero">Extranjero</Option>
                <Option value="Pasaporte">Pasaporte</Option>
                <Option value="Cedula Escolar">Cédula Escolar</Option>
              </Select>
            </Form.Item>

            <Form.Item name="document" label="Número de Documento" rules={[{ required: true }]}>
              <Input />
            </Form.Item>

            <Form.Item name="gender" label="Género" rules={[{ required: true }]}>
              <Radio.Group>
                <Radio value="M">M</Radio>
                <Radio value="F">F</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item name="birthdate" label="Fecha de Nacimiento" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>

            <div style={{ gridColumn: 'span 2', marginTop: 16 }}>
              <h4 style={{ margin: 0, marginBottom: 8, color: '#666' }}>Datos de Contacto</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item name="address" label="Dirección" rules={[{ required: true }]} style={{ gridColumn: 'span 2' }}>
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Form.Item name="phone1" label="Teléfono Principal" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="phone2" label="Teléfono Secundario"><Input /></Form.Item>
                <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input /></Form.Item>
                <Form.Item name="whatsapp" label="WhatsApp"><Input /></Form.Item>
              </div>
            </div>

            {isStudent && inscriptionData && (
              <>
                <div style={{ gridColumn: 'span 2', marginTop: 16 }}>
                  <Divider />
                  <h4 style={{ margin: 0, color: '#1890ff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Datos de Inscripción
                    <Tag color="blue">{inscriptionData.period?.name || 'Periodo'}</Tag>
                  </h4>
                </div>
                <Form.Item name="gradeId" label="Grado">
                  <Select
                    placeholder="Seleccione Grado"
                    onChange={(val) => {
                      setSelectedGradeId(val);
                      form.setFieldsValue({ sectionId: undefined });
                    }}
                  >
                    {enrollStructure.map(s => (
                      <Option key={s.gradeId} value={s.gradeId}>{s.grade?.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="sectionId" label="Sección">
                  <Select placeholder="Seleccione Sección" disabled={!selectedGradeId} allowClear>
                    {getSectionsForGrade(selectedGradeId).map((sec: any) => (
                      <Option key={sec.id} value={sec.id}>{sec.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </>
            )}

            <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
              <h4 style={{ margin: 0, marginBottom: 8, color: '#666' }}>Permisos del Sistema</h4>
            </div>
            <Form.Item
              name="roles"
              label="Roles Asignados"
              rules={[{ required: true, message: 'Seleccione al menos un rol' }]}
              style={{ gridColumn: 'span 2' }}
            >
              <Select mode="multiple" placeholder="Selecciona roles">
                <Option value="Student">Estudiante</Option>
                <Option value="Tutor">Representante</Option>
                <Option value="Teacher">Profesor</Option>
                <Option value="Admin" disabled={!isMaster}>Admin {!isMaster && '(Restringido)'}</Option>
                <Option value="Master" disabled={!isMaster}>Master {!isMaster && '(Restringido)'}</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block size="large">Guardar Cambios</Button>
          </Form.Item>
          <Form.Item>
            <Button danger block onClick={() => navigate(`${getBasePath()}/search`)}>Cancelar</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default EditUser;
