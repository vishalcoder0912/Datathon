import { Button } from '@/shared/components/ui/button';

interface StatusPanelProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const StatusPanel = ({ title, message, actionLabel, onAction }: StatusPanelProps) => {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-10">
      <div className="max-w-xl w-full text-left">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-muted-foreground">{message}</p>
        {actionLabel && onAction && (
          <Button onClick={onAction} className="mt-6 rounded-lg">
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
};

export default StatusPanel;