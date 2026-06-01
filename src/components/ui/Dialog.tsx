// ============================================
// components/ui/Dialog.jsx
// ============================================
// USAGE:
// const [showDialog, setShowDialog] = useState(false);
// const [dialogConfig, setDialogConfig] = useState({});

// <Dialog
//   isOpen={showDialog}
//   onClose={() => setShowDialog(false)}
//   title="Confirm Action"
//   message="Are you sure you want to proceed?"
//   type="confirm" // 'alert', 'confirm', 'warning'
//   confirmText="Yes, proceed"
//   cancelText="Cancel"
//   onConfirm={handleConfirm}
// />

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

const Dialog = ({
  isOpen,
  onClose,
  title,
  message,
  type = "alert", // 'alert', 'confirm', 'warning', 'error'
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  showCancel = true,
  extraButtonText,
  onExtraButton,
}: any) => {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case "warning":
        return (
          <svg
            className='w-12 h-12 text-accent mx-auto mb-4'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
            />
          </svg>
        );
      case "error":
        return (
          <svg
            className='w-12 h-12 text-danger mx-auto mb-4'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
        );
      case "confirm":
        return (
          <svg
            className='w-12 h-12 text-primary mx-auto mb-4'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
        );
      default:
        return (
          <svg
            className='w-12 h-12 text-success mx-auto mb-4'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
        );
    }
  };

  const getConfirmVariant = () => {
    switch (type) {
      case "warning":
      case "error":
        return "danger";
      default:
        return "success";
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size='sm'
      closeOnOverlayClick={false}
      showCloseButton={false}
      footer={null}
    >
      <div className='text-center'>
        {getIcon()}
        <p className='text-sm text-text whitespace-pre-line mb-6'>{message}</p>
        <div className='flex gap-2 justify-center'>
          {showCancel && type !== "alert" && (
            <Button
              variant='outline'
              onClick={handleCancel}
              className='min-w-[100px]'
            >
              {cancelText}
            </Button>
          )}
          {extraButtonText && onExtraButton && (
            <Button
              variant='outline'
              onClick={() => {
                onExtraButton();
                onClose();
              }}
              className='min-w-[100px]'
            >
              {extraButtonText}
            </Button>
          )}
          <Button
            variant={getConfirmVariant()}
            onClick={handleConfirm}
            className='min-w-[100px]'
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default Dialog;
