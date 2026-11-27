// Warning codes a booking can carry (src/server/cruises/bookings.ts → addAttention), in Greek, as the admin and the
// owner's e-mails show them. Shared by the admin (client) and the e-mail templates (server).

export const ATTENTION_EL: Record<string, string> = {
  over_capacity: 'Πληρώθηκε αφού έληξε ο χρόνος κράτησης και το σκάφος ξεπερνά τη χωρητικότητα: ελέγξτε τις θέσεις.',
  paid_after_departure_cancelled: 'Πληρώθηκε αφού ακυρώθηκε η αναχώρηση: οφείλεται επιστροφή.',
  double_payment: 'Διπλή πληρωμή: επιστρέψτε τη δεύτερη χρέωση από την τράπεζα.',
  payment_amount_mismatch: 'Η τράπεζα ανέφερε διαφορετικό ποσό: ελέγξτε την πληρωμή.',
}

/** The Greek sentences for a stored list of codes ("over_capacity,double_payment"); an unknown code is shown as it is. */
export function attentionTexts(codes: string | string[] | null | undefined): string[] {
  const list = Array.isArray(codes) ? codes : (codes ?? '').split(',')
  return list.map((c) => c.trim()).filter(Boolean).map((c) => ATTENTION_EL[c] ?? c)
}
