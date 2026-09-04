export default function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="np-logo"><span className="np-logo-mark">N</span>{!compact && <span className="np-logo-name">NEETPrep</span>}</div>;
}
