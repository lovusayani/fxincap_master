type Toast = {
  id: string;
  title?: string;
  description?: string;
};

type ToastInput = Omit<Toast, "id">;

const globalToasts: Toast[] = [];

export function useToast() {
  const toast = (_t: ToastInput) => {
    // Minimal fallback implementation used for recovery mode.
  };

  const dismiss = (_id?: string) => {
    // Minimal fallback implementation used for recovery mode.
  };

  return {
    toasts: globalToasts,
    toast,
    dismiss,
  };
}
