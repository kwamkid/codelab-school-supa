// lib/services/payment-transactions.ts

import { PaymentTransaction } from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { adminMutation } from '@/lib/admin-mutation';

interface PaymentTransactionRow {
  id: string;
  enrollment_id: string;
  amount: number;
  method: string;
  transaction_date: string;
  receipt_number: string | null;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
}

function mapToPaymentTransaction(row: PaymentTransactionRow): PaymentTransaction {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    amount: Number(row.amount),
    method: row.method as PaymentTransaction['method'],
    transactionDate: new Date(row.transaction_date),
    receiptNumber: row.receipt_number || undefined,
    note: row.note || undefined,
    recordedBy: row.recorded_by || undefined,
    createdAt: new Date(row.created_at),
  };
}

// Get all transactions for an enrollment
export async function getPaymentTransactions(enrollmentId: string): Promise<PaymentTransaction[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .order('transaction_date', { ascending: true });

    if (error) throw error;
    return (data || []).map((row: any) => mapToPaymentTransaction(row));
  } catch (error) {
    console.error('Error getting payment transactions:', error);
    throw error;
  }
}

// Create a payment transaction + recalculate enrollment payment
export async function createPaymentTransaction(
  data: Omit<PaymentTransaction, 'id' | 'createdAt'>
): Promise<string> {
  try {
    const result = await adminMutation({
      table: 'payment_transactions',
      operation: 'insert',
      data: {
        enrollment_id: data.enrollmentId,
        amount: data.amount,
        method: data.method,
        transaction_date: data.transactionDate.toISOString(),
        receipt_number: data.receiptNumber || null,
        note: data.note || null,
        recorded_by: data.recordedBy || null,
      },
      options: { select: true, single: true },
    });

    // Recalculate enrollment payment status
    await recalculateEnrollmentPayment(data.enrollmentId);

    return result.id;
  } catch (error) {
    console.error('Error creating payment transaction:', error);
    throw error;
  }
}

// Delete a payment transaction + recalculate
export async function deletePaymentTransaction(id: string, enrollmentId: string): Promise<void> {
  try {
    await adminMutation({
      table: 'payment_transactions',
      operation: 'delete',
      match: { id },
    });

    await recalculateEnrollmentPayment(enrollmentId);
  } catch (error) {
    console.error('Error deleting payment transaction:', error);
    throw error;
  }
}

// Recalculate paid_amount and payment_status from transactions
export async function recalculateEnrollmentPayment(enrollmentId: string): Promise<void> {
  try {
    const supabase = getClient();

    // Get all transactions
    const { data: transactions, error: txError } = await supabase
      .from('payment_transactions')
      .select('amount')
      .eq('enrollment_id', enrollmentId);

    if (txError) throw txError;

    const totalPaid = (transactions || []).reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

    // Get enrollment final_price
    const { data: enrollment, error: enrollError } = await supabase
      .from('enrollments')
      .select('final_price')
      .eq('id', enrollmentId)
      .single();

    if (enrollError || !enrollment) throw enrollError || new Error('Enrollment not found');

    const finalPrice = Number((enrollment as any).final_price);
    let paymentStatus: string;

    if (totalPaid >= finalPrice) {
      paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      paymentStatus = 'partial';
    } else {
      paymentStatus = 'pending';
    }

    // Update enrollment
    await adminMutation({
      table: 'enrollments',
      operation: 'update',
      data: {
        paid_amount: totalPaid,
        payment_status: paymentStatus,
        paid_date: totalPaid > 0 ? new Date().toISOString() : null,
      },
      match: { id: enrollmentId },
    });
  } catch (error) {
    console.error('Error recalculating enrollment payment:', error);
    throw error;
  }
}

// Get payment summary for an enrollment
export async function getPaymentSummary(enrollmentId: string): Promise<{
  totalPaid: number;
  remaining: number;
  finalPrice: number;
  status: string;
  transactions: PaymentTransaction[];
}> {
  try {
    const supabase = getClient();

    const [{ data: enrollment, error: enrollError }, transactions] = await Promise.all([
      supabase.from('enrollments').select('final_price, payment_status').eq('id', enrollmentId).single(),
      getPaymentTransactions(enrollmentId),
    ]);

    if (enrollError || !enrollment) throw enrollError || new Error('Enrollment not found');

    const enrollmentData = enrollment as any;
    const finalPrice = Number(enrollmentData.final_price);
    const totalPaid = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    return {
      totalPaid,
      remaining: Math.max(0, finalPrice - totalPaid),
      finalPrice,
      status: enrollmentData.payment_status as string,
      transactions,
    };
  } catch (error) {
    console.error('Error getting payment summary:', error);
    throw error;
  }
}
