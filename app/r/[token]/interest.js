'use client';

import { useState } from 'react';
import { createClient } from '../../../lib/supabase-client';

export default function InterestButtons({ token, carId, current }) {
  const [interest, setInterest] = useState(current);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function mark(value) {
    setSaving(true);
    setSaveError('');
    const supabase = createClient();
    const { error } = await supabase.rpc('set_interest_by_token', { p_token: token, p_car_id: carId, p_interest: value });
    if (error) {
      setSaveError('השמירה נכשלה — נסו שוב או פנו אלינו');
    } else {
      setInterest(value);
    }
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
      {saveError ? <span style={{ color: '#f87171', fontSize: 13 }}>{saveError}</span>
        : interest && <span className="muted">הבחירה נשמרה</span>}
    </div>
  );
}
