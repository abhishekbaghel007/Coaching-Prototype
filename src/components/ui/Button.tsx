import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

export default function Button({ children, variant = 'primary', size = 'md', className = '', ...props }: Props) {
  return <button className={`np-button np-button-${variant} np-button-${size} ${className}`.trim()} {...props}>{children}</button>;
}
