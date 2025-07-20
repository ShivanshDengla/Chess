import { Page } from '@/components/PageLayout';
import { LoadingScreen } from '../components/LoadingScreen';

export default function Home() {
  return (
    <Page>
      <Page.Main className="flex flex-col items-center justify-start pt-4">
        <LoadingScreen />
      </Page.Main>
    </Page>
  );
}
