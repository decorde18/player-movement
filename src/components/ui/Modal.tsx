/**
 * Modal Component - Uses Global Theme Variables
 *
 * @example
 * // Basic modal with title and content
 * const [isOpen, setIsOpen] = useState(false);
 * <Modal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Confirm Action"
 *   size="md"
 * >
 *   <p>Are you sure you want to proceed?</p>
 * </Modal>
 *
 * @example
 * // Modal with footer buttons
 * <Modal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Delete Item"
 *   size="sm"
 *   footer={
 *     <>
 *       <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
 *       <Button variant="danger" onClick={handleDelete}>Delete</Button>
 *     </>
 *   }
 * >
 *   <p>This action cannot be undone.</p>
 * </Modal>
 */

"use client";
// ============================================
// components/ui/Modal.jsx
// ============================================

import { cn } from "@/lib/utils";
import { useEffect } from "react";
import Button from "@/components/ui/Button";

// ============================================
// MODAL CONFIGURATION
// ============================================
const modalSizes: Record<string, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[95vw]",
};

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  overlayClassName?: string;
}

const Modal = ({
  isOpen,
  onClose,
  size = "md",
  title,
  children,
  footer,
  closeOnOverlayClick = true,
  showCloseButton = true,
  className = "",
  headerClassName = "",
  bodyClassName = "",
  footerClassName = "",
  overlayClassName = "",
}: ModalProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={cn("modal-overlay p-4 backdrop-blur-sm", overlayClassName)}
      onClick={() => closeOnOverlayClick && onClose()}
    >
      <div
        className={cn(
          "relative bg-surface rounded-xl shadow-xl max-h-[90vh] overflow-y-auto w-full",
          modalSizes[size],
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div
            className={cn(
              "flex items-center justify-between px-6 py-4 border-b border-border",
              headerClassName,
            )}
          >
            {title && (
              <h3 className='text-xl font-semibold text-text pr-8'>{title}</h3>
            )}
            {showCloseButton && (
              <>
                {/* Use shared Button for consistent UI */}
                <Button
                  onClick={onClose}
                  variant='outline'
                  size='xs'
                  className='absolute top-4 right-4 text-muted hover:text-text transition-colors duration-200 w-8 h-8 flex items-center justify-center rounded-full p-0'
                  aria-label='Close modal'
                >
                  <span className='text-xl leading-none'>×</span>
                </Button>
              </>
            )}
          </div>
        )}

        <div className={cn("px-6 py-4 text-text", bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div
            className={cn(
              "px-6 py-4 border-t border-border flex justify-end gap-2",
              footerClassName,
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
