import { Expense, ExpenseCategory, EXPENSE_CATEGORIES, Settlement } from '../types/travel';

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const expenseCategory = (e: Expense): ExpenseCategory =>
  EXPENSE_CATEGORIES.some((c) => c.id === e.category) ? (e.category as ExpenseCategory) : 'Altro';

export interface Balance {
  total: number;
  paidByMe: number;
  paidByPartner: number;
  /** > 0: il partner deve a me; < 0: io devo al partner; 0: pari */
  net: number;
}

// Saldo_A = Σ spese pagate da A − Σ spese totali / 2, corretto dai conguagli già registrati.
export const computeBalance = (
  expenses: Expense[],
  settlements: Settlement[],
  userId: string
): Balance => {
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const paidByMe = expenses.filter((e) => e.paid_by === userId).reduce((s, e) => s + Number(e.amount), 0);
  const sentByMe = settlements.filter((s) => s.from_user_id === userId).reduce((s, x) => s + Number(x.amount), 0);
  const receivedByMe = settlements.filter((s) => s.to_user_id === userId).reduce((s, x) => s + Number(x.amount), 0);

  let net = round2(paidByMe - total / 2 + sentByMe - receivedByMe);
  if (Math.abs(net) < 0.005) net = 0;
  return { total: round2(total), paidByMe: round2(paidByMe), paidByPartner: round2(total - paidByMe), net };
};

export interface CategoryTotal {
  category: ExpenseCategory;
  emoji: string;
  color: string;
  total: number;
  pct: number;
}

export const categoryTotals = (expenses: Expense[]): CategoryTotal[] => {
  const sums: { [k: string]: number } = {};
  expenses.forEach((e) => {
    const c = expenseCategory(e);
    sums[c] = (sums[c] || 0) + Number(e.amount);
  });
  const grand = Object.values(sums).reduce((a, b) => a + b, 0);
  return EXPENSE_CATEGORIES.filter((c) => sums[c.id] > 0).map((c) => ({
    category: c.id,
    emoji: c.emoji,
    color: c.color,
    total: round2(sums[c.id]),
    pct: grand > 0 ? (sums[c.id] / grand) * 100 : 0,
  }));
};
