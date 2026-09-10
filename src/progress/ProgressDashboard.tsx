import ProgressFinal from './ProgressFinal';

type Props = {
  demo?: boolean;
  onClose?: () => void;
};

/**
 * Backwards-compatible entry point for the progress dashboard.
 * The previous implementation contained JSX parser-invalid type assertions.
 * Keep existing imports working while using the maintained progress screen.
 */
export default function ProgressDashboard({ demo = false, onClose }: Props) {
  return <ProgressFinal onClose={onClose} website={demo} />;
}
