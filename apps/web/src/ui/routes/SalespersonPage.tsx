import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useAction } from '../lib/hooks';
import { Button, Card, Field, Input, Textarea } from '../components/ui/primitives';
import { submitLead } from '@/backend';

const empty = { name: '', company: '', contact_phone: '', contact_email: '', requirements: '', source: '' };

export default function SalespersonPage() {
  const user = useAuth((s) => s.user)!;
  const [form, setForm] = useState({ ...empty });
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = useAction(
    (input: typeof empty) => submitLead(user.id, input),
    { success: 'Lead sent to the admin desk. 🎯' },
  );

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="display text-xl font-semibold">Add a lead</h1>
        <p className="text-sm text-ink-soft">New enquiries you submit go straight to the admin desk.</p>
      </div>

      <Card className="space-y-4 p-6">
        <Field label="Client / contact name">
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Patel Motors" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company (optional)">
            <Input value={form.company} onChange={set('company')} placeholder="Patel Motors Pvt Ltd" />
          </Field>
          <Field label="Source (optional)">
            <Input value={form.source} onChange={set('source')} placeholder="Instagram, referral…" />
          </Field>
          <Field label="Phone (optional)">
            <Input value={form.contact_phone} onChange={set('contact_phone')} placeholder="+91 …" />
          </Field>
          <Field label="Email (optional)">
            <Input value={form.contact_email} onChange={set('contact_email')} placeholder="name@example.com" />
          </Field>
        </div>
        <Field label="What do they need?">
          <Textarea value={form.requirements} onChange={set('requirements')} placeholder="e.g. 60s showroom promo for new SUV launch" />
        </Field>
        <Button
          variant="primary"
          className="w-full"
          disabled={!form.name.trim() || submit.isPending}
          onClick={() => submit.mutate(form, { onSuccess: () => setForm({ ...empty }) })}
        >
          Submit lead
        </Button>
      </Card>
    </div>
  );
}
