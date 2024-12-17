import React from 'https://cdn.skypack.dev/react@19.0.0';
import { cn } from '../../lib/utils.js';

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
));

export { Card }; 