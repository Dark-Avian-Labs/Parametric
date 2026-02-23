import { Routes, Route, Navigate } from 'react-router-dom';

import { AdminPage } from './components/Auth/AdminPage';
import { LoginPage } from './components/Auth/LoginPage';
import { BuildOverview } from './components/BuildOverview/BuildOverview';
import { Layout } from './components/Layout/Layout';
import { ModBuilder } from './components/ModBuilder/ModBuilder';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/builder" replace />} />
        <Route path="/builder" element={<BuildOverview />} />
        <Route
          path="/builder/new/:equipmentType/:equipmentId"
          element={<ModBuilder />}
        />
        <Route path="/builder/:buildId" element={<ModBuilder />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}
