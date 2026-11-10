import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import { WakeGate } from "./components/WakeGate";
import Projects from "./pages/Projects";
import Workspace from "./pages/Workspace";

export default function App() {
  return (
    <ToastProvider>
      <WakeGate>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/app" element={<Projects />} />
            <Route path="/app/p/:id" element={<Workspace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </BrowserRouter>
      </WakeGate>
    </ToastProvider>
  );
}
