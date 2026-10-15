import { ExchangeRateType, Fee, EnrollmentPlan } from '@/models/index';
import { pickEffective, resolveFee, resolveEnrollmentPlan } from '@/services/feeResolverService';
import { createAcademicStructure } from '../helpers/testData';

const window = { billingStartMonth: 9, billingEndMonth: 8 };

describe('pickEffective (pure)', () => {
  const versions = [
    { id: 1, effectiveMonth: 'Sep', amount: 55 },
    { id: 2, effectiveMonth: 'Mar', amount: 65 },
  ];

  it('returns the latest version whose month is <= the requested month (calendar order)', () => {
    expect(pickEffective(versions, 'Sep', window)!.amount).toBe(55);
    expect(pickEffective(versions, 'Jan', window)!.amount).toBe(55);
    expect(pickEffective(versions, 'Feb', window)!.amount).toBe(55);
    expect(pickEffective(versions, 'Mar', window)!.amount).toBe(65);
    expect(pickEffective(versions, 'Aug', window)!.amount).toBe(65);
  });

  it('returns null when no version is effective yet', () => {
    expect(pickEffective([{ id: 2, effectiveMonth: 'Mar' }], 'Oct', window)).toBeNull();
  });

  it('breaks ties on the same month with the highest id', () => {
    const tie = [
      { id: 1, effectiveMonth: 'Mar', amount: 1 },
      { id: 5, effectiveMonth: 'Mar', amount: 5 },
    ];
    expect(pickEffective(tie, 'Apr', window)!.amount).toBe(5);
  });
});

describe('resolveFee / resolveEnrollmentPlan (DB)', () => {
  const setup = async () => {
    const { period } = await createAcademicStructure();
    const type = await ExchangeRateType.create({ code: 'USD_T', name: 'Dólar', currency: 'USD', isDefault: false, active: true } as any);
    return { period, type };
  };

  it('resolves the fee version effective for the month, ignoring inactive ones', async () => {
    const { period, type } = await setup();
    const base = { schoolPeriodId: period.id, key: 'mensualidad' as const, name: 'Mensualidad', exchangeRateTypeId: type.id };
    await Fee.create({ ...base, amount: 55, effectiveMonth: 'Sep' } as any);
    await Fee.create({ ...base, amount: 65, effectiveMonth: 'Mar' } as any);
    await Fee.create({ ...base, amount: 99, effectiveMonth: 'May', active: false } as any);

    expect(Number((await resolveFee(period.id, 'mensualidad', 'Oct'))!.amount)).toBe(55);
    expect(Number((await resolveFee(period.id, 'mensualidad', 'Mar'))!.amount)).toBe(65);
    expect(Number((await resolveFee(period.id, 'mensualidad', 'Jun'))!.amount)).toBe(65);
    expect(await resolveFee(period.id, 'matricula', 'Oct')).toBeNull();
  });

  it('resolves the enrollment plan version effective for the month', async () => {
    const { period, type } = await setup();
    const base = { schoolPeriodId: period.id, targetExchangeRateTypeId: type.id };
    await EnrollmentPlan.create({ ...base, name: 'Plan A', effectiveMonth: 'Sep' } as any);
    await EnrollmentPlan.create({ ...base, name: 'Plan B', effectiveMonth: 'Mar' } as any);

    expect((await resolveEnrollmentPlan(period.id, 'Nov'))!.name).toBe('Plan A');
    expect((await resolveEnrollmentPlan(period.id, 'Apr'))!.name).toBe('Plan B');
  });
});
