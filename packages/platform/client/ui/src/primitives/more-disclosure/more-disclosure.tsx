import {
  type ComponentPropsWithRef,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from 'react';
import { cn } from '../../lib/class-names';
import type { Align, Side } from '../../types';
import { Popover } from '../popover';

export interface MoreDisclosureProps extends Omit<ComponentPropsWithRef<'button'>, 'content'> {
  content: ReactNode;
  side?: Side;
  align?: Align;
  /** Milliseconds a mouse rests on the trigger before it opens; touch and keyboard never wait. */
  openDelay?: number;
}

/** Inline text that opens a popover on click, tap, keyboard focus and a resting mouse. */
export function MoreDisclosure({
  content,
  side = 'block-end',
  align = 'start',
  openDelay = 300,
  className,
  children,
  ...props
}: MoreDisclosureProps) {
  const [open, setOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const openedByHover = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();

  const show = (byHover: boolean) => {
    openedByHover.current = byHover;
    setOpen(true);
  };
  const hide = () => {
    clearTimeout(hoverTimer.current);
    setOpen(false);
  };

  const handleClick = (event: MouseEvent) => {
    event.preventDefault();
    show(false);
  };
  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    if (event.currentTarget.matches(':focus-visible')) show(false);
  };
  const handleBlur = ({ relatedTarget }: FocusEvent) => {
    if (relatedTarget instanceof Node && contentRef.current?.contains(relatedTarget)) return;
    hide();
  };
  const handlePointerEnter = ({ pointerType }: PointerEvent) => {
    if (pointerType !== 'mouse') return;
    hoverTimer.current = setTimeout(() => show(true), openDelay);
  };
  const handlePointerLeave = ({ pointerType }: PointerEvent) => {
    if (pointerType !== 'mouse') return;
    clearTimeout(hoverTimer.current);
    if (openedByHover.current) setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={(next) => (next ? show(false) : hide())}>
      <Popover.Trigger asChild>
        <button
          {...props}
          type="button"
          id={triggerId}
          className={cn(
            'cursor-pointer underline decoration-dotted underline-offset-4 focus-ring',
            className
          )}
          onClick={handleClick}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          {children}
        </button>
      </Popover.Trigger>
      <Popover.Content
        ref={contentRef}
        side={side}
        align={align}
        aria-labelledby={triggerId}
        className="max-h-[min(18rem,var(--radix-popover-content-available-height))] wrap-break-word"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {content}
      </Popover.Content>
    </Popover.Root>
  );
}
