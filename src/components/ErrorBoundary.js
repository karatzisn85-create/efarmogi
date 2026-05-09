import React from 'react';
import styled from 'styled-components';

const ErrorCard = styled.div`
  background: #fff;
  border-radius: 12px;
  padding: 40px;
  max-width: 500px;
  margin: 60px auto;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  border-top: 4px solid #e53935;
`;

const ErrorTitle = styled.h2`
  color: #e53935;
  margin: 0 0 12px;
  font-size: 22px;
`;

const ErrorMsg = styled.p`
  color: #666;
  font-size: 14px;
  margin: 0 0 24px;
  line-height: 1.6;
`;

const RetryBtn = styled.button`
  background: #1a2a3a;
  color: white;
  border: none;
  padding: 12px 32px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: #2c3e50; }
`;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorCard>
          <ErrorTitle>Κάτι πήγε στραβά</ErrorTitle>
          <ErrorMsg>
            Παρουσιάστηκε ένα απροσδόκητο σφάλμα.
            Πατήστε το κουμπί για να δοκιμάσετε ξανά.
          </ErrorMsg>
          <RetryBtn onClick={() => this.setState({ hasError: false, error: null })}>
            Επαναφόρτωση
          </RetryBtn>
        </ErrorCard>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
