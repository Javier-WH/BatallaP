import React, { useState, useEffect } from 'react';
import { Form, Input, Button, DatePicker, Select, Radio, message, Card, Spin, Tag, Divider } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import dayjs from 'dayjs';

const { Option } = Select;

const EditUserAdmin: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // State to track user info
  const [hasRestrictedRoles, setHasRestrictedRoles] = useState(false);
  const [isStudent, setIsStudent] = useState(false);
  const [inscriptionData, setInscriptionData] = useState<any>(null);

  // For student enrollment editing
  const [enrollStructure, setEnrollStructure] = useState<any[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await api.get(`/users/${id}`);

        const userRoles = data.roles?.map((r: any) => r.name) || [];
        const isRestricted = userRoles.includes('Master') || userRoles.includes('Admin');
        setHasRestrictedRoles(isRestricted);

        const studentCheck = userRoles.some((r: string) =>
          ['Student', 'Estudiante', 'Alumno'].includes(r)
        );
        setIsStudent(studentCheck);

        // If student, set inscription data
        if (studentCheck && data.inscription) {
          setInscriptionData(data.inscription);

          // Load structure for the period
          if (data.inscription.schoolPeriodId) {
            try {
              const structureRes = await api.get(`/academic/structure/${data.inscription.schoolPeriodId}`);
              setEnrollStructure(structureRes.data);
              setSelectedGradeId(data.inscription.gradeId);
            } catch (e) {
              console.error('Error loading structure:', e);
            }
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
          // Contact
          address: data.contact?.address,
          phone1: data.contact?.phone1,
          phone2: data.contact?.phone2,
          email: data.contact?.email,
          whatsapp: data.contact?.whatsapp,
          roles: userRoles,
          // Student inscription data
          gradeId: data.inscription?.gradeId,
          sectionId: data.inscription?.sectionId
        });
      } catch (error) {
        console.error(error);
        message.error('Error al cargar datos');
        navigate('/admin/search');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchUser();
  }, [id, form, navigate]);


  const onFinish = async (values: any) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        birthdate: values.birthdate ? values.birthdate.format('YYYY-MM-DD') : null
      };

      await api.put(`/users/${id}`, payload);

      // If student, update inscription
      if (isStudent && inscriptionData) {
        try {
          await api.put(`/inscriptions/${inscriptionData.id}`, {
            gradeId: values.gradeId,
            sectionId: values.sectionId
          });
        } catch (inscErr) {
          console.error('Error updating inscription:', inscErr);
          // Continue anyway, main data was saved
        }
      }

      message.success('Actualizado exitosamente');
      navigate('/admin/search');
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.message || 'Error al actualizar');
    } finally {
      setSubmitting(false);
    }
  };

  // Get sections for selected grade
  const getSectionsForGrade = (gradeId: number | null) => {
    if (!gradeId) return [];
    const item = enrollStructure.find(s => s.gradeId === gradeId);
    return item?.sections || [];
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card title="Editar Usuario (Admin View)" extra={<Button onClick={() => navigate('/admin/search')}>Volver</Button>}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Account Section */}
            <div style={{ gridColumn: 'span 2' }}><h4 style={{ margin: 0, color: '#666' }}>Datos de Cuenta</h4></div>
            <Form.Item name="username" label="Usuario" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="password" label="Nueva Contraseña"><Input.Password placeholder="******" /></Form.Item>

            {/* Personal Data Section */}
            <div style={{ gridColumn: 'span 2' }}><h4 style={{ margin: 0, color: '#666' }}>Datos Personales</h4></div>
            <Form.Item name="firstName" label="Nombre" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="lastName" label="Apellido" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="documentType" label="Tipo"><Select><Option value="Venezolano">Venezolano</Option><Option value="Extranjero">Extranjero</Option><Option value="Pasaporte">Pasaporte</Option><Option value="Cedula Escolar">Cedula Escolar</Option></Select></Form.Item>
            <Form.Item name="document" label="Documento" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="gender" label="Género"><Radio.Group><Radio value="M">M</Radio><Radio value="F">F</Radio></Radio.Group></Form.Item>
            <Form.Item name="birthdate" label="F. Nacimiento"><DatePicker style={{ width: '100%' }} /></Form.Item>

            {/* Contact Section */}
            <div style={{ gridColumn: 'span 2' }}><h4 style={{ margin: 0, color: '#666' }}>Contacto</h4></div>
            <Form.Item name="address" label="Dirección" style={{ gridColumn: 'span 2' }} rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
            <Form.Item name="phone1" label="Teléfono 1" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="phone2" label="Teléfono 2"><Input /></Form.Item>
            <Form.Item name="email" label="Email"><Input /></Form.Item>
            <Form.Item name="whatsapp" label="WhatsApp"><Input /></Form.Item>

            {/* Student Inscription Data */}
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
                  <Select
                    placeholder="Seleccione Sección"
                    disabled={!selectedGradeId}
                    allowClear
                  >
                    {getSectionsForGrade(selectedGradeId).map((sec: any) => (
                      <Option key={sec.id} value={sec.id}>{sec.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </>
            )}

            {/* Role Assignment - RESTRICTED */}
            <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
              <h4 style={{ margin: 0, marginBottom: 8, color: '#666' }}>Permisos (Limitados)</h4>
            </div>
            <Form.Item
              name="roles"
              label="Roles"
              rules={[{ required: true, message: 'Seleccione al menos un rol' }]}
              style={{ gridColumn: 'span 2' }}
              help="Los roles Master y Admin no pueden ser modificados desde aquí."
            >
              <Select mode="multiple" placeholder="Selecciona roles">
                <Option value="Student">Estudiante</Option>
                <Option value="Tutor">Representante</Option>
                <Option value="Teacher">Profesor</Option>
                {/* Render Master/Admin as disabled options so they appear selected if user has them, but cannot be toggled */}
                <Option value="Admin" disabled>Admin (Restringido)</Option>
                <Option value="Master" disabled>Master (Restringido)</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block size="large">Guardar Cambios</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default EditUserAdmin;
