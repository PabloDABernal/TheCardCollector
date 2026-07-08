import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { HomeScreen } from './screens/HomeScreen';
import { RunStartScreen } from './screens/RunStartScreen';
import { CombatScreen } from './screens/CombatScreen';

const router = createBrowserRouter(
  [
    { path: '/', element: <HomeScreen /> },
    { path: '/run-start', element: <RunStartScreen /> },
    { path: '/combat', element: <CombatScreen /> }
  ],
  { basename: import.meta.env.BASE_URL }
);

export function App(): JSX.Element {
  return <RouterProvider router={router} />;
}
