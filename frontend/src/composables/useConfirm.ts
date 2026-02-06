import { ref } from 'vue';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
  reject: (value: boolean) => void;
}

const confirmState = ref<ConfirmState | null>(null);

export const useConfirm = () => {
  const confirm = (options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      // Если передан только текст, используем его как message
      const opts: ConfirmOptions = typeof options === 'string' 
        ? { message: options }
        : options;

      confirmState.value = {
        title: opts.title,
        message: opts.message,
        confirmText: opts.confirmText || 'Подтвердить',
        cancelText: opts.cancelText || 'Отмена',
        resolve,
        reject
      };
    });
  };

  const resolveConfirm = (value: boolean): void => {
    if (confirmState.value) {
      confirmState.value.resolve(value);
      confirmState.value = null;
    }
  };

  const rejectConfirm = (value: boolean): void => {
    if (confirmState.value) {
      confirmState.value.reject(value);
      confirmState.value = null;
    }
  };

  return {
    confirmState,
    confirm,
    resolveConfirm,
    rejectConfirm
  };
};
