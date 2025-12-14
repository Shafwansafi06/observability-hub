/**
 * Time Range Selector Component
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

export type TimeRangeOption = 'all' | '1h' | '24h';

interface TimeRangeSelectorProps {
  selected: TimeRangeOption;
  onChange: (range: TimeRangeOption) => void;
}

export function TimeRangeSelector({ selected, onChange }: TimeRangeSelectorProps) {
  const options: Array<{ value: TimeRangeOption; label: string }> = [
    { value: '1h', label: '1 Hour' },
    { value: '24h', label: '24 Hours' },
    { value: 'all', label: 'From Beginning' },
  ];

  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-1 p-1 rounded-lg border bg-muted/30">
        {options.map((option) => (
          <Button
            key={option.value}
            variant={selected === option.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChange(option.value)}
            className="h-7 text-xs"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
