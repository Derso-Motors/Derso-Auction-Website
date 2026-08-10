'use client';

// Select that submits its parent form as soon as a new value is picked.
export default function AutoSubmitSelect(props) {
  return (
    <select
      {...props}
      onChange={(e) => {
        e.target.disabled = false;
        e.target.form?.requestSubmit();
      }}
    />
  );
}
