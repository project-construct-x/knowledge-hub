import React from 'react';
import { useAuth } from '../auth/useAuth.ts';
import { Database, Lock } from 'lucide-react';

const Login: React.FC = () => {
  const { login } = useAuth();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }} className="animate-fade-in">

        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '52px',
              height: '52px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--green-600), var(--blue-500))',
              marginBottom: '16px',
              boxShadow: '0 8px 24px rgba(37,99,235,0.25)',
            }}
          >
            <Database size={26} color="white" />
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: '4px',
            }}
          >
            Willkommen zurück
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Melden Sie sich an, um fortzufahren
          </p>
        </div>

        {/* Card */}
        <div className="card">
          <div className="card-body">
            <button
              type="button"
              onClick={login}
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              <Lock size={15} />
              Mit Keycloak anmelden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;