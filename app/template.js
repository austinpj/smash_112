// Re-renders on every page change, so each tab slides in smoothly.
export default function Template({ children }) {
  return <div className="page-enter">{children}</div>;
}
