/** "Ongoing Research | Public Preview" label, shared by the top bar, home hero and first-visit notice. */
export function PreviewBadge({ className = "" }: { className?: string }) {
  return (
    <span className={"preview-badge " + className}>
      <i className="preview-dot" aria-hidden="true" />
      <span>Ongoing Research</span>
      <span className="preview-sep">|</span>
      <span>Public Preview</span>
    </span>
  );
}
