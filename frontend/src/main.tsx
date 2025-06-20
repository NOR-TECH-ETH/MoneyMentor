import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from './components/ChatWidget';
import './styles/ChatWidget.css';

// Development demo app
function DemoApp() {
  console.log('DemoApp rendering...'); // Debug log

  return (
    <ChatWidget
      apiUrl="http://localhost:3000"
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
    apiUrl = 'http://localhost:3000',
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