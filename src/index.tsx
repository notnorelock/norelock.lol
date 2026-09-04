import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import { render } from 'solid-js/web';
import App from '@/app/App';
import { bootStep, initBoot } from '@/lib/boot';
import '@/styles/globals.css';

initBoot();

render(() => <App />, document.getElementById('root')!);

bootStep('app');
