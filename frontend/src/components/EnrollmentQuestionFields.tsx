import React from 'react';
import { Form, Input, Select, Checkbox, Typography } from 'antd';
import type { EnrollmentQuestionResponse } from '@/services/enrollmentQuestions';

const { Text } = Typography;

type Props = {
  questions: EnrollmentQuestionResponse[];
  parentName?: string;
};

const EnrollmentQuestionFields: React.FC<Props> = ({ questions, parentName = 'enrollmentAnswers' }) => {
  if (!questions.length) {
    return null;
  }

  const renderControl = (question: EnrollmentQuestionResponse) => {
    if (question.type === 'select') {
      const options = (question.options ?? []).map((option) => ({
        label: option,
        value: option
      }));
      return (
        <Select
          placeholder="Seleccione una opción"
          options={options}
          allowClear={!question.required}
        />
      );
    }

    if (question.type === 'checkbox') {
      const options = (question.options ?? []).map((option) => ({
        label: option,
        value: option
      }));
      return <Checkbox.Group options={options} />;
    }

    return <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {questions.map((question) => (
        <Form.Item
          key={question.id}
          label={
            <span>
              {question.prompt}
              {question.required && (
                <Text type="danger" style={{ marginLeft: 6 }}>
                  *
                </Text>
              )}
            </span>
          }
          name={[parentName, question.id.toString()]}
          rules={
            question.required
              ? [{ required: true, message: 'Este campo es obligatorio' }]
              : undefined
          }
          extra={question.description || undefined}
        >
          {renderControl(question)}
        </Form.Item>
      ))}
    </div>
  );
};

export default EnrollmentQuestionFields;
