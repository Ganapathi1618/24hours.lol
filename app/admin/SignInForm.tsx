'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { signIn } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-3 w-full rounded bg-accent px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? 'Checking…' : 'Sign in'}
    </button>
  );
}

export function SignInForm() {
  const [error, formAction] = useFormState(signIn, null);

  return (
    <form action={formAction} className="w-full max-w-xs">
      <label htmlFor="password" className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
        Admin password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="mt-1.5 w-full rounded border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-accent"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-livered">
          {error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
