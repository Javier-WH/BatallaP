import React, { useState, useEffect } from 'react';
import { Modal, AutoComplete, Button, Space, Typography, Empty, Spin } from 'antd';
import { BankOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Text } = Typography;

interface PlantelOption {
  id: number;
  code: string;
  name: string;
  state: string;
}

interface PlantelSelectorModalProps {
  open: boolean;
  currentPlantelLabel?: string;
  onSelect: (plantel: { id: number; code: string; name: string; state: string }) => void;
  onClose: () => void;
}

const PlantelSelectorModal: React.FC<PlantelSelectorModalProps> = ({
  open,
  currentPlantelLabel,
  onSelect,
  onClose
}) => {
  const [searchText, setSearchText] = useState('');
  const [options, setOptions] = useState<{ value: string; label: string; plantel: PlantelOption }[]>([]);
  const [selectedPlantel, setSelectedPlantel] = useState<PlantelOption | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearchText('');
      setOptions([]);
      setSelectedPlantel(null);
    }
  }, [open]);

  const handleSearch = async (value: string) => {
    setSearchText(value);
    if (!value || value.length < 2) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const response = await api.get('/planteles/search', { params: { q: value, limit: 20 } });
      const mappedOptions = response.data.map((p: PlantelOption) => ({
        value: p.code,
        label: `[${p.code}] — ${p.name} (${p.state})`,
        plantel: p
      }));
      setOptions(mappedOptions);
    } catch (error) {
      console.error('Error searching planteles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (_value: string, option: { plantel: PlantelOption }) => {
    setSelectedPlantel(option.plantel);
  };

  const handleConfirm = () => {
    if (selectedPlantel) {
      onSelect(selectedPlantel);
      onClose();
    }
  };

  return (
    <Modal
      title={
        <Space>
          <BankOutlined />
          <span>Seleccionar Plantel</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="primary" onClick={handleConfirm} disabled={!selectedPlantel}>
            Confirmar
          </Button>
        </Space>
      }
      width={500}
    >
      <div className="space-y-4">
        {currentPlantelLabel && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <Text type="secondary" className="text-xs">Plantel actual:</Text>
            <div className="font-medium text-blue-900">{currentPlantelLabel}</div>
          </div>
        )}

        <div>
          <Text className="block mb-2 font-medium">Buscar plantel por código o nombre:</Text>
          <AutoComplete
            value={searchText}
            onSearch={handleSearch}
            onSelect={handleSelect}
            options={options}
            placeholder="Ej: 0123456 o Colegio..."
            className="w-full"
            filterOption={false}
            allowClear
            notFoundContent={loading ? <Spin size="small" /> : <Empty description="No hay resultados" />}
          />
        </div>

        {selectedPlantel && (
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <Text className="block mb-1 text-xs text-green-700">Seleccionado:</Text>
            <div className="font-medium text-green-900">
              [{selectedPlantel.code}] — {selectedPlantel.name} ({selectedPlantel.state})
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PlantelSelectorModal;
