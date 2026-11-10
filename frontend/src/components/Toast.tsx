import { CheckCircle } from "@phosphor-icons/react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const Ctx = createContext<(msg: string) => void>(() => undefined);
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  const push = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2 print:hidden">
        {items.map((i) => (
          <div key={i.id} className="panel rise pointer-events-auto flex items-center gap-2 px-4 py-3">
            <CheckCircle size={18} className="text-success-ink" aria-hidden />
            <span>{i.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
