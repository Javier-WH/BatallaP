import React from 'react';
import { Form, Input, Select } from 'antd';
import type { FormItemProps } from 'antd';
import { DOCUMENT_TYPE_OPTIONS, type DocumentTypeOption } from '@/utils/personFields';

interface DocumentFieldProps {
  label?: React.ReactNode;
  required?: boolean;
  /** Form field holding the document type (e.g. `documentType`). */
  typeName: FormItemProps['name'];
  /** Form field holding the document number (e.g. `document`). */
  numberName: FormItemProps['name'];
  typeOptions?: DocumentTypeOption[];
  typeRules?: FormItemProps['rules'];
  numberRules?: FormItemProps['rules'];
  numberNormalize?: FormItemProps['normalize'];
  numberPlaceholder?: string;
  numberSuffix?: React.ReactNode;
  /** Lets an optional person's document type be cleared again. */
  allowClearType?: boolean;
}

/**
 * Document field with the type in a selector zone at the start (V, E, P, CE — the list opens
 * with the full names) and the number typed after it, drawn as ONE control (see
 * `.composite-field` in index.css). It keeps the two form values separate (`typeName` and
 * `numberName`), so validators and lookups that read them are unchanged; errors of both
 * show under the single field.
 */
const DocumentField: React.FC<DocumentFieldProps> = ({
  label, required, typeName, numberName, typeOptions = DOCUMENT_TYPE_OPTIONS,
  typeRules, numberRules, numberNormalize, numberPlaceholder, numberSuffix, allowClearType,
}) => (
  <Form.Item label={label} required={required}>
    <div className="composite-field">
      <Form.Item name={typeName} noStyle rules={typeRules}>
        <Select
          variant="borderless"
          placeholder="Tipo"
          allowClear={allowClearType}
          style={{ width: 68 }}
          popupMatchSelectWidth={false}
          options={typeOptions.map((option) => ({
            value: option.value,
            label: option.code,
            full: `${option.code} — ${option.label}`,
          }))}
          optionRender={(option) => (option.data as { full: string }).full}
        />
      </Form.Item>
      <Form.Item name={numberName} noStyle rules={numberRules} normalize={numberNormalize}>
        <Input variant="borderless" placeholder={numberPlaceholder} suffix={numberSuffix} />
      </Form.Item>
    </div>
  </Form.Item>
);

export default DocumentField;
