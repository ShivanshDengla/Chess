import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { Providers } from '../../providers/Providers';

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <Providers session={session}>
      <Page>
        {children}
      </Page>
    </Providers>
  );
}
