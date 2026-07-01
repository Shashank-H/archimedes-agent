import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ChatPage } from '../pages/chat/ChatPage';
import { SettingsPage } from '../pages/settings/SettingsPage';

export function AssistantPaneRouter() {
  return (
    <MemoryRouter initialEntries={["/chat"]}>
      <Routes>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </MemoryRouter>
  );
}
