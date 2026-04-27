'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';

export function Nav() {
  const { user, ready, logout } = useAuth();
  const path = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    path === href || (href !== '/' && path.startsWith(href));

  const onLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <nav className="nav">
      <Link href="/" className="brand">Pet Adoption Board</Link>
      <Link href="/pets" className={`nav-link ${isActive('/pets') ? 'active' : ''}`}>Browse</Link>
      {user && (
        <Link href="/applications" className={`nav-link ${isActive('/applications') ? 'active' : ''}`}>
          My applications
        </Link>
      )}
      {user?.role === 'staff' && (
        <Link href="/staff" className={`nav-link ${isActive('/staff') ? 'active' : ''}`}>
          Staff
        </Link>
      )}
      <span className="spacer" />
      {!ready ? null : user ? (
        <>
          <span className="muted">Hi, {user.name}</span>
          <button className="ghost" onClick={onLogout}>Log out</button>
        </>
      ) : (
        <>
          <Link href="/login" className="nav-link">Log in</Link>
          <Link href="/register" className="nav-link">Sign up</Link>
        </>
      )}
    </nav>
  );
}
