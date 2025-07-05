import { forwardRef, useMemo, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { VariantProps } from 'class-variance-authority';
import { useForwardedRef } from '@/lib/use-forwarded-ref';

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

const ColorPicker = forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"button">, 'value' | 'onChange' | 'onBlur'> & ColorPickerProps & React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>
>(
  (
    { disabled, value, onChange, onBlur, name, className, size, ...props },
    forwardedRef
  ) => {
    const ref = useForwardedRef(forwardedRef);
    const [open, setOpen] = useState(false);

    const parsedValue = useMemo(() => {
      return value || '#FFFFFF';
    }, [value]);

    return (
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild disabled={disabled} onBlur={onBlur}>
          <Button
            {...props}
            className={cn('block', className)}
            name={name}
            onClick={() => {
              setOpen(true);
            }}
            size={size}
            style={{
              backgroundColor: parsedValue,
            }}
            variant='outline'
          >
            <div />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-full'>
          <HexColorPicker color={parsedValue} onChange={onChange} />
          <Input
            maxLength={7}
            onChange={(e) => {
              onChange(e?.currentTarget?.value);
            }}
            ref={ref}
            value={parsedValue}
          />
        </PopoverContent>
      </Popover>
    );
  }
);
ColorPicker.displayName = 'ColorPicker';

export { ColorPicker };