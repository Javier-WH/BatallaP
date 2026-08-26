import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select, message,
  Space, Tag, Typography, Row, Col, Tabs, Popconfirm, Switch, Divider, Statistic, Tooltip,
} from 'antd';
import {
  DollarOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined,
  CalculatorOutlined, ShoppingOutlined, BankOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useSchool } from '@/context/SchoolContext';
import type {
  ExchangeRateType, ExchangeRate, Fee, SellableItem, EnrollmentPlan, PlanCalculation,
} from '@/services/paymentsService';
import {
  listExchangeRateTypes, createExchangeRateType, updateExchangeRateType, deleteExchangeRateType,
  listExchangeRates, upsertExchangeRate,
  listFees, upsertFee, updateFee,
  listSellableItems, createSellableItem, updateSellableItem, deleteSellableItem,
  listEnrollmentPlans, createEnrollmentPlan, updateEnrollmentPlan, deleteEnrollmentPlan,
  calculateEnrollmentPlan,
} from '@/services/paymentsService';

const { Title, Text } = Typography;

const PaymentsConfig: React.FC = () => {
  const { activePeriod, allPeriods } = useSchool();
  const [activeTab, setActiveTab] = useState('exchangeRates');

  // ── Exchange Rate Types ──
  const [rateTypes, setRateTypes] = useState<ExchangeRateType[]>([]);
  const [rateTypesLoading, setRateTypesLoading] = useState(false);
  const [rateTypeModalOpen, setRateTypeModalOpen] = useState(false);
  const [editingRateType, setEditingRateType] = useState<ExchangeRateType | null>(null);
  const [rateTypeForm] = Form.useForm();

  // ── Exchange Rates ──
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [rateForm] = Form.useForm();

  // ── Fees ──
  const [fees, setFees] = useState<Fee[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [feeForm] = Form.useForm();
  const [feePeriodFilter, setFeePeriodFilter] = useState<number | undefined>(undefined);

  // ── Sellable Items ──
  const [items, setItems] = useState<SellableItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SellableItem | null>(null);
  const [itemForm] = Form.useForm();

  // ── Enrollment Plans ──
  const [plans, setPlans] = useState<EnrollmentPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<EnrollmentPlan | null>(null);
  const [planForm] = Form.useForm();
  const [planItems, setPlanItems] = useState<any[]>([]);
  const [calculation, setCalculation] = useState<PlanCalculation | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // ── Load functions ──
  const loadRateTypes = useCallback(async () => {
    setRateTypesLoading(true);
    try {
      const data = await listExchangeRateTypes();
      setRateTypes(data);
    } catch { message.error('Error al cargar tipos de cambio'); }
    finally { setRateTypesLoading(false); }
  }, []);

  const loadRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const data = await listExchangeRates({ latest: true });
      setRates(data);
    } catch { message.error('Error al cargar tipos de cambio'); }
    finally { setRatesLoading(false); }
  }, []);

  const loadFees = useCallback(async () => {
    setFeesLoading(true);
    try {
      const data = await listFees(feePeriodFilter ? { schoolPeriodId: feePeriodFilter } : undefined);
      setFees(data);
    } catch { message.error('Error al cargar costos'); }
    finally { setFeesLoading(false); }
  }, [feePeriodFilter]);

  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const data = await listSellableItems();
      setItems(data);
    } catch { message.error('Error al cargar items'); }
    finally { setItemsLoading(false); }
  }, []);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const data = await listEnrollmentPlans();
      setPlans(data);
    } catch { message.error('Error al cargar planes'); }
    finally { setPlansLoading(false); }
  }, []);

  useEffect(() => { loadRateTypes(); loadRates(); }, [loadRateTypes, loadRates]);
  useEffect(() => { loadFees(); }, [loadFees]);
  useEffect(() => { loadItems(); loadPlans(); }, [loadItems, loadPlans]);

  // ── Exchange Rate Type handlers ──
  const openRateTypeModal = (type?: ExchangeRateType) => {
    setEditingRateType(type ?? null);
    if (type) rateTypeForm.setFieldsValue(type);
    else rateTypeForm.resetFields();
    setRateTypeModalOpen(true);
  };

  const handleSaveRateType = async () => {
    try {
      const values = await rateTypeForm.validateFields();
      if (editingRateType) {
        await updateExchangeRateType(editingRateType.id, values);
        message.success('Tipo de cambio actualizado');
      } else {
        await createExchangeRateType(values);
        message.success('Tipo de cambio creado');
      }
      setRateTypeModalOpen(false);
      loadRateTypes();
    } catch { /* validation error */ }
  };

  const handleDeleteRateType = async (id: number) => {
    try {
      await deleteExchangeRateType(id);
      message.success('Tipo de cambio eliminado');
      loadRateTypes();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error al eliminar');
    }
  };

  // ── Exchange Rate handlers ──
  const openRateModal = (typeId?: number) => {
    rateForm.resetFields();
    if (typeId) rateForm.setFieldsValue({ exchangeRateTypeId: typeId });
    else if (rateTypes.length > 0) rateForm.setFieldsValue({ exchangeRateTypeId: rateTypes[0].id });
    rateForm.setFieldsValue({ date: new Date().toISOString().slice(0, 10) });
    setRateModalOpen(true);
  };

  const handleSaveRate = async () => {
    try {
      const values = await rateForm.validateFields();
      await upsertExchangeRate(values);
      message.success('Tipo de cambio guardado');
      setRateModalOpen(false);
      loadRates();
    } catch { /* validation error */ }
  };

  // ── Fee handlers ──
  const openFeeModal = (fee?: Fee) => {
    setEditingFee(fee ?? null);
    if (fee) {
      feeForm.setFieldsValue(fee);
    } else {
      feeForm.resetFields();
      feeForm.setFieldsValue({
        schoolPeriodId: activePeriod?.id,
        exchangeRateTypeId: rateTypes.find(t => t.isDefault)?.id ?? rateTypes[0]?.id,
      });
    }
    setFeeModalOpen(true);
  };

  const handleSaveFee = async () => {
    try {
      const values = await feeForm.validateFields();
      if (editingFee) {
        await updateFee(editingFee.id, values);
        message.success('Costo actualizado');
      } else {
        await upsertFee(values);
        message.success('Costo creado');
      }
      setFeeModalOpen(false);
      loadFees();
    } catch { /* validation error */ }
  };

  // ── Sellable Item handlers ──
  const openItemModal = (item?: SellableItem) => {
    setEditingItem(item ?? null);
    if (item) itemForm.setFieldsValue(item);
    else {
      itemForm.resetFields();
      itemForm.setFieldsValue({
        exchangeRateTypeId: rateTypes.find(t => t.isDefault)?.id ?? rateTypes[0]?.id,
        active: true,
      });
    }
    setItemModalOpen(true);
  };

  const handleSaveItem = async () => {
    try {
      const values = await itemForm.validateFields();
      if (editingItem) {
        await updateSellableItem(editingItem.id, values);
        message.success('Item actualizado');
      } else {
        await createSellableItem(values);
        message.success('Item creado');
      }
      setItemModalOpen(false);
      loadItems();
    } catch { /* validation error */ }
  };

  const handleDeleteItem = async (id: number) => {
    try {
      await deleteSellableItem(id);
      message.success('Item desactivado');
      loadItems();
    } catch { message.error('Error al eliminar'); }
  };

  // ── Enrollment Plan handlers ──
  const openPlanModal = (plan?: EnrollmentPlan) => {
    setEditingPlan(plan ?? null);
    if (plan) {
      planForm.setFieldsValue(plan);
      setPlanItems(plan.items ?? []);
    } else {
      planForm.resetFields();
      planForm.setFieldsValue({
        targetExchangeRateTypeId: rateTypes.find(t => t.isDefault)?.id ?? rateTypes[0]?.id,
        conversionMode: 'exchange_rate',
        active: true,
      });
      setPlanItems([]);
    }
    setPlanModalOpen(true);
  };

  const handleAddPlanItem = () => {
    setPlanItems([...planItems, { itemType: 'fee', feeId: null, sellableItemId: null, quantity: 1 }]);
  };

  const handleRemovePlanItem = (idx: number) => {
    setPlanItems(planItems.filter((_, i) => i !== idx));
  };

  const handlePlanItemChange = (idx: number, field: string, value: any) => {
    const updated = [...planItems];
    updated[idx] = { ...updated[idx], [field]: value };
    // Clear the other ID when switching type
    if (field === 'itemType') {
      updated[idx].feeId = null;
      updated[idx].sellableItemId = null;
    }
    setPlanItems(updated);
  };

  const handleSavePlan = async () => {
    try {
      const values = await planForm.validateFields();
      const payload = { ...values, items: planItems };
      if (editingPlan) {
        await updateEnrollmentPlan(editingPlan.id, payload);
        message.success('Plan actualizado');
      } else {
        await createEnrollmentPlan(payload);
        message.success('Plan creado');
      }
      setPlanModalOpen(false);
      loadPlans();
    } catch { /* validation error */ }
  };

  const handleDeletePlan = async (id: number) => {
    try {
      await deleteEnrollmentPlan(id);
      message.success('Plan desactivado');
      loadPlans();
    } catch { message.error('Error al eliminar'); }
  };

  const handleCalculate = async (id: number) => {
    setCalcLoading(true);
    try {
      const result = await calculateEnrollmentPlan(id);
      setCalculation(result);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error al calcular');
    } finally { setCalcLoading(false); }
  };

  // ── Columns ──
  const rateTypeColumns = [
    { title: 'Código', dataIndex: 'code', key: 'code' },
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    { title: 'Moneda', dataIndex: 'currency', key: 'currency', render: (c: string) => <Tag>{c}</Tag> },
    { title: 'Por defecto', dataIndex: 'isDefault', key: 'isDefault', render: (v: boolean) => v ? <Tag color="green">Sí</Tag> : null },
    { title: 'Activo', dataIndex: 'active', key: 'active', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Sí' : 'No'}</Tag> },
    {
      title: 'Acciones', key: 'actions',
      render: (_: any, record: ExchangeRateType) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openRateTypeModal(record)} />
          {!record.isDefault && (
            <Popconfirm title="¿Eliminar?" onConfirm={() => handleDeleteRateType(record.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const rateColumns = [
    { title: 'Tipo', key: 'type', render: (_: any, r: ExchangeRate) => r.type?.name ?? '—' },
    { title: 'Moneda', key: 'currency', render: (_: any, r: ExchangeRate) => <Tag>{r.type?.currency}</Tag> },
    { title: 'Rate (VES)', dataIndex: 'rate', key: 'rate', render: (v: number) => v.toLocaleString('es-VE', { minimumFractionDigits: 2 }) },
    { title: 'Fecha', dataIndex: 'date', key: 'date' },
  ];

  const feeColumns = [
    { title: 'Período', key: 'period', render: (_: any, f: Fee) => f.schoolPeriod?.period ?? '—' },
    { title: 'Concepto', dataIndex: 'name', key: 'name' },
    { title: 'Tipo', dataIndex: 'key', key: 'key', render: (k: string) => {
      const labels: Record<string, string> = { mensualidad: 'Mensualidad', matricula: 'Matrícula', gastos_administrativos: 'Gastos Admin' };
      return <Tag>{labels[k] ?? k}</Tag>;
    }},
    { title: 'Monto', dataIndex: 'amount', key: 'amount', render: (v: number) => v.toLocaleString('es-VE', { minimumFractionDigits: 2 }) },
    { title: 'Moneda', key: 'currency', render: (_: any, f: Fee) => f.exchangeRateType?.name ?? '—' },
    { title: 'Activo', dataIndex: 'active', key: 'active', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Sí' : 'No'}</Tag> },
    {
      title: 'Acciones', key: 'actions',
      render: (_: any, record: Fee) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openFeeModal(record)} />
      ),
    },
  ];

  const itemColumns = [
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    { title: 'Categoría', dataIndex: 'category', key: 'category', render: (c: string | null) => c ? <Tag>{c}</Tag> : null },
    { title: 'Monto', dataIndex: 'amount', key: 'amount', render: (v: number) => v.toLocaleString('es-VE', { minimumFractionDigits: 2 }) },
    { title: 'Moneda', key: 'currency', render: (_: any, i: SellableItem) => i.exchangeRateType?.name ?? '—' },
    { title: 'Activo', dataIndex: 'active', key: 'active', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Sí' : 'No'}</Tag> },
    {
      title: 'Acciones', key: 'actions',
      render: (_: any, record: SellableItem) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openItemModal(record)} />
          <Popconfirm title="¿Desactivar?" onConfirm={() => handleDeleteItem(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const planColumns = [
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    { title: 'Descripción', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Moneda destino', key: 'target', render: (_: any, p: EnrollmentPlan) => p.targetExchangeRateType?.name ?? '—' },
    { title: 'Items', key: 'items', render: (_: any, p: EnrollmentPlan) => p.items?.length ?? 0 },
    {
      title: 'Items (moneda original)',
      key: 'amounts',
      render: (_: any, p: EnrollmentPlan) => {
        if (!p.items || p.items.length === 0) return '—';
        // Group by currency
        const byCurrency: Record<string, number> = {};
        for (const it of p.items) {
          const ref = it.itemType === 'fee' ? it.fee : it.sellableItem;
          if (!ref) continue;
          const cur = ref.exchangeRateType?.currency ?? '?';
          byCurrency[cur] = (byCurrency[cur] ?? 0) + Number(ref.amount) * it.quantity;
        }
        return (
          <Space wrap>
            {Object.entries(byCurrency).map(([cur, total]) => (
              <Tag key={cur}>{total.toFixed(2)} {cur}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Total plan',
      key: 'planTotal',
      render: (_: any, p: EnrollmentPlan) => {
        if (!p.items || p.items.length === 0) return '—';
        const targetCur = p.targetExchangeRateType?.currency ?? '?';
        const targetName = p.targetExchangeRateType?.name ?? '—';
        if (p.conversionMode === 'same_amount') {
          // Sum all item amounts × quantity (regardless of currency)
          const sum = p.items.reduce((acc: number, it: any) => {
            const ref = it.itemType === 'fee' ? it.fee : it.sellableItem;
            return ref ? acc + Number(ref.amount) * it.quantity : acc;
          }, 0);
          return (
            <Tooltip title={`Mismo monto en ${targetName}`}>
              <Tag color="green">{sum.toFixed(2)} {targetCur}</Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title={`Conversión por tasa de cambio → ${targetName}`}>
            <Tag color="blue">? {targetCur}</Tag>
          </Tooltip>
        );
      },
    },
    { title: 'Activo', dataIndex: 'active', key: 'active', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Sí' : 'No'}</Tag> },
    {
      title: 'Acciones', key: 'actions',
      render: (_: any, record: EnrollmentPlan) => (
        <Space>
          <Button size="small" icon={<CalculatorOutlined />} loading={calcLoading} onClick={() => handleCalculate(record.id)} />
          <Button size="small" icon={<EditOutlined />} onClick={() => openPlanModal(record)} />
          <Popconfirm title="¿Desactivar?" onConfirm={() => handleDeletePlan(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Title level={3}><DollarOutlined /> Configuración de Pagos</Title>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          // ── Tab 1: Tipos de Cambio ──
          {
            key: 'exchangeRates',
            label: <span><BankOutlined /> Tipos de Cambio</span>,
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Card title="Tipos de Cambio" extra={
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={() => { loadRateTypes(); loadRates(); }}>Recargar</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openRateTypeModal()}>Nuevo Tipo</Button>
                  </Space>
                }>
                  <Table columns={rateTypeColumns} dataSource={rateTypes} rowKey="id" loading={rateTypesLoading} pagination={false} size="small" />
                </Card>

                <Card title="Rates Actuales" extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openRateModal()}>Actualizar Rate</Button>
                }>
                  <Table columns={rateColumns} dataSource={rates} rowKey="id" loading={ratesLoading} pagination={false} size="small" />
                </Card>
              </Space>
            ),
          },

          // ── Tab 2: Costos Fijos ──
          {
            key: 'fees',
            label: <span><DollarOutlined /> Costos Fijos</span>,
            children: (
              <Card title="Mensualidad, Matrícula y Gastos Administrativos" extra={
                <Space>
                  <Select
                    placeholder="Filtrar por período"
                    allowClear
                    style={{ width: 200 }}
                    value={feePeriodFilter}
                    onChange={setFeePeriodFilter}
                    options={allPeriods.map((p: any) => ({ value: p.id, label: p.period }))}
                  />
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openFeeModal()}>Nuevo Costo</Button>
                </Space>
              }>
                <Table columns={feeColumns} dataSource={fees} rowKey="id" loading={feesLoading} pagination={false} size="small" />
              </Card>
            ),
          },

          // ── Tab 3: Items Vendibles ──
          {
            key: 'items',
            label: <span><ShoppingOutlined /> Items Vendibles</span>,
            children: (
              <Card title="Uniformes, Distintivos, etc." extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openItemModal()}>Nuevo Item</Button>
              }>
                <Table columns={itemColumns} dataSource={items} rowKey="id" loading={itemsLoading} pagination={{ pageSize: 10 }} size="small" />
              </Card>
            ),
          },

          // ── Tab 4: Planes de Inscripción ──
          {
            key: 'plans',
            label: <span><CalculatorOutlined /> Planes de Inscripción</span>,
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Card title="Planes" extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openPlanModal()}>Nuevo Plan</Button>
                }>
                  <Table columns={planColumns} dataSource={plans} rowKey="id" loading={plansLoading} pagination={false} size="small" />
                </Card>

                {calculation && (
                  <Card title={`Cálculo: ${calculation.planName}`} size="small">
                    <div style={{ marginBottom: 16 }}>
                      <Tag color={calculation.conversionMode === 'same_amount' ? 'green' : 'blue'}>
                        {calculation.conversionMode === 'same_amount'
                          ? 'Mismo monto, otra moneda'
                          : 'Conversión por tasa de cambio'}
                      </Tag>
                      {calculation.missingRates && calculation.missingRates.length > 0 && (
                        <Tag color="orange">Faltan tipos de cambio. Los montos en VES no están disponibles.</Tag>
                      )}
                    </div>
                    <Row gutter={16}>
                      <Col span={6}>
                        <Statistic
                          title="Total VES"
                          value={calculation.totalVES !== null ? calculation.totalVES : '—'}
                          precision={calculation.totalVES !== null ? 2 : undefined}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title={`Total (${calculation.targetCurrencyName})`}
                          value={calculation.total !== null ? calculation.total : '—'}
                          precision={calculation.total !== null ? 2 : undefined}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic title="Rate destino" value={calculation.targetRate !== null ? calculation.targetRate : '—'} precision={calculation.targetRate !== null ? 2 : undefined} />
                      </Col>
                      <Col span={6}>
                        <Statistic title="Fecha" value={calculation.date} />
                      </Col>
                    </Row>
                    <Divider />
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={calculation.breakdown}
                      rowKey={(r) => `${r.itemType}-${r.name}`}
                      columns={[
                        { title: 'Item', dataIndex: 'name', key: 'name' },
                        {
                          title: 'Monto',
                          key: 'amount',
                          render: (_: any, r: any) => `${r.amount.toFixed(2)} ${r.currency}`,
                        },
                        {
                          title: 'Cantidad',
                          dataIndex: 'quantity',
                          key: 'quantity',
                        },
                        {
                          title: 'Subtotal',
                          key: 'subtotal',
                          render: (_: any, r: any) => `${r.totalOriginal.toFixed(2)} ${r.currency}`,
                        },
                        {
                          title: 'Rate (VES)',
                          dataIndex: 'rate',
                          key: 'rate',
                          render: (v: number | null) => v !== null ? v.toFixed(4) : <Tag color="orange">Sin rate</Tag>,
                        },
                        {
                          title: 'Total VES',
                          dataIndex: 'totalVES',
                          key: 'totalVES',
                          render: (v: number | null) => v !== null ? v.toFixed(2) : <Tag color="orange">—</Tag>,
                        },
                      ]}
                    />
                  </Card>
                )}
              </Space>
            ),
          },
        ]}
      />

      {/* ── Rate Type Modal ── */}
      <Modal
        title={editingRateType ? 'Editar Tipo de Cambio' : 'Nuevo Tipo de Cambio'}
        open={rateTypeModalOpen}
        onOk={handleSaveRateType}
        onCancel={() => setRateTypeModalOpen(false)}
        okText="Guardar"
      >
        <Form form={rateTypeForm} layout="vertical">
          <Form.Item name="code" label="Código" rules={[{ required: true }]}>
            <Input placeholder="USD_BCV" />
          </Form.Item>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Dólar BCV" />
          </Form.Item>
          <Form.Item name="currency" label="Moneda (ISO)" rules={[{ required: true }]}>
            <Input placeholder="USD" maxLength={3} />
          </Form.Item>
          <Form.Item name="isDefault" label="Por defecto" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="active" label="Activo" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Rate Modal ── */}
      <Modal
        title="Actualizar Rate"
        open={rateModalOpen}
        onOk={handleSaveRate}
        onCancel={() => setRateModalOpen(false)}
        okText="Guardar"
      >
        <Form form={rateForm} layout="vertical">
          <Form.Item name="exchangeRateTypeId" label="Tipo de Cambio" rules={[{ required: true }]}>
            <Select options={rateTypes.map(t => ({ value: t.id, label: `${t.name} (${t.currency})` }))} />
          </Form.Item>
          <Form.Item name="rate" label="Rate (VES por unidad)" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="date" label="Fecha" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Fee Modal ── */}
      <Modal
        title={editingFee ? 'Editar Costo' : 'Nuevo Costo'}
        open={feeModalOpen}
        onOk={handleSaveFee}
        onCancel={() => setFeeModalOpen(false)}
        okText="Guardar"
      >
        <Form form={feeForm} layout="vertical">
          <Form.Item name="schoolPeriodId" label="Período Escolar" rules={[{ required: true }]}>
            <Select options={allPeriods.map((p: any) => ({ value: p.id, label: p.period }))} />
          </Form.Item>
          <Form.Item name="key" label="Concepto" rules={[{ required: true }]}>
            <Select options={[
              { value: 'mensualidad', label: 'Mensualidad' },
              { value: 'matricula', label: 'Matrícula' },
              { value: 'gastos_administrativos', label: 'Gastos Administrativos' },
            ]} />
          </Form.Item>
          <Form.Item name="name" label="Nombre personalizado" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="amount" label="Monto" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="exchangeRateTypeId" label="Tipo de Cambio" rules={[{ required: true }]}>
            <Select options={rateTypes.map(t => ({ value: t.id, label: `${t.name} (${t.currency})` }))} />
          </Form.Item>
          <Form.Item name="active" label="Activo" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Sellable Item Modal ── */}
      <Modal
        title={editingItem ? 'Editar Item' : 'Nuevo Item'}
        open={itemModalOpen}
        onOk={handleSaveItem}
        onCancel={() => setItemModalOpen(false)}
        okText="Guardar"
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Uniforme completo" />
          </Form.Item>
          <Form.Item name="description" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="category" label="Categoría">
            <Input placeholder="Uniforme, Distintivo, etc." />
          </Form.Item>
          <Form.Item name="amount" label="Monto" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="exchangeRateTypeId" label="Tipo de Cambio" rules={[{ required: true }]}>
            <Select options={rateTypes.map(t => ({ value: t.id, label: `${t.name} (${t.currency})` }))} />
          </Form.Item>
          <Form.Item name="active" label="Activo" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Enrollment Plan Modal ── */}
      <Modal
        title={editingPlan ? 'Editar Plan' : 'Nuevo Plan'}
        open={planModalOpen}
        onOk={handleSavePlan}
        onCancel={() => setPlanModalOpen(false)}
        okText="Guardar"
        width={700}
      >
        <Form form={planForm} layout="vertical">
          <Form.Item name="name" label="Nombre del Plan" rules={[{ required: true }]}>
            <Input placeholder="Inscripción Básica" />
          </Form.Item>
          <Form.Item name="description" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="targetExchangeRateTypeId" label="Moneda del Total" rules={[{ required: true }]}>
            <Select options={rateTypes.map(t => ({ value: t.id, label: `${t.name} (${t.currency})` }))} />
          </Form.Item>
          <Form.Item
            name="conversionMode"
            label="Modo de conversión"
            rules={[{ required: true }]}
            tooltip="Mismo monto: el número se mantiene, solo cambia la moneda (ej. 165 USD → 165 EUR). Tasa de cambio: convierte a través de VES usando los rates configurados."
          >
            <Select options={[
              { value: 'exchange_rate', label: 'Tasa de cambio (convierte a través de VES)' },
              { value: 'same_amount', label: 'Mismo monto, otra moneda (165 USD → 165 EUR)' },
            ]} />
          </Form.Item>
          <Form.Item name="active" label="Activo" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Divider>Items del Plan</Divider>

          {planItems.map((it, idx) => (
            <Row key={idx} gutter={8} align="middle" style={{ marginBottom: 8 }}>
              <Col span={6}>
                <Select
                  value={it.itemType}
                  onChange={(v) => handlePlanItemChange(idx, 'itemType', v)}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'fee', label: 'Costo Fijo' },
                    { value: 'sellable_item', label: 'Item Vendible' },
                  ]}
                />
              </Col>
              <Col span={10}>
                <Select
                  value={it.itemType === 'fee' ? it.feeId : it.sellableItemId}
                  onChange={(v) => handlePlanItemChange(idx, it.itemType === 'fee' ? 'feeId' : 'sellableItemId', v)}
                  style={{ width: '100%' }}
                  placeholder="Seleccionar..."
                  options={it.itemType === 'fee'
                    ? fees.map(f => ({ value: f.id, label: `${f.name} (${f.schoolPeriod?.period ?? ''})` }))
                    : items.map(i => ({ value: i.id, label: i.name }))
                  }
                />
              </Col>
              <Col span={5}>
                <InputNumber
                  value={it.quantity}
                  onChange={(v) => handlePlanItemChange(idx, 'quantity', v ?? 1)}
                  min={1}
                  style={{ width: '100%' }}
                  placeholder="Cantidad"
                />
              </Col>
              <Col span={3}>
                <Button danger icon={<DeleteOutlined />} onClick={() => handleRemovePlanItem(idx)} />
              </Col>
            </Row>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddPlanItem} block>
            Añadir Item
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default PaymentsConfig;
