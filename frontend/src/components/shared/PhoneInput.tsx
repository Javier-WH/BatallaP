import React, { useState } from 'react';
import { Input, Select } from 'antd';
import { PHONE_NUMBER_LENGTH, PHONE_PREFIXES, joinPhone, splitPhone } from '@/utils/personFields';

interface PhoneInputProps {
  /** Stored value, `04XX-XXXXXXX`. */
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Main phone / WhatsApp field: the operator code in a selector at the start (0414, 0416…) and
 * only the 7-digit number typed after it, drawn as one field. It works as the child of a
 * Form.Item and reads/writes the usual `04XX-XXXXXXX` string, so rules and saved data do not
 * change. Until a number is typed the value stays empty (an optional phone is valid), but the
 * chosen code is kept.
 */
const PhoneInput: React.FC<PhoneInputProps> = ({ value, onChange, placeholder, disabled, id }) => {
  const [draftPrefix, setDraftPrefix] = useState('');
  const { prefix: storedPrefix, number } = splitPhone(value);
  const prefix = storedPrefix || draftPrefix;
  // A stored prefix outside the list (e.g. a landline) stays selectable so editing never loses it.
  const prefixes = !prefix || PHONE_PREFIXES.includes(prefix) ? PHONE_PREFIXES : [prefix, ...PHONE_PREFIXES];

  const emit = (nextPrefix: string, nextNumber: string) =>
    onChange?.(nextNumber ? joinPhone(nextPrefix, nextNumber) : '');

  const handleNumber = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '');
    // A full number pasted into the number box (04149443784) fills both parts.
    if (digits.length > PHONE_NUMBER_LENGTH && digits.startsWith('0')) {
      const pastedPrefix = digits.slice(0, 4);
      setDraftPrefix(pastedPrefix);
      emit(pastedPrefix, digits.slice(4, 4 + PHONE_NUMBER_LENGTH));
      return;
    }
    emit(prefix, digits.slice(0, PHONE_NUMBER_LENGTH));
  };

  return (
    <div className={`composite-field${disabled ? ' composite-field-disabled' : ''}`}>
      <Select
        variant="borderless"
        value={prefix || undefined}
        placeholder="04XX"
        allowClear
        disabled={disabled}
        style={{ width: 84 }}
        popupMatchSelectWidth={false}
        options={prefixes.map((item) => ({ value: item, label: item }))}
        onChange={(next?: string) => {
          setDraftPrefix(next ?? '');
          emit(next ?? '', number);
        }}
      />
      <Input
        id={id}
        variant="borderless"
        value={number}
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder ?? '1234567'}
        disabled={disabled}
        onChange={handleNumber}
      />
    </div>
  );
};

export default PhoneInput;
