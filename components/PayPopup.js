'use client';

// Opens a Grow payment link in a centered popup window.
// Falls back to a normal navigation if the popup is blocked.
export default function PayPopup({ url, className, style, children }) {
  const open = (e) => {
    e.preventDefault();
    const w = 480, h = 760;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    const win = window.open(url, 'grow_pay', `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    if (!win) window.location.href = url;
  };
  return (
    <a href={url} onClick={open} className={className} style={style}>
      {children}
    </a>
  );
}
