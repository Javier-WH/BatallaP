import React, { useState } from 'react';
import { Alert, Card, Switch, Table, Tag, message } from 'antd';
import { useSchool } from '@/context/SchoolContext';
import { updateParSettlement } from '@/services/paymentsService';

/**
 * Per school period: do dollars (USD or USDT) settle EUR debts 1:1?
 * Example with the switch on: a 40 EUR debt is settled by $40 — in cash, Zelle,
 * Zinli or USDT — instead of ~$35 by the exchange rate. Bolívares are always
 * converted at the rate of the payment date.
 */
const ParSettlementCard: React.FC = () => {
  const { allPeriods, refreshSettings } = useSchool();
  const [saving, setSaving] = useState<number | null>(null);

  const periods = allPeriods.filter((p: any) => p.status !== 'externo');

  const toggle = async (p: any, value: boolean) => {
    setSaving(p.id);
    try {
      await updateParSettlement(p.id, value);
      message.success(value
        ? `${p.period}: los dólares ahora saldan las deudas en EUR a la par`
        : `${p.period}: los dólares se convierten por tasa`);
      await refreshSettings();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error al guardar la configuración');
    } finally {
      setSaving(null);
    }
  };

  const columns = [
    {
      title: 'Período',
      key: 'period',
      render: (_: any, p: any) => (
        <span>{p.period} {p.status === 'activo' && <Tag color="green">Activo</Tag>}</span>
      ),
    },
    {
      title: 'Dólares a la par con el EUR',
      key: 'usdAtPar',
      width: 260,
      render: (_: any, p: any) => (
        <Switch
          checked={!!p.usdAtPar}
          loading={saving === p.id}
          checkedChildren="A la par"
          unCheckedChildren="Por tasa"
          onChange={(v) => toggle(p, v)}
        />
      ),
    },
  ];

  return (
    <Card title="Pagos en dólares contra deudas en euros">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Cómo funciona"
        description={
          <>
            Con <b>A la par</b>, un pago en <b>USD o USDT</b> (efectivo, Zelle, Zinli, Binance, Bybit, OKX…) salda una deuda
            en <b>EUR</b> a su valor nominal: <b>$40 saldan 40 EUR</b>. Los pagos en <b>bolívares</b> (efectivo o digital)
            siempre se convierten a la tasa de la fecha del pago. Con <b>Por tasa</b>, los dólares también se convierten
            por tasa. Aplica a los pagos que se registren desde ahora; los anteriores no cambian.
          </>
        }
      />
      <Table columns={columns} dataSource={periods} rowKey="id" pagination={false} size="small" />
    </Card>
  );
};

export default ParSettlementCard;
