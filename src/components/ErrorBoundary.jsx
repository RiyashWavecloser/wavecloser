/**
 * src/components/ErrorBoundary.jsx
 *
 * React error boundary — catches any render-time JS errors inside a subtree
 * and shows a friendly recovery UI instead of a blank/crashed page.
 */
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 24px',
          textAlign: 'center',
          background: '#FDF0F0',
          borderRadius: 12,
          border: '1px solid #D44A4A',
          margin: 24,
          fontFamily: "'Inter', sans-serif",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#D44A4A', marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
            {this.state.error?.message || 'An unexpected error occurred in this section.'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: '#1F4E79',
              color: 'white',
              border: 'none',
              padding: '10px 24px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
