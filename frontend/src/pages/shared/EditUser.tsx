import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, DatePicker, Select, Radio, message, Card, Spin, Tag, Divider, Alert, Popconfirm, List, Space } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import dayjs, { Dayjs } from 'dayjs';
import { useAuth } from '@/context/AuthContext';
import type { AxiosError } from 'axios';

interface Role {
  id: number;
  name: string;
}

interface Section {
  id: number;
  name: string;
}

interface Grade {
  id: number;
  name: string;
}

interface Subject {
  id: number;
  name: string;
}

interface PeriodGrade {
  id: number;
  grade?: Grade;
}

interface PeriodGradeSubject {
  id: number;
  subject?: Subject;
  periodGrade?: PeriodGrade;
}

interface TeachingAssignment {
  id: number;
  periodGradeSubject?: PeriodGradeSubject;
  section?: Section;
}

interface Period {
  id: number;
  name: string;
  period: string;
}

interface InscriptionData {
  id: number;
  schoolPeriodId: number;
  gradeId: number;
  sectionId: number;
  period?: Period;
}

interface EnrollStructureItem {
  gradeId: number;
  grade?: Grade;
  sections?: Section[];
}

interface EditUserFormValues {
  firstName: string;
  lastName: string;
  documentType: string;
  document: string;
  gender: string;
  birthdate: Dayjs | null;
  username?: string;
  password?: string;
  address?: string;
  phone1?: string;
  phone2?: string;
  email?: string;
  whatsapp?: string;
  roles: string[];
  gradeId?: number;
  sectionId?: number;
}

const { Option } = Select;

