'use client';

import { useState } from 'react';
import { createClient } from '../../../lib/supabase-client';

export default function InterestButtons({ token, carId, current }) {
  const [interest, setInterest] = useState(current);
  const [saving, setSaving] = useState(false);

  async function mark(value) {
    setSaving(true);
    const supabase = createClient();
    await supabase.rpc('set_interest_by_token', { p_token: token, p_car_id: carId, p_interest: value });
    setInterest(value);
    setSaving(false);
  }

  return (
    <div className="row">
      <button
        className={`btn small ${interest === 'interested' ? 'success' : 'secondary'}`}
        onClick={() => mark('interested')}
        disabled={saving}
      >
        מעניין אותי
      </button>
      <button
        className={`btn small ${interest === 'not_interested' ? 'danger-outline' : 'secondary'}`}
        onClick={() => mark('not_interested')}
        disabled={saving}
      >
        לא רלוונטי
      </button>
      {interest && <span className="muted">הבחירה נשמרה</span>}
    </div>
  );
}
