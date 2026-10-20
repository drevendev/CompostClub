import { createRoot } from 'react-dom/client';
import { Component, type ReactNode } from 'react';
import App from './App';
class FatalBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  override state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  override render() {
    return this.state.error ? (
      <main style={{ padding: 40, fontFamily: 'system-ui' }}>
        <h1>The garden needs a moment.</h1>
        <p>Your stored garden has not been deleted. Reload to reopen it.</p>
        <button onClick={() => location.reload()}>Reload garden</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const root = document.getElementById('root');
if (!root) throw new Error('The app root is missing.');
createRoot(root).render(
  <FatalBoundary>
    <App />
  </FatalBoundary>,
);
