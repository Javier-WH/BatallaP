import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Button,
  Form,
  Input,
  Select,
  Switch,
  Table,
  Tag,
  Space,
  Tooltip,
  Modal,
  message,
  Typography,
  Empty
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { EnrollmentQuestionResponse, EnrollmentQuestionType } from '@/services/enrollmentQuestions';
import {
  createEnrollmentQuestion,
  getEnrollmentQuestions,
  reorderEnrollmentQuestions,
  setEnrollmentQuestionStatus,
  updateEnrollmentQuestion
} from '@/services/enrollmentQuestions';

const typeDescriptions: Record<EnrollmentQuestionType, string> = {
  text: 'Entrada de texto libre',
  select: 'Selector de una opción',
  checkbox: 'Seleccionar múltiples opciones'
};

const typeColors: Record<EnrollmentQuestionType, string> = {
  text: 'blue',
  select: 'purple',
  checkbox: 'geekblue'
};

const EnrollmentQuestions: React.FC = () => {
  const [questions, setQuestions] = useState<EnrollmentQuestionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<EnrollmentQuestionResponse | null>(null);
  const [form] = Form.useForm();

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEnrollmentQuestions(true);
      setQuestions(data);
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message ?? 'Error cargando preguntas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const openModal = useCallback((question?: EnrollmentQuestionResponse) => {
    setEditingQuestion(question ?? null);
    setIsModalVisible(true);
    if (question) {
      form.setFieldsValue({
        prompt: question.prompt,
        description: question.description,
        type: question.type,
        options: (question.options ?? []).join('\n'),
        required: question.required
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ type: 'text', required: false });
    }
  }, [form]);

  const handleModalCancel = () => {
    setIsModalVisible(false);
    setEditingQuestion(null);
    form.resetFields();
  };

  const parseOptions = (type: EnrollmentQuestionType, raw: string | undefined) => {
    if (type === 'text') return null;
    if (!raw || raw.trim() === '') {
      throw new Error('Debe ingresar al menos una opción (una por línea).');
    }
    const options = Array.from(
      new Set(
        raw
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      )
    );
    if (options.length === 0) {
      throw new Error('Debe ingresar opciones válidas.');
    }
    return options;
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        prompt: values.prompt.trim(),
        description: values.description?.trim() || null,
        type: values.type as EnrollmentQuestionType,
        options: parseOptions(values.type, values.options),
        required: Boolean(values.required)
      };

      if (editingQuestion) {
        await updateEnrollmentQuestion(editingQuestion.id, payload);
        message.success('Pregunta actualizada');
      } else {
        await createEnrollmentQuestion(payload);
        message.success('Pregunta creada');
      }
      handleModalCancel();
      fetchQuestions();
    } catch (error) {
      if (error instanceof Error && error.name === 'Error') {
        message.error(error.message);
        return;
      }
      const err = error as { response?: { data?: { message?: string } } };
      const apiMessage = err.response?.data?.message ?? 'No se pudo guardar la pregunta';
      message.error(apiMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = useCallback(async (question: EnrollmentQuestionResponse) => {
    try {
      await setEnrollmentQuestionStatus(question.id, !question.isActive);
      message.success(`Pregunta ${question.isActive ? 'inactivada' : 'activada'}`);
      fetchQuestions();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message ?? 'Error cambiando estado');
    }
  }, [fetchQuestions]);

  const handleReorder = useCallback(async (questionId: number, direction: 'up' | 'down') => {
    const currentIndex = questions.findIndex((q) => q.id === questionId);
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= questions.length) {
      return;
    }

    const newOrder = [...questions];
    const temp = newOrder[currentIndex];
    newOrder[currentIndex] = newOrder[nextIndex];
    newOrder[nextIndex] = temp;

    try {
      setQuestions(newOrder);
      await reorderEnrollmentQuestions(newOrder.map((q) => q.id));
      message.success('Orden actualizado');
      fetchQuestions();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message ?? 'Error reordenando preguntas');
      fetchQuestions();
    }
  }, [fetchQuestions, questions]);

  const columns: ColumnsType<EnrollmentQuestionResponse> = useMemo(
    () => [
      {
        title: 'Pregunta',
        dataIndex: 'prompt',
        key: 'prompt',
        render: (value: string, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{value}</Typography.Text>
            {record.description && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {record.description}
              </Typography.Text>
            )}
          </Space>
        )
      },
      {
        title: 'Tipo',
        dataIndex: 'type',
        key: 'type',
        render: (type: EnrollmentQuestionType) => (
          <Tag color={typeColors[type]}>{typeDescriptions[type]}</Tag>
        ),
        width: 200
      },
      {
        title: 'Opciones',
        dataIndex: 'options',
        key: 'options',
        render: (options: string[] | null, record) =>
          record.type === 'text' ? '-' : (
            <Typography.Paragraph style={{ margin: 0 }} ellipsis={{ rows: 2, expandable: true }}>
              {(options ?? []).join(', ')}
            </Typography.Paragraph>
          ),
        width: 260
      },
      {
        title: 'Campos',
        key: 'flags',
        render: (_, record) => (
          <Space>
            <Tag color={record.required ? 'red' : 'default'}>
              {record.required ? 'Requerido' : 'Opcional'}
            </Tag>
            <Tag color={record.isActive ? 'green' : 'default'}>
              {record.isActive ? 'Activa' : 'Inactiva'}
            </Tag>
          </Space>
        ),
        width: 200
      },
      {
        title: 'Acciones',
        key: 'actions',
        width: 230,
        render: (_, record, index) => (
          <Space wrap>
            <Tooltip title="Editar">
              <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
            </Tooltip>
            <Tooltip title={record.isActive ? 'Desactivar' : 'Activar'}>
              <Button
                icon={record.isActive ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
                onClick={() => handleToggleActive(record)}
              />
            </Tooltip>
            <Tooltip title="Subir">
              <Button
                icon={<ArrowUpOutlined />}
                disabled={index === 0}
                onClick={() => handleReorder(record.id, 'up')}
              />
            </Tooltip>
            <Tooltip title="Bajar">
              <Button
                icon={<ArrowDownOutlined />}
                disabled={index === questions.length - 1}
                onClick={() => handleReorder(record.id, 'down')}
              />
            </Tooltip>
          </Space>
        )
      }
    ],
    [handleReorder, handleToggleActive, openModal, questions]
  );

  const hasQuestions = questions.length > 0;

  return (
    <>
      <Card
        title="Preguntas dinámicas de inscripción"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchQuestions} loading={loading}>
              Actualizar
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Nueva Pregunta
            </Button>
          </Space>
        }
      >
        <Typography.Paragraph style={{ maxWidth: 720 }}>
          Define preguntas personalizadas que aparecerán en el formulario de inscripción. Puedes
          crear campos de texto libre, selectores y casillas múltiples. Las preguntas no se eliminan,
          solo se pueden desactivar para conservar historial.
        </Typography.Paragraph>

        <Table
          rowKey="id"
          dataSource={questions}
          columns={columns}
          pagination={false}
          loading={loading}
          locale={{
            emptyText: (
              <Empty
                description="No hay preguntas configuradas aún"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )
          }}
        />
      </Card>

      <Modal
        open={isModalVisible}
        title={editingQuestion ? 'Editar Pregunta' : 'Nueva Pregunta'}
        okText={editingQuestion ? 'Guardar Cambios' : 'Crear Pregunta'}
        onCancel={handleModalCancel}
        onOk={handleSubmit}
        confirmLoading={saving}
        destroyOnClose
        width={600}
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            label="Texto de la pregunta"
            name="prompt"
            rules={[{ required: true, message: 'Ingrese la pregunta' }]}
          >
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item label="Descripción (opcional)" name="description">
            <Input.TextArea rows={2} maxLength={280} showCount />
          </Form.Item>

          <Form.Item
            label="Tipo de campo"
            name="type"
            rules={[{ required: true, message: 'Seleccione el tipo de pregunta' }]}
          >
            <Select
              options={[
                { label: typeDescriptions.text, value: 'text' },
                { label: typeDescriptions.select, value: 'select' },
                { label: typeDescriptions.checkbox, value: 'checkbox' }
              ]}
            />
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const fieldType = getFieldValue('type') as EnrollmentQuestionType | undefined;
              if (!fieldType || fieldType === 'text') return null;
              return (
                <Form.Item
                  label="Opciones (una por línea)"
                  name="options"
                  rules={[{ required: true, message: 'Ingrese las opciones para este campo' }]}
                >
                  <Input.TextArea rows={4} placeholder="Ejemplo: Sí&#10;No" />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item
            label="Campo requerido"
            name="required"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {!hasQuestions && !loading && (
        <Card style={{ marginTop: 16 }}>
          <Empty description="Agrega tu primera pregunta personalizada" />
        </Card>
      )}
    </>
  );
};

export default EnrollmentQuestions;
