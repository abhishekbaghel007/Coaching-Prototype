import type { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & { children: ReactNode; interactive?: boolean };

export default function Card({ children, className = '', interactive = false, ...props }: Props) {
  return <div className={`np-card${interactive ? ' np-card-interactive' : ''} ${className}`.trim()} {...props}>{children}</div>;
}