const EditUser: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const isMaster = currentUser?.roles?.includes('Master') || false;

  const [isStudent, setIsStudent] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [teachingAssignments, setTeachingAssignments] = useState<TeachingAssignment[]>([]);
  const [inscriptionData, setInscriptionData] = useState<InscriptionData | null>(null);
  const [enrollStructure, setEnrollStructure] = useState<EnrollStructureItem[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [targetUserRoles, setTargetUserRoles] = useState<string[]>([]);
  const [hasAccount, setHasAccount] = useState(false);
  const [showAccountFields, setShowAccountFields] = useState(false);

  const getBasePath = useCallback(() => {
    return '/admin';
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await api.get(`/users/${id}`);
        const userRoles = data.roles?.map((r: Role) => r.name) || [];
        setTargetUserRoles(userRoles);

        const hasUser = !!data.user;
        setHasAccount(hasUser);
        setShowAccountFields(hasUser);

        const studentCheck = userRoles.some((r: string) =>
          ['Alumno'].includes(r)
        );
        setIsStudent(studentCheck);

        const teacherCheck = userRoles.includes('Profesor');
        setIsTeacher(teacherCheck);
        if (teacherCheck) {
          setTeachingAssignments(data.teachingAssignments || []);
        }

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

  const onFinish = async (values: EditUserFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        birthdate: values.birthdate ? values.birthdate.format('YYYY-MM-DD') : null
      };

      await api.put(`/users/${id}`, payload);

      if (isStudent && inscriptionData) {
        try {
          // Grade is now fixed for the current inscription, only section can be moved
          await api.put(`/inscriptions/${inscriptionData.id}`, {
            sectionId: values.sectionId
          });
        } catch (inscErr) {
          console.error('Error updating inscription:', inscErr);
        }
      }

      message.success('Usuario actualizado exitosamente');
      navigate(`${getBasePath()}/search`);
    } catch (error: unknown) {
      console.error(error);
      const axiosError = error as AxiosError<{ message?: string }>;
      message.error(axiosError.response?.data?.message || 'Error al actualizar usuario');
    } finally {
      setSubmitting(false);
    }
  };

  const getSectionsForGrade = (gradeId: number | null) => {
    if (!gradeId) return [];
    const item = enrollStructure.find(s => s.gradeId === gradeId);
    return item?.sections || [];
  };

  const handleDeleteAccount = async () => {
    try {
      setSubmitting(true);
      await api.delete(`/users/${id}/account`);
      message.success('Acceso al sistema eliminado');
      setHasAccount(false);
      setShowAccountFields(false);
      form.setFieldsValue({ username: '', password: '' });
    } catch (error: unknown) {
      console.error(error);
      const axiosError = error as AxiosError<{ message?: string }>;
      message.error(axiosError.response?.data?.message || 'Error al eliminar acceso');
    } finally {
      setSubmitting(false);
    }
  };

  const targetHasRestrictedRoles = targetUserRoles.includes('Master') || targetUserRoles.includes('Administrador');

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
            {/* Account Info Section */}
            {!showAccountFields ? (
              <div style={{ gridColumn: 'span 2', marginBottom: 16 }}>
                <Alert
                  message="Sin cuenta de acceso"
                  description="Este usuario no tiene credenciales para entrar al sistema."
                  type="info"
                  showIcon
                  action={
                    <Button size="small" type="primary" onClick={() => setShowAccountFields(true)}>
                      Habilitar Acceso
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, color: '#666' }}>
                    Credenciales de Acceso
                    {hasAccount && <Tag color="green" style={{ marginLeft: 8 }}>Cuenta Activa</Tag>}
                    {!hasAccount && <Tag color="orange" style={{ marginLeft: 8 }}>Nueva Cuenta</Tag>}
                  </h4>
                  {hasAccount && (isMaster || !targetHasRestrictedRoles) && (
                    <Popconfirm
                      title="¿Eliminar acceso al sistema?"
                      description="Se borrará el usuario y contraseña. Los datos personales permanecerán intactos."
                      onConfirm={handleDeleteAccount}
                      okText="Sí, eliminar"
                      cancelText="No"
                      okButtonProps={{ danger: true }}
                    >
                      <Button danger type="link" size="small">Eliminar Acceso</Button>
                    </Popconfirm>
                  )}
                  {!hasAccount && (
                    <Button type="link" size="small" onClick={() => setShowAccountFields(false)}>
                      Cancelar habilitación
                    </Button>
                  )}
                </div>
                <Form.Item
                  name="username"
                  label="Usuario"
                  rules={[{ required: showAccountFields, message: 'El nombre de usuario es requerido' }]}
                >
                  <Input placeholder="Nombre de usuario" disabled={targetHasRestrictedRoles && !isMaster} />
                </Form.Item>

                <Form.Item
                  name="password"
                  label={hasAccount ? "Nueva Contraseña (Dejar en blanco para no cambiar)" : "Contraseña Inicial"}
                  rules={[{ required: !hasAccount && showAccountFields, message: 'La contraseña es requerida para nuevas cuentas' }]}
                >
                  <Input.Password placeholder="******" disabled={targetHasRestrictedRoles && !isMaster} />
                </Form.Item>
              </>
            )}

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
                    disabled // Disable grade editing
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
                    {getSectionsForGrade(selectedGradeId).map((sec: Section) => (
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
              <Select mode="multiple" placeholder="Selecciona roles" disabled={targetHasRestrictedRoles && !isMaster}>
                <Option value="Student">Estudiante</Option>
                <Option value="Tutor">Representante</Option>
                <Option value="Teacher">Profesor</Option>
                <Option value="StudyControl">Control de Estudios</Option>
                <Option value="Admin" disabled={!isMaster}>Admin {!isMaster && '(Restringido)'}</Option>
                <Option value="Master" disabled={!isMaster}>Master {!isMaster && '(Restringido)'}</Option>
              </Select>
            </Form.Item>

            {isTeacher && (
              <div style={{ gridColumn: 'span 2', marginTop: 16 }}>
                <Divider>Carga Académica (Docencia)</Divider>
                {teachingAssignments.length > 0 ? (
                  <List
                    size="small"
                    bordered
                    dataSource={teachingAssignments}
                    renderItem={(item: TeachingAssignment) => (
                      <List.Item>
                        <Space>
                          <BookOutlined style={{ color: '#1890ff' }} />
                          <span style={{ fontWeight: 600 }}>{item.periodGradeSubject?.subject?.name}</span>
                          <Tag color="cyan">{item.periodGradeSubject?.periodGrade?.grade?.name}</Tag>
                          <Tag color="blue">Sección {item.section?.name}</Tag>
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Alert message="Sin carga académica asignada en este periodo" type="info" showIcon />
                )}
                <div style={{ marginTop: 8, textAlign: 'right' }}>
                  <Button type="link" onClick={() => navigate('/admin/projection')}>Gestionar en Proyección</Button>
                </div>
              </div>
            )}
          </div>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block size="large">Guardar Cambios</Button>
          </Form.Item>
          <Form.Item>
            <Button danger block onClick={() => navigate(`${getBasePath()}/search`)}>Cancelar</Button>
          </Form.Item>
        </Form>
      </Card>
    </div >
  );
};

export default EditUser;
