import { useAuth } from '../lib/auth';
import { useNotifications, useAction } from '../lib/hooks';
import { Button, Card, EmptyState, SkeletonRows } from '../components/ui/primitives';
import { markRead, markAllRead } from '@/backend';
import { fmtRelative } from '../lib/format';

export default function NotificationsPage() {
  const user = useAuth((s) => s.user)!;
  const { data: items, isLoading } = useNotifications(user.id);
  const readOne = useAction((id: string) => markRead(user.id, id));
  const readAll = useAction<void>(() => markAllRead(user.id));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="display text-xl font-semibold">Activity</h1>
        {items && items.some((n) => !n.read_at) && (
          <Button variant="ghost" onClick={() => readAll.mutate()}>Mark all read</Button>
        )}
      </div>

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : !items?.length ? (
        <Card className="p-6"><EmptyState message="No notifications yet — actions across the studio will show up here." /></Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.read_at && readOne.mutate(n.id)}
              className="flex w-full items-start gap-3 rounded-sm border border-line bg-surface px-4 py-3 text-left hover:border-line2"
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-line2' : 'bg-amber'}`} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{n.title}</span>
                  <span className="mono shrink-0 text-[11px] text-ink-dim">{fmtRelative(n.created_at)}</span>
                </span>
                {n.body && <span className="mt-0.5 block text-sm text-ink-soft">{n.body}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
