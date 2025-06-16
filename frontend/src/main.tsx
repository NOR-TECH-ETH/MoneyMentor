import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from './components/ChatWidget';
import './styles/ChatWidget.css';

// Development demo app
function DemoApp() {
  const [backendStatus, setBackendStatus] = React.useState('❌ Not Connected');
  const [calcStatus, setCalcStatus] = React.useState('❌ Not Connected');

  React.useEffect(() => {
    // Check backend status
    fetch('http://localhost:8000/health')
      .then(() => setBackendStatus('✅ Connected'))
      .catch(() => setBackendStatus('❌ Not Connected'));

    // Check calc service status
    fetch('http://localhost:3001/health')
      .then(() => setCalcStatus('✅ Connected'))
      .catch(() => setCalcStatus('❌ Not Connected'));
  }, []);

  React.useEffect(() => {
    // Update status indicators in the HTML
    const backendEl = document.getElementById('backend-status');
    const calcEl = document.getElementById('calc-status');
    
    if (backendEl) {
      backendEl.textContent = backendStatus;
      backendEl.className = `status-indicator ${backendStatus.includes('✅') ? 'status-running' : 'status-error'}`;
    }
    
    if (calcEl) {
      calcEl.textContent = calcStatus;
      calcEl.className = `status-indicator ${calcStatus.includes('✅') ? 'status-running' : 'status-error'}`;
    }
  }, [backendStatus, calcStatus]);

  return (
    <ChatWidget
      apiUrl="http://localhost:8000"
      position="bottom-right"
      theme="light"
    />
  );
}

// Render the demo app as bottom-right widget
const body = document.body;
const widgetContainer = document.createElement('div');
widgetContainer.id = 'money-mentor-widget';
body.appendChild(widgetContainer);

const root = createRoot(widgetContainer);
root.render(<DemoApp />);

// Also export the original functionality for library usage
export { ChatWidget } from './components/ChatWidget';

// Widget initialization function for embedding
export function initMoneyMentorWidget(config?: {
  apiUrl?: string;
  position?: 'bottom-right' | 'bottom-left' | 'fullscreen';
  theme?: 'light' | 'dark';
  containerId?: string;
}) {
  const {
    apiUrl = 'http://localhost:8000',
    position = 'bottom-right',
    theme = 'light',
    containerId = 'money-mentor-widget'
  } = config || {};

  // Create container if it doesn't exist
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }

  // Render the widget
  const root = createRoot(container);
  root.render(
    <ChatWidget
      apiUrl={apiUrl}
      position={position}
      theme={theme}
    />
  );

  return {
    destroy: () => {
      root.unmount();
      container?.remove();
    }
  };
}

// Global for script tag usage
if (typeof window !== 'undefined') {
  (window as any).MoneyMentor = {
    init: initMoneyMentorWidget
  };
} 