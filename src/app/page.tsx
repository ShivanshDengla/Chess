import { Page } from '@/components/PageLayout';
import { AuthButton } from '../components/AuthButton';

export default function Home() {
  return (
    <Page>
      <Page.Main className="flex flex-col items-center justify-start pt-4">
        <AuthButton />
      </Page.Main>
    </Page>
  );
}
