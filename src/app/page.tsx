import { Page } from '@/components/PageLayout';
import { AuthButton } from '../components/AuthButton';
import { LoadingScreen } from '../components/LoadingScreen';

export default function Home() {
  return (
    <Page>
      <Page.Main className="flex flex-col items-center justify-start pt-4">
        <LoadingScreen />
        <AuthButton />
      </Page.Main>
    </Page>
  );
}
