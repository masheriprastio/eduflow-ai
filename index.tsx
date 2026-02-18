import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Simple Error Boundary to catch render errors (White Screen of Death)
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
            minHeight: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            backgroundColor: '#f8fafc', 
            fontFamily: 'sans-serif',
            padding: 20
        }}>
          <div style={{
              maxWidth: 600, 
              width: '100%', 
              backgroundColor: 'white', 
              padding: 40, 
              borderRadius: 16, 
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}>
            <h1 style={{color: '#dc2626', fontSize: 24, marginBottom: 10, fontWeight: 'bold'}}>Terjadi Kesalahan (Application Error)</h1>
            <p style={{color: '#475569', marginBottom: 20}}>Aplikasi mengalami error saat memuat. Kemungkinan konfigurasi Environment Variables belum terbaca atau format salah.</p>
            
            <div style={{
                backgroundColor: '#f1f5f9', 
                padding: 15, 
                borderRadius: 8, 
                overflowX: 'auto',
                border: '1px solid #e2e8f0',
                marginBottom: 20
            }}>
              <code style={{color: '#ef4444', fontSize: 14}}>
                {this.state.error?.toString()}
              </code>
            </div>

            <button 
                onClick={() => window.location.reload()}
                style={{
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}
            >
                Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);