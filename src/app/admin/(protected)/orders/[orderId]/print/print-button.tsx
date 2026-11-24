"use client";

export function PrintButton() {
  return (
    <button className="admin-button admin-button-secondary" type="button" onClick={() => window.print()}>
      Print
    </button>
  );
}
