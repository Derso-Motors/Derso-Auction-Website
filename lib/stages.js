// Single source of truth for the car release-process stages.
// Must match create_default_stages() in Supabase (migration: new_car_release_stages).
export const STAGES = [
  'העברת 10%',
  'זכות פידיון (7 ימים)',
  'העברת 90%',
  'הזמנת צו העברת בעלות',
  'אישורי משרד הרישוי',
  'משוחרר — בדרך אליך 🚚',
];
