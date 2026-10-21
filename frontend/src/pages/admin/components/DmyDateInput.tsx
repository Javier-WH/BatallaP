import { DatePicker } from 'antd';
import dayjs from 'dayjs';

interface Props {
  /** ISO date (YYYY-MM-DD) or empty. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  allowClear?: boolean;
  placeholder?: string;
}

/**
 * Date field shown as dd/mm/yyyy regardless of the browser language (the native
 * `<input type="date">` follows the OS locale). Reads and writes ISO strings.
 */
export default function DmyDateInput({ value, onChange, min, max, allowClear, placeholder = 'dd/mm/aaaa' }: Props) {
  return (
    <DatePicker
      className="w-full"
      format="DD/MM/YYYY"
      placeholder={placeholder}
      allowClear={!!allowClear}
      value={value ? dayjs(value) : null}
      onChange={d => onChange(d ? d.format('YYYY-MM-DD') : '')}
      disabledDate={d => (!!min && d.isBefore(dayjs(min), 'day')) || (!!max && d.isAfter(dayjs(max), 'day'))}
    />
  );
}
